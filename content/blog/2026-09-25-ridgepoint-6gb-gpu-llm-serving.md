---
title: What a 6 GB GPU Forces You to Learn About LLM Serving
date: 2026-09-25
slug: ridgepoint-6gb-gpu-llm-serving
category: Inference
type: Design note
summary: Ridgepoint is a from-scratch inference-engine experiment where every optimization has to justify itself in memory, latency, throughput, correctness and measurement.
tags: LLM serving, Inference, KV cache, Scheduling, GPU memory
math: true
---

> [!NOTE] Sources
> Based on the [Ridgepoint lab notebook](/notes/files/ridgepoint-lab-notebook.pdf) (75-page PDF, also in [Notes](/notes)) and the [Ridgepoint repository](https://github.com/SoubhagyaJain/ridgepoint). Unless a number is described as a measurement, it is an estimate from first principles.

A 6 GB laptop GPU sounds like the wrong place to study LLM serving.

That is exactly why I want to use one.

Qwen2.5-1.5B in BF16 consumes roughly 3.1 GB just for weights. On an RTX 4050 Laptop GPU, that leaves only about 1.5–2 GB for the KV cache after accounting for runtime memory, activations, and safety margin. Memory bandwidth is also limited: the notebook estimates roughly 192 GB/s from the card’s GDDR6 configuration.

On a larger GPU, inefficient decisions can hide behind capacity. Here they become difficult to ignore.

A wasteful KV layout reduces concurrency. A long prefill can stall every active stream. A poorly chosen batching policy damages tail latency. A hidden CPU synchronization point leaves the GPU waiting. Keeping cached prefixes around may save compute while consuming the memory needed to admit another request.

That is the idea behind **Ridgepoint**, a single-GPU LLM inference engine I am designing from the scheduler down in PyTorch: paged KV storage, continuous batching, chunked prefill, prefix caching, admission control, and eventually CUDA graphs or quantization depending on what profiling says is actually limiting the engine.

There is an important caveat before going any further.

**The numbers in this article are engineering estimates and hypotheses unless explicitly described as measurements.** The project notebook deliberately leaves benchmark tables blank. Its rule is that estimates from spec sheets must eventually be replaced by measurements.

That distinction is central to the project.

I am not trying to build a smaller vLLM and then announce that it is fast.

I am trying to understand *why* an inference engine behaves the way it does.

---

## The interesting part is not generating tokens

At first glance, LLM inference looks deceptively simple:

```text
prompt → model → next token → repeat
```

But serving even one decoder-only model contains two computational regimes with very different behavior.

### Prefill

During prefill, the model processes the input prompt.

If there are $P$ prompt tokens, large weight matrices operate on relatively wide activation matrices. As $P$ grows, arithmetic intensity grows too. The notebook models the dominant model computation roughly as:

$$
\text{FLOPs} \approx 2NP
$$

for $N$ parameters and $P$ prompt tokens, ignoring the additional attention term.

Long prefills can therefore become compute-bound.

### Decode

Decode looks different.

Once generation begins, each active sequence usually contributes only one new token per decoding iteration. The model still has to use almost all of its weights to produce that token.

So instead of asking:

> How much arithmetic can the GPU perform?

the important question becomes:

> How many bytes have to cross memory before the next token can exist?

For practical batch sizes on this GPU, the notebook expects decode to be primarily memory-bandwidth-bound.

That distinction changes almost every optimization that follows.

![A roofline: a sloped memory-bandwidth ceiling meets a flat compute ceiling at the ridge point. Decode points at batch 1, 4 and 16 stay on the slope; prefill points move right toward the roof as the prompt grows.](images/ridgepoint/f1-roofline.svg "Two regimes under one roof. Decode stays on the bandwidth slope; prefill climbs toward the compute roof as the prompt grows. Qualitative positions, not measurements.")
---

## Start with the bandwidth floor, not `nvidia-smi`

The BF16 weights for Qwen2.5-1.5B are approximately 3.1 GB.

If the GPU can sustain 192 GB/s of memory bandwidth, then a crude lower bound for batch-1 decode is:

$$
\frac{3.1\text{ GB}}{192\text{ GB/s}}
\approx 16\text{ ms/token}
$$

or about:

$$
62\text{ tokens/s}
$$

That is not a benchmark.

It is a physical estimate.

The measured number will be worse because the engine has additional work: KV reads, kernel launches, sampling, framework overhead, host work, synchronization, and imperfect utilization. But the estimate gives the measurement something to be compared against.

This is more useful than seeing “95% GPU utilization.”

A GPU can report high utilization simply because a kernel is executing most of the time. That does not tell me whether I am getting anywhere close to the useful bandwidth or compute ceiling of the device.

The more useful question is:

> If physics suggests this step could take 16 ms, why did mine take 24 ms?

Now there is something to investigate.

The notebook reduces that idea to a simple first-order decode model:

$$
t_\text{step}
\approx
\alpha +
\frac{W + \sum_i KV_\text{bytes}(ctx_i)}
{BW}
$$

where $W$ is the model weight traffic, $BW$ is effective memory bandwidth, and $\alpha$ captures costs such as launches, host work, and sampling.

The equation is deliberately simple.

Its purpose is not to perfectly simulate a GPU. Its purpose is to tell me when reality departs from the model strongly enough that I should investigate why.

---

## The scheduler is where the system becomes interesting

The full engine can be mentally reduced to one loop.

At each iteration it:

1. accepts new requests and aborts,
2. asks the scheduler what should run,
3. constructs the model inputs,
4. performs one GPU step,
5. retrieves sampled token IDs,
6. updates request and KV state,
7. sends outputs,
8. records what happened.

The notebook intentionally gives only one thread authority to mutate scheduler and KV-cache state. That removes an entire category of synchronization bugs by construction. New requests and aborts are applied at step boundaries rather than asynchronously modifying engine state.

The frontend has a different responsibility. It owns HTTP, validation, tokenization, detokenization, streaming and disconnect detection, but no GPU state. Messages crossing into the engine contain token IDs rather than text.

![Client to frontend to IPC carrying token IDs, into an engine process that owns the GPU and contains the scheduler, KV cache manager, input builder, model runner, output processor and telemetry.](images/ridgepoint/f2-architecture.svg "The frontend owns text and HTTP; one engine thread owns the GPU and every piece of scheduler and KV state."){full}
That division matters because most interesting serving decisions happen at every iteration:

- Which sequences decode now?
- Is there enough memory to admit another prompt?
- How many tokens of that prompt should be prefetched?
- Should an inactive cached prefix be evicted?
- If memory is exhausted, which sequence should be preempted?
- Can adding this prompt still keep current streams inside their latency target?

An inference engine is therefore not simply a faster forward pass.

It is a resource allocator that happens to execute a transformer.

---

## The optimization order matters more than the optimization list

It would be easy to implement every feature I associate with modern serving systems and produce a README containing all the right words:

`continuous batching`, `PagedAttention`, `prefix caching`, `CUDA graphs`, `quantization`.

That would teach less than implementing them in the wrong order and discovering *why* they fail.

Ridgepoint is instead planned as eight configurations of the same codebase:

Table: Eight configurations of one codebase, in the planned order.
| Version | Change | Bottleneck it is meant to expose or attack | Price paid |
|---|---|---|---|
| V0 | Serialized Hugging Face baseline | Establish ground truth | Deliberately slow |
| V1 | Own runtime + request batching | Repeated weight traffic | Padding, waiting, head-of-line blocking |
| V2 | Continuous batching | Output-length variance | Prefill can stall decodes |
| V3 | Paged KV + admission + preemption | KV fragmentation and overload | Indirection, rejection, recomputation |
| V4 | Prefix caching | Repeated prompt computation | Cache memory competes with concurrency |
| V5 | Chunked prefill | Prefill/decode interference | Longer TTFT for large prompts |
| V6 | CUDA graphs + persistent buffers | Host/launch overhead | Rigid shapes, memory, startup cost |
| V7 | Weight/KV quantization | Memory traffic and capacity | Accuracy and dequantization costs |

The important word in that table is not **change**.

It is **price**.

The notebook uses one rule throughout:

> isolate the bottleneck → predict the gain → measure it → write down what it cost.

Failed hypotheses stay in the record.

That gives the project a causal story rather than a feature checklist.

---

## Batching fixes one problem by creating another

Suppose batch-1 decode has to stream roughly 3.1 GB of weights to generate one token.

Now suppose 16 sequences decode together.

The same weights can participate in computations for all 16 sequences during the step. Weight traffic is amortized across the batch.

That is why batching can dramatically increase aggregate output throughput before step time increases proportionally.

But traditional request-level batching has an awkward property: the batch survives until its longest request finishes.

Imagine output lengths like:

```text
Request A:  40 tokens
Request B:  65 tokens
Request C: 410 tokens
Request D:  52 tokens
```

A, B and D finish early, but their batch slots remain trapped behind C.

That is head-of-line blocking.

Continuous batching changes the scheduling unit from the request to the **iteration**. Finished sequences leave immediately. New ones can enter on the next iteration. The batch becomes a changing set rather than a fixed group.

But continuous batching reveals the next problem.

A decoding request may need only one token of model work in a step.

A newly admitted request might need a 2,000-token prefill.

Run that prefill as one large operation and all existing streams wait behind it.

The scheduler has removed one form of head-of-line blocking and created another.

That is the pattern I want the project to expose repeatedly:

**An optimization usually moves the bottleneck. It rarely deletes it.**

---

## KV memory turns scheduling into memory management

The key-value cache stores the attention K and V vectors for previous positions so that they do not have to be recomputed during autoregressive generation.

Its size per token can be derived directly from the model configuration:

$$
KV_\text{token}
=
2 \times L \times H_{kv} \times D \times \text{bytes/element}
$$

The leading 2 represents K and V.

For Qwen2.5-1.5B, the notebook derives:

$$
2 \times 28 \times 2 \times 128 \times 2
=
28{,}672\text{ bytes}
\approx 28\text{ KiB/token}
$$

Qwen3-1.7B, despite having a fairly similar weight footprint, is estimated at approximately **112 KiB per token** because of its larger KV-head count.

That is a 4× difference in KV footprint.

![Tokens of context that fit in 1 GiB of KV cache: about 37,449 for Qwen2.5-1.5B at 28 KiB per token, and about 9,362 for Qwen3-1.7B at 112 KiB per token.](images/ridgepoint/f3-kv-capacity.svg "Same VRAM, different concurrency: derived from each model's KV bytes per token, not measured.")
This is one reason model size alone is a poor predictor of serving capacity.

Two models with similar parameter counts can behave very differently once dozens of sequences carry growing contexts.

And a naive KV allocation scheme makes matters worse.

If every request receives one contiguous region sized for `max_model_len`, most of that memory remains unused for shorter sequences. Paging instead allocates smaller physical blocks as contexts grow, limiting internal waste to roughly the unfinished portion of a block rather than the difference between actual context length and the maximum configured sequence length.

Now the scheduler needs block tables, a block allocator, reference counts, eviction and preemption.

This is where “model inference” starts looking suspiciously like an operating system.

---

## Prefix caching makes the trade-off even sharper

Many real prompts contain repeated text:

- system instructions,
- few-shot examples,
- application templates,
- multi-turn conversation history.

Recomputing the same prefix wastes prefill compute.

Ridgepoint's proposed cache identifies full blocks through chained hashes. The KV manager can map a hash derived from the previous prefix hash and the block's token IDs to an existing physical block. Shared blocks increase their reference count; unused cached blocks become candidates for LRU eviction.

On admission, the scheduler searches for the longest chain of cached prompt blocks. Those blocks can be shared rather than recomputed, while the uncached suffix still requires prefill.

Conceptually, that sounds like a straightforward win.

It is not.

Every cached block occupying VRAM is a block that cannot simultaneously hold a live request's KV.

So there should be traffic patterns where caching improves TTFT but decreases the number of concurrent requests the engine can hold.

That is precisely the kind of result I want to preserve rather than hide.

“Prefix caching improved latency” is incomplete.

The interesting result would be something like:

> At this prefix reuse distribution and memory pressure, caching saved this much prefill work while costing this much concurrency.

![Two sequences whose block tables share blocks b3 and b7 with refcount 2, beside the block lifecycle: free, live, shared, evictable when the last user leaves, and reclaimed by LRU eviction; a cache hit can revive an evictable block.](images/ridgepoint/f4-kv-lifecycle.svg "A KV block's life. The shared prefix saves prefill; the evictable cache costs capacity.")
---

## Chunking turns latency into a scheduling dial

The notebook estimates that a 2,000-token prefill can take roughly 0.4 seconds at an assumed 15 TFLOP/s. Even before queueing and other costs, two long prompts ahead of a request could consume most of a 1-second first-token budget. Again, this is a pre-measurement estimate rather than a benchmark result.

One response is **chunked prefill**.

Instead of processing:

```text
2048 prompt tokens
```

in one enormous step, the scheduler might run:

```text
decode tokens + 256 prompt tokens
decode tokens + 256 prompt tokens
decode tokens + 256 prompt tokens
...
```

Now a long prompt cannot monopolize the GPU for hundreds of milliseconds at once.

Existing streams get smoother inter-token latency.

But the new request waits longer for its own first token because its prefill is spread across multiple steps.

That is not a bug.

It is the trade-off.

The chunk's Q, K and V are computed normally; K and V are written into the existing cache, while its queries attend to cached prefix KV, earlier chunks and the current chunk.

![Top lane: a single 2,000-token prefill leaves a long gap between decode steps. Bottom lane: the same prefill split into 256-token chunks interleaved with decode steps.](images/ridgepoint/f5-chunked-prefill.svg "Chunking turns one long stall into bounded steps: smoother streams, a later first token for the new request."){full}
Eventually the chunk size should not be a magic constant.

The performance model should tell the scheduler how much prefill work can safely fit into a step without violating the latency budget of sequences already decoding.

At that point, measurement stops being something done *after* the scheduler.

Measurement becomes part of the scheduler.

---

## Throughput is not the objective

It would be easy to maximize tokens per second.

That is not the stated objective.

Ridgepoint defines its target as **goodput**: the maximum sustainable request rate where latency requirements continue to hold. The initial chat targets are P95 TTFT no higher than 1 second and P95 TPOT no higher than 75 ms, with the explicit rule that they may be adjusted once after baseline measurement if the hardware floor makes them unreasonable.

That changes how overload should behave.

Consider an engine capable of sustainably handling 3 requests per second receiving 6.

An unbounded queue allows all six through.

Nothing has really been admitted successfully. The queue simply stores work that may already be too late to satisfy its latency target.

As utilization approaches saturation, queueing delay grows sharply; an unbounded system can eventually reach a state where almost everyone times out despite the GPU remaining busy.

A deadline-aware system instead has to say:

> This request is unlikely to succeed within its SLO, so accepting it would make the system worse for both this request and the ones already running.

Then it rejects early.

That creates an uncomfortable but important reporting requirement:

**Higher goodput is meaningless if it was obtained simply by hiding a higher rejection rate.**

Admission control makes overload behavior better by deciding who *not* to serve.

That decision belongs in the performance story too.

---

## Correctness has to survive optimization

Performance engineering becomes dangerous when a faster implementation subtly changes the model.

Ridgepoint therefore treats numerical correctness as a gate rather than a cleanup step.

The notebook calls for checking logits against Hugging Face and testing equivalence across several paths:

- prefix-cache hit versus miss,
- chunked versus whole prefill,
- preempted versus uninterrupted execution,
- and eventually alternate execution paths such as CUDA graphs.

This matters especially because not every output difference is automatically a bug.

Changing batch composition changes floating-point reduction order. Tiny logit differences can accumulate, and a greedy decode can eventually select a different token even if both executions are numerically reasonable.

The standard therefore cannot simply be:

> “The text looked right.”

It has to include layer-level numerical comparisons, targeted equivalence tests and known tolerances.

---

## The benchmark harness matters as much as the engine

A serving engine can look impressive if the benchmark is weak enough.

So the baseline is intentionally simple but heavily instrumented: timestamps for request arrival, tokenization, first token and completion; server-side metrics; GPU observations; and an HTTP interface that remains constant as the internals change.

The same workloads are also intended to run against external references such as vLLM and llama.cpp rather than only against previous Ridgepoint versions.

That distinction is important.

Going from:

```text
my V2 → my V3 = +40%
```

to:

```text
Ridgepoint V3 reaches X% of vLLM under
the same model, hardware, trace and latency target
```

changes what the number means.

The first proves that I improved my own implementation.

The second begins to locate it relative to an established system.

And if the gap is large, the next question is not how to hide it.

It is:

> Where did the remaining time go?

That is a much better engineering question.

![P95 time to first token against offered request rate for an earlier version, a later version and a reference engine, with a horizontal SLO line at 1 second; each curve's goodput is the last rate under the line.](images/ridgepoint/f6-goodput.svg "The headline chart as planned. No data yet — the same trace, SLO and hardware for every engine.")
---

## One optimization will deliberately be chosen late

There is one design decision in the project that I particularly like: whether to prioritize CUDA graphs or quantization is intentionally deferred.

If profiling after chunked prefill shows meaningful gaps where the GPU is idle while Python prepares work or launches kernels, reducing host overhead should come first.

If the GPU is already saturating memory bandwidth, reducing the number of bytes moved through quantization is more likely to matter.

That sounds obvious when written down.

It is surprisingly easy to do the opposite while building systems: implement whichever optimization is fashionable, then search for a benchmark that makes it look useful.

Ridgepoint's rule is meant to prevent that.

**The profile chooses the next feature.**

---

## What this project will not prove

There is also a useful boundary around the project.

A single RTX 4050 does not demonstrate expertise running hundreds of GPUs. It does not prove experience writing production-grade CUTLASS kernels. It does not reproduce the operational environment of hyperscale inference.

That limitation does not make the experiment uninteresting.

The mechanisms are still real.

Weight bandwidth is real.

KV capacity is real.

Queueing is real.

Prefill/decode interference is real.

Host overhead is real.

Tail latency is real.

The ratios and bottlenecks will move on an H100. Some optimizations will become more important and others less important. But the habit I am trying to develop should transfer:

**derive a ceiling, measure the gap, explain the gap, change one thing, and measure again.**

---

## The part I actually want to learn

When I started thinking about an inference engine, I thought the interesting work would be things like paged attention kernels and CUDA graphs.

They are interesting.

But the deeper problem is deciding *when they matter*.

A fast attention kernel does not fix an overloaded queue.

Prefix caching does not automatically improve capacity.

Continuous batching does not eliminate latency interference.

Quantizing weights does not guarantee faster inference.

Increasing throughput does not guarantee more requests meet their SLO.

Even “more cache” can be counterproductive when cached blocks displace live KV.

The project therefore has a different unit of progress than a conventional software project.

Not endpoints.

Not features.

Not even commits.

**Experiments.**

Each version should end with four things I can defend:

> This was the bottleneck.  
> This is what I predicted.  
> This is what happened.  
> This is what the optimization cost.

Until those measurements exist, Ridgepoint is a hypothesis.

That is exactly how I want to build it.

The interesting result will not be that paged KV, continuous batching or prefix caching work. We already know they can.

It will be learning **where each stops helping, what becomes the next bottleneck, and whether a simple performance model could have predicted the transition before I wrote the optimization.**

> [!TAKEAWAYS]
> - **A constrained GPU is useful precisely because it exposes trade-offs.** With only ~6 GB of VRAM, KV allocation, caching and batching cannot be treated as abstract concerns.
> - **Prefill and decode are different performance problems.** Prefill tends toward compute pressure; practical decode on this hardware is expected to be dominated by memory traffic.
> - **Most optimizations move bottlenecks rather than eliminate them.** Continuous batching exposes prefill interference; prefix caching consumes KV capacity; chunked prefill exchanges TTFT for smoother ITL.
> - **The scheduler is fundamentally managing memory, time and deadlines.** Model execution is only one component of the serving problem.
> - **The benchmark methodology is part of the engineering.** A performance number without a hardware ceiling, workload, SLO, reference engine and correctness check says much less than it appears to.
> - **The performance model may ultimately be more important than any individual optimization.** If it can predict where the engine will bottleneck, the system becomes not just measurable but controllable.
