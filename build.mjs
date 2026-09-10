// Compiles the Claude Design artboards in design/ into a static site in dist/.
//
// The design source is a set of .dc.html artboards: an <x-dc> template plus a
// `class Component extends DCLogic` script, rendered in the design canvas by
// support.js — which pulls React, ReactDOM and Babel-standalone off a CDN at page
// load and evaluates the logic classes in the browser. None of that belongs in a
// shipped portfolio, and none of it is actually needed: the templates carry no
// control flow, and the logic classes are plain ES2020 that only touch the DOM.
//
// So this compiler does the three things the runtime was there for —
//
//   ref="{{ x }}"        -> data-ref="x" (bound to a plain {current} object)
//   style-hover="..."    -> a real :hover rule (declarations marked !important,
//                           the same way support.js does it, so they beat the
//                           element's own inline style)
//   <dc-import name=".."> -> the imported artboard's markup, inlined in place
//
// — and leaves everything else byte-for-byte alone. In particular the inline
// style attributes stay inline: the design's own JS selects on them
// (`div[style*='radial-gradient']` in initParallax) and writes over them at
// runtime, so hoisting them into classes would quietly break the choreography.
//
// Run: node build.mjs

import { readFileSync, writeFileSync, mkdirSync, readdirSync, copyFileSync, rmSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Script } from "node:vm";
import { createHash } from "node:crypto";

const ROOT = dirname(fileURLToPath(import.meta.url));
const SRC = join(ROOT, "design");
const OUT = join(ROOT, "dist");

const ENTRY = "Living Photograph";
const TITLE = "Soubhagya Jain — AI / ML Engineer";
const DESCRIPTION =
  "AI/ML engineer working on retrieval, agents, evaluation and inference — " +
  "the engineering that decides whether an AI system survives production.";

/* ── parsing ──────────────────────────────────────────────────────────────── */

const decodeEntities = (s) =>
  s.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<")
   .replace(/&gt;/g, ">").replace(/&amp;/g, "&");

/** Split one .dc.html into helmet / template / logic source / prop defaults. */
function parseDc(src) {
  const open = /<x-dc(?:\s[^>]*)?>/.exec(src);
  const close = src.lastIndexOf("</x-dc>");
  if (!open || close < open.index) throw new Error("no <x-dc> block");
  let template = src.slice(open.index + open[0].length, close);

  let helmet = "";
  template = template.replace(/<helmet>([\s\S]*?)<\/helmet>/i, (_, inner) => {
    helmet = inner;
    return "";
  });

  const script = /<script\b[^>]*\bdata-dc-script\b[^>]*>([\s\S]*?)<\/script>/i.exec(src);
  const js = script ? script[1] : "";

  // data-props is HTML-escaped JSON: { key: { default, editor, ... } }
  let props = {};
  const attr = script && /\bdata-props="([\s\S]*?)"\s*>/.exec(script[0]);
  if (attr) {
    try {
      const meta = JSON.parse(decodeEntities(attr[1]));
      for (const [k, v] of Object.entries(meta)) {
        if (k.startsWith("$")) continue;              // $preview is canvas-only
        if (v && v.default !== undefined) props[k] = v.default;
      }
    } catch (e) {
      console.warn(`  ! could not parse data-props: ${e.message}`);
    }
  }
  return { helmet, template, js, props };
}

/* ── style-hover -> CSS ───────────────────────────────────────────────────── */

// Port of support.js's importantify: split on top-level ";" only, so semicolons
// inside gradients, url() and quoted strings do not split a declaration.
function importantify(css) {
  const decls = [];
  let start = 0, depth = 0, quote = "";
  for (let i = 0; i < css.length; i++) {
    const c = css[i];
    if (quote) {
      if (c === "\\") i++;
      else if (c === quote) quote = "";
    } else if (c === "'" || c === '"') quote = c;
    else if (c === "(") depth++;
    else if (c === ")") depth = Math.max(0, depth - 1);
    else if (c === ";" && depth === 0) { decls.push(css.slice(start, i)); start = i + 1; }
  }
  decls.push(css.slice(start));
  return decls
    .map((d) => d.trim())
    .filter(Boolean)
    .map((d) => (/!\s*important$/i.test(d) ? d : d + " !important"))
    .join(";");
}

/* ── template transforms ──────────────────────────────────────────────────── */

const hoverRules = [];
let hoverSeq = 0;
const hoverClassFor = new Map();       // identical hover blocks share one class

/**
 * Rewrite one component's own template. Refs are stamped with the component that
 * owns them, so a ref name reused across artboards (three of them declare
 * `canvasRef`) still resolves to the right element once everything is inlined
 * into a single document.
 */
function transformTemplate(template, owner) {
  let out = template;

  out = out.replace(
    /ref="\{\{\s*([A-Za-z_$][\w$]*)\s*\}\}"/g,
    (_, name) => `data-ref="${name}" data-dc-owner="${escapeAttr(owner)}"`
  );

  out = out.replace(/\sstyle-hover="([^"]*)"/g, (_, raw) => {
    const css = importantify(decodeEntities(raw));
    if (!css) return "";
    let cls = hoverClassFor.get(css);
    if (!cls) {
      cls = "dch" + (hoverSeq++).toString(36);
      hoverClassFor.set(css, cls);
      hoverRules.push(`.${cls}:hover,.${cls}:focus-visible{${css}}`);
    }
    return ` class="${cls}"`;
  });

  const leftover = out.match(/\{\{[^}]*\}\}/g);
  if (leftover) throw new Error(`${owner}: unsupported template expression ${leftover[0]}`);
  return out;
}

const escapeAttr = (s) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;");

/* ── load every artboard ──────────────────────────────────────────────────── */

const files = readdirSync(SRC).filter((f) => f.endsWith(".dc.html"));
const parts = new Map();

for (const file of files) {
  const name = file.replace(/\.dc\.html$/, "");
  const parsed = parseDc(readFileSync(join(SRC, file), "utf8"));
  parts.set(name, parsed);
}
if (!parts.has(ENTRY)) throw new Error(`entry artboard "${ENTRY}" not found in design/`);

// transform each template on its own, before any inlining, so ref ownership is
// attributed to the artboard the ref was actually written in
for (const [name, p] of parts) p.template = transformTemplate(p.template, name);

/* ── inline the imports ───────────────────────────────────────────────────── */

const used = new Set([ENTRY]);
const IMPORT_RE = /<dc-import\b([^>]*)><\/dc-import>|<dc-import\b([^>]*)\/>/g;

function inline(name, stack = []) {
  if (stack.includes(name)) throw new Error(`import cycle: ${[...stack, name].join(" -> ")}`);
  const part = parts.get(name);
  if (!part) throw new Error(`missing artboard "${name}"`);

  return part.template.replace(IMPORT_RE, (whole, a, b) => {
    const attrs = a || b || "";
    const m = /\bname="([^"]*)"/.exec(attrs);
    if (!m) { console.warn(`  ! <dc-import> without a name in ${name}`); return ""; }
    const child = decodeEntities(m[1]);
    if (!parts.has(child)) {
      console.warn(`  ! ${name} imports "${child}", which is not in design/ — skipped`);
      return "";
    }
    used.add(child);
    // hint-size is a canvas placeholder dimension; on the real page the component
    // sizes from its own content, so it is deliberately dropped here.
    return `<div data-dc-component="${escapeAttr(child)}">${inline(child, [...stack, name])}</div>`;
  });
}

const body = inline(ENTRY);

/* ── stylesheet ───────────────────────────────────────────────────────────── */

const fontHrefs = new Set();
const helmetStyles = [];

const collectHelmet = (name) => {
  const { helmet } = parts.get(name);
  for (const m of helmet.matchAll(/<link\b[^>]*href="([^"]*)"[^>]*>/gi)) {
    if (/fonts\.googleapis\.com/.test(m[1])) fontHrefs.add(decodeEntities(m[1]));
  }
  for (const m of helmet.matchAll(/<style>([\s\S]*?)<\/style>/gi)) {
    helmetStyles.push(`/* ${name} */\n${m[1].trim()}`);
  }
};
// entry first, so its base rules sit at the top of the cascade
collectHelmet(ENTRY);
for (const name of used) if (name !== ENTRY) collectHelmet(name);

const css = [
  "/* Generated by build.mjs from design/*.dc.html — edit the artboards, not this file. */",
  `html,body{margin:0;padding:0;background:#0a0c0d}
#dc-root{min-height:100%}
img{max-width:100%}
:focus-visible{outline:2px solid rgba(226,178,116,.75);outline-offset:3px}

/* ── Layering ──────────────────────────────────────────────────────────────
   Three page-level bands, named once so no chapter has to invent a number:

     --z-bg       the fixed photograph and its scrims
     --z-content  every chapter, in document order
     --z-overlay  the floating nav and anything that must clear a chapter

   The larger values you will see inside a stage (100-500 in the Education and
   Beyond Terminal graphs) are not chrome layering: they are per-frame depth
   sorting for a projected 3D scene, written by that artboard's own camera. They
   are scoped inside a single stage that itself sits in --z-content, so they can
   never reorder anything against the page. Leaving them alone is deliberate —
   flattening them would break the depth read. */
:root{--z-bg:0;--z-content:10;--z-overlay:20}

/* ── No horizontal scroll, structurally ─────────────────────────────────────
   The page may not exceed the viewport, whatever a chapter does inside itself.

   clip, not hidden, and the distinction is not cosmetic. overflow-x:hidden forces the
   other axis to compute to auto, which makes body a scroll container -- one that never
   actually scrolls, because the viewport does. Every position:sticky on the page then
   sticks to that box instead of to the viewport and simply scrolls away with it, which
   is what stopped both pinned chapters (Direction and the Aperture pipeline) from ever
   pinning: they played their entire scroll sequence off-screen above the reader.

   clip creates no scroll container, so sticky keeps the viewport as its scrollport, and
   it forbids scrolling in that axis more firmly than hidden does. */
html,body{max-width:100%;overflow-x:clip}
#dc-root{max-width:100vw}

@media (max-width: 768px){
  /* Tap targets. The design's chrome is deliberately fine — 9-11px mono set on
     small pills — so rather than inflate it, give each control an invisible
     44x44 hit area centred on the glyph. Appearance is untouched; only the
     region that answers a thumb grows.

     No !important, on purpose: a control the artboard positions absolutely keeps
     its inline position, so this cannot dislodge anything. */
  #dc-root a,#dc-root button{position:relative}
  #dc-root a::after,#dc-root button::after{
    content:"";position:absolute;left:50%;top:50%;
    width:max(100%,44px);height:max(100%,44px);
    transform:translate(-50%,-50%);
  }

  /* Stage nodes are the exception. Education projects 19 of them and Beyond
     Terminal 6, placed by a camera and often sitting closer together than 44px;
     padding their hit areas would let neighbours swallow each other's taps and
     would change which node reads as nearest. They are parts of a diagram, not
     page controls, and the chapter is legible without tapping them. */
  #dc-root [data-ref="nodeRef"] a::after,
  #dc-root [data-ref="nodeRef"] button::after{content:none}

  /* Form fields cannot carry a pseudo-element, so they grow for real. */
  #dc-root input,#dc-root textarea{min-height:44px}

  /* The hero's social pill clips to a rounded capsule, so a 44px hit area inside
     it is cut back to the capsule's own 32px. The capsule itself has to grow —
     it is content-height driven, so padding on the links does it, and the pill
     follows. This is the one place the mobile fix is visible rather than
     invisible: the capsule sits ~12px taller. */
  #dc-root [data-social-pill] a{padding-block:15px !important}

  /* Motion budget: nothing decorative may travel far enough to leave its stage. */
  #dc-root [data-reveal],
  #dc-root [data-reveal2]{will-change:transform,opacity}
}

@media (prefers-reduced-motion: reduce){
  /* The artboards each honour this in their own logic; this is the backstop for
     anything driven purely by CSS. */
  #dc-root *,#dc-root *::before,#dc-root *::after{
    animation-duration:.001ms !important;animation-iteration-count:1 !important;
    transition-duration:.001ms !important;scroll-behavior:auto !important;
  }
}`,
  ...helmetStyles,
  "/* style-hover, lifted out of the markup */",
  ...hoverRules,
].join("\n\n");

/* ── runtime + logic ──────────────────────────────────────────────────────── */

const runtime = readFileSync(join(ROOT, "src", "dc-lite.js"), "utf8");

const logic = [...used]
  .filter((name) => parts.get(name).js.trim())
  .map((name) => {
    const { js, props } = parts.get(name);
    // The artboard source is embedded verbatim: it declares `class Component
    // extends DCLogic` and closes over React/DCLogic, both handed in as
    // parameters here. Keeping it untouched means a re-sync from the design is a
    // straight copy, with no hand-merge.
    return `dc.define(${JSON.stringify(name)}, ${JSON.stringify(props)}, function (DCLogic, React) {
${js.trim()}
return Component;
});`;
  })
  .join("\n\n");

const app = `${runtime}

/* ── artboard logic, compiled from design/*.dc.html ──────────────────────── */

${logic}

dc.mount();
`;

/* ── emit ─────────────────────────────────────────────────────────────────── */

// the artboard's own canvas thumbnail, reused as the favicon
const thumb = /<template id="__bundler_thumbnail">([\s\S]*?)<\/template>/.exec(
  parts.get(ENTRY).helmet
);
const favicon = thumb
  ? `<link rel="icon" href="data:image/svg+xml,${encodeURIComponent(thumb[1].trim())}">`
  : "";

/* Content stamps on the two generated assets. Both keep fixed filenames, so a browser
   that has seen the site before will go on running the copy it already holds - the
   markup changes, the code does not, and the mismatch surfaces as behaviour nobody can
   reproduce. Eight hex characters of the file's own hash makes the URL change exactly
   when the bytes do, and stay identical when they do not. */
const stamp = (text) => createHash("sha256").update(text).digest("hex").slice(0, 8);

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${TITLE}</title>
<meta name="description" content="${escapeAttr(DESCRIPTION)}">
<meta name="color-scheme" content="dark">
<meta property="og:title" content="${escapeAttr(TITLE)}">
<meta property="og:description" content="${escapeAttr(DESCRIPTION)}">
<meta property="og:type" content="website">
${favicon}
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
${[...fontHrefs].map((h) => `<link rel="stylesheet" href="${h}">`).join("\n")}
<link rel="stylesheet" href="styles.css?v=${stamp(css)}">
</head>
<body>
<div id="dc-root" data-dc-component="${escapeAttr(ENTRY)}">${body}</div>
<script src="app.js?v=${stamp(app)}" defer></script>
</body>
</html>
`;

/* ── the check a bundler owes you ─────────────────────────────────────────────
   Every artboard's logic is concatenated into one file, so a syntax error in any one
   of them takes down all ten: the page loads, the markup is there, and nothing runs.
   Parsing here turns that into a failed build instead of a silently dead site. */
try {
  new Script(app, { filename: "app.js" });
} catch (e) {
  // Far and away the most common cause in this project, and the one whose native error
  // message is least helpful: the WebGL artboards keep their GLSL in JS template
  // literals, so a backtick inside a shader comment closes the string early and the
  // failure surfaces from a line that reads like prose. Point at the likely culprits
  // rather than making the next person bisect a 250 KB bundle.
  const suspects = [];
  for (const [name, part] of parts) {
    part.js.split("\n").forEach((line, i) => {
      if (/^\s*\/\/.*`/.test(line)) suspects.push(`    ${name}:${i + 1}  ${line.trim()}`);
    });
  }
  throw new Error(
    `generated app.js does not parse — ${e.message}` +
    (suspects.length
      ? `\n\n  a backtick in one of these comments may be closing a template literal early:\n${suspects.join("\n")}\n`
      : "")
  );
}

rmSync(OUT, { recursive: true, force: true });
mkdirSync(join(OUT, "assets"), { recursive: true });
writeFileSync(join(OUT, "index.html"), html);
writeFileSync(join(OUT, "styles.css"), css);
writeFileSync(join(OUT, "app.js"), app);

// assets referenced anywhere in the compiled page, so a missing one is reported
// rather than discovered as a broken image in the browser
const wanted = new Set();
for (const m of (body + app).matchAll(/assets\/[\w.-]+\.(?:jpg|jpeg|png|webp|svg|avif)/g)) {
  wanted.add(m[0].slice("assets/".length));
}
const missing = [];
for (const file of wanted) {
  const from = join(SRC, "assets", file);
  if (existsSync(from)) copyFileSync(from, join(OUT, "assets", file));
  else missing.push(file);
}

const kb = (s) => (s.length / 1024).toFixed(1).padStart(7) + " KB";
console.log(`\n  ${used.size} artboards -> dist/`);
console.log(`    index.html  ${kb(html)}`);
console.log(`    styles.css  ${kb(css)}   (${hoverRules.length} hover rules)`);
console.log(`    app.js      ${kb(app)}`);
console.log(`    assets/     ${wanted.size - missing.length} of ${wanted.size} copied`);
if (missing.length) {
  console.log(`\n  MISSING ASSETS — drop these into design/assets/ and re-run:`);
  for (const f of missing) console.log(`    - ${f}`);
}
console.log();
