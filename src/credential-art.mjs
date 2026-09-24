// Artwork for the credential records: one drawing per subject, printed on the record's
// paper. Same language as src/plates.mjs — hairlines, a faint drafting grid, mono
// labels, one amber accent — and the same rule: drawings of mechanisms, never charts
// of results, so nothing here carries a number that could be read as a measurement.
//
// These illustrate what a course was about. They are not certificates and carry no
// issuer's mark; the record says as much where it is opened.
//
// Written as standalone SVG files by build.mjs (dist/credentials/art/), with their own
// palette, because an <img> does not inherit the page's CSS.

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
const line = (x1, y1, x2, y2, c = "i") => `<line class="${c}" x1="${f(x1)}" y1="${f(y1)}" x2="${f(x2)}" y2="${f(y2)}"/>`;
const rect = (x, y, w, h, c = "i", r = 4) => `<rect class="${c}" x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" rx="${r}"/>`;
const circ = (x, y, r, c = "i") => `<circle class="${c}" cx="${f(x)}" cy="${f(y)}" r="${f(r)}"/>`;
const text = (x, y, s, c = "t", a = "start") => `<text class="${c}" x="${f(x)}" y="${f(y)}" text-anchor="${a}">${s}</text>`;
const path = (d, c = "i") => `<path class="${c}" d="${d}"/>`;
const arrow = (x1, y1, x2, y2, c = "i") => {
  const a = Math.atan2(y2 - y1, x2 - x1), s = 7;
  return line(x1, y1, x2, y2, c) + path(`M${f(x2 - s * Math.cos(a - 0.45))},${f(y2 - s * Math.sin(a - 0.45))}L${f(x2)},${f(y2)}L${f(x2 - s * Math.cos(a + 0.45))},${f(y2 - s * Math.sin(a + 0.45))}`, c);
};
const tick = (x, y, c = "a") => path(`M${f(x - 6)},${f(y)}L${f(x - 2)},${f(y + 5)}L${f(x + 7)},${f(y - 6)}`, c);
const cross = (x, y, s = 6, c = "a") => line(x - s, y - s, x + s, y + s, c) + line(x - s, y + s, x + s, y - s, c);

function grid() {
  let g = "";
  for (let x = 40; x < W; x += 40) g += line(x, 0, x, H, "g");
  for (let y = 40; y < H; y += 40) g += line(0, y, W, y, "g");
  return g;
}

/* ── one drawing per subject ─────────────────────────────────────────────── */

// output passes through a row of validators; one fails and is routed to a fallback
function guardrails(r) {
  let s = "";
  const y = 250;
  s += rect(70, y - 34, 120, 68, "blk", 8) + text(130, y + 5, "LLM", "t", "middle");
  const checks = ["schema", "toxicity", "PII", "grounded"];
  const bad = Math.floor(r() * checks.length);
  checks.forEach((c, i) => {
    const x = 260 + i * 105;
    s += line(x, 120, x, 380, i === bad ? "a" : "d");
    s += rect(x - 30, y - 22, 60, 44, i === bad ? "acc" : "blk", 6);
    s += text(x, 410, c, i === bad ? "ta" : "t", "middle");
    s += i === bad ? cross(x, y) : tick(x, y, "i");
  });
  s += arrow(190, y, 228, y) + arrow(640, y, 700, y);
  s += text(712, y + 5, "out", "t");
  const bx = 260 + bad * 105;
  s += path(`M${bx},${y + 22} C${bx},${y + 110} ${bx + 120},${y + 110} ${Math.min(700, bx + 170)},${y + 110}`, "a");
  s += text(Math.min(706, bx + 176), y + 115, "fallback", "ta");
  return s;
}

// a hub in the middle, model cards and their tasks around it
function hub(r) {
  let s = circ(400, 250, 46, "acc") + text(400, 255, "hub", "ta", "middle");
  const tasks = ["text-gen", "embed", "vision", "speech", "classify", "summarize"];
  tasks.forEach((t, i) => {
    const a = -Math.PI / 2 + i * (Math.PI * 2 / tasks.length) + (r() - 0.5) * 0.2;
    const x = 400 + Math.cos(a) * 250, y = 250 + Math.sin(a) * 170;
    s += line(400 + Math.cos(a) * 50, 250 + Math.sin(a) * 50, x - Math.cos(a) * 60, y - Math.sin(a) * 30, "d");
    s += rect(x - 62, y - 26, 124, 52, "blk", 6);
    s += line(x - 50, y - 8, x + 20 + r() * 25, y - 8, "i") + line(x - 50, y + 6, x + r() * 30, y + 6, "d");
    s += text(x, y + 44, t, "t", "middle");
  });
  s += text(400, 40, "pipeline(task, model)", "t", "middle");
  return s;
}

// commit → build → a table of eval cases → a deploy gate
function llmops(r) {
  let s = "";
  const stages = [["commit", 90], ["build", 210]];
  stages.forEach(([t, x]) => { s += circ(x, 250, 22, "blk") + text(x, 300, t, "t", "middle"); });
  s += arrow(112, 250, 186, 250) + arrow(232, 250, 300, 250);
  s += rect(300, 120, 250, 260, "blk", 8) + text(425, 105, "eval suite", "t", "middle");
  for (let i = 0; i < 7; i++) {
    const y = 150 + i * 32;
    s += line(320, y, 460 + r() * 40, y, "d");
    s += (r() < 0.16 ? cross(525, y, 5) : tick(525, y, "i"));
  }
  s += arrow(550, 250, 618, 250);
  s += path("M620,210 L680,250 L620,290 Z", "acc") + text(650, 320, "gate", "ta", "middle");
  s += arrow(680, 250, 740, 250) + text(740, 235, "deploy", "t", "end");
  return s;
}

// a row of tokens, attention arcs of varying weight, layers stacked above
function attention(r) {
  let s = "";
  const n = 9, x0 = 110, dx = 72, y = 390;
  for (let i = 0; i < n; i++) s += rect(x0 + i * dx - 22, y - 16, 44, 32, "blk", 4);
  const q = 2 + Math.floor(r() * 5);
  s += rect(x0 + q * dx - 22, y - 16, 44, 32, "acc", 4);
  for (let i = 0; i < n; i++) {
    if (i === q) continue;
    const x1 = x0 + q * dx, x2 = x0 + i * dx, h = Math.abs(x2 - x1) * 0.55;
    const w = r();
    s += path(`M${x1},${y - 18} C${x1},${y - 18 - h} ${x2},${y - 18 - h} ${x2},${y - 18}`, w > 0.62 ? "a" : "d");
  }
  for (let k = 0; k < 3; k++) {
    const yy = 70 + k * 34;
    s += rect(110 - 22 + k * 6, yy, 7 * dx + 44 + 70 - k * 12, 22, "blk", 4);
  }
  s += text(110, 60, "softmax(QKᵀ/√d)·V", "t");
  return s;
}

// plan → act → observe → reflect, around a loop, with tools hanging off "act"
function agentic(r) {
  let s = circ(400, 250, 130, "d");
  const steps = ["plan", "act", "observe", "reflect"];
  steps.forEach((t, i) => {
    const a = -Math.PI / 2 + i * Math.PI / 2;
    const x = 400 + Math.cos(a) * 130, y = 250 + Math.sin(a) * 130;
    s += circ(x, y, 30, i === 1 ? "acc" : "blk") + text(x, y + 5, t, i === 1 ? "ta" : "t", "middle");
  });
  for (let i = 0; i < 4; i++) {
    const a = -Math.PI / 2 + i * Math.PI / 2 + 0.42;
    s += arrow(400 + Math.cos(a - 0.08) * 130, 250 + Math.sin(a - 0.08) * 130, 400 + Math.cos(a + 0.12) * 130, 250 + Math.sin(a + 0.12) * 130, "a");
  }
  ["search", "code", "API"].forEach((t, i) => {
    const y = 160 + i * 90;
    s += line(560, 250, 640, y, "dash") + rect(640, y - 20, 100, 40, "blk", 6) + text(690, y + 5, t, "t", "middle");
  });
  s += text(400, 255, "goal", "t", "middle");
  return s;
}

// a ReAct trace read top to bottom
function trace(r) {
  let s = "";
  const rows = [["thought", "i"], ["action", "a"], ["observation", "i"], ["thought", "i"], ["action", "a"], ["answer", "i"]];
  rows.forEach(([t, c], i) => {
    const y = 60 + i * 66;
    const x = 150 + (t === "observation" ? 40 : 0);
    s += rect(x, y, 440 - (t === "observation" ? 40 : 0), 44, c === "a" ? "acc" : "blk", 6);
    s += text(x - 16, y + 27, t, c === "a" ? "ta" : "t", "end");
    s += line(x + 18, y + 16, x + 150 + r() * 200, y + 16, "d") + line(x + 18, y + 28, x + 90 + r() * 180, y + 28, "d");
    if (i < rows.length - 1) s += arrow(620, y + 22, 620, y + 88, "d");
  });
  return s;
}

// points in an embedding space, a query, and its nearest neighbours
function semantic(r) {
  let s = "";
  const pts = [];
  for (let i = 0; i < 70; i++) {
    const cx = [230, 520, 400][i % 3], cy = [170, 200, 360][i % 3];
    pts.push([cx + (r() - 0.5) * 220, cy + (r() - 0.5) * 150]);
  }
  const q = [470, 240];
  pts.forEach(([x, y]) => { s += circ(x, y, 3.2, "inkd"); });
  const near = pts.map((p) => [Math.hypot(p[0] - q[0], p[1] - q[1]), p]).sort((a, b) => a[0] - b[0]).slice(0, 7);
  near.forEach(([, p]) => { s += line(q[0], q[1], p[0], p[1], "a") + circ(p[0], p[1], 6, "acc"); });
  s += circ(q[0], q[1], near[6][0] + 8, "dash");
  s += circ(q[0], q[1], 8, "accf") + text(q[0] + 14, q[1] - 12, "query", "ta");
  s += text(60, 470, "cosine · k nearest", "t");
  return s;
}

// an HNSW-style layered graph with a greedy descent through it
function hnsw(r) {
  let s = "";
  const layers = [[90, 5], [210, 10], [350, 18]];
  const nodes = layers.map(([y, n]) => Array.from({ length: n }, (_, i) => [110 + (i + r() * 0.6) * (580 / n), y + (r() - 0.5) * 30]));
  layers.forEach(([y], k) => {
    s += path(`M70,${y + 40} L700,${y + 40} L740,${y - 30} L110,${y - 30} Z`, "d");
    s += text(56, y + 5, "L" + (2 - k), "t", "end");
    const ns = nodes[k];
    ns.forEach((p, i) => { if (i) s += line(ns[i - 1][0], ns[i - 1][1], p[0], p[1], "d"); });
    ns.forEach(([x, y2]) => { s += circ(x, y2, 4, "inkd"); });
  });
  let prev = nodes[0][1];
  s += circ(prev[0], prev[1], 7, "acc");
  for (let k = 1; k < 3; k++) {
    const target = nodes[k][Math.floor(nodes[k].length * (0.55 + k * 0.08))];
    s += path(`M${f(prev[0])},${f(prev[1])} L${f(target[0])},${f(target[1])}`, "a") + circ(target[0], target[1], 7, "acc");
    prev = target;
  }
  s += text(740, 470, "greedy descent", "ta", "end");
  return s;
}

// a signal, a threshold, and the one place it crosses
function monitoring(r) {
  let s = rect(60, 60, 680, 320, "blk", 8);
  const thr = 150;
  s += line(80, thr, 720, thr, "a") + text(716, thr - 8, "alarm threshold", "ta", "end");
  let d = "", cross1 = null, prevY = 0;
  for (let i = 0; i <= 64; i++) {
    const x = 80 + i * 10;
    let y = 290 + Math.sin(i * 0.45 + r()) * 28 + (r() - 0.5) * 22;
    const spike = [0, 40, 95, 150, 185, 150, 90, 40, 10][i - 38];
    if (spike) y -= spike;
    if (!cross1 && y < thr && prevY >= thr) cross1 = [x, y];
    prevY = y;
    d += (i ? "L" : "M") + f(x) + "," + f(y);
  }
  s += path(d, "i");
  if (cross1) s += circ(cross1[0], thr, 9, "acc") + line(cross1[0], thr, cross1[0], 420, "dash") + text(cross1[0], 440, "alert", "ta", "middle");
  for (let k = 0; k < 3; k++) s += rect(80 + k * 220, 400, 200, 60, "blk", 6) + line(96 + k * 220, 440, 150 + k * 220 + r() * 60, 440, "d");
  return s;
}

// a collection of documents, one opened to its nested fields, over a replica set
function documents(r) {
  let s = "";
  for (let i = 0; i < 4; i++) s += rect(80 + i * 16, 90 + i * 14, 220, 260, "blk", 6);
  const x = 128, y = 132;
  s += text(x + 16, y + 30, "{", "t");
  const keys = ["_id", "name", "tags", "address", "orders"];
  keys.forEach((k, i) => {
    const yy = y + 58 + i * 34, ind = k === "address" || k === "orders" ? 0 : 0;
    s += text(x + 32 + ind, yy, k + ":", i === 3 ? "ta" : "t");
    s += line(x + 110, yy - 4, x + 150 + r() * 30, yy - 4, "d");
  });
  s += text(x + 16, y + 250, "}", "t");
  s += path(`M${x + 200},${y + 160} C470,${y + 160} 470,120 520,120`, "a");
  s += rect(520, 90, 200, 70, "acc", 6) + text(620, 132, "{ city, zip }", "ta", "middle");
  ["primary", "secondary", "secondary"].forEach((t, i) => {
    const cx = 480 + i * 110, cy = 320;
    s += circ(cx, cy, 30, i ? "blk" : "acc") + text(cx, cy + 56, t, i ? "t" : "ta", "middle");
    if (i) s += arrow(480 + 30, cy, cx - 30, cy, "dash");
  });
  return s;
}

// a feed-forward network and the loss it is descending
function network(r) {
  let s = "";
  const layers = [4, 6, 6, 3];
  const pos = layers.map((n, k) => Array.from({ length: n }, (_, i) => [90 + k * 130, 250 + (i - (n - 1) / 2) * 56]));
  for (let k = 0; k < layers.length - 1; k++) {
    pos[k].forEach((a) => pos[k + 1].forEach((b) => { s += line(a[0], a[1], b[0], b[1], r() < 0.12 ? "a" : "g2"); }));
  }
  pos.forEach((l) => l.forEach(([x, y]) => { s += circ(x, y, 12, "blk"); }));
  s += rect(520, 110, 220, 280, "blk", 6);
  let d = "";
  for (let i = 0; i <= 40; i++) {
    const x = 540 + i * 4.8, y = 360 - 210 * Math.exp(-i / 9) + (r() - 0.5) * 10;   // falls, as a loss should
    d += (i ? "L" : "M") + f(x) + "," + f(y);
  }
  s += path(d, "a") + text(630, 410, "loss", "ta", "middle");
  return s;
}

// scattered observations, a fitted line, and a distribution along the axis
function datascience(r) {
  let s = line(90, 400, 720, 400, "i") + line(90, 400, 90, 70, "i");
  for (let i = 0; i < 60; i++) {
    const x = 110 + r() * 420, y = 360 - (x - 110) * 0.55 + (r() - 0.5) * 110;
    s += circ(x, y, 3.2, "inkd");
  }
  s += line(110, 372, 540, 128, "a") + text(548, 124, "fit", "ta");
  for (let i = 0; i < 10; i++) {
    const h = 20 + Math.exp(-Math.pow((i - 4.5) / 2.3, 2)) * 180 + r() * 14;
    s += rect(580 + i * 14, 400 - h, 11, h, i === 4 || i === 5 ? "acc" : "blk", 1);
  }
  s += text(650, 430, "distribution", "t", "middle");
  return s;
}

// a GPU's grid of multiprocessors, one tile of a matrix multiply lit, tokens out
function gpu(r) {
  let s = rect(70, 70, 420, 360, "blk", 10);
  for (let i = 0; i < 6; i++) for (let j = 0; j < 5; j++) {
    const lit = (i === 2 && j === 1) || (i === 3 && j === 1);
    s += rect(90 + i * 66, 90 + j * 66, 56, 56, lit ? "acc" : "blk", 4);
  }
  s += text(280, 460, "SMs · tensor cores", "t", "middle");
  s += rect(540, 110, 80, 80, "blk", 2) + text(640, 158, "×", "t", "middle") + rect(660, 110, 80, 80, "blk", 2);
  s += rect(540 + 20, 110 + 20, 40, 18, "acc", 1) + rect(660 + 30, 110, 18, 80, "acc", 1);
  s += arrow(500, 250, 560, 250, "a");
  for (let i = 0; i < 6; i++) s += rect(570 + i * 28, 290, 20, 28, i === 5 ? "acc" : "blk", 3);
  s += text(654, 350, "tokens", "t", "middle");
  return s;
}

// the nesting every introduction starts from
function fundamentals(r) {
  const rings = [["AI", 330, 210], ["machine learning", 250, 160], ["deep learning", 170, 110], ["generative AI", 95, 62]];
  let s = "";
  rings.forEach(([t, rx, ry], i) => {
    const cx = 400 + i * 22, cy = 250 + i * 12;
    s += `<ellipse class="${i === 3 ? "acc" : "blk"}" cx="${f(cx)}" cy="${f(cy)}" rx="${rx}" ry="${ry}"/>`;
    s += text(cx - rx + 26, cy - ry + (i ? 28 : 36), t, i === 3 ? "ta" : "t");
  });
  return s;
}

const ART = { guardrails, hub, llmops, attention, agentic, trace, semantic, hnsw, monitoring, documents, network, datascience, gpu, fundamentals };
export const ART_KINDS = Object.keys(ART);

// drawn at 800 wide and printed at a quarter to half that, so strokes and type are
// set heavier than on the page's own plates
const STYLE = `<style>
.g{stroke:rgba(26,27,29,.07);fill:none}.g2{stroke:rgba(26,27,29,.18);fill:none;stroke-width:1.2}
.d{stroke:rgba(26,27,29,.38);fill:none;stroke-width:1.6}.i{stroke:rgba(26,27,29,.78);fill:none;stroke-width:2.2}
.blk{stroke:rgba(26,27,29,.72);fill:rgba(26,27,29,.045);stroke-width:2}
.dash{stroke:rgba(26,27,29,.55);fill:none;stroke-width:1.6;stroke-dasharray:6 7}
.a{stroke:#a4651f;fill:none;stroke-width:2.8}.acc{stroke:#a4651f;fill:rgba(176,112,42,.2);stroke-width:2.4}
.accf{fill:#a4651f}.inkd{fill:rgba(26,27,29,.62)}
text{font-family:'IBM Plex Mono',ui-monospace,Menlo,Consolas,monospace;font-size:18px;letter-spacing:.04em;fill:rgba(26,27,29,.72)}
.ta{fill:#8f5517}
</style>`;

/** A drawing as a standalone SVG document, or null for an unknown kind. */
export function credentialArt(kind, seed) {
  const draw = ART[kind];
  if (!draw) return null;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet">${STYLE}${grid()}${draw(rng(kind + ":" + seed))}</svg>`;
}
