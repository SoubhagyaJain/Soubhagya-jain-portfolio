---
title: The title of the article
date: 2026-09-24
summary: One or two sentences shown on the Blog page and in link previews.
tags: RAG, evaluation
---

Write the article in Markdown. Start with the problem, not the conclusion.

## A section heading

Paragraphs are separated by a blank line. **Bold**, *italic*, `inline code`,
and [links](https://example.com) work as you would expect.

```python
# code blocks keep their formatting
def recall_at_k(retrieved, relevant, k=8):
    return len(set(retrieved[:k]) & set(relevant)) / len(relevant)
```

> A quote, set large.

- a list item
- another one

![Caption shown under the image](images/diagram.png)
