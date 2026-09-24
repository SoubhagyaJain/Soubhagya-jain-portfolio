// Engineering plates: the imagery for articles that do not bring their own.
//
// One drawn motif per domain, in the same language as the diagrams on the home page —
// hairlines, a faint drafting grid, mono labels, a single amber accent. They are
// drawings of mechanisms (a token timeline, a neighbourhood in embedding space, a trace
// tree), never charts of results: nothing here carries a number, so nothing here can
// be mistaken for a measurement. An article with a real benchmark graph or screenshot
// sets `cover:` and the plate steps aside.
//
// Every plate is seeded from the article's slug, so two articles in the same domain get
// different compositions and crops, and the same article always gets the same one.
// Colours come from CSS custom properties (--pl-ink, --pl-dim, --pl-fill, --pl-acc), so
// one drawing serves the dark and the light page.

const W = 800, H = 500;

function rng(seed) {
  let h = 2166136261;
  for (const c of String(seed)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
  return () => {
    h += 0x6D2B79F5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const f = (n) => Math.round(n * 10) / 10;
const line = (x1, y1, x2, y2, cls = "i") => `<line class="${cls}" x1="${f(x1)}" y1="${f(y1)}" x2="${f(x2)}" y2="${f(y2)}"/>`;
const rect = (x, y, w, h, cls = "i", r = 4) => `<rect class="${cls}" x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" rx="${r}"/>`;
const circ = (x, y, r, cls = "i") => `<circle class="${cls}" cx="${f(x)}" cy="${f(y)}" r="${f(r)}"/>`;
const text = (x, y, s, cls = "t", anchor = "start") => `<text class="${cls}" x="${f(x)}" y="${f(y)}" text-anchor="${anchor}">${s}</text>`;
const path = (d, cls = "i") => `<path class="${cls}" d="${d}"/>`;
const cross = (x, y, s = 5, cls = "a") => line(x - s, y - s, x + s, y + s, cls) + line(x - s, y + s, x + s, y - s, cls);

function drafting(r) {
  let g = "";
  for (let x = 40; x < W; x += 40) g += line(x, 0, x, H, "g");
  for (let y = 40; y < H; y += 40) g += line(0, y, W, y, "g");
  // registration marks, as on a drawing sheet
  for (const [x, y] of [[24, 24], [W - 24, 24], [24, H - 24], [W - 24, H - 24]]) g += line(x - 6, y, x + 6, y, "d") + line(x, y - 6, x, y + 6, "d");
  return g;
}

/* ── the six domains ──────────────────────────────────────────────────────── */

// Inference: requests as token timelines — a prefill block, then decode ticks — and the
// KV-cache pages they hold. One request reuses a cached prefix (dashed), which is the
// shape of most of what gets written about serving.
function inference(r) {
  let s = "";
  const rows = [110, 200, 290];
  rows.forEach((y, i) => {
    const x0 = 70 + r() * 30;
    const reused = i === 1;
    const pre = reused ? 60 + r() * 30 : 170 + r() * 120;
    if (reused) s += rect(x0, y - 18, 150 + r() * 60, 36, "dash", 5);
    s += rect(x0 + (reused ? 150 : 0), y - 18, pre, 36, "blk", 5);
    s += text(x0 + (reused ? 150 : 0) + 10, y + 4, reused ? "prefill · cached prefix" : "prefill", "t");
    const d0 = x0 + (reused ? 150 : 0) + pre + 14;
    s += line(d0 - 7, y - 30, d0 - 7, y + 30, "a");
    const n = 10 + Math.floor(r() * 12);
    for (let k = 0; k < n && d0 + k * 18 < W - 60; k++) s += rect(d0 + k * 18, y - 9, 12, 18, k === 0 ? "acc" : "i", 2);
    s += text(W - 56, y + 4, "req " + String.fromCharCode(97 + i), "t", "end");
  });
  s += text(rows[0] > 0 ? 70 : 0, 60, "first token ↓", "ta");
  // KV pages
  const gx = 70, gy = 360, cols = 22, cell = 22;
  for (let c = 0; c < cols; c++) for (let k = 0; k < 4; k++) {
    const on = r() < 0.46 - k * 0.08;
    s += rect(gx + c * (cell + 6), gy + k * 26, cell, 18, on ? (r() < 0.12 ? "acc" : "blk") : "i", 2);
  }
  s += text(gx, gy - 12, "kv cache · paged blocks", "t");
  s += line(40, 330, W - 40, 330, "d");
  return s;
}

// RAG: a neighbourhood in embedding space around a query, and the ranked list it
// becomes — with one candidate struck out by the reranker.
function rag(r) {
  let s = "";
  const qx = 190 + r() * 90, qy = 230 + r() * 60;
  const pts = [];
  for (let i = 0; i < 70; i++) {
    const a = r() * Math.PI * 2, d = Math.pow(r(), 0.7) * 210;
    pts.push([qx + Math.cos(a) * d * 1.25, qy + Math.sin(a) * d * 0.9]);
  }
  pts.sort((a, b) => Math.hypot(a[0] - qx, a[1] - qy) - Math.hypot(b[0] - qx, b[1] - qy));
  pts.forEach(([x, y], i) => { if (x > 20 && x < 480 && y > 20 && y < H - 20) s += circ(x, y, i < 6 ? 4.5 : 2.4, i < 6 ? "blk" : "i"); });
  pts.slice(0, 6).forEach(([x, y]) => { s += line(qx, qy, x, y, "d"); });
  s += circ(qx, qy, 48, "dash") + circ(qx, qy, 96, "dash");
  s += circ(qx, qy, 7, "accf");
  s += text(qx + 12, qy - 12, "query", "ta");
  s += text(qx - 96, qy + 118, "top-k", "t");
  // ranked list
  const lx = 520, ly = 110;
  s += text(lx, ly - 30, "candidates → reranked", "t");
  for (let i = 0; i < 7; i++) {
    const y = ly + i * 44, w = 40 + (1 - i / 7) * (160 + r() * 40);
    const dropped = i === 2 + Math.floor(r() * 3);
    s += text(lx, y + 13, String(i + 1).padStart(2, "0"), "t");
    s += rect(lx + 30, y, w, 18, dropped ? "dash" : i === 0 ? "acc" : "blk", 3);
    if (dropped) s += line(lx + 26, y + 9, lx + 40 + w, y + 9, "a");
  }
  return s;
}

// Agents: a trace tree. A plan fans out into tool calls; one call fails and is retried
// (the dashed arc), and one path runs through verification.
function agents(r) {
  let s = "";
  const root = [90, 250];
  s += rect(root[0] - 40, root[1] - 20, 110, 40, "blk", 6) + text(root[0] + 15, root[1] + 4, "plan", "t", "middle");
  const n = 3 + Math.floor(r() * 2);
  const fail = Math.floor(r() * n);
  const good = (fail + 1 + Math.floor(r() * (n - 1))) % n;
  for (let i = 0; i < n; i++) {
    const y = 80 + i * (340 / (n - 1));
    const x = 300 + r() * 30;
    s += path(`M${root[0] + 70},${root[1]} C${root[0] + 150},${root[1]} ${x - 90},${f(y)} ${f(x - 50)},${f(y)}`, i === good ? "a" : "i");
    s += rect(x - 50, y - 18, 120, 36, i === good ? "acc" : "blk", 6);
    s += text(x + 10, y + 4, ["search", "read", "call api", "compute", "browse"][i % 5], "t", "middle");
    if (i === fail) {
      s += cross(x + 88, y, 6);
      s += path(`M${f(x + 70)},${f(y - 18)} C${f(x + 120)},${f(y - 70)} ${f(x - 60)},${f(y - 70)} ${f(x - 30)},${f(y - 18)}`, "dash");
      s += text(x + 30, y - 58, "retry", "t", "middle");
    }
    // sub-steps
    const k = 1 + Math.floor(r() * 3);
    for (let j = 0; j < k; j++) {
      const sx = 470 + j * 70, sy = y + (r() - 0.5) * 20;
      s += line(sx - 30, y, sx - 8, sy, i === good ? "a" : "d") + circ(sx, sy, 7, i === good && j === k - 1 ? "accf" : "i");
    }
  }
  s += rect(660, 225, 100, 50, "blk", 6) + text(710, 254, "verify", "t", "middle");
  s += text(40, 470, "trace · one run", "t");
  return s;
}

// Evaluation: cases against checks. Most pass, a few fail, and one check regresses
// across a whole column — the kind of thing a single average hides.
function evaluation(r) {
  let s = "";
  const cols = 14, rows = 7, cx = 60, cy = 150, cw = 44, ch = 36;
  const bad = 3 + Math.floor(r() * (cols - 6));
  s += rect(cx + bad * cw - 4, cy - 10, cw + 0, rows * ch + 16, "dash", 6);
  for (let c = 0; c < cols; c++) for (let k = 0; k < rows; k++) {
    const x = cx + c * cw, y = cy + k * ch;
    const fail = c === bad ? r() < 0.7 : r() < 0.06;
    s += rect(x, y, cw - 10, ch - 10, fail ? "i" : "blk", 3);
    if (fail) s += cross(x + (cw - 10) / 2, y + (ch - 10) / 2, 5);
  }
  s += text(cx, cy - 24, "cases × checks", "t");
  s += text(cx + bad * cw + (cw - 10) / 2, cy + rows * ch + 26, "regressed", "ta", "middle");
  // a trace above: one line, one threshold
  let d = "";
  for (let i = 0; i <= 20; i++) {
    const x = 60 + i * 34, y = 80 - Math.sin(i * 0.6 + r() * 2) * 14 - (i > 13 ? (i - 13) * 5 : 0);
    d += (i ? "L" : "M") + f(x) + "," + f(y);
  }
  s += path(d, "a") + line(60, 96, 740, 96, "dash");
  return s;
}

// AI Systems: a block diagram. The request path is amber; telemetry runs underneath
// as a dashed bus, the way it does in Aperture.
function aiSystems(r) {
  let s = "";
  const B = [
    ["gateway", 60, 90], ["router", 250, 90], ["retrieve", 440, 50], ["rerank", 440, 150],
    ["model", 250, 250], ["verify", 440, 280], ["answer", 620, 280], ["memory", 60, 250]
  ].map(([l, x, y]) => [l, x + (r() - 0.5) * 24, y + (r() - 0.5) * 18]);
  const at = (l) => B.find((b) => b[0] === l);
  const link = (a, b, cls) => {
    const A = at(a), C = at(b);
    const x1 = A[1] + 120, y1 = A[2] + 20, x2 = C[1], y2 = C[2] + 20;
    const mx = (x1 + x2) / 2;
    s += path(`M${f(x1)},${f(y1)} L${f(mx)},${f(y1)} L${f(mx)},${f(y2)} L${f(x2)},${f(y2)}`, cls);
  };
  link("gateway", "router", "a"); link("router", "retrieve", "a"); link("router", "rerank", "i");
  link("memory", "model", "i"); link("model", "verify", "a"); link("verify", "answer", "a");
  s += path(`M${f(at("rerank")[1] + 60)},${f(at("rerank")[2] + 40)} C${f(at("rerank")[1] + 60)},210 ${f(at("model")[1] + 60)},200 ${f(at("model")[1] + 60)},${f(at("model")[2])}`, "a");
  B.forEach(([l, x, y]) => { s += rect(x, y, 120, 40, l === "answer" ? "acc" : "blk", 6) + text(x + 60, y + 24, l, "t", "middle"); });
  s += line(40, 400, 760, 400, "dash");
  for (let x = 90; x < 760; x += 120 + r() * 40) s += line(x, 340, x, 400, "d") + circ(x, 400, 3, "i");
  s += text(40, 430, "telemetry · async, off the request path", "t");
  return s;
}

// ML Infrastructure: stages with queues between them, a replica set, and a monitor
// trace that eventually feeds back.
function mlInfra(r) {
  let s = "";
  const stages = ["ingest", "features", "train", "registry", "serve"];
  stages.forEach((l, i) => {
    const x = 50 + i * 150, y = 150 + (r() - 0.5) * 30;
    s += rect(x, y, 104, 44, i === 4 ? "acc" : "blk", 6) + text(x + 52, y + 27, l, "t", "middle");
    if (i < stages.length - 1) {
      s += line(x + 104, y + 22, x + 150, y + 22, "a");
      // a queue: stacked slots
      for (let k = 0; k < 3; k++) s += rect(x + 112 + k * 8, y + 52, 6, 16, "i", 1);
    }
  });
  for (let k = 0; k < 3; k++) s += rect(650 + k * 12, 250 + k * 12, 104, 44, "blk", 6);
  s += text(708, 322, "replicas", "t", "middle");
  let d = "";
  for (let i = 0; i <= 30; i++) {
    const x = 60 + i * 20, y = 400 + Math.sin(i * 0.8 + r() * 3) * 10 + (i > 22 ? -(i - 22) * 6 : 0);
    d += (i ? "L" : "M") + f(x) + "," + f(y);
  }
  s += path(d, "a") + line(60, 360, 660, 360, "dash");
  s += path("M660,400 C720,400 760,380 760,300", "dash");
  s += text(60, 450, "monitor · drift feeds back", "t");
  return s;
}

const MOTIFS = { inference, rag, agents, evaluation, "ai-systems": aiSystems, "ml-infra": mlInfra };

/**
 * One plate as inline SVG. Each use crops the drawing differently — its own zoom and
 * its own point of focus, seeded — the way two photographs of the same machine are
 * framed differently, so a page of cards from one domain does not repeat itself.
 * `zoom` bounds how close the crop may go: wide for a hero, closer for a card.
 */
export function plate(domain, seed, { label = "", ratio = "slice", zoom = [1.05, 1.75] } = {}) {
  const r = rng(domain + ":" + seed);
  const draw = (MOTIFS[domain] || aiSystems)(r);
  const s = zoom[0] + r() * (zoom[1] - zoom[0]);
  // the focus may wander further from the centre the closer the crop is
  const reach = 0.5 - 0.5 / s;
  const fx = 0.5 + (r() * 2 - 1) * reach * 0.9, fy = 0.5 + (r() * 2 - 1) * reach * 0.8;
  const fig = label ? `<text class="cap" x="40" y="${H - 34}">${label}</text>` : "";
  return `<svg class="plate" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid ${ratio}" aria-hidden="true" focusable="false"><g transform="translate(${W / 2} ${H / 2}) scale(${f(s * 100) / 100}) translate(${f(-fx * W)} ${f(-fy * H)})">${drafting(r)}${draw}</g>${fig}</svg>`;
}
