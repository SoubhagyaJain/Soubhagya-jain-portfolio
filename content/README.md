# Publishing: blog, LinkedIn posts and notes

Everything on `/blog` and `/notes` comes from this folder. Add a file, commit it to
`main`, and Vercel rebuilds the site in a few seconds. The newest three of each also
appear in the home page's **Writing** chapter.

You can do all of it on github.com: open the folder, choose **Add file → Create new
file** (or **Upload files** for a PDF or an image), then **Commit changes**.

Files whose names start with `_` are ignored, so `_template.md` in each folder is safe
to copy.

## A LinkedIn post

LinkedIn does not let other websites read your posts (the permission that would allow
it is only given to approved partners), so each post is copied here once. Copying it
also means the full text stays on your site even if you later edit or delete it on
LinkedIn.

1. On LinkedIn, open the post, choose **… → Copy link to post**, and copy the post
   text.
2. Create `content/linkedin/2026-09-24-short-name.md`:

   ```
   ---
   date: 2026-09-24
   url: https://www.linkedin.com/posts/...the link you copied...
   ---
   Paste the post text here, exactly as written.

   Line breaks are kept. #hashtags are highlighted.
   ```

3. Commit. It shows on `/blog` in full, with a **View on LinkedIn** link.

For a photo, put it in `content/linkedin/images/` and add `image: images/photo.jpg`
(several: `image: images/a.jpg, images/b.jpg`).

## A blog article

Create `content/blog/2026-09-24-the-address-you-want.md`. The part of the file name
after the date becomes the page address: `/blog/the-address-you-want`.

```
---
title: What broke when the index went stale
date: 2026-09-24
summary: One or two sentences for the Blog page and for link previews.
tags: RAG, evaluation
---

The article, in Markdown.
```

Markdown that works: `## headings`, **bold**, *italic*, `` `code` ``, fenced code
blocks with a language (```` ```python ````), `> quotes`, lists, `[links](https://…)`
and images. Put images in `content/blog/images/` and write
`![caption](images/name.png)`. An image on a line of its own gets its caption shown
underneath.

Add `draft: true` to keep an article out of the build while you are still writing it.

## A PDF of notes

1. Upload the PDF to `content/notes/`, for example `probability-weeks-1-4.pdf`.
2. Optionally, create `content/notes/probability-weeks-1-4.md` (same name, `.md`) to
   give it a proper title and description:

   ```
   ---
   title: Probability — weeks 1 to 4
   date: 2026-09-24
   summary: Random variables, expectation and the common distributions.
   topics: Statistics, IIT Madras
   pages: 38
   ---
   ```

Without that file, the title is made from the file name. Everyone who visits `/notes`
can open the PDF in the browser or download it.

Keep PDFs reasonably small: every file lives in the git repository forever, and large
scanned PDFs (tens of MB) make the repository slow to clone. Compressing a scan before
uploading usually brings it well under 10 MB.

## If something does not show up

Run `node build.mjs` locally, or look at the Vercel build log. A file that is missing
something it needs (a date, a title) is skipped and listed under **CONTENT** in the
build output, with what to fix. One bad file never breaks the rest of the site.
