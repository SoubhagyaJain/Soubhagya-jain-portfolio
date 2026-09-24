// The Engineering Journal (/blog), its domain pages, the article reading page, the
// LinkedIn archive and the Notes library — as plain functions returning HTML.
//
// Each function is one component, named for what it is on the page:
//
//   BlogHero · CategoryCard · ArticleListItem · EngineeringNoteBanner · ArticleCard
//   AuthorAside · ArticleMetadata · ArticleLayout · (TechnicalCallout is Markdown:
//   `> [!FAILURE]`, rendered in content.mjs)
//
// They all read the same article record — title, slug, summary, date, domain, type,
// tags, minutes, featured, start, cover — so moving to MDX or a CMS later means
// producing that record from somewhere else, not rewriting the pages.

import { plate } from "./plates.mjs";
import { DOMAINS, SITE, AUTHOR, esc, fmtDate, fmtMonth, isoDate, clip } from "./content.mjs";

const LINKEDIN = "https://www.linkedin.com/in/soubhagya-jain-118205204";
const GITHUB = "https://github.com/SoubhagyaJain";
const arrow = `<span class="arr" aria-hidden="true">&#8594;</span>`;
const pad2 = (n) => String(n).padStart(2, "0");

/* ── shared pieces ───────────────────────────────────────────────────────── */

/** The article's picture: its own cover if it has one, otherwise its domain's plate. */
function Visual(p, { eager = false, label = "", zoom } = {}) {
  if (p.cover) {
    return `<img src="${esc(p.cover)}" alt="${esc(p.coverAlt)}" ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async">`;
  }
  return plate(p.domain.slug, p.slug, { label, zoom });
}

/** Category · type · date · reading time, in one quiet mono line. */
function ArticleMetadata(p, { link = false, month = false } = {}) {
  const cat = link
    ? `<a class="am-cat" href="/blog/topic/${p.domain.slug}">${esc(p.domain.name)}</a>`
    : `<span class="am-cat">${esc(p.domain.name)}</span>`;
  return `<div class="am">${cat}<span>${esc(p.type.label)}</span><time datetime="${isoDate(p.date)}">${month ? fmtMonth(p.date) : fmtDate(p.date)}</time><span>${p.minutes} min read</span>${p.draft ? '<span class="am-draft">Draft</span>' : ""}</div>`;
}

function SectionHead({ id, eyebrow, title, aside = "" }) {
  return `<header class="sh" data-rv>
    <div class="sh-eyebrow">${eyebrow}</div>
    <h2 id="${id}">${title}</h2>
    ${aside ? `<div class="sh-aside">${aside}</div>` : ""}
  </header>`;
}

/* ── BlogHero ────────────────────────────────────────────────────────────── */

function BlogHero(p) {
  return `<article class="hero" aria-labelledby="hero-title">
  <div class="hero-vis dark${p.cover ? "" : " drawn"}">${Visual(p, { eager: true, zoom: [1, 1.12] })}</div>
  <div class="hero-shade" aria-hidden="true"></div>
  <div class="hero-fig" aria-hidden="true">Fig. ${esc(p.domain.name.toLowerCase())}</div>
  <div class="hero-body">
    <div class="hero-kicker"><span class="flag">Featured ${esc(p.type.label.toLowerCase())}</span>${ArticleMetadata(p, { link: false, month: true })}</div>
    <h2 id="hero-title" class="hero-title" data-split><a href="${p.href}">${esc(p.title)}</a></h2>
    <p class="hero-abstract">${esc(p.summary)}</p>
    <a class="cta" href="${p.href}">${esc(p.type.cta)} ${arrow}</a>
  </div>
</article>`;
}

/* ── CategoryCard ────────────────────────────────────────────────────────── */

function CategoryCard(d, count, i) {
  return `<a class="cat" href="/blog/topic/${d.slug}" data-rv style="--i:${i}">
  <div class="cat-vis dark">${plate(d.slug, "domain-" + i, { zoom: [1.1, 1.45] })}</div>
  <div class="cat-body">
    <div class="cat-count">${count} ${count === 1 ? "article" : "articles"}</div>
    <h3 class="cat-name">${esc(d.name)}</h3>
    <p class="cat-blurb">${esc(d.blurb)}</p>
    <span class="cat-go">Browse ${arrow}</span>
  </div>
</a>`;
}

/* ── ArticleListItem ─────────────────────────────────────────────────────── */

function ArticleListItem(p, i) {
  return `<li class="sl" data-rv style="--i:${i}"><a href="${p.href}">
  <span class="sl-n">${pad2(i + 1)}</span>
  <span class="sl-meta"><span class="c">${esc(p.domain.name)}</span><time datetime="${isoDate(p.date)}">${fmtDate(p.date)}</time><span>${p.minutes} min</span></span>
  <span class="sl-title">${esc(p.title)}</span>
</a></li>`;
}

/* ── EngineeringNoteBanner ───────────────────────────────────────────────── */

/**
 * The editorial interruption. The photograph from the home page, at night, carries it —
 * the same place the whole site is set — and the latest two articles lie on it as
 * printed pages, so the "object" in the composition is the actual writing.
 */
function EngineeringNoteBanner(latest, second, settings) {
  const nl = (settings && settings.newsletter) || {};
  const sheet = (p, cls) => p ? `<a class="sheet ${cls}" href="${p.href}" tabindex="${cls === "under" ? "-1" : "0"}"${cls === "under" ? ' aria-hidden="true"' : ""}>
      <div class="sh-top"><span>Engineering Journal</span><span>${esc(p.domain.name)}</span></div>
      <div class="sh-title">${esc(p.title)}</div>
      <div class="sh-meta">${fmtDate(p.date)} &#183; ${p.minutes} min read</div>
      <div class="sh-fig light">${plate(p.domain.slug, p.slug + ":sheet", { zoom: [1, 1.2] })}</div>
      <p class="sh-text">${esc(clip(p.text || p.summary, 330))}</p>
    </a>` : "";
  const subscribe = nl.action
    ? `<form class="nl" action="${esc(nl.action)}" method="post" data-newsletter target="_blank">
        <label class="vh" for="nl-email">Email address</label>
        <input id="nl-email" type="email" name="${esc(nl.field || "email")}" placeholder="you@company.com" autocomplete="email" required>
        <button type="submit">Subscribe</button>
        <p class="nl-note" aria-live="polite">${esc(nl.note || "New notes by email. No digest, no tracking pixels.")}</p>
      </form>`
    : `<a class="cta ghost" href="/blog/feed.xml">Follow by RSS <span class="arr" aria-hidden="true">&#8599;</span></a>`;
  return `<section class="band" aria-labelledby="band-title">
  <div class="band-bg" aria-hidden="true"><img src="/assets/journal-night.jpg" alt="" loading="lazy" decoding="async"></div>
  <div class="wrap band-grid">
    <div class="band-copy" data-rv>
      <div class="sh-eyebrow">The journal</div>
      <h2 id="band-title">No AI news digest.<br>No &#8220;10 tools you need to know.&#8221;</h2>
      <p>Just experiments, architecture decisions, failure analysis, and the things I learn while building AI systems.</p>
      <div class="band-ctas">
        ${latest ? `<a class="cta" href="${latest.href}">Read the latest note ${arrow}</a>` : ""}
        ${subscribe}
      </div>
    </div>
    <div class="band-sheets" data-rv>${sheet(second, "under")}${sheet(latest, "over")}</div>
  </div>
</section>`;
}

/* ── ArticleCard, in four cuts ───────────────────────────────────────────── */

function ArticleCard(p, variant = "small", flip = false) {
  const abstract = `<p class="ac-abs">${esc(p.summary)}</p>`;
  if (variant === "feature") {
    return `<article class="ac ac-feature${flip ? " flip" : ""}" data-rv><a href="${p.href}">
  <div class="ac-vis dark">${Visual(p)}</div>
  <div class="ac-body">${ArticleMetadata(p)}<h3 class="ac-title serif">${esc(p.title)}</h3>${abstract}<span class="ac-go">${esc(p.type.cta)} ${arrow}</span></div>
</a></article>`;
  }
  if (variant === "text") {
    return `<article class="ac ac-text" data-rv><a href="${p.href}">
  <div class="ac-vis strip dark">${Visual(p)}</div>
  ${ArticleMetadata(p)}<h3 class="ac-title serif">${esc(p.title)}</h3>${abstract}
  ${p.tags.length ? `<div class="ac-tags">${p.tags.map((t) => `<span>${esc(t)}</span>`).join("")}</div>` : ""}
  <span class="ac-go">${esc(p.type.cta)} ${arrow}</span>
</a></article>`;
  }
  return `<article class="ac ac-${variant}" data-rv><a href="${p.href}">
  <div class="ac-vis dark">${Visual(p)}</div>
  ${ArticleMetadata(p)}<h3 class="ac-title${variant === "lead" ? " serif" : ""}">${esc(p.title)}</h3>${abstract}
  <span class="ac-go">${esc(p.type.cta)} ${arrow}</span>
</a></article>`;
}

/**
 * The feed never repeats one grid: it cycles a lead story with two below it, a pair of
 * text-led pieces, then one full-width feature, and lets the tail take whichever shape
 * fits what is left.
 */
function Feed(items) {
  const out = [];
  let i = 0, g = 0, features = 0;
  while (i < items.length) {
    const left = items.length - i;
    let kind = ["lead", "pair", "feature"][g % 3];
    if (kind === "lead" && left < 3) kind = left === 2 ? "pair" : "feature";
    if (kind === "pair" && left < 2) kind = "feature";
    if (kind === "lead") {
      out.push(`<div class="fg fg-lead">${ArticleCard(items[i], "lead")}<div class="fg-two">${ArticleCard(items[i + 1], "small")}${ArticleCard(items[i + 2], "small")}</div></div>`);
      i += 3;
    } else if (kind === "pair") {
      out.push(`<div class="fg fg-pair">${ArticleCard(items[i], "text")}${ArticleCard(items[i + 1], "text")}</div>`);
      i += 2;
    } else {
      out.push(`<div class="fg">${ArticleCard(items[i], "feature", features++ % 2 === 1)}</div>`);
      i += 1;
    }
    g++;
  }
  return out.join("\n");
}

/* ── AuthorAside ─────────────────────────────────────────────────────────── */

function AuthorAside(articles) {
  const counts = DOMAINS.map((d) => [d, articles.filter((p) => p.domain === d).length]).filter(([, n]) => n);
  return `<aside class="author" aria-label="About the author">
  <div class="au-head">
    <img src="/assets/portrait.jpg" alt="" width="56" height="56" loading="lazy" decoding="async">
    <div><div class="au-name">${AUTHOR}</div><div class="au-role">AI/ML Engineer</div></div>
  </div>
  <p class="au-bio">I build AI systems that have to work beyond the demo — retrieval, inference, evaluation, agents and ML infrastructure.</p>
  <div class="au-block">
    <div class="au-label">Featured project</div>
    <a class="au-proj" href="/#selected-systems"><span class="t">Aperture RAG ${arrow}</span><span class="d">Local-first retrieval built around one rule: when the evidence is weak, the answer says so.</span></a>
  </div>
  ${counts.length ? `<div class="au-block">
    <div class="au-label">Research topics</div>
    <ul class="au-topics">${counts.map(([d, n]) => `<li><a href="/blog/topic/${d.slug}"><span>${esc(d.name)}</span><span class="n">${n}</span></a></li>`).join("")}</ul>
  </div>` : ""}
  <div class="au-block">
    <div class="au-label">Elsewhere</div>
    <div class="au-links"><a href="${LINKEDIN}" rel="noopener">LinkedIn</a><a href="${GITHUB}" rel="noopener">GitHub</a><a href="/blog/feed.xml">RSS</a><a href="/#contact">Contact</a></div>
  </div>
</aside>`;
}

/* ── LinkedIn posts, in full ─────────────────────────────────────────────── */

function DocLinks(doc) {
  return `<span class="deck-meta">PDF${doc.pages ? ` &#183; ${doc.pages} pages` : ""} &#183; ${doc.size}</span>
    <a href="${esc(doc.href)}" target="_blank" rel="noopener">Open PDF <span aria-hidden="true">&#8599;</span></a>
    <a href="${esc(doc.href)}" download="${esc(doc.name)}">Download <span aria-hidden="true">&#8595;</span></a>`;
}

/**
 * A LinkedIn document post's carousel, as the slides themselves: a strip that scrolls
 * sideways and snaps slide by slide — swipe on a phone, arrows or keys on a desktop —
 * with the original PDF beside it.
 */
function LinkedInDeck(p) {
  const n = p.slides.length;
  return `<figure class="deck-wrap">
    <div class="deck" tabindex="0" role="region" aria-label="${esc(p.deckTitle || "Carousel")}, ${n} slides — scroll sideways" data-deck>
      ${p.slides.map((sl, k) => `<img src="${esc(sl.src)}" alt="${esc(sl.alt)}" width="900" height="1125" ${k < 2 ? "" : 'loading="lazy" '}decoding="async">`).join("\n      ")}
    </div>
    <figcaption class="deck-bar">
      <span class="deck-meta">Carousel &#183; ${n} slides</span>
      <span class="deck-nav"><button type="button" data-deck-go="-1" aria-label="Previous slide">&#8592;</button><button type="button" data-deck-go="1" aria-label="Next slide">&#8594;</button></span>
      ${p.doc ? DocLinks(p.doc) : ""}
    </figcaption>
  </figure>`;
}

/* A post in full, as a notebook entry: a rail that keeps the entry's facts in view
   while it is read, and the post itself at reading size with its carousel wide. */
function LinkedInEntry(p, n) {
  const facts = [["Source", "LinkedIn"], ["Topic", `<a href="/blog/topic/${p.domain.slug}">${esc(p.domain.name)}</a>`], ["Length", `${p.minutes} min read`]];
  if (p.slides.length) facts.push(["Carousel", `${p.slides.length} slides`]);
  return `<article class="li" id="${p.id}" aria-labelledby="${p.id}-t" data-rv>
  <aside class="li-rail"><div class="li-rail-in">
    <span class="li-n">${String(n).padStart(2, "0")}</span>
    <time datetime="${isoDate(p.date)}">${fmtDate(p.date)}</time>
    ${p.draft ? '<span class="am-draft">Draft</span>' : ""}
    <dl>${facts.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join("")}</dl>
    <div class="li-acts">
      ${p.url ? `<a href="${esc(p.url)}" rel="noopener">View on LinkedIn <span aria-hidden="true">&#8599;</span></a>` : ""}
      ${p.doc ? `<a href="${esc(p.doc.href)}" target="_blank" rel="noopener">Open the PDF <span aria-hidden="true">&#8599;</span></a><a href="${esc(p.doc.href)}" download="${esc(p.doc.name)}">Download PDF <span aria-hidden="true">&#8595;</span></a>` : ""}
    </div>
  </div></aside>
  <div class="li-main">
    <h2 class="li-title" id="${p.id}-t">${p.title ? esc(p.title) : `Posted ${fmtDate(p.date)}`}</h2>
    <div class="li-text">${p.html}</div>
    ${p.images.length ? `<div class="li-shots">${p.images.map((src) => `<img src="${esc(src)}" alt="" loading="lazy" decoding="async">`).join("")}</div>` : ""}
    ${p.slides.length ? LinkedInDeck(p) : ""}
  </div>
</article>`;
}

/* On the journal's front page a post is introduced, not reprinted: its title, its
   opening, the carousel's cover, and a way into the whole thing. */
function LinkedInTeaser(p) {
  const cover = p.slides[0];
  return `<a class="lt" href="${p.href}" data-rv>
  ${cover ? `<span class="lt-cover"><img src="${esc(cover.src)}" alt="" loading="lazy" decoding="async"><span class="lt-count">${p.slides.length} slides</span></span>` : ""}
  <span class="lt-body">
    <span class="lt-meta"><time datetime="${isoDate(p.date)}">${fmtDate(p.date)}</time><span>${esc(p.domain.name)}</span><span>${p.minutes} min</span></span>
    <span class="lt-title">${p.title ? esc(p.title) : "A note from LinkedIn"}</span>
    <span class="lt-text">${esc(p.excerpt)}</span>
    <span class="lt-go">Read the note ${arrow}</span>
  </span>
</a>`;
}

/* ── the page shell ──────────────────────────────────────────────────────── */

const NAV = [["About", "/#about"], ["Work", "/#selected-systems"], ["Blog", "/blog"], ["Notes", "/notes"], ["Contact", "/#contact"]];

// Reading mode follows the weather the visitor chose on the home page — Daylight reads
// on paper, Night and Storm on graphite — and falls back to the system setting. It is
// set before first paint, so the page never flashes the other palette.
const HEAD_SCRIPT = `(function(){var m="dark";try{var t=localStorage.getItem("lp-theme");if(t==="day")m="light";else if(!t&&window.matchMedia&&matchMedia("(prefers-color-scheme: light)").matches)m="light";}catch(e){}var d=document.documentElement;d.setAttribute("data-mode",m);d.className+=" js";setTimeout(function(){if(!window.__jr)d.className+=" still";},3000);})();`;

function Shell({ title, description, path, active, main, ctx, type = "website", extraHead = "" }) {
  const full = title ? `${title} — ${AUTHOR}` : AUTHOR;
  return `<!DOCTYPE html>
<html lang="en" data-mode="dark">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(full)}</title>
<meta name="description" content="${esc(description)}">
<meta name="color-scheme" content="dark light">
<link rel="canonical" href="${SITE}${path}">
<meta property="og:title" content="${esc(full)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${SITE}${path}">
<meta property="og:type" content="${type}">
<link rel="alternate" type="application/rss+xml" title="${AUTHOR} — Engineering Journal" href="/blog/feed.xml">
<script>${HEAD_SCRIPT}</script>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="${esc(ctx.fontHref)}">
<link rel="stylesheet" href="${ctx.cssHref}">
${extraHead}</head>
<body>
<a class="skip" href="#main">Skip to content</a>
<header class="pnav">
  <nav aria-label="Site">
    <a class="brand" href="/">${AUTHOR}</a>
    <span class="sep" aria-hidden="true"></span>
    <div class="links">
      ${NAV.map(([l, h]) => `<a href="${h}"${l === active ? ' aria-current="page"' : ""}>${l}</a>`).join("\n      ")}
    </div>
    <div class="mode" role="group" aria-label="Reading mode">
      <span class="mode-lens" aria-hidden="true"></span>
      <button type="button" data-set-mode="light" aria-label="Light" title="Light">&#9728;</button>
      <button type="button" data-set-mode="dark" aria-label="Dark" title="Dark">&#9790;</button>
    </div>
  </nav>
</header>
${ctx.drafts ? `<div class="draft-note" role="note">Draft preview &#183; built with --drafts &#183; drafts are never published</div>` : ""}
<main id="main">
${main}
</main>
<footer class="pfoot">
  <div class="wrap">
    <div class="pf-l"><a class="brand" href="/">${AUTHOR}</a><span>Engineering Journal &#183; written by hand, built without a framework</span></div>
    <div class="flinks"><a href="/#contact">Contact</a><a href="/blog/feed.xml">RSS</a><a href="${LINKEDIN}" rel="noopener">LinkedIn</a><a href="${GITHUB}" rel="noopener">GitHub</a></div>
  </div>
</footer>
<script src="${ctx.jsHref}" defer></script>
</body>
</html>
`;
}

/* ── pages ───────────────────────────────────────────────────────────────── */

function BlogPage(content, ctx) {
  const articles = content.posts.filter((p) => p.kind === "article");
  const shorts = content.posts.filter((p) => p.kind === "linkedin");
  const hero = articles.find((p) => p.featured) || articles[0];
  const rest = articles.filter((p) => p !== hero);

  const withCount = DOMAINS.map((d) => [d, articles.filter((p) => p.domain === d).length]).filter(([, n]) => n);
  const picks = articles.filter((p) => p.start).sort((a, b) => a.start - b.start);
  const startList = (picks.length ? picks : rest).slice(0, 5);
  const curated = picks.length > 0;

  const masthead = `<header class="mast wrap" data-rv>
    <h1>Engineering Journal</h1>
    <p>Experiments, failures, benchmarks and design decisions from building AI systems.</p>
    <div class="mast-meta">${articles.length ? `<span>${articles.length} ${articles.length === 1 ? "article" : "articles"}</span>` : ""}${shorts.length ? `<a href="/blog/linkedin">${shorts.length} LinkedIn ${shorts.length === 1 ? "post" : "posts"}</a>` : ""}<a href="/blog/feed.xml">RSS</a></div>
  </header>`;

  if (!articles.length && !shorts.length) {
    return masthead + `<div class="wrap"><p class="empty">Nothing published yet.</p></div>`;
  }

  const parts = [masthead];
  if (hero) parts.push(`<div class="wrap">${BlogHero(hero)}</div>`);

  if (withCount.length >= 2) {
    parts.push(`<section class="wrap sec" aria-labelledby="domains">
  ${SectionHead({ id: "domains", eyebrow: "Explore by system", title: "Engineering domains", aside: `<span class="sh-note">${withCount.length} of ${DOMAINS.length} domains written about so far</span>` })}
  <div class="cats" data-n="${withCount.length}">${withCount.map(([d, n], i) => CategoryCard(d, n, i)).join("\n")}</div>
</section>`);
  }

  if (startList.length >= 3) {
    parts.push(`<section class="wrap sec" aria-labelledby="start">
  ${SectionHead({ id: "start", eyebrow: curated ? "Reading order" : "Latest", title: curated ? "Start here" : "Recently written", aside: curated ? `<span class="sh-note">If you read one thing, read these, in this order.</span>` : "" })}
  <ol class="slist">${startList.map(ArticleListItem).join("\n")}</ol>
</section>`);
  }

  if (hero) parts.push(EngineeringNoteBanner(articles[0], articles[1], content.settings));

  if (rest.length) {
    parts.push(`<section class="wrap sec" aria-labelledby="all">
  ${SectionHead({ id: "all", eyebrow: "The archive", title: "Every article", aside: `<span class="sh-note">Newest first</span>` })}
  <div class="feed-grid">
    <div class="feed">${Feed(rest)}</div>
    ${AuthorAside(articles)}
  </div>
</section>`);
  } else if (hero) {
    parts.push(`<section class="wrap sec">${AuthorAside(articles)}</section>`);
  }

  if (shorts.length) {
    parts.push(`<section class="wrap sec" aria-labelledby="shorts">
  ${SectionHead({ id: "shorts", eyebrow: "First posted on LinkedIn", title: "Shorter notes", aside: shorts.length > 4 ? `<a class="more" href="/blog/linkedin">All ${shorts.length} posts ${arrow}</a>` : "" })}
  <div class="lt-list">${shorts.slice(0, 4).map(LinkedInTeaser).join("\n")}</div>
</section>`);
  }
  return parts.join("\n");
}

function TopicPage(d, content) {
  const items = content.posts.filter((p) => p.kind === "article" && p.domain === d);
  const others = DOMAINS.filter((x) => x !== d).map((x) => [x, content.posts.filter((p) => p.kind === "article" && p.domain === x).length]).filter(([, n]) => n);
  return `<header class="tp wrap" data-rv>
    <a class="back" href="/blog"><span aria-hidden="true">&#8592;</span> Engineering Journal</a>
    <div class="sh-eyebrow">Domain &#183; ${items.length} ${items.length === 1 ? "article" : "articles"}</div>
    <h1>${esc(d.name)}</h1>
    <p>${esc(d.blurb)}</p>
  </header>
  <div class="wrap"><div class="tp-plate dark" aria-hidden="true">${plate(d.slug, "topic", { zoom: [1, 1.1] })}</div></div>
  <section class="wrap sec" aria-label="${esc(d.name)} articles"><div class="feed wide">${items.length ? Feed(items) : `<p class="empty">Nothing in this domain yet.</p>`}</div></section>
  ${others.length ? `<nav class="wrap sec others" aria-label="Other domains"><div class="sh-eyebrow">Other domains</div><ul>${others.map(([x, n]) => `<li><a href="/blog/topic/${x.slug}">${esc(x.name)} <span>${n}</span></a></li>`).join("")}</ul></nav>` : ""}`;
}

/* ── ArticleLayout ───────────────────────────────────────────────────────── */

function Contents(p) {
  const h2 = p.toc.filter((t) => t.level === 2);
  if (h2.length < 2) return { rail: "", inline: "" };
  let n = 0;
  const items = p.toc.map((t) => {
    const num = t.level === 2 && !t.plain ? String(++n).padStart(2, "0") : "";
    return `<li class="l${t.level}"><a href="#${t.id}" data-toc="${t.id}"><span class="n">${num}</span><span class="t">${esc(t.text)}</span></a></li>`;
  }).join("");
  return {
    rail: `<nav class="toc" aria-label="Contents"><div class="toc-in"><div class="toc-h">Contents</div><ol>${items}</ol><div class="toc-read"><span data-read-left>${p.minutes} min read</span></div></div></nav>`,
    inline: `<details class="toc-m"><summary>Contents <span>${h2.length} sections &#183; ${p.minutes} min</span></summary><ol>${items}</ol></details>`
  };
}

function ArticleLayout(p, articles) {
  const i = articles.indexOf(p);
  const newer = articles[i - 1], older = articles[i + 1];
  const related = articles.filter((x) => x !== p && x.domain === p.domain).slice(0, 2);
  const toc = Contents(p);
  const facts = [
    `<time datetime="${isoDate(p.date)}">${fmtDate(p.date)}</time>`,
    `${p.minutes} min read`,
    `<a href="/blog/topic/${p.domain.slug}">${esc(p.domain.name)}</a>`,
    esc(p.type.label)
  ];
  return `<div class="read-progress" aria-hidden="true"><span></span></div>
<article class="post" aria-labelledby="post-title">
  <div class="post-grid">
    <header class="post-head">
      <a class="back" href="/blog"><span aria-hidden="true">&#8592;</span> Engineering Journal</a>
      <div class="post-facts">${facts.map((f) => `<span>${f}</span>`).join("")}${p.draft ? '<span class="am-draft">Draft</span>' : ""}</div>
      <h1 id="post-title" data-split>${esc(p.title)}</h1>
      ${p.summary ? `<p class="post-abstract">${esc(p.summary)}</p>` : ""}
      <div class="byline">By <a href="/">${AUTHOR}</a>${p.tags.length ? ` <span class="tags">${p.tags.map((t) => `<span>${esc(t)}</span>`).join("")}</span>` : ""}</div>
    </header>
    <figure class="post-cover"><div class="pc-vis dark">${Visual(p, { eager: true, zoom: [1, 1.2] })}</div>${p.cover && p.coverAlt ? `<figcaption>${esc(p.coverAlt)}</figcaption>` : ""}</figure>
    ${toc.rail}
    <div class="prose"${p.math ? " data-math" : ""}>
${toc.inline}
${p.html}
    </div>
  </div>
  <footer class="post-foot">
    <div class="pf-row">
      <div class="pf-filed">Filed under <a href="/blog/topic/${p.domain.slug}">${esc(p.domain.name)}</a>${p.tags.length ? ` &#183; ${p.tags.map(esc).join(", ")}` : ""}</div>
      <a class="pf-author" href="/#contact">Questions or corrections? Write to me ${arrow}</a>
    </div>
    <nav class="pager" aria-label="More articles">
      ${older ? `<a href="${older.href}"><span class="dir">&#8592; Earlier</span><span class="t">${esc(older.title)}</span></a>` : "<span></span>"}
      ${newer ? `<a href="${newer.href}" class="next"><span class="dir">Later &#8594;</span><span class="t">${esc(newer.title)}</span></a>` : ""}
    </nav>
  </footer>
</article>
${related.length ? `<section class="wrap sec related" aria-labelledby="related">
  ${SectionHead({ id: "related", eyebrow: "Keep reading", title: `More on ${esc(p.domain.name)}` })}
  <div class="fg-two">${related.map((x) => ArticleCard(x, "small")).join("")}</div>
</section>` : ""}`;
}

function LinkedInPage(content) {
  const shorts = content.posts.filter((p) => p.kind === "linkedin");
  return `<header class="tp wrap" data-rv>
    <a class="back" href="/blog"><span aria-hidden="true">&#8592;</span> Engineering Journal</a>
    <div class="sh-eyebrow">First posted on LinkedIn &#183; ${shorts.length} ${shorts.length === 1 ? "post" : "posts"}</div>
    <h1>Shorter notes</h1>
    <p>Everything I have posted on LinkedIn, kept here in full, newest first.</p>
  </header>
  <section class="li-list" aria-label="Posts">${shorts.length ? shorts.map((p, k) => LinkedInEntry(p, shorts.length - k)).join("\n") : `<p class="empty wrap">Nothing posted yet.</p>`}</section>`;
}

function NotesPage(content) {
  const notes = content.notes;
  return `<header class="tp wrap" data-rv>
    <div class="sh-eyebrow">Library${notes.length ? ` &#183; ${notes.length} PDF${notes.length === 1 ? "" : "s"}` : ""}</div>
    <h1>Notes</h1>
    <p>Study notes and write-ups, as PDFs. Free to read and to download.</p>
  </header>
  <section class="wrap sec">${notes.length ? `<ol class="library">
${notes.map((n) => `  <li class="doc" data-rv>
    <div class="doc-rail">${n.cover ? `<a class="doc-cover" href="${n.href}" target="_blank" rel="noopener" tabindex="-1" aria-hidden="true"><img src="${esc(n.cover)}" alt="" loading="lazy" decoding="async"></a>` : ""}${n.date ? `<time datetime="${isoDate(n.date)}">${fmtDate(n.date)}</time>` : ""}<span class="k">PDF &#183; ${n.size}${n.pages ? ` &#183; ${esc(n.pages)} pp` : ""}</span></div>
    <div class="doc-body">
      <h2><a href="${n.href}" target="_blank" rel="noopener">${esc(n.title)}</a></h2>
      ${n.summary ? `<p>${esc(n.summary)}</p>` : ""}
      ${n.topics.length ? `<div class="doc-topics">${n.topics.map((t) => `<span>${esc(t)}</span>`).join("")}</div>` : ""}
    </div>
    <div class="doc-acts">
      <a href="${n.href}" target="_blank" rel="noopener">Open <span aria-hidden="true">&#8599;</span></a>
      <a href="${n.href}" download="${esc(n.download)}" class="dl">Download <span aria-hidden="true">&#8595;</span></a>
    </div>
  </li>`).join("\n")}
  </ol>` : `<p class="empty">No notes uploaded yet.</p>`}</section>`;
}

function Feed_xml(content) {
  const posts = content.posts.slice(0, 30);
  return `<?xml version="1.0" encoding="utf-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
<title>${esc(AUTHOR)} — Engineering Journal</title>
<link>${SITE}/blog</link>
<atom:link href="${SITE}/blog/feed.xml" rel="self" type="application/rss+xml"/>
<description>Experiments, failures, benchmarks and design decisions from building AI systems.</description>
<language>en</language>
${posts.map((p) => `<item>
<title>${esc(p.kind === "article" ? p.title : "LinkedIn: " + p.excerpt)}</title>
<link>${SITE}${p.href}</link>
<guid isPermaLink="false">${SITE}${p.href}</guid>
<pubDate>${p.date.toUTCString()}</pubDate>
${p.kind === "article" ? `<category>${esc(p.domain.name)}</category>\n` : ""}<description>${esc(p.kind === "article" ? p.summary : p.html)}</description>
</item>`).join("\n")}
</channel>
</rss>
`;
}

/** Every generated file under dist/, as [path, text]. */
export function renderJournal(content, ctx) {
  const articles = content.posts.filter((p) => p.kind === "article");
  const pages = [];
  const page = (path, url, opts) => pages.push([path, Shell({ path: url, ctx, ...opts })]);

  page("blog/index.html", "/blog", {
    title: "Engineering Journal", active: "Blog", main: BlogPage(content, ctx),
    description: "Experiments, failures, benchmarks and design decisions from building AI systems — by Soubhagya Jain."
  });
  for (const d of DOMAINS) {
    if (!articles.some((p) => p.domain === d)) continue;
    page(`blog/topic/${d.slug}/index.html`, `/blog/topic/${d.slug}`, {
      title: `${d.name} — Engineering Journal`, active: "Blog", main: TopicPage(d, content), description: d.blurb
    });
  }
  for (const p of articles) {
    page(`blog/${p.slug}/index.html`, p.href, {
      title: p.title, active: "Blog", main: ArticleLayout(p, articles), description: p.summary, type: "article",
      extraHead: `<meta property="article:published_time" content="${isoDate(p.date)}">\n<meta property="article:section" content="${esc(p.domain.name)}">\n`
    });
  }
  page("blog/linkedin/index.html", "/blog/linkedin", {
    title: "Shorter notes — Engineering Journal", active: "Blog", main: LinkedInPage(content),
    description: "Posts by Soubhagya Jain, first published on LinkedIn, kept here in full."
  });
  page("notes/index.html", "/notes", {
    title: "Notes", active: "Notes", main: NotesPage(content),
    description: "Study notes and write-ups by Soubhagya Jain, free to download as PDFs."
  });
  pages.push(["blog/feed.xml", Feed_xml(content)]);
  return pages;
}
