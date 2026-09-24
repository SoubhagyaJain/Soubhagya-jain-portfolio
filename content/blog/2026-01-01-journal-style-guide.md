---
title: Journal style guide — everything an article can use
date: 2026-01-01
category: AI Systems
type: Field note
summary: A reference for writing here. It stays a draft forever; build with --drafts to see it.
tags: reference
draft: true
---

This page exists to show every element the journal renders, so you can see them before you use them. It is never published. Open it with `node build.mjs --drafts`.

Body text is set at 18px on a 720px column, which keeps a line to about 70 characters. Inline elements: **bold**, *italic*, `inline_code()`, and [a link](https://example.com).

## A section heading

Section headings are set in the serif. They get an anchor link on hover, so a reader can share a link straight to the section.

### A smaller heading

Smaller headings switch to the sans, for structure inside a section.

#### A label heading

Label headings are mono and set in small capitals; use them sparingly, for things like "Setup" or "Method".

## Callouts

Five kinds, written as a quote that starts with a tag. An optional title can follow the tag.

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

## Tables

Tables step out of the reading column, so wide comparisons have room.

| Configuration | What changes | What to measure |
| --- | --- | --- |
| Baseline | Nothing | Time to first token, total latency |
| Variant A | One setting changed | The same two, on the same prompts |
| Variant B | Two settings changed | The same two, plus memory held |

## Code

Code blocks also step out of the column, and show their language.

```python
def recall_at_k(retrieved, relevant, k=8):
    """Fraction of the relevant passages found in the first k results."""
    return len(set(retrieved[:k]) & set(relevant)) / len(relevant)
```

## Quotes and lists

> A pull quote is set large, in the serif.

- An unordered list item
- Another, long enough to wrap onto a second line so you can see how the wrap sits against the marker

1. An ordered list
2. Numbered in the mono

---

Images go in `content/blog/images/`, written as `![Caption shown underneath](images/name.png)` on a line of their own. They step out of the column like code and tables.
