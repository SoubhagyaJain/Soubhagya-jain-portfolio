---
date: 2026-09-24
url: https://lnkd.in/p/dsSdJRVk
slides: images/multilingual-retrieval
slides_title: Why does multilingual RAG miss answers in another language?
document: files/multilingual-retrieval-carousel.pdf
---
A German user asks:

**“Wie funktioniert ein Transformer?”**

The best answer in the corpus is in English.

But the retriever returns a weaker German passage instead.

No timeout.
No hallucination.

**Just an embedding space with an opinion about language.**

That made me ask:

**Does a multilingual embedding model retrieve by meaning — or partly by language?**

The textbook view says:

“Reset my password”
“मेरा पासवर्ड रीसेट करें”
“Mein Passwort zurücksetzen”

→ same meaning
→ nearby vectors

But in practice, language can still shape the embedding space.

A useful mental model is:

**vector ≈ meaning + language signal + model-specific geometry**

Not literally — but enough to affect retrieval.

Qdrant recently tested `multilingual-e5-small` on XRAG (~15k articles, 5 languages).

Recall@10:

→ same-language answer: **0.61**
→ cross-language answer: **0.08**

That matters because the failure happens **before the reranker**:

Query
↓
Embedding
↓
ANN retrieval → Top-K
↓
Reranker
↓
LLM

A reranker only scores what retrieval gives it.

In one example, the relevant English document for a Spanish query was at **rank #438**.

If you rerank the top 50, you never even see it.

So I separate two problems:

**Recall@20 low**
→ candidate-generation problem
→ fix retrieval first

**Recall@20 healthy, MRR low**
→ ranking problem
→ reranking can help

**Candidate recall ≠ ranking.**

One proposed fix is SHIFT: estimate a language-related direction from parallel translation pairs, then subtract a scaled version from embeddings.

It can improve cross-language retrieval — but not for free.

In Qdrant’s replication:

cross-language Recall@10:
**0.08 → 0.24**

same-language Recall@10:
**0.61 → 0.49**

So **“more language invariant” does not automatically mean “better.”**

The experiment I’m setting up:

• ~200 English + Hindi queries
• relevant same-language passage
• relevant cross-language passage
• weaker same-language distractor
• unrelated passages

Then compare:

**A — baseline embeddings**
**B — SHIFT-style correction**
**C — corrected embeddings + multilingual reranker**

Metrics:

Recall@5/10/20 · MRR · nDCG@10

Always split into **same-language vs cross-language retrieval.**

The test I care about most:

**Hindi query
→ relevant English answer
→ weaker Hindi distractor**

Which one ranks first?

A multilingual model is not automatically a **language-neutral retriever**.

Before choosing one, measure:

**Where do your queries live?
Where does your evidence live?
Has language quietly become a ranking feature nobody chose?**
