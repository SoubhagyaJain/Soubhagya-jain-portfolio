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

3. Commit. It shows in full on `/blog/linkedin` (Shorter notes), with a **View on
   LinkedIn** link, and as a short preview on `/blog`.

Write it the way you write on LinkedIn; the page reads the shape of your lines back
into structure:

| You write | It becomes |
| --- | --- |
| lines that start with `→` | an arrow list |
| a **bold** line followed by `→` lines | a small case; two in a row sit side by side |
| `Query` / `↓` / `Embedding` / `↓` / … | a pipeline, drawn as steps |
| lines that start with `•` | a bulleted list |
| a line that is **bold from start to end** | a pull line, set large |
| `label:` then a **bold value** on the next line | a measurement; neighbours sit side by side |

Add `title:` for the entry's heading; without it, a carousel's `slides_title` is used.

For a photo, put it in `content/linkedin/images/` and add `image: images/photo.jpg`
(several: `image: images/a.jpg, images/b.jpg`).

For a **carousel** (a document post), put the slide images in a folder, for example
`content/linkedin/images/my-carousel/slide-01.jpg`, `slide-02.jpg`, … and the PDF in
`content/linkedin/files/`, then add:

```
slides: images/my-carousel
slides_title: The carousel's title
document: files/my-carousel.pdf
```

The slides show as a strip that swipes on a phone and steps with arrows on a desktop,
with **Open PDF** and **Download** beside it. An `alts.txt` in the slides folder, one
line per slide, describes each slide for screen readers.
`2026-09-24-multilingual-retrieval.md` is a working example.

## A journal article

Create `content/blog/2026-09-24-the-address-you-want.md`. The part of the file name
after the date becomes the page address: `/blog/the-address-you-want`.

```
---
title: What broke when the index went stale
date: 2026-09-24
category: RAG & Retrieval
type: Postmortem
summary: One or two sentences — the engineering problem, not the conclusion.
tags: RAG, evaluation
---

The article, in Markdown.
```

| Field | What it does |
| --- | --- |
| `category` | One of: AI Systems, RAG & Retrieval, Inference, Agents, Evaluation, ML Infrastructure. Decides its domain page and its drawn picture. |
| `type` | Experiment, Deep dive, Postmortem, Design note, Field note or Benchmark. Shown in the metadata and in the link ("Read the experiment"). |
| `summary` | The abstract on cards, in the hero and in link previews. |
| `featured: true` | Puts it in the big slot at the top of the journal. Without one, the newest article goes there. |
| `start: 1` … `5` | Its place in **Start here**, the reading order for a first visit. |
| `cover: images/x.png` | A real picture — a benchmark graph, a terminal capture, a project screenshot. Without it the article gets a drawn plate for its domain. Add `cover_alt:` to describe it. |
| `draft: true` | Keeps it off the site. |

Markdown that works: `## headings`, **bold**, *italic*, `` `code` ``, fenced code
blocks with a language (```` ```python ````), tables, `> quotes`, lists,
`[links](https://…)` and images. Put images in `content/blog/images/` and write
`![caption](images/name.png)` on a line of its own; the caption shows underneath.
Code, tables and images step out wider than the text.

**Callouts** are quotes that start with a tag, with an optional title after it:

```
> [!FAILURE] The index was three days stale
> Retrieval kept returning the old policy, and the answer cited it confidently.
```

The tags: `[!OBSERVATION]`, `[!FAILURE]`, `[!BENCHMARK]`, `[!TRADEOFF]`,
`[!CHANGED]` (what changed my mind), `[!QUESTION]` (open question), `[!NOTE]`.

**For technical articles** — the page is built for long ones, with a contents rail,
numbered sections, a reading-progress line and notes in the margin:

| Write | For |
| --- | --- |
| `> [!TAKEAWAYS]` then `> - …` lines | Key takeaways, numbered, near the top |
| `> [!RESULTS] title` then `> - **2.53 s → 0.56 s** — prompt evaluation` | Headline numbers, set large enough to find by skimming |
| `> [!SETUP]` then `> - GPU: RTX 4050` | The conditions an experiment ran under, as a spec sheet |
| `Table: caption` on the line above a table | A numbered, captioned table; number-only columns align right |
| `![alt](images/x.png "Caption"){full}` | A numbered figure; `{narrow}`, wide (default) or `{full}` |
| `![a](images/a.png "Before") ![b](images/b.png "After")` | Figures side by side |
| ```` ```python title="bench.py" ```` | Code with a file name and a copy button |
| `$x^2$` and `$$ … $$` | Maths, typeset by KaTeX. Turned on by `math: true`, or by any `$$` block |
| `text[^id]` and `[^id]: the note` | A note: in the margin beside its line on a wide screen, and listed under *Notes & references* at the end — use it for citations |

See `2026-01-01-journal-style-guide.md` (a permanent draft) for every one of these in
place: `node build.mjs --drafts`.

### Drafts, and previewing

The articles already in `content/blog/` are **drafts**: the titles are yours; each
summary is a placeholder framing for you to rewrite; the bodies are empty. They stay
off the live site until you write them and delete the `draft: true` line.

To see drafts in place, with every section of the journal filled in, run
`node build.mjs --drafts` and open `http://localhost:4173/blog` (after
`python -m http.server 4173 --directory dist`). Drafts are marked, and the live
build never includes them. `2026-01-01-journal-style-guide.md` is a draft that shows
every element an article can use — keep it as a reference.

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

## Newsletter

The journal has a subscribe form, switched off until it has somewhere to send to. Sign
up with any service that accepts a plain form post with an email field (Buttondown,
ConvertKit, or your own serverless function), and put its form address in
`content/journal.json`:

```json
{ "newsletter": { "action": "https://…your provider's form address…", "field": "email" } }
```

Until then the journal offers the RSS feed (`/blog/feed.xml`) in its place.
