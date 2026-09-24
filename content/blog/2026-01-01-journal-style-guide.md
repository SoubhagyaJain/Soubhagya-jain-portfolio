---
title: Journal style guide — everything an article can use
date: 2026-01-01
category: AI Systems
type: Field note
summary: A reference for writing here, and a working test of every element the journal renders. It stays a draft forever; build with --drafts to see it. The numbers on this page are placeholders, not measurements.
tags: reference, style
math: true
draft: true
---

This page shows every element the journal renders, so you can see one before you use it. It is never published: open it with `node build.mjs --drafts`. **Every number on this page is a placeholder that shows the layout; none of it is a measurement.**

Body text is set between 18 and 20px on a column of about 740px, roughly seventy characters a line. The first paragraph of an article is set a little larger, to carry the reader in. Inline elements: **bold**, *italic*, `inline_code()`, [a link](https://example.com), and a note in the margin.[^margin]

## Start with what a reader should leave with

Most readers skim first. Put the conclusion where the skim lands.

> [!TAKEAWAYS]
> - State the finding in one sentence, with its condition: *on this hardware, for this prompt shape*.
> - Say what did not change, when that is the surprise.
> - Name the one follow-up you would run next.

> [!RESULTS] Placeholder numbers
> - **2.53 s → 0.56 s** — prompt evaluation, median
> - **4.5×** — faster time to first token
> - **±0.1 s** — decode time, unchanged
> - **24%** — lower wall latency

## Say how it was measured

A benchmark without its conditions is an anecdote. A setup block is a spec sheet: one `Label: value` line per row.

> [!SETUP]
> - Hardware: a laptop GPU, 6 GB
> - Runtime: a local inference server
> - Model: a 7B instruction model, 4-bit
> - Prompts: 30 requests, ~2,800 tokens each
> - Repetitions: 3 runs, median reported
> - Code: link to the repository here

### Tables

A table steps out of the reading column. Put a `Table:` line directly above it to number and caption it. Columns that hold only numbers are aligned right and set in the mono, so they line up by the decimal point.

Table: Placeholder latencies for two prompt shapes, median of three runs.
| Configuration | Prompt eval | TTFT | Decode | Wall |
| --- | --- | --- | --- | --- |
| Different prefix | 2.534 s | 2.653 s | 4.731 s | 7.284 s |
| Shared prefix | 0.559 s | 0.585 s | 4.826 s | 5.529 s |
| Change | **−78%** | **−78%** | +2% | **−24%** |

A table with more than five columns takes the full width of the page:

| Run | Queries | Recall@5 | Recall@10 | Recall@20 | MRR | nDCG@10 |
| --- | --- | --- | --- | --- | --- | --- |
| A — baseline | 200 | 0.42 | 0.51 | 0.60 | 0.38 | 0.44 |
| B — corrected | 200 | 0.47 | 0.55 | 0.63 | 0.41 | 0.48 |
| C — corrected + reranker | 200 | 0.53 | 0.59 | 0.63 | 0.52 | 0.57 |

## Figures

An image on a line of its own is a figure. Its title (or alt text) becomes the caption, and figures are numbered in order. It is wide by default; add `{narrow}` to keep it in the text column or `{full}` to use the whole page.

![A slide from the multilingual retrieval carousel](/blog/media/linkedin/images/multilingual-retrieval/slide-02.jpg "A wide figure, the default. The caption is set in the reading face, so a long caption stays readable."){narrow}

Two or more images on one line sit side by side, each with its own caption:

![First slide](/blog/media/linkedin/images/multilingual-retrieval/slide-07.jpg "Before") ![Second slide](/blog/media/linkedin/images/multilingual-retrieval/slide-08.jpg "After")

## Equations

Maths is written in TeX. Inline, between single dollar signs: the recall of the first $k$ results is $\mathrm{R@k} = |R_k \cap G| / |G|$. On a line of its own, between double dollar signs:

$$
\mathrm{MRR} = \frac{1}{|Q|} \sum_{i=1}^{|Q|} \frac{1}{\mathrm{rank}_i}
$$

An article turns maths on with `math: true` in its front matter, or automatically when it contains a `$$` block, so a price like $5 is never mistaken for an equation.

## Code

Code blocks show their language, and a file name if you give one. A reader can copy the block with one click.

```python title="metrics.py"
def recall_at_k(retrieved, relevant, k=10):
    """Fraction of the relevant passages found in the first k results."""
    return len(set(retrieved[:k]) & set(relevant)) / len(relevant)


def mrr(ranks):
    return sum(1 / r for r in ranks) / len(ranks)
```

## Callouts

Each kind is written as a quote that starts with a tag, and an optional title can follow the tag.

> [!OBSERVATION] Optional title
> Something you noticed while running the system, stated plainly.

> [!FAILURE]
> What broke, under what condition, and how you found out.

> [!BENCHMARK]
> What was measured, on what hardware, with which settings. Put the numbers in a table below it.

> [!TRADEOFF]
> What you gave up to get what you wanted, and why that was the right trade here.

> [!CHANGED]
> What you believed before the experiment, and what you believe now.

> [!QUESTION]
> What you still do not know, and what would settle it.

## Notes and references

Write `[^name]` where a note belongs and define it anywhere as `[^name]: text`.[^cite] Notes are numbered in the order they are first used. On a wide screen each sits in the margin beside its sentence; everywhere, they are collected under *Notes & references* at the end, with a link back.

### Quotes and lists

> A pull quote is set large, in the serif.

- An unordered list item
- Another, long enough to wrap onto a second line so you can see how the wrap sits against the marker

1. An ordered list
2. Numbered in the mono

---

Images go in `content/blog/images/`, written as `![Alt](images/name.png "Caption")` on a line of their own.

[^margin]: A margin note sits beside the line that calls it, where the eye already is, instead of at the bottom of a long page.
[^cite]: A citation looks like any other note: *Author, "Title", Venue, Year* — with [a link](https://example.com) to the source.
