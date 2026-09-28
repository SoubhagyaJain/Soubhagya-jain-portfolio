---
title: My RAG Pipeline Found the Right Answer, Then Threw It Away
date: 2026-09-28
slug: rag-pipeline-found-the-answer-then-threw-it-away
category: RAG & Retrieval
type: Postmortem
summary: I built a local-first document assistant that cites every claim. Measuring it showed my biggest problem was not retrieval — the pipeline found the right passage and then dropped it before the prompt. How I found that, and why I ended up deleting more code than I shipped.
tags: RAG, Evaluation, Retrieval, LLMs, FastAPI, Python
---

> [!NOTE] Sources
> Grounded Policy RAG is open source: [code, A/B log and eval harnesses on GitHub](https://github.com/SoubhagyaJain/Company-policy-rag). Every number here comes from that log; eval sets are small, so treat them as regression signals rather than leaderboard claims.

I asked my assistant who owns the employee handbook. It answered that the handbook "does not explicitly mention" an owner.

That was wrong. The handbook has a document-control section that answers the question, and my retriever had found it. A later stage in my own pipeline threw that section away before the model ever saw it. The model did what a grounded model is supposed to do with no evidence: it said the document didn't cover it.

This wasn't a one-off. On a legal textbook, **8 of 37 questions** had the right passage ranked **#1** by retrieval and **nothing relevant** in the final prompt. My retrieval metrics looked fine the whole time, because retrieval had done its job.

This post covers how I found that, how I fixed it, and the broader habit it pushed me into: **every retrieval or prompt change has to win an A/B test, and anything that can't show a gain gets deleted.**

> [!TAKEAWAYS] TL;DR
> - I built **Grounded Policy RAG**, a document assistant for HR handbooks, contracts and policy PDFs. It handles messy follow-up questions and cites the exact section behind every answer. It runs entirely on one laptop (FastAPI, Next.js, Ollama with `qwen2.5:7b`) with no API keys and no data leaving the machine.
> - The largest quality gain came from a bug fix, not a model, reranker or new retrieval trick. Keeping the ranked evidence in the prompt raised the share of questions whose evidence reached the model from **80.0% to 98.6%**, and cost about 5 ms.
> - I **deleted more than I shipped**. That included a GraphRAG layer, an LLM query decomposer, an LLM conversation pass, and query-expansion tables that turned out to be leaking eval answers into the queries. The cross-encoder reranker is now off by default.
> - **Quality regressions fail the build.** CI runs retrieval and conversation gates against committed baselines, alongside 646 automated tests.

![The pipeline: message, interpret, semantic cache, scope, dense and BM25 search fused with RRF, an optional reranker, then context assembly, token-budget packing, the grounded prompt and the stream, followed by citations and verification and a trace written to SQLite.](images/grounded-rag/f1-pipeline.svg "One message, one trace. Dashed stages are off by default after measurement; the highlighted ones are where this story happens."){full}

---

## What I built

The project started in June as a Streamlit app with a single-file pipeline. About 140 commits later it has these parts:

- **Upload** PDFs, DOCX, XLSX, PPTX, Markdown, HTML, CSV, JSON and a few more (11 formats). Each document is validated, split into sections, chunked according to its structure, embedded, and indexed.
- **Ask** questions in plain English, including follow-ups like *"does it apply during probation?"* or *"going back to leave, what about contractors?"*
- **Get** a streamed answer where every sentence carries a `[Source N]` tag. Each tag links to a citation card with the document, section, page and snippet.
- **Inspect** any answer in a trace drawer. It shows the retrieval decision and the reason for it, what was retrieved, what reached the prompt, the verification scores, and per-stage timings.

```text
message → interpret (standalone query + retrieval decision) → [semantic cache]
        → scope → dense ∥ BM25 → RRF fusion → [rerank]
        → context assembly → token-budget packing → grounded prompt → stream
        → citations + verification → trace to SQLite
```

Table: The stack.
| Layer | Choice |
|---|---|
| LLM | `qwen2.5:7b` via Ollama, fully local |
| Embeddings | `BAAI/bge-small-en-v1.5`, in-process |
| Retrieval | Chroma (HNSW, cosine) + BM25, fused with Reciprocal Rank Fusion |
| API | FastAPI, Server-Sent Events for streaming |
| Frontend | Next.js 16, React, a WebGL hero, trace drawer and admin dashboard |
| Storage | Chroma, BM25 index, SQLite (WAL mode) for traces and telemetry |
| Infra | Docker Compose (6 services), Celery + Redis for async ingestion |

**Why local-first?** The target documents are HR handbooks, contracts and internal policy, which many organisations can't send to a third-party API at all. Running locally also keeps the benchmarks honest. No model gets silently upgraded underneath my results, and runs are reproducible at temperature 0 with seed 42. The cost is a 7B model, which is much weaker than a frontier model. Most of the architecture is there to make up for that with tighter retrieval and explicit verification.

---

## Part 1: RAG breaks on the second question

Textbook RAG takes four lines: embed the question, search a vector store, put the top-k chunks in a prompt, generate. It demos well on the first question. Then a real person asks a follow-up:

```text
You:  What is maternity leave?
Bot:  Employees receive 26 weeks of paid maternity leave. [Source 1]

You:  Does it apply during probation?
```

"Does it apply during probation?" contains no keywords. Dense search confidently returns the *probation* policy, and the answer is confidently wrong. The usual fixes introduce new failures:

1. **Concatenating history into the query** means that when the user changes topic ("how do I reset my VPN?"), leave-policy vocabulary still gets dragged into the search, and precision collapses.
2. **Feeding the previous answer back in as context** means one hallucination on turn 2 becomes trusted "evidence" on turn 5.
3. **Asking the model to cite** gets you `[Source 2]` because the format asks for a tag, whether or not source 2 supports the claim.

### One structured interpretation before retrieval runs

My fix was a conversation interpreter that turns every turn into a single validated object *before* retrieval runs:

```python
class ConversationInterpretation(BaseModel):
    intent: QueryCategory
    is_followup: bool
    topic_shift: bool                    # -> prior retrieval context is dropped
    returned_to_topic: bool              # "going back to leave..."
    standalone_query: str                # the ONLY string retrieval ever sees
    retrieval_decision: RetrievalDecision
    resolved_references: list[ResolvedReference]  # "it" -> "maternity leave"
    clarification_question: str | None
    confidence: float
    # ...
```

The retriever only ever sees `standalone_query`, and `retrieval_decision` is a closed enum with five actions:

![A user turn becomes one ConversationInterpretation, whose retrieval_decision routes it to one of five actions: RETRIEVE, REUSE_PREVIOUS, DECOMPOSE, ASK_CLARIFICATION or NO_RETRIEVAL; three of them never search.](images/grounded-rag/f2-interpretation.svg "Every turn becomes one validated object before retrieval runs. Three of the five decisions never touch the index.")

Table: The five retrieval decisions.
| Decision | When | Retrieval cost |
|---|---|---|
| `RETRIEVE` | New information is needed | Full pipeline |
| `REUSE_PREVIOUS` | "Explain that simply", "show me the source" | None |
| `DECOMPOSE` | Comparisons and multi-part questions | One per part |
| `ASK_CLARIFICATION` | A reference has several plausible targets | None |
| `NO_RETRIEVAL` | Greetings, meta-questions | None |

I'd defend two rules from this design in any review:

**Assistant prose is never evidence.** Earlier answers help resolve "it" and "that", but they can't ground a claim. Only retrieved chunks and verified citations can. `REUSE_PREVIOUS` reuses the *verified evidence set* from an earlier turn, never the text the model generated from it. Metadata-filter inference reads only the user's messages, so the model can't narrow its own search into a corner it made up.

**The semantic cache is deliberately narrow.** It fires at cosine ≥ 0.95, and never for follow-ups, filtered queries or queries scoped to a document. "Does it apply during probation?" is nearly identical text in two conversations about two different policies. A cache hit there would be a correctness bug, not a speedup.

On a 12-case multi-turn benchmark, I held the corpus, retriever, prompt and model constant and changed only the conversation layer:

Table: 12-case multi-turn benchmark: only the conversation layer changed.
| Metric | Old query rewriter | Interpreter |
|---|---:|---:|
| Retrieval hit@3 | 90.9% | **100%** |
| Retrieval-policy accuracy | 75.0% | **100%** |
| Citation correctness | 81.2% | **100%** |
| Answers with *only* correct citations | 72.7% | **100%** |
| Conversation logic, p50 | **0.23 ms** | 0.43 ms |
| End-to-end answer, p50 | 5.96 s | **4.25 s** |

The conversation layer got about 2× slower in isolation, and the end-to-end answer got **29% faster**. Better retrieval produces shorter prompts and fewer verification retries. The benchmark is small and synthetic, so I treat it as a regression signal rather than a leaderboard number. It gates every build.

### The LLM call that never worked

The first version of the interpreter also made an LLM call on every turn. When I finally measured that call, **11 of 11 outputs had failed schema validation.**

The prompt showed the schema as lists of allowed values, so the model answered `"intent": ["factual"]` where a string was expected. Pydantic rejected it, the pipeline quietly fell back to the deterministic interpreter, and every ~8.5-second LLM call was thrown away. The fallback did its job, and that was exactly why nobody noticed.

After I fixed the parser, the model mostly restated the deterministic result, down to the rationale string, and changed **no** retrieval decision. The LLM pass is now off by default and can be turned back on with one environment variable. The structure stayed and the model call went.

**Lesson:** a safe fallback can also hide a component that has never worked. Count how often your fallbacks fire.

---

## Part 2: Measure what reaches the prompt, not what retrieval returns

This is the part that changed how I think about RAG.

I started with a narrow question: *is the cross-encoder reranker worth ~2 seconds per query on CPU?* To answer it, I built an evaluation harness that runs the production retrieval path with no LLM and records chunk IDs at every stage. It also checks what *actually reaches the prompt*. It ran 70 labelled questions over two real PDFs, an AI-agents guidebook and a legal-studies textbook. Every comparison is paired, with a bootstrap confidence interval and a sign-flip p-value.

The answer to my original question was strange. **Every** reranker configuration had exactly the same final-context Hit@6: **0.800**. (Hit@6 is the share of questions where at least one relevant chunk is among the six the model sees.) No reranker, base reranker, large reranker: identical.

That flat line was the clue. Here is the funnel for the legacy pipeline with the large reranker:

```text
Stage                       Hit@6    MRR
Handed off by ranking       0.929    0.881
After clause selection      0.843    0.629   ← evidence lost here
After token-budget packing  0.843    0.629
Final prompt context        0.800    0.621
```

![Hit@6 at each stage of the legacy pipeline: 0.929 handed off by ranking, 0.843 after clause selection, 0.843 after token-budget packing and 0.800 in the final prompt; after the fix the final prompt reaches 0.986.](images/grounded-rag/f3-funnel.svg "The funnel. Ranking did its job; a later stage threw the evidence away. Axis starts at 0.7.")

Of the relevant chunks that ranking handed off, **68 of 182 were discarded** before the prompt was built, and 9 questions lost *all* of their evidence. The reranker was improving an ordering that a later stage then overwrote.

I found two causes.

### Bug 1: "The guidebook" matched nothing

Questions like *"what does the guidebook say about…"* triggered a current-document scope. With no document selected in the UI, that scope had no document ID, so the enforcement step rejected **every** candidate as coming from the wrong document. On **5 of 33** guidebook questions, the pipeline found the evidence and then returned nothing.

**Fix:** an unbound reference now binds to the only indexed document, or to the one whose filename contains the noun ("guidebook", "handbook", "manual"). If neither exists, the query searches globally instead of returning nothing.

### Bug 2: A clever selector overwrote the ranking

For policy questions, I had built a "governing clause selector". It tries to find the rule that actually governs the answer, plus its exceptions and definitions. The idea is sound. Here is how it scored chunks:

```python
# Retrieval evidence enters through a bounded transform...
score = 1.5 * math.tanh(max(-5.0, base_score) / 5.0)

# ...while wording carries most of the weight.
score += 3.0 * (len(overlap) / max(1, len(query_terms)))
if _NORMATIVE_RE.search(sc.chunk.text):   # "shall", "must", "entitled"...
    score += 2.0
if _CONDITION_RE.search(sc.chunk.text):   # "if", "when", "before"...
    score += 0.75
```

![Points the clause selector gave a chunk: about 0.01 for retrieval evidence, against 2.0 for normative words like shall, up to 3.0 for query-term overlap and 0.75 for conditional words.](images/grounded-rag/f4-selector.svg "What the selector rewarded. The retriever's opinion was worth about a hundredth of a point; the word “shall” was worth two.")

With an RRF score, retrieval's contribution came out to roughly **0.01 points**. Containing the word "shall" was worth **2.0**. The selector scored the *whole candidate pool*, not just the top-ranked chunks, and then **replaced** the ranked list with its own picks. Legal prose is full of "shall", "however" and "means", so normative-sounding text from anywhere in the pool filled every slot.

**Fix:** keep the ranked order. The selector now only writes a short policy-decision block. For workplace-policy questions, it can also move a governing clause into the last slots if ranking missed it.

### Result

Table: The context-assembly fix.
| | Before | After |
|---|---:|---:|
| Final-context Hit@6 (70 queries) | 0.800 | **0.986** |
| Relevant chunks discarded before the prompt (91 queries) | 41 | **4** |
| Context MRR (91 queries) | | **+0.192** (95% CI +0.127 to +0.255, p < 0.001) |
| Retrieval latency, p50 | 76 ms | 81 ms |

This was the largest quality gain in the project, and it came from removing a step's authority rather than adding a new component.

### And the reranker?

Once the fix was in, the reranker changed *which* chunks reached the model on most queries but not *how much relevant evidence* arrived: **159** relevant chunks delivered without it, **154** with the base model and **159** with the large one. The base reranker cost about **2.1 s per query on CPU**. It's now off by default. `ENABLE_RERANKER=true` turns it back on, and the large model does buy +0.045 context MRR if you have a GPU and can afford the latency.

**Lesson:** any stage between the retriever and the model can undo everything retrieval did, and no retrieval metric will show it. Log chunk IDs at every stage and measure the funnel all the way to the prompt.

---

## Part 3: My benchmark got worse when I fixed a problem

Early on, I added query-expansion tables that append related vocabulary to a query when it contains a trigger phrase. They seemed to help the guidebook scores.

When I checked which eval questions actually triggered them, I got:

- **18 of 35** guidebook questions
- **0 of 37** legal questions
- **0 of 24** handbook questions

![Query-expansion tables fired on 18 of 35 guidebook questions, 0 of 37 legal questions and 0 of 24 handbook questions.](images/grounded-rag/f5-leakage.svg "A heuristic that only fires on one eval set is leakage.")

The appended text was the *answer's* vocabulary. A question about the "building blocks" of AI agents got `Role-playing Focus Tasks Tools Cooperation Guardrails Planning Memory six AI agents` added to it. That's the answer key pasted into the query. It could only help a user who phrased questions exactly like my eval set, about that one PDF.

I deleted the tables. Guidebook context coverage **dropped from 0.739 to 0.662** (p = 0.003), and I reset the baseline to the lower number. The context-assembly fix from Part 2 later brought it back to **0.724** without any leaked vocabulary.

This happens easily in RAG work. You find a failing example and write a heuristic to fix it, and failing examples come from your eval set. You end up overfitting by hand, one reasonable fix at a time. In the same pass I removed seven guidebook-specific sub-query tables and a hard-coded "$5,000 / furniture" hallucination check. The gap left by that check is recorded as a strict `xfail` test, so it isn't hidden.

**Lesson:** for every heuristic, check whether it fires *outside* your eval set. If it doesn't, it's probably leakage.

---

## Part 4: Getting a 7B model to cite properly

`qwen2.5:7b` had a habit of copying the prompt's source header straight into its answer:

```text
[Source 2] File: sample_employee_handbook.md | Section: 1. Parental and Maternity Leave | Page: 1 | Evidence Type: TEXT
```

This happened in **half** the answers on my handbook eval, and in many of them it was the only citation.

**The clever fix failed.** I built a lexical citation-repair pass that reassigns each `[Source N]` tag to the chunk that best supports its sentence. Run offline over 141 stored answers, it made **zero** safe corrections. The model paraphrases, so on real misattributions the right and wrong chunks scored within 0.3 of each other. Any threshold loose enough to fix them would also have broken correct tags. I deleted the module the same day I wrote it.

**The simple fix worked.** I replaced one prompt line with two:

> Put the tag of the supporting source right after each sentence it supports.
> Never copy source headers or metadata (file names, sections, pages, evidence types) into the answer.

On the live model, header echo went from **50% to 0%**, every answer carried a tag, and median latency fell by **~1.5 s**.

![Header echo fell from 50 percent of answers to 0; time to first token for high-risk answers fell from 5.6 seconds to 1.1.](images/grounded-rag/f6-small-fixes.svg "Two measured fixes: a prompt sentence and a default.")

One open problem is left. The model sometimes attaches the wrong *number* to a correct sentence, and citation precision sits at **0.905**. The tagged chunk is always one that was in the prompt, but it isn't always the right one.

---

## Part 5: Verification without the latency tax

Every answer is scored on four axes: faithfulness, completeness, citation coverage and coherence. A composite threshold gates the result. Two properties matter:

1. **The LLM judge can only tighten a verdict, never loosen one.** Policy and numeric answers are escalated to an LLM faithfulness check, which can catch hallucinations the lexical heuristic misses. It can't turn a weak answer into a passing one.
2. **It fails quietly.** If the judge errors or returns something unparseable, the heuristic score is used instead. A verifier outage lowers quality but doesn't take the system down.

A failed verdict keeps an answer out of the semantic cache and is recorded in the trace.

Measurement changed two defaults here too. Verification can trigger a retry, but no answer eval showed a retry improving an answer, and each retry costs a full generation. So retries now default to **0**. That exposed a latency problem. High-risk answers (amounts, deadlines, entitlements) were buffered so a failed check could be retried before the user saw anything, but with no retries left, users were just waiting for the same answer. Those answers now stream while they're verified. **Time to first token went from 5.6 s to 1.1 s** with identical answer text.

---

## Part 6: What I deleted

This table sums up the project better than any feature list:

Table: What I deleted, and the number that decided it.
| What | Why it went |
|---|---|
| **GraphRAG layer** (~2,400 lines, including tests) | 0 of 70 cross-reference edges pointed at the right clause, because clause IDs had come from page headers. The measured losses were downstream, not missing relationships. |
| Query-expansion tables | Eval leakage (Part 3) |
| Seven sub-query tables | No measurable effect |
| Bag-of-words policy sub-queries | No measurable effect; removing them saved ~15 ms |
| LLM conversation pass (now off) | Failed validation 11/11 times; ~8.5 s per turn; changed nothing once fixed |
| LLM query decomposition (now off) | nDCG −0.010 over 91 queries, plus one LLM call per question |
| Cross-encoder reranker (now off) | No gain in relevant evidence delivered; +2.1 s on CPU |
| Lexical citation repair | Zero safe corrections on 141 answers |
| Verification retries (now 0) | No measured gain; each costs a full generation |

Some of this was the most interesting code in the repository, and that's exactly why it needed a number behind it. RAG pipelines pick up plausible-sounding heuristics faster than almost anything else in software. Each one is defensible on its own, and most never get measured.

---

## Part 7: Quality regressions fail the build

A metric on a dashboard gets ignored. A red build doesn't. CI fails if:

1. Any of the **430 backend** or **216 frontend** tests fail, or the production Next.js build breaks.
2. The conversation benchmark drops below 90% hit@3 or policy accuracy, or falls below its stored baseline.
3. A retrieval gate regresses: the labelled one falls more than 0.03 below its **committed baseline** on context Hit@6, Hit@2, MRR or coverage, or the self-contained one drops below 100% hit@3 or 80% MRR.
4. Lint fails on the hot-path modules.

The retrieval gates run the real retrieval and context-assembly path with no LLM, so they're deterministic and finish in under a minute. They're sensitive enough to catch a single lost query: reverting the context-assembly fix on its own fails the gate, with MRR dropping from 1.000 to 0.881.

Every A/B is written up in a log with confidence intervals, including the ones that came out flat. When a change legitimately moves a gate, the new baseline goes in the same pull request, so the quality impact shows up in the diff next to the code.

### The unglamorous bugs

Some of the most important fixes had nothing to do with ranking:

- **The document library reset on every restart.** Each backend process created a fresh, isolated library, and more than 200 orphaned session directories had piled up by the time I measured it. Isolation that only isolates you from yourself isn't a security control. The library is now persistent, with per-process isolation available as an opt-in.
- **The retrieval cache could serve chunks from deleted documents.** Cache keys now include a corpus fingerprint, and ingestion and deletion clear the cache.
- **Failed vector writes were logged and ignored**, so a document could show as "ready" while being unsearchable. They now fail the ingestion job and clean up partial indexes.
- **Upload hardening:** size and post-expansion caps (Office files are zip archives, which makes zip bombs possible), `defusedxml` for all XML parsing, MIME sniffing instead of trusting the file extension, and a non-root container.

---

## Where it stands

**Retrieval → final prompt** (91 labelled questions over 3 corpora, no LLM):

Table: Retrieval to final prompt: 91 labelled questions over 3 corpora, no LLM.
| Context Hit@6 | Context MRR | Questions that lost all evidence | p50 |
|---:|---:|---:|---:|
| 0.99 | 0.93 | 0 | 50 ms |

**Answers** (24 handbook questions, live `qwen2.5:7b`; 3 of the questions *must* be refused):

Table: Answers: 24 handbook questions on live qwen2.5:7b; 3 must be refused.
| Key-fact recall | Refused exactly when it should | Cited chunk was in the prompt | Citation precision | Latency p50 |
|---:|---:|---:|---:|---:|
| 1.000 | 1.000 | 1.000 | 0.905 | 4.7 s |

Everything ran on a laptop with an i5-13420H and an RTX 4050 (6 GB).

### What it doesn't do yet

- **The eval sets are small.** They cover 91 retrieval questions, 24 answer questions and 12 conversations, and the labels are partly LLM-assisted. They're strong regression signals and weak absolute claims. The handbook corpus is at ceiling, so real improvements have to show up on the guidebook and legal corpora.
- **Chunking stops at page boundaries.** A section that runs across pages gets split, and 80 of the guidebook's 235 chunks are bare headings. A query-time filter hides the worst of it, but the real fix is a chunking rewrite, and I haven't done it yet.
- **Citation numbers still drift** (see Part 4).
- **7B limits.** Retrieval and verification narrow the gap to frontier models on multi-step reasoning but don't close it.
- **Single-node, no auth.** SQLite telemetry and embedded Chroma are a deliberate boundary for a local tool, and multi-tenancy would need authentication first.
- **Vision needs a GPU.** Page understanding takes ~65 s per page on CPU, so scanned PDFs can't be indexed on a CPU-only machine.

---

## Advice for your first RAG system

1. **Measure what reaches the prompt, not just what retrieval returns.** My worst bug sat between a correct retriever and a well-behaved model.
2. **Log IDs at every stage.** You can't fix a funnel you can't see.
3. **Check your heuristics against questions outside the eval set.** If a rule only fires on eval questions, it's leakage.
4. **Count your fallbacks.** A silent fallback kept an LLM call that never worked running on every turn.
5. **Make quality regressions fail the build.** With a committed baseline, a regression shows up as a red build.
6. **Delete what can't show its value,** even when it's clever.

---

## Try it

```bash
git clone https://github.com/SoubhagyaJain/Company-policy-rag.git
cd Company-policy-rag/company_policy_rag
docker compose up --build
```

The first boot downloads the models, which takes 10–20 minutes. After that, open `http://localhost:3000`, upload the included sample handbook, and try this sequence. Each line exercises a different branch of the retrieval policy:

```text
What is maternity leave?                                → RETRIEVE
Does it apply during probation?                         → RETRIEVE (pronoun resolved first)
Explain that simply.                                    → REUSE_PREVIOUS (no new search)
How do I reset VPN?                                     → RETRIEVE (topic shift, old context dropped)
Going back to maternity leave, what about contractors?  → RETRIEVE (explicit topic return)
```

Open the trace drawer on any answer to see which decision fired and why.

**Code, A/B log and eval harnesses:** [github.com/SoubhagyaJain/Company-policy-rag](https://github.com/SoubhagyaJain/Company-policy-rag)

---

*If you're building RAG systems and have seen evidence go missing between retrieval and generation, I'd like to hear how you caught it.*
