// The writing side of the site: journal articles, LinkedIn posts and downloadable notes.
//
// Everything is plain files, so publishing needs no dashboard and no API key:
//
//   content/blog/2026-09-24-some-title.md     a journal article, on its own page
//   content/linkedin/2026-09-24-anything.md   a LinkedIn post, shown in full on /blog
//   content/notes/some-notes.pdf              a PDF anyone can open or download
//   content/notes/some-notes.md               (optional) its title, date and summary
//   content/journal.json                      settings: the newsletter endpoint
//
// Why LinkedIn posts are files and not a live feed: LinkedIn does not let a website read
// a member's own posts. The permission that would (r_member_social) is closed to all but
// approved partners, and the scraping services that work around it break without notice.
// A file per post is one paste, and it keeps the full text here even if the post is
// later edited or deleted there.
//
// This module loads and parses. The pages themselves are in journal.mjs.
// No dependencies, like the rest of the build.

import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join, extname } from "node:path";

export const SITE = "https://soubhagya-jain-portfolio.vercel.app";
export const AUTHOR = "Soubhagya Jain";

/* ── the journal's domains ───────────────────────────────────────────────── */

// Fixed, so the journal has a shape before it has many articles. An article names one
// in `category:` by slug or name; the aliases catch the obvious variants.
export const DOMAINS = [
  { slug: "ai-systems", name: "AI Systems", aliases: ["systems", "system design", "reliability"],
    blurb: "How the parts fit: routing, fallbacks, observability, and what a system does when one component quietly fails." },
  { slug: "rag", name: "RAG & Retrieval", aliases: ["rag", "retrieval", "search"],
    blurb: "Hybrid search, reranking and grounding — and measuring whether the right evidence arrived." },
  { slug: "inference", name: "Inference", aliases: ["ai inference", "serving", "llm serving"],
    blurb: "KV caching, batching, model serving, latency and throughput experiments." },
  { slug: "agents", name: "Agents", aliases: ["agent", "agentic", "agentic ai"],
    blurb: "Planning, tool use and verification, and where multi-step systems break." },
  { slug: "evaluation", name: "Evaluation", aliases: ["eval", "evals", "testing"],
    blurb: "Harnesses, metrics and regression tests — and what an average hides." },
  { slug: "ml-infra", name: "ML Infrastructure", aliases: ["mlops", "infrastructure", "infra", "ml infrastructure"],
    blurb: "Pipelines, deployment and monitoring: the plumbing that keeps a model honest once it ships." }
];

export function domainOf(v) {
  const k = String(v || "").trim().toLowerCase();
  if (!k) return null;
  return DOMAINS.find((d) => d.slug === k || d.name.toLowerCase() === k || d.aliases.includes(k)) || null;
}

// What kind of piece it is changes how it is introduced and what the link says.
const TYPES = {
  "experiment": { label: "Experiment", cta: "Read the experiment" },
  "deep dive": { label: "Deep dive", cta: "Read the deep dive" },
  "postmortem": { label: "Postmortem", cta: "Read the postmortem" },
  "design note": { label: "Design note", cta: "Read the design note" },
  "field note": { label: "Field note", cta: "Read the note" },
  "benchmark": { label: "Benchmark", cta: "Read the benchmark" }
};
const typeOf = (v) => TYPES[String(v || "").trim().toLowerCase().replace(/-/g, " ")] || { label: "Article", cta: "Read the article" };

/* ── small helpers ───────────────────────────────────────────────────────── */

export const esc = (s) => String(s)
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export const slugify = (s) => String(s).toLowerCase()
  .normalize("NFKD").replace(/[̀-ͯ]/g, "")
  .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "untitled";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export const fmtDate = (d) => d ? `${String(d.getUTCDate()).padStart(2, "0")} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}` : "";
export const fmtMonth = (d) => d ? `${MONTHS_LONG[d.getUTCMonth()]} ${d.getUTCFullYear()}` : "";
export const isoDate = (d) => d ? d.toISOString().slice(0, 10) : "";

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
    data[kv[1].toLowerCase().replace(/-/g, "_")] = v;
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
    (_, t, href) => keep(`<a href="${esc(opt.link(href))}"${/^https?:/.test(href) ? ' rel="noopener"' : ""}>${inline(t, opt)}</a>`));
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

// Technical callouts, written GitHub-style:  > [!FAILURE] optional title
const CALLOUTS = {
  observation: "Observation", note: "Note",
  failure: "Failure mode", "failure-mode": "Failure mode",
  benchmark: "Benchmark", measurement: "Benchmark",
  tradeoff: "Engineering trade-off", "trade-off": "Engineering trade-off",
  changed: "What changed my mind", "what-changed": "What changed my mind", "changed-my-mind": "What changed my mind"
};

const splitRow = (l) => l.trim().replace(/^\|/, "").replace(/\|$/, "").split(/(?<!\\)\|/).map((c) => c.trim().replace(/\\\|/g, "|"));
const isTableSep = (l) => /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$/.test(l);

/**
 * Block structure. `breaks` keeps single line breaks as line breaks, which is how a
 * LinkedIn post is written: short lines on purpose, not paragraphs that happened to wrap.
 */
export function markdown(text, opt = {}) {
  opt = { media: (s) => s, link: (s) => s, breaks: false, hashtags: false, anchors: false, ids: new Set(), ...opt };
  const lines = text.replace(/\t/g, "    ").split(/\r?\n/);
  const out = [];
  let i = 0;

  const isBlockStart = (l, next) =>
    /^```/.test(l) || /^#{1,4}\s/.test(l) || /^>\s?/.test(l) || /^\s{0,3}([-*+]|\d+[.)])\s+/.test(l) ||
    /^\s{0,3}(-{3,}|\*{3,}|_{3,})\s*$/.test(l) || (l.includes("|") && next !== undefined && isTableSep(next));

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
      while (opt.ids.has(id)) id = `${slugify(m[2])}-${n++}`;
      opt.ids.add(id);
      const anchor = opt.anchors && level < 4 ? `<a class="anchor" href="#${id}" aria-label="Link to this section">#</a>` : "";
      out.push(`<h${level} id="${id}">${inline(m[2], opt)}${anchor}</h${level}>`);
      i++;
      continue;
    }

    if (/^\s{0,3}(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) { out.push("<hr>"); i++; continue; }

    if (line.includes("|") && i + 1 < lines.length && isTableSep(lines[i + 1])) {
      const head = splitRow(line);
      const align = splitRow(lines[i + 1]).map((c) => /^:-+:$/.test(c) ? "center" : /-+:$/.test(c) ? "right" : "");
      i += 2;
      const rows = [];
      while (i < lines.length && lines[i].includes("|") && lines[i].trim()) rows.push(splitRow(lines[i++]));
      const cell = (tag, c, k) => `<${tag}${align[k] ? ` style="text-align:${align[k]}"` : ""}>${inline(c, opt)}</${tag}>`;
      out.push(`<div class="table"><table><thead><tr>${head.map((c, k) => cell("th", c, k)).join("")}</tr></thead><tbody>${
        rows.map((r) => `<tr>${head.map((_, k) => cell("td", r[k] || "", k)).join("")}</tr>`).join("")}</tbody></table></div>`);
      continue;
    }

    if (/^>\s?/.test(line)) {
      const body = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) body.push(lines[i++].replace(/^>\s?/, ""));
      const c = /^\[!([\w-]+)\]\s*(.*)$/.exec(body[0] || "");
      if (c && CALLOUTS[c[1].toLowerCase()]) {
        const kind = CALLOUTS[c[1].toLowerCase()];
        const k = slugify(kind);
        out.push(`<aside class="callout" data-kind="${k}"><div class="c-label">${esc(kind)}${c[2] ? `<span>${inline(c[2], opt)}</span>` : ""}</div>${markdown(body.slice(1).join("\n"), { ...opt, anchors: false })}</aside>`);
      } else {
        out.push(`<blockquote>${markdown(body.join("\n"), { ...opt, anchors: false })}</blockquote>`);
      }
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
    while (i < lines.length && lines[i].trim() && !(para.length && isBlockStart(lines[i], lines[i + 1]))) para.push(lines[i++]);
    out.push(`<p>${inline(para.join("\n"), opt).replace(/\n/g, opt.breaks ? "<br>" : " ")}</p>`);
  }
  return out.join("\n");
}

export const plain = (md) => md
  .replace(/<!--[\s\S]*?-->/g, " ")
  .replace(/```[\s\S]*?```/g, " ")
  .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
  .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
  .replace(/^>\s*\[![\w-]+\]/gm, " ")
  .replace(/[#>*_`~|]/g, "")
  .replace(/\s+/g, " ").trim();

export const clip = (s, n) => s.length <= n ? s : s.slice(0, n).replace(/\s+\S*$/, "") + "…";

/* ── loading ─────────────────────────────────────────────────────────────── */

const MEDIA_EXT = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif", ".avif", ".svg"]);

function mdFiles(dir) {
  if (!existsSync(dir)) return [];
  // a leading underscore keeps a file out of the build entirely: templates, scratch
  return readdirSync(dir).filter((f) => f.endsWith(".md") && !f.startsWith("_") && !/^readme\.md$/i.test(f)).sort();
}

/**
 * Read everything under content/. Returns the entries, the files the build has to copy
 * (images, PDFs), settings, and a list of problems worth printing. A malformed file is
 * skipped with a warning rather than failing the build: one bad paste should not take
 * the whole site down. With `drafts`, articles marked `draft: true` are included and
 * flagged, for previewing locally; the deployed build never passes it.
 */
export function loadContent(root, { drafts = false } = {}) {
  const dir = join(root, "content");
  const warn = [];
  const copies = [];                                   // [from, toInsideDist]

  const mediaUrl = (sub) => (src) => {
    if (/^(https?:)?\/\//.test(src) || src.startsWith("/")) return src;
    const from = join(dir, sub, src);
    if (!existsSync(from)) { warn.push(`content/${sub}: image not found: ${src}`); return src; }
    return `/blog/media/${sub}/${src.replace(/^\.\//, "")}`;
  };

  const posts = [];

  for (const f of mdFiles(join(dir, "blog"))) {
    const { data, body } = frontMatter(readFileSync(join(dir, "blog", f), "utf8"));
    const draft = truthy(data.draft);
    if (draft && !drafts) continue;
    const date = parseDate(data.date) || parseDate(f);
    const title = data.title;
    if (!title) { warn.push(`content/blog/${f}: needs a "title:" line — skipped`); continue; }
    if (!date) { warn.push(`content/blog/${f}: needs a "date: YYYY-MM-DD" line (or a date at the start of the file name) — skipped`); continue; }
    const slug = slugify(data.slug || f.replace(/\.md$/, "").replace(/^\d{4}-\d{2}-\d{2}-?/, "") || title);
    let domain = domainOf(data.category);
    if (!domain) {
      if (data.category) warn.push(`content/blog/${f}: unknown category "${data.category}" — filed under AI Systems. Use one of: ${DOMAINS.map((d) => d.name).join(", ")}`);
      else warn.push(`content/blog/${f}: no "category:" — filed under AI Systems`);
      domain = DOMAINS[0];
    }
    const text = plain(body);
    const words = text ? text.split(" ").length : 0;
    const media = mediaUrl("blog");
    posts.push({
      kind: "article", slug, title, date, draft, domain, type: typeOf(data.type),
      tags: list(data.tags),
      summary: data.summary || data.excerpt || clip(text, 220),
      text,
      featured: truthy(data.featured),
      start: parseInt(data.start, 10) || 0,
      cover: data.cover ? media(data.cover) : "",
      coverAlt: data.cover_alt || "",
      html: markdown(body, { media, anchors: true }),
      minutes: Math.max(1, Math.round(words / 230)),
      href: `/blog/${slug}`, source: `content/blog/${f}`
    });
  }

  for (const f of mdFiles(join(dir, "linkedin"))) {
    const { data, body } = frontMatter(readFileSync(join(dir, "linkedin", f), "utf8"));
    if (truthy(data.draft) && !drafts) continue;
    const date = parseDate(data.date) || parseDate(f);
    if (!date) { warn.push(`content/linkedin/${f}: needs a "date: YYYY-MM-DD" line — skipped`); continue; }
    if (!body.trim()) { warn.push(`content/linkedin/${f}: the post text is empty — skipped`); continue; }
    const id = "li-" + slugify(f.replace(/\.md$/, ""));
    const media = mediaUrl("linkedin");
    posts.push({
      kind: "linkedin", id, date, url: data.url || "", draft: truthy(data.draft),
      html: markdown(body, { breaks: true, hashtags: true, media }),
      images: list(data.image || data.images).map(media),
      excerpt: clip(plain(body).replace(/#\w+/g, "").trim(), 150),
      href: `/blog/linkedin#${id}`, source: `content/linkedin/${f}`
    });
    if (!data.url) warn.push(`content/linkedin/${f}: no "url:" — it will show without a link back to LinkedIn`);
  }

  // every image sitting next to the articles, so a relative path in Markdown works
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
      if (truthy(data.draft) && !drafts) continue;
      const file = slugify(base) + ".pdf";
      copies.push([join(nd, f), `notes/files/${file}`]);
      notes.push({
        title: data.title || base.replace(/^\d{4}-\d{2}-\d{2}[-_ ]?/, "").replace(/[-_]+/g, " ").replace(/^\w/, (c) => c.toUpperCase()),
        date: parseDate(data.date) || parseDate(f),
        summary: data.summary || plain(body),
        topics: list(data.topics || data.tags),
        pages: data.pages || "",
        href: `/notes/files/${file}`, download: file, size: fmtBytes(statSync(join(nd, f)).size)
      });
    }
    for (const f of mdFiles(nd)) {
      if (!existsSync(join(nd, f.replace(/\.md$/, ".pdf")))) warn.push(`content/notes/${f}: there is no PDF named ${f.replace(/\.md$/, ".pdf")} next to it`);
    }
  }
  notes.sort((a, b) => (b.date || 0) - (a.date || 0) || a.title.localeCompare(b.title));

  let settings = {};
  const sf = join(dir, "journal.json");
  if (existsSync(sf)) {
    try { settings = JSON.parse(readFileSync(sf, "utf8")); }
    catch (e) { warn.push(`content/journal.json does not parse (${e.message}) — using defaults`); }
  }

  return { posts, notes, copies, warn, settings, drafts };
}

/* ── the home page's Writing chapter ─────────────────────────────────────── */

/**
 * Markup for the chapter on the home page: the latest three of each, pointing at the
 * full pages. It uses the page's own reveal hook (data-reveal2), so it arrives the way
 * every other chapter does, and it degrades to plain visible content without JS.
 */
export function homeWriting({ posts, notes }) {
  const row = (p) => p.kind === "article"
    ? `<li><a href="${p.href}"><span class="w-meta"><time datetime="${isoDate(p.date)}">${fmtDate(p.date)}</time> &#183; ${esc(p.domain.name)} &#183; ${esc(p.type.label)}</span><span class="w-title">${esc(p.title)}</span></a></li>`
    : `<li><a href="${p.href}"><span class="w-meta"><time datetime="${isoDate(p.date)}">${fmtDate(p.date)}</time> &#183; LinkedIn</span><span class="w-text">${esc(p.excerpt)}</span></a></li>`;
  const doc = (n) => `<li><a href="${n.href}" download="${esc(n.download)}"><span class="w-meta">PDF &#183; ${n.size}${n.date ? ` &#183; <time datetime="${isoDate(n.date)}">${fmtDate(n.date)}</time>` : ""}</span><span class="w-title">${esc(n.title)} <span class="w-dl" aria-hidden="true">&#8595;</span></span></a></li>`;

  return `<div class="w-cols">
      <div id="writing-blog" class="w-col" data-reveal2="1">
        <div class="w-label"><span class="n">05.1</span><span class="s">/</span>Journal</div>
        ${posts.length ? `<ul class="w-list">${posts.slice(0, 3).map(row).join("")}</ul>` : `<p class="w-empty">Nothing published yet.</p>`}
        <a class="w-all" href="/blog">${posts.length > 3 ? `All ${posts.length} entries` : "Open the journal"} <span aria-hidden="true">&#8594;</span></a>
      </div>
      <div id="writing-notes" class="w-col" data-reveal2="2">
        <div class="w-label"><span class="n">05.2</span><span class="s">/</span>Notes &#183; PDF</div>
        ${notes.length ? `<ul class="w-list">${notes.slice(0, 3).map(doc).join("")}</ul>` : `<p class="w-empty">No notes uploaded yet.</p>`}
        <a class="w-all" href="/notes">${notes.length > 3 ? `All ${notes.length} notes` : "Open the library"} <span aria-hidden="true">&#8594;</span></a>
      </div>
    </div>`;
}
