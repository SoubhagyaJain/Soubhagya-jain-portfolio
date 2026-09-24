---
title: Constrain the Output, and the Error Moves Into the Question
date: 2026-09-24
slug: jev-typed-decisions-error-moves-into-question
category: AI Systems
type: Deep dive
summary: Jev removes one class of LLM failure by turning generation into typed decisions. The more interesting question is what fails after malformed output is no longer possible.
tags: LLMs, Reliability, Inference, Calibration, AI Engineering
---

> [!NOTE] Sources
> This article is based on [my research notebook](/notes/files/jev-research-notebook.pdf) (22-page PDF, also in [Notes](/notes)) covering TypeSafe's primary documentation and independent evaluations reviewed through September 21, 2026. The independent evaluations discussed here are single-author tests, not peer-reviewed studies.

TypeSafe says its new model, Jev, cannot hallucinate.

There is a sense in which that statement is literally true. Give Jev a set of allowed answers and it cannot invent a fourth option, return malformed JSON, ramble instead of answering, or fabricate a tool name outside the list you supplied.

But that is not the same thing as being unable to be wrong.

Jev can return a perfectly valid answer to a badly constructed question. It can confidently select an option when the correct answer is missing. It can make a decision when the information needed to make that decision was never included in the input.

That distinction is more interesting than the launch claim.

Because once you constrain the output, the error does not disappear.

**It moves into the question.**

TypeSafe's own documentation makes this distinction: Jev's zero-hallucination property refers to out-of-schema outputs, while the model can still choose the wrong valid option.

And that changes how I think about using models like this inside production AI systems.

---

## Jev is closer to a decision primitive than a chatbot

Jev is not designed to generate prose.

You give it some **state**—for example a support ticket, log excerpt, JSON record, or text-bearing application object—and one or more typed questions.

The questions use three primitives:

- **Noul** returns a probability for a yes/no judgment.
- **Choice** returns a probability distribution over predefined options.
- **Score** returns a distribution over ordered levels and an expected score.

The questions can be evaluated against the same state in parallel. Your application then decides what to do with the resulting distributions: accept a route, reject an event, escalate to a human, invoke another model, or apply some other piece of business logic.

The boundary is important.

Jev does not decide the entire application flow. It provides a bounded judgment.

Conceptually:

```text
application state
        ↓
typed questions
        ↓
       Jev
        ↓
probability distributions
        ↓
thresholds + business logic
        ↓
act / escalate / call another model
```

That makes the model easier to reason about than a free-form generation endpoint in one important way: its output contract is extremely narrow.

Suppose a support router permits:

```text
billing
technical
none_of_these
```

Jev cannot suddenly return:

```text
priority_customer_success_escalation
```

because that value does not exist in the answer space.

Malformed output is not merely unlikely. For the typed interface, it is structurally unavailable.

But there is another possibility:

```text
returned: billing
valid type: yes
correct route: no
```

The type system has done its job.

The prediction is still wrong.

---

## The fair comparison is not Jev versus an unconstrained LLM

It would be easy to frame this as:

```text
LLM → unreliable text
Jev → reliable structure
```

That comparison is too generous to Jev.

Modern LLM APIs can already use strict structured-output mechanisms that constrain generation to a schema. For bounded application decisions, malformed JSON is increasingly a solved engineering problem rather than Jev's unique advantage.

So the more useful comparison is:

Table: Three ways to get a bounded decision out of a model.
| Dimension | Generative LLM | LLM with strict structured output | Jev-like decision model |
|---|---|---|---|
| Output | Open-ended text | Schema-valid structured output | Distribution over predefined answers |
| Decode loop | Yes | Yes | No explicit generative decode loop |
| Per-option probabilities | Usually unavailable | Usually unavailable | Native |
| Reasoning/explanation | Possible | Possible | Not generated |
| Answer space | Open | Flexible schema | Closed |
| Characteristic failure | Fabricated/off-task output | Valid structure, wrong content | Valid option, wrong decision |

That last row matters most.

Jev does not make model error disappear.

It changes its shape.

---

## Why removing the decode loop could matter

There is a compelling systems argument behind this design.

A conventional autoregressive language model generates tokens sequentially. After processing the input, it repeatedly performs another inference step to select the next token:

```text
prefill
   ↓
token 1
   ↓
token 2
   ↓
token 3
   ↓
...
```

For reasoning models, the model may generate substantial intermediate reasoning before returning the small structured answer the application actually needed.

If the application only wants:

```text
fraud = true
```

then paying for a long generative path to obtain one bit of application-level information can be an awkward abstraction.

A closed-set model can instead treat the problem more like scoring known alternatives:

```text
input
   ↓
model
   ↓
P(option₁), P(option₂), ... P(optionₖ)
```

There is no need to generate an explanation token by token just to arrive at one of several predefined outcomes.

That gives a plausible reason for substantially lower latency.

There is an important caveat, though: **TypeSafe has not published Jev's underlying architecture or its "parallel sampler."** I therefore treat the no-decode-loop mechanism as an interpretation consistent with the product interface and reported behavior, not as a disclosed implementation fact.

That distinction is worth preserving.

We can observe the interface and measurements.

We should not pretend we know an architecture that has not been published.

---

## The headline benchmark numbers are real. The comparison is doing a lot of work.

TypeSafe reports Jev reaching the high end of **193.6× faster and 444.6× cheaper** in its workflow evaluations.

Those numbers deserve two reactions at the same time.

First: they are large enough to be technically interesting.

Second: a multiplier without its denominator is not very informative.

The TypeSafe evaluation compared Jev against several generative models operating through workflows. The reference answers were not human ground truth; they were built from the averaged outputs of GPT-6 Astra and Claude Fable 5.1. TypeSafe employees constructed the workflows, which TypeSafe discloses, and the company describes the largest multiples as the high end of the comparison.

The more revealing comparison uses GPT-5.6 Terra because its reported agreement is almost identical to Jev's:

```text
Jev:           67.8%
GPT-5.6 Terra: 67.9%
```

Using TypeSafe's published per-case means, that works out to roughly **76× cheaper and 25× faster** than Terra, with some uncertainty because several published values are rounded.

That is still a substantial difference.

But it is different from hearing "444× cheaper" without context.

The speed comparison changes again when the baseline is a small, non-reasoning model rather than a slow reasoning-heavy model. Independent measurements in the notebook landed around 239 ms p50 in one setup and roughly 0.43 seconds in others; against small non-reasoning LLMs, the observed advantage was closer to roughly **2–3×** than hundreds of times.

> [!RESULTS] The same model, three denominators
> - **193.6× / 444.6×** — faster / cheaper: TypeSafe's headline, the high end of its workflow comparisons
> - **~25× / ~76×** — faster / cheaper than GPT-5.6 Terra, at near-identical agreement (67.8% vs 67.9%)
> - **~2–3×** — the speed advantage over small non-reasoning LLMs, in independent measurements

The useful lesson is not that the headline is false.

It is that **model architecture, reasoning settings, workflow shape, and comparator selection determine what the multiplier means**.

There is another complication.

The benchmark moves certain operations into ordinary code. Arithmetic, dates, and account checks are handled deterministically for all models rather than delegated to Jev. That is sensible system design, but it also removes categories where TypeSafe itself documents Jev as weaker.

And because the workflow reference is frontier-model consensus rather than human-labelled ground truth, the benchmark primarily measures agreement rather than absolute correctness.

This is why benchmark reading is often more useful than benchmark ranking.

---

## Closed-world systems fail differently

The most useful failure case I found was not a malformed output.

There were none.

It was a completely valid answer to a world the schema failed to represent.

In one independent evaluation, 30 messages were deliberately outside the provided categories. When there was no explicit **"none of these"** option, zero of the 30 were rejected as out-of-scope, even with a 0.99 confidence gate.

The system selected one of the available labels.

Every time.

In another experiment, the correct priority depended on an organizational policy that had not been included in the state. Jev achieved only **44.7% accuracy**, while assigning an average probability of **0.74** to the option it selected.

A third test deliberately corrupted option descriptions. Accuracy fell to **16.7%** on a four-option task—below the 25% chance level—and on ambiguous tasks, merely changing option order moved results by as much as 13 percentage points.

None of those failures violate the type system.

That is precisely the point.

Once output validity is guaranteed, reliability depends heavily on three things:

**The answer space.** Does your enum actually contain reality?

**The state.** Did you supply enough information to make the decision?

**The threshold.** Does the probability mean what your routing logic assumes it means?

This is why I would treat the criteria supplied to a model like Jev less like prompt copy and more like an API contract.

Version it.

Test it.

Regression-test changes.

And whenever reality can fall outside your categories, add an explicit escape hatch.

`none_of_these` is not cosmetic.

It is part of the safety model.

---

## Calibration may matter more than schema validity

Once a model returns probabilities, it becomes tempting to write application logic like:

```python
if confidence > 0.90:
    automate()
else:
    escalate()
```

That looks rigorous.

It is only rigorous if 0.90 actually means something useful on your data.

A model is **calibrated** when predictions assigned a probability near 0.8 are correct roughly 80% of the time across many comparable cases.

That is different from accuracy, and it is different from discrimination.

A model might rank good decisions above bad ones very effectively while its numerical probabilities remain systematically too high or too low.

This distinction becomes especially important for a model whose product interface encourages threshold-based routing.

I could not find a TypeSafe-published Expected Calibration Error curve or comparable calibration evaluation in the source set as of September 21.

One independent study reported ECE around **0.024–0.032** on several public benchmarks, but **0.107** on an out-of-distribution synthetic support-ticket dataset. It also found different calibration directions across primitives: Choice was overconfident while Noul was underconfident.

Another evaluation found confidence equal to exactly 1.0 on 102 of 200 CLINC150 samples.

Six of those predictions were wrong.

That does not make confidence useless.

It means confidence should initially be treated as a model signal rather than a mathematical guarantee.

A production threshold should be tuned against the distribution that the production system actually sees.

A threshold for one question type should not automatically be reused for another.

And when the distribution shifts, the threshold deserves monitoring just like any other model parameter.

The harder part of a probability-returning API is not obtaining the number.

It is earning the right to trust it.

---

## The phishing result shows where the intelligence really lives

One experiment in the notebook changed my interpretation of the model more than the headline benchmarks did.

On 2,000 phishing and legitimate emails, a direct question—effectively, *is this phishing or not?*—produced **62.6% accuracy**. Claude Haiku 4.5 reached **81.3%** in that evaluation.

That does not look impressive.

Then the task was decomposed.

Instead of asking for one final verdict, the same call evaluated five narrower signals. Those signals were combined using logistic regression fitted on labelled examples.

Accuracy reached **95.1%**.

It would be easy to call that a Jev result.

That would miss half the engineering.

The performance came from at least three components:

```text
model judgments
+
engineer's decomposition
+
labelled-data-trained combination rule
```

The workflow knew something the direct question did not.

This suggests a more useful mental model for bounded-decision systems:

**The model handles leaf judgments. The system designer constructs the reasoning graph.**

That can be powerful.

It also means comparing a carefully decomposed workflow against a one-shot prompt can accidentally compare system design rather than model intelligence.

And there is another reality check: the 95.1% phishing result required labelled data and a fitted regression model. Where conventional supervised models were tested, they could still be stronger.

On Banking77, for example, a frozen encoder plus logistic regression reached **93.3%**, compared with Jev at **83.2%**, while running at roughly **0.01 seconds**.

So Jev's strongest argument is not:

> classifiers are obsolete.

It is closer to:

> what if I need classifier-like bounded decisions before I have enough labelled data to train a classifier for every decision?

That is a much more interesting systems niche.

---

## Where I would put a model like this

I would not use Jev as a replacement for a generative model.

I would use it to avoid calling one unnecessarily.

That leads to an architecture closer to:

```text
event / user input
        ↓
deterministic code
parse · calculate · lookup
        ↓
fast decision layer
route · classify · score · gate
       ↙            ↘
   confident      uncertain / open-ended
      ↓                  ↓
 deterministic       generative LLM
    action               ↓
                         result
                           ↓
                     fast verifier
                       ↙       ↘
                     pass      fail
                               ↓
                         human review
```

Plausible positions for this kind of model include query routing, tool selection, guardrails, RAG relevance filtering, document classification, ticket routing, phishing triage, escalation decisions, and output verification.

The common property is not "AI."

It is **a frequent decision over a known answer space**.

That also explains where I would not use it.

If the task requires reconciling multiple documents, doing multi-hop reasoning, producing an explanation, extracting an unknown free-form value, interpreting images, or working through arithmetic that deterministic code could perform more reliably, the bounded decision abstraction starts fighting the problem instead of helping it.

TypeSafe itself documents weaknesses around math, counting, dates, multi-hop indirection, and related cases.

A specialized model becomes useful when the application is equally disciplined about what **not** to ask it.

---

## The deeper engineering lesson

The launch story around Jev is easy to reduce to one claim:

**"A model that can't hallucinate."**

I think the better story is about specialization.

Generative models are enormously flexible because almost anything can appear after the prompt.

That flexibility has costs: decoding, output validation, uncontrolled answer spaces, and a broad surface for failure.

A typed decision model gives up that flexibility.

In exchange, it gets a much tighter contract.

But every constraint pushes responsibility somewhere else.

Remove free-form generation, and the engineer must define the answer space.

Remove implicit context, and the engineer must decide what belongs in state.

Expose probabilities, and the engineer must calibrate thresholds.

Break a hard decision into smaller judgments, and the engineer becomes responsible for the composition logic.

Put several gates in sequence, and local accuracy is no longer enough: five independent gates that each succeed 95% of the time all succeed together only about 77% of the time.

The system becomes easier to constrain, but not easier to design.

And perhaps that is the useful direction for production AI generally.

Not one increasingly general model doing everything, but a hierarchy:

```text
code
for what is computable

↓

fast decision models
for bounded judgment

↓

generative models
for open-ended reasoning and generation

↓

humans
when uncertainty or consequences justify escalation
```

Jev fits naturally into that hierarchy as a fast decision layer before an expensive model, and potentially again as a verifier after it.

The interesting question now is not whether Jev's type system works.

It does what a type system should do: it constrains what can come out.

The question is whether engineers can build answer spaces, state representations, calibration datasets, and escalation policies good enough to make those constrained answers trustworthy.

Because a type system can guarantee a valid answer.

**It cannot guarantee that you asked a question the world fits into.**

---

## Key takeaways

> [!TAKEAWAYS]
> - **"Cannot hallucinate" is a structural guarantee, not a correctness guarantee.** Jev can prevent out-of-schema output while still choosing the wrong schema-valid answer.
> - **Schema validity is not the main differentiator.** Strict structured-output LLMs already address much of that problem. Jev's more interesting properties are native option probabilities, many judgments over shared state, bounded outputs, and potentially much lower decision cost.
> - **Benchmark multiples depend heavily on the comparator.** TypeSafe's 193.6×/444.6× headline reflects favorable workflow comparisons; a roughly accuracy-matched Terra comparison suggests about 25× lower latency and 76× lower cost instead.
> - **Closed answer spaces create closed-world failures.** Missing `none_of_these` categories, missing input context, or badly written criteria can produce confident, perfectly valid wrong answers.
> - **Calibration is central to production use.** A confidence value should not automatically become a routing threshold without validation on the application's own distribution.
> - **Decomposition can matter as much as the model.** Turning one difficult judgment into several narrower signals dramatically changed performance in the phishing experiment, but part of the improvement came from system design and labelled data.
> - **The most interesting deployment pattern is a cascade:** deterministic code → bounded decision layer → generative model → human escalation, invoking each layer only when the previous one cannot safely finish the job.
