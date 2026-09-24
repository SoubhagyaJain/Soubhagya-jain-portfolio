// The writing side of the site: blog articles, LinkedIn posts and downloadable notes.
//
// Everything here is plain files, so publishing needs no dashboard and no API key:
//
//   content/blog/2026-09-24-some-title.md     an article, rendered on its own page
//   content/linkedin/2026-09-24-anything.md   a LinkedIn post, shown in full on /blog
//   content/notes/some-notes.pdf              a PDF anyone can open or download
//   content/notes/some-notes.md               (optional) its title, date and summary
//
// Why LinkedIn posts are files and not a live feed: LinkedIn does not let a website read
// a member's own posts. The permission that would (r_member_social) is closed to all but
// approved partners, and the scraping services that work around it break without notice.
// A file per post is one paste, and it keeps the full text on this site even if the post
// is later edited or deleted there.
//
// No dependencies, like the rest of the build: node:fs, node:path and a small Markdown
// renderer that covers what writing about engineering needs (headings, code, lists,
// quotes, links, images) and escapes everything else.

import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join, extname, basename } from "node:path";

export const SITE = "https://soubhagya-jain-portfolio.vercel.app";
const AUTHOR = "Soubhagya Jain";

/* ── small helpers ───────────────────────────────────────────────────────── */

export const esc = (s) => String(s)
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const slugify = (s) => String(s).toLowerCase()
  .normalize("NFKD").replace(/[̀-ͯ]/g, "")
  .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "untitled";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const fmtDate = (d) => d ? `${String(d.getUTCDate()).padStart(2, "0")} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}` : "";
const isoDate = (d) => d ? d.toISOString().slice(0, 10) : "";

function parseDate(v) {
  if (!v) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v).trim());
  if (!m) return null;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return isNaN(d) ? null : d;
}

const fmtBytes = (n) => n >= 1048576 ? (n / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round(n / 1024)) + " KB";

/** `---` fenced front matter, one `key: value` per line. Enough YAML for this job. */
export function frontMatter(text) {
  const src = text.replace(/^﻿/, "");
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(src);
  if (!m) return { data: {}, body: src };
  const data = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = /^\s*([A-Za-z][\w-]*)\s*:\s*(.*?)\s*$/.exec(line);
    if (!kv) continue;
    let v = kv[2];
    if (/^(['"]).*\1$/.test(v)) v = v.slice(1, -1);
    data[kv[1].toLowerCase()] = v;
  }
  return { data, body: src.slice(m[0].length) };
}

const list = (v) => (v ? String(v).replace(/^\[|\]$/g, "").split(",").map((s) => s.trim().replace(/^['"]|['"]$/g, "")).filter(Boolean) : []);
const truthy = (v) => /^(true|yes|1)$/i.test(String(v || "").trim());

/* ── Markdown ────────────────────────────────────────────────────────────── */

/**
 * Inline spans. Code spans, links and images are lifted out into placeholders first,
 * so that nothing inside them (a URL, an underscore in a variable name) is re-read as
 * emphasis or linked twice.
 */
function inline(raw, opt) {
  const stash = [];
  const keep = (html) => `\u0000${stash.push(html) - 1}\u0000`;
  let s = raw;

  s = s.replace(/`([^`\n]+)`/g, (_, c) => keep(`<code>${esc(c)}</code>`));
  s = s.replace(/!\[([^\]]*)\]\(\s*<?([^)\s>]+)>?(?:\s+"([^"]*)")?\s*\)/g,
    (_, alt, src) => keep(`<img src="${esc(opt.media(src))}" alt="${esc(alt)}" loading="lazy" decoding="async">`));
  s = s.replace(/\[([^\]]+)\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)/g,
    (_, text, href) => keep(`<a href="${esc(opt.link(href))}"${/^https?:/.test(href) ? ' rel="noopener"' : ""}>${inline(text, opt)}</a>`));
  s = s.replace(/<(https?:\/\/[^>\s]+)>/g, (_, u) => keep(`<a href="${esc(u)}" rel="noopener">${esc(u)}</a>`));
  // bare URLs, minus trailing punctuation that belongs to the sentence
  s = s.replace(/https?:\/\/[^\s<>"]*[^\s<>".,;:!?)'\]]/g, (u) => keep(`<a href="${esc(u)}" rel="noopener">${esc(u.replace(/^https?:\/\/(www\.)?/, ""))}</a>`));

  s = esc(s);
  s = s.replace(/\*\*(?=\S)([^*]+?)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/(^|[^*\w])\*(?=\S)([^*\n]+?)\*(?!\w)/g, "$1<em>$2</em>");
  s = s.replace(/(^|[^\w])_(?=\S)([^_\n]+?)_(?!\w)/g, "$1<em>$2</em>");
  s = s.replace(/~~(?=\S)([^~]+?)~~/g, "<del>$1</del>");
  if (opt.hashtags) s = s.replace(/(^|[\s(])#([A-Za-z][\w]*)/g, '$1<span class="tag">#$2</span>');

  return s.replace(/\u0000(\d+)\u0000/g, (_, i) => stash[+i]);
}

/**
 * Block structure. `breaks` keeps single line breaks as line breaks, which is how a
 * LinkedIn post is written: short lines on purpose, not paragraphs that happened to wrap.
 */
export function markdown(text, opt = {}) {
  opt = { media: (s) => s, link: (s) => s, breaks: false, hashtags: false, ...opt };
  const lines = text.replace(/\t/g, "    ").split(/\r?\n/);
  const out = [];
  const ids = new Set();
  let i = 0;

  const isBlockStart = (l) =>
    /^```/.test(l) || /^#{1,4}\s/.test(l) || /^>\s?/.test(l) || /^\s{0,3}([-*+]|\d+[.)])\s+/.test(l) ||
    /^\s{0,3}(-{3,}|\*{3,}|_{3,})\s*$/.test(l);

  while (i < lines.length) {
    const line = lines[i];

    if (!line.trim()) { i++; continue; }

    let m;
    if ((m = /^```\s*([\w+-]*)/.exec(line))) {
      const body = [];
      i++;
      while (i < lines.length && !/^```\s*$/.test(lines[i])) body.push(lines[i++]);
      i++;
      const lang = m[1] ? ` data-lang="${esc(m[1])}"` : "";
      out.push(`<pre${lang}><code>${esc(body.join("\n"))}</code></pre>`);
      continue;
    }

    if ((m = /^(#{1,4})\s+(.*?)\s*#*\s*$/.exec(line))) {
      const level = Math.max(2, m[1].length);          // the page title is the only h1
      let id = slugify(m[2].replace(/[`*_]/g, "")), n = 2;
      while (ids.has(id)) id = `${slugify(m[2])}-${n++}`;
      ids.add(id);
      out.push(`<h${level} id="${id}">${inline(m[2], opt)}</h${level}>`);
      i++;
      continue;
    }

    if (/^\s{0,3}(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) { out.push("<hr>"); i++; continue; }

    if (/^>\s?/.test(line)) {
      const body = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) body.push(lines[i++].replace(/^>\s?/, ""));
      out.push(`<blockquote>${markdown(body.join("\n"), opt)}</blockquote>`);
      continue;
    }

    if ((m = /^\s{0,3}([-*+]|\d+[.)])\s+/.exec(line))) {
      const ordered = /\d/.test(m[1]);
      const start = ordered ? parseInt(m[1], 10) : 1;
      const items = [];
      while (i < lines.length) {
        const l = lines[i];
        const im = /^\s{0,3}([-*+]|\d+[.)])\s+(.*)$/.exec(l);
        if (im && /\d/.test(im[1]) === ordered) { items.push(im[2]); i++; continue; }
        // an indented line continues the item above it
        if (items.length && l.trim() && /^\s{2,}/.test(l) && !im) { items[items.length - 1] += "\n" + l.trim(); i++; continue; }
        break;
      }
      const tag = ordered ? "ol" : "ul";
      const attr = ordered && start !== 1 ? ` start="${start}"` : "";
      out.push(`<${tag}${attr}>${items.map((t) => `<li>${inline(t, opt).replace(/\n/g, opt.breaks ? "<br>" : " ")}</li>`).join("")}</${tag}>`);
      continue;
    }

    // an image on a line of its own is a figure, and its alt text is the caption
    if ((m = /^!\[([^\]]*)\]\(\s*<?([^)\s>]+)>?(?:\s+"([^"]*)")?\s*\)\s*$/.exec(line))) {
      const cap = m[3] || m[1];
      out.push(`<figure><img src="${esc(opt.media(m[2]))}" alt="${esc(m[1])}" loading="lazy" decoding="async">${cap ? `<figcaption>${inline(cap, opt)}</figcaption>` : ""}</figure>`);
      i++;
      continue;
    }

    const para = [];
    while (i < lines.length && lines[i].trim() && !(para.length && isBlockStart(lines[i]))) para.push(lines[i++]);
    out.push(`<p>${inline(para.join("\n"), opt).replace(/\n/g, opt.breaks ? "<br>" : " ")}</p>`);
  }
  return out.join("\n");
}

const plain = (md) => md
  .replace(/```[\s\S]*?```/g, " ")
  .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
  .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
  .replace(/[#>*_`~]/g, "")
  .replace(/\s+/g, " ").trim();

const clip = (s, n) => s.length <= n ? s : s.slice(0, n).replace(/\s+\S*$/, "") + "…";

/* ── loading ─────────────────────────────────────────────────────────────── */

const MEDIA_EXT = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif", ".avif", ".svg"]);

function mdFiles(dir) {
  if (!existsSync(dir)) return [];
  // a leading underscore keeps a file out of the build: templates, drafts in progress
  return readdirSync(dir).filter((f) => f.endsWith(".md") && !f.startsWith("_") && !/^readme\.md$/i.test(f)).sort();
}

/**
 * Read everything under content/. Returns the entries, the files the build has to copy
 * (article images, PDFs), and a list of problems worth printing. A malformed file is
 * skipped with a warning rather than failing the build: one bad paste should not take
 * the whole site down.
 */
export function loadContent(root) {
  const dir = join(root, "content");
  const warn = [];
  const copies = [];                                   // [from, toInsideDist]

  const mediaUrl = (sub) => (src) => {
    if (/^(https?:)?\/\//.test(src) || src.startsWith("/")) return src;
    const from = join(dir, sub, src);
    if (!existsSync(from)) { warn.push(`content/${sub}: image not found: ${src}`); return src; }
    const to = `blog/media/${sub}/${src.replace(/^\.\//, "")}`;
    copies.push([from, to]);
    return "/" + to;
  };

  const posts = [];

  for (const f of mdFiles(join(dir, "blog"))) {
    const { data, body } = frontMatter(readFileSync(join(dir, "blog", f), "utf8"));
    if (truthy(data.draft)) continue;
    const date = parseDate(data.date) || parseDate(f);
    const title = data.title;
    if (!title) { warn.push(`content/blog/${f}: needs a "title:" line — skipped`); continue; }
    if (!date) { warn.push(`content/blog/${f}: needs a "date: YYYY-MM-DD" line (or a date at the start of the file name) — skipped`); continue; }
    const slug = slugify(data.slug || f.replace(/\.md$/, "").replace(/^\d{4}-\d{2}-\d{2}-?/, "") || title);
    const text = plain(body);
    const words = text ? text.split(" ").length : 0;
    posts.push({
      kind: "article", slug, title, date, tags: list(data.tags),
      summary: data.summary || clip(text, 220),
      html: markdown(body, { media: mediaUrl("blog") }),
      minutes: Math.max(1, Math.round(words / 230)),
      href: `/blog/${slug}`, source: `content/blog/${f}`
    });
  }

  for (const f of mdFiles(join(dir, "linkedin"))) {
    const { data, body } = frontMatter(readFileSync(join(dir, "linkedin", f), "utf8"));
    if (truthy(data.draft)) continue;
    const date = parseDate(data.date) || parseDate(f);
    if (!date) { warn.push(`content/linkedin/${f}: needs a "date: YYYY-MM-DD" line — skipped`); continue; }
    if (!body.trim()) { warn.push(`content/linkedin/${f}: the post text is empty — skipped`); continue; }
    const id = "li-" + slugify(f.replace(/\.md$/, ""));
    const media = mediaUrl("linkedin");
    const images = list(data.image || data.images).map(media);
    posts.push({
      kind: "linkedin", id, date, url: data.url || "",
      html: markdown(body, { breaks: true, hashtags: true, media }),
      images, excerpt: clip(plain(body).replace(/#\w+/g, "").trim(), 150),
      href: `/blog#${id}`, source: `content/linkedin/${f}`
    });
    if (!data.url) warn.push(`content/linkedin/${f}: no "url:" — it will show without a link back to LinkedIn`);
  }

  // copy every image sitting next to the articles, so a relative path in Markdown works
  for (const sub of ["blog", "linkedin"]) {
    const d = join(dir, sub);
    if (!existsSync(d)) continue;
    const walk = (rel) => {
      for (const e of readdirSync(join(d, rel), { withFileTypes: true })) {
        const r = rel ? `${rel}/${e.name}` : e.name;
        if (e.isDirectory()) walk(r);
        else if (MEDIA_EXT.has(extname(e.name).toLowerCase())) copies.push([join(d, r), `blog/media/${sub}/${r}`]);
      }
    };
    walk("");
  }

  const slugs = new Set();
  for (const p of posts.filter((p) => p.kind === "article")) {
    if (slugs.has(p.slug)) warn.push(`${p.source}: another article already uses the address /blog/${p.slug}`);
    slugs.add(p.slug);
  }
  posts.sort((a, b) => b.date - a.date || (a.title || a.id).localeCompare(b.title || b.id));

  const notes = [];
  const nd = join(dir, "notes");
  if (existsSync(nd)) {
    for (const f of readdirSync(nd).filter((f) => /\.pdf$/i.test(f) && !f.startsWith("_")).sort()) {
      const base = f.replace(/\.pdf$/i, "");
      const side = join(nd, base + ".md");
      const { data, body } = existsSync(side) ? frontMatter(readFileSync(side, "utf8")) : { data: {}, body: "" };
      if (truthy(data.draft)) continue;
      const file = slugify(base) + ".pdf";
      copies.push([join(nd, f), `notes/files/${file}`]);
      const bytes = statSync(join(nd, f)).size;
      notes.push({
        title: data.title || base.replace(/^\d{4}-\d{2}-\d{2}[-_ ]?/, "").replace(/[-_]+/g, " ").replace(/^\w/, (c) => c.toUpperCase()),
        date: parseDate(data.date) || parseDate(f),
        summary: data.summary || plain(body),
        topics: list(data.topics || data.tags),
        pages: data.pages || "",
        href: `/notes/files/${file}`, download: file, size: fmtBytes(bytes)
      });
    }
    for (const f of mdFiles(nd)) {
      if (!existsSync(join(nd, f.replace(/\.md$/, ".pdf")))) warn.push(`content/notes/${f}: there is no PDF named ${f.replace(/\.md$/, ".pdf")} next to it`);
    }
  }
  notes.sort((a, b) => (b.date || 0) - (a.date || 0) || a.title.localeCompare(b.title));

  return { posts, notes, copies, warn };
}

/* ── pages ───────────────────────────────────────────────────────────────── */

const NAV = [
  ["About", "/#about"], ["Work", "/#selected-systems"], ["Blog", "/blog"], ["Notes", "/notes"], ["Contact", "/#contact"]
];

// The ground is the same place as the home page's hero, at the weather the visitor
// last chose there, sunk behind a scrim so it reads as texture. The upright portrait
// cuts are used at every size: cover-fitting one into a wide window keeps the band
// around the horizon, which is the quietest part of the picture.
const GROUND_SCRIPT = `(function(){try{var t=localStorage.getItem("lp-theme");var f=t==="day"?"day":t==="storm"?"storm":"night";var g=document.querySelector("[data-ground]");if(g&&f!=="night")g.src="/assets/plate-"+f+"-portrait.jpg";}catch(e){}})();`;

function shell({ title, description, path, active, main, cssHref, fontHref, extraHead = "" }) {
  const full = title ? `${title} — ${AUTHOR}` : `${AUTHOR}`;
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(full)}</title>
<meta name="description" content="${esc(description)}">
<meta name="color-scheme" content="dark">
<link rel="canonical" href="${SITE}${path}">
<meta property="og:title" content="${esc(full)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${SITE}${path}">
<link rel="alternate" type="application/rss+xml" title="${AUTHOR} — Blog" href="/blog/feed.xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="${esc(fontHref)}">
<link rel="stylesheet" href="${cssHref}">
${extraHead}</head>
<body>
<a class="skip" href="#main">Skip to content</a>
<div class="ground" aria-hidden="true"><img data-ground src="/assets/plate-night-portrait.jpg" alt=""></div>
<script>${GROUND_SCRIPT}</script>
<header class="pnav">
  <nav aria-label="Site">
    <a class="brand" href="/">${AUTHOR}</a>
    <span class="sep" aria-hidden="true"></span>
    <div class="links">
      ${NAV.map(([l, h]) => `<a href="${h}"${l === active ? ' aria-current="page"' : ""}>${l}</a>`).join("\n      ")}
    </div>
  </nav>
</header>
<main id="main">
${main}
</main>
<footer class="pfoot">
  <div class="wrap">
    <a class="brand" href="/">${AUTHOR}</a>
    <div class="flinks"><a href="/#contact">Contact</a><a href="/blog/feed.xml">RSS</a><a href="https://www.linkedin.com/in/soubhagya-jain-118205204" rel="noopener">LinkedIn</a><a href="https://github.com/SoubhagyaJain" rel="noopener">GitHub</a></div>
  </div>
</footer>
</body>
</html>
`;
}

const kindLabel = (p) => p.kind === "linkedin" ? "LinkedIn" : "Article";

function entryHtml(p) {
  const when = `<time datetime="${isoDate(p.date)}">${fmtDate(p.date)}</time>`;
  if (p.kind === "article") {
    return `<article class="entry" data-kind="article">
  <div class="rail">${when}<span class="kind">Article</span></div>
  <div class="body">
    <h2><a href="${p.href}">${esc(p.title)}</a></h2>
    <p class="summary">${esc(p.summary)}</p>
    <div class="meta"><span>${p.minutes} min read</span>${p.tags.map((t) => `<span>${esc(t)}</span>`).join("")}</div>
    <a class="more" href="${p.href}">Read the article <span aria-hidden="true">&#8594;</span></a>
  </div>
</article>`;
  }
  return `<article class="entry" data-kind="linkedin" id="${p.id}">
  <div class="rail">${when}<span class="kind">LinkedIn</span></div>
  <div class="body">
    <div class="post">${p.html}</div>
    ${p.images.length ? `<div class="shots">${p.images.map((src) => `<img src="${esc(src)}" alt="" loading="lazy" decoding="async">`).join("")}</div>` : ""}
    ${p.url ? `<a class="more" href="${esc(p.url)}" rel="noopener">View on LinkedIn <span aria-hidden="true">&#8599;</span></a>` : ""}
  </div>
</article>`;
}

export function renderPages({ posts, notes }, { cssHref, fontHref }) {
  const pages = [];
  const articles = posts.filter((p) => p.kind === "article");
  const hasBoth = articles.length && articles.length < posts.length;

  const blogMain = `<div class="wrap">
  <header class="phead">
    <div class="eyebrow">Blog${posts.length ? ` <span>&#183; ${posts.length} ${posts.length === 1 ? "entry" : "entries"}</span>` : ""}</div>
    <h1>Writing.</h1>
    <p class="lead">Longer pieces written here, and everything I post on LinkedIn, kept in full.</p>
    ${hasBoth ? `<div class="filter" role="group" aria-label="Show">
      <button type="button" data-f="all" aria-pressed="true">All</button><button type="button" data-f="article" aria-pressed="false">Articles</button><button type="button" data-f="linkedin" aria-pressed="false">LinkedIn</button>
    </div>` : ""}
  </header>
  ${posts.length
    ? `<div class="stream" data-show="all">\n${posts.map(entryHtml).join("\n")}\n</div>`
    : `<p class="empty">Nothing published yet.</p>`}
</div>
${hasBoth ? `<script>(function(){var s=document.querySelector(".stream"),b=[].slice.call(document.querySelectorAll(".filter button"));b.forEach(function(x){x.addEventListener("click",function(){s.setAttribute("data-show",x.dataset.f);b.forEach(function(y){y.setAttribute("aria-pressed",y===x?"true":"false")})})})})();</script>` : ""}`;
  pages.push(["blog/index.html", shell({
    title: "Blog", path: "/blog", active: "Blog", cssHref, fontHref, main: blogMain,
    description: "Articles and LinkedIn posts by Soubhagya Jain on retrieval, agents, evaluation and inference."
  })]);

  articles.forEach((p) => {
    const i = articles.indexOf(p);
    const newer = articles[i - 1], older = articles[i + 1];
    const main = `<article class="wrap article">
  <a class="back" href="/blog"><span aria-hidden="true">&#8592;</span> Blog</a>
  <header class="ahead">
    <div class="eyebrow"><time datetime="${isoDate(p.date)}">${fmtDate(p.date)}</time> <span>&#183; ${p.minutes} min read</span></div>
    <h1>${esc(p.title)}</h1>
    ${p.summary ? `<p class="lead">${esc(p.summary)}</p>` : ""}
  </header>
  <div class="prose">
${p.html}
  </div>
  <footer class="afoot">
    ${p.tags.length ? `<div class="meta">${p.tags.map((t) => `<span>${esc(t)}</span>`).join("")}</div>` : ""}
    <nav class="pager" aria-label="More articles">
      ${older ? `<a href="${older.href}"><span class="dir">Earlier</span><span class="t">${esc(older.title)}</span></a>` : "<span></span>"}
      ${newer ? `<a href="${newer.href}" class="next"><span class="dir">Later</span><span class="t">${esc(newer.title)}</span></a>` : ""}
    </nav>
  </footer>
</article>`;
    pages.push([`blog/${p.slug}/index.html`, shell({
      title: p.title, path: p.href, active: "Blog", cssHref, fontHref, main, description: p.summary,
      extraHead: `<meta property="og:type" content="article">\n<meta property="article:published_time" content="${isoDate(p.date)}">\n`
    })]);
  });

  const notesMain = `<div class="wrap">
  <header class="phead">
    <div class="eyebrow">Notes${notes.length ? ` <span>&#183; ${notes.length} PDF${notes.length === 1 ? "" : "s"}</span>` : ""}</div>
    <h1>Notes.</h1>
    <p class="lead">Study notes and write-ups, as PDFs. Free to read and to download.</p>
  </header>
  ${notes.length ? `<ol class="library">
${notes.map((n) => `  <li class="doc">
    <div class="rail">${n.date ? `<time datetime="${isoDate(n.date)}">${fmtDate(n.date)}</time>` : ""}<span class="kind">PDF &#183; ${n.size}${n.pages ? ` &#183; ${esc(n.pages)} pp` : ""}</span></div>
    <div class="body">
      <h2><a href="${n.href}" target="_blank" rel="noopener">${esc(n.title)}</a></h2>
      ${n.summary ? `<p class="summary">${esc(n.summary)}</p>` : ""}
      ${n.topics.length ? `<div class="meta">${n.topics.map((t) => `<span>${esc(t)}</span>`).join("")}</div>` : ""}
    </div>
    <div class="acts">
      <a href="${n.href}" target="_blank" rel="noopener">Open <span aria-hidden="true">&#8599;</span></a>
      <a href="${n.href}" download="${esc(n.download)}" class="dl">Download <span aria-hidden="true">&#8595;</span></a>
    </div>
  </li>`).join("\n")}
  </ol>` : `<p class="empty">No notes uploaded yet.</p>`}
</div>`;
  pages.push(["notes/index.html", shell({
    title: "Notes", path: "/notes", active: "Notes", cssHref, fontHref, main: notesMain,
    description: "Study notes and write-ups by Soubhagya Jain, free to download as PDFs."
  })]);

  const feed = `<?xml version="1.0" encoding="utf-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
<title>${esc(AUTHOR)} — Blog</title>
<link>${SITE}/blog</link>
<atom:link href="${SITE}/blog/feed.xml" rel="self" type="application/rss+xml"/>
<description>Articles and LinkedIn posts on retrieval, agents, evaluation and inference.</description>
<language>en</language>
${posts.slice(0, 30).map((p) => `<item>
<title>${esc(p.kind === "article" ? p.title : "LinkedIn: " + p.excerpt)}</title>
<link>${SITE}${p.href}</link>
<guid isPermaLink="false">${SITE}${p.kind === "article" ? p.href : "/blog#" + p.id}</guid>
<pubDate>${p.date.toUTCString()}</pubDate>
<description>${esc(p.html)}</description>
</item>`).join("\n")}
</channel>
</rss>
`;
  pages.push(["blog/feed.xml", feed]);
  return pages;
}

/* ── the home page's Writing chapter ─────────────────────────────────────── */

/**
 * Markup for the chapter on the home page: the latest three of each, pointing at the
 * full pages. It uses the page's own reveal hook (data-reveal2), so it arrives the way
 * every other chapter does, and it degrades to plain visible content without JS.
 */
export function homeWriting({ posts, notes }) {
  const row = (p) => p.kind === "article"
    ? `<li><a href="${p.href}"><span class="w-meta"><time datetime="${isoDate(p.date)}">${fmtDate(p.date)}</time> &#183; Article</span><span class="w-title">${esc(p.title)}</span></a></li>`
    : `<li><a href="${p.href}"><span class="w-meta"><time datetime="${isoDate(p.date)}">${fmtDate(p.date)}</time> &#183; LinkedIn</span><span class="w-text">${esc(p.excerpt)}</span></a></li>`;
  const doc = (n) => `<li><a href="${n.href}" download="${esc(n.download)}"><span class="w-meta">PDF &#183; ${n.size}${n.date ? ` &#183; <time datetime="${isoDate(n.date)}">${fmtDate(n.date)}</time>` : ""}</span><span class="w-title">${esc(n.title)} <span class="w-dl" aria-hidden="true">&#8595;</span></span></a></li>`;

  return `<div class="w-cols">
      <div id="writing-blog" class="w-col" data-reveal2="1">
        <div class="w-label"><span class="n">05.1</span><span class="s">/</span>Blog</div>
        ${posts.length ? `<ul class="w-list">${posts.slice(0, 3).map(row).join("")}</ul>` : `<p class="w-empty">Nothing published yet.</p>`}
        <a class="w-all" href="/blog">${posts.length > 3 ? `All ${posts.length} posts` : "Open the blog"} <span aria-hidden="true">&#8594;</span></a>
      </div>
      <div id="writing-notes" class="w-col" data-reveal2="2">
        <div class="w-label"><span class="n">05.2</span><span class="s">/</span>Notes &#183; PDF</div>
        ${notes.length ? `<ul class="w-list">${notes.slice(0, 3).map(doc).join("")}</ul>` : `<p class="w-empty">No notes uploaded yet.</p>`}
        <a class="w-all" href="/notes">${notes.length > 3 ? `All ${notes.length} notes` : "Open the library"} <span aria-hidden="true">&#8594;</span></a>
      </div>
    </div>`;
}
