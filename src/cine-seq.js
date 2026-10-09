/* ── three cinematic entrances (see cine-seq.css) ───────────────────────────
   1. The Hero build. On a dark stage a cursor drags the live hero's own pieces
      into a laptop, the portrait develops on its screen, and the camera pushes in
      until the screen is the viewport, which by then is the hero itself.
   2. The Builder. The desk film is scrubbed by the scroll; the monitor wakes into
      the "Selected systems." title card and the camera pushes into it.
   3. The CTA. The laptop is opened toward the reader; its screen wakes into the
      Contact section and the camera closes in.

   What sits on every screen is a clone of the live section it resolves into, and
   each shot ends exactly on the identity: the clone fills the viewport where the
   real section now is, so the overlay can simply go. Desktop, light mode, and
   full motion only; everything else sees the page exactly as before. */
(function () {
  "use strict";
  var root = document.documentElement;
  var mq = function (q) { return !!(window.matchMedia && matchMedia(q).matches); };
  var eligible = function () {
    return window.innerWidth >= 1024 && mq("(hover: hover) and (pointer: fine)") && !mq("(prefers-reduced-motion: reduce)");
  };
  var day = function () { return root.getAttribute("data-scene") === "day"; };

  var clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
  var seg = function (p, a, b) { return clamp((p - a) / (b - a), 0, 1); };
  var lerp = function (a, b, t) { return a + (b - a) * t; };
  var inOut = function (t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
  var out3 = function (t) { return 1 - Math.pow(1 - t, 3); };
  var smooth = function (t) { return t * t * (3 - 2 * t); };

  /* ── a div mapped onto any quad: the projective matrix, as CSS matrix3d ── */
  function adj(m) {
    return [m[4] * m[8] - m[5] * m[7], m[2] * m[7] - m[1] * m[8], m[1] * m[5] - m[2] * m[4],
            m[5] * m[6] - m[3] * m[8], m[0] * m[8] - m[2] * m[6], m[2] * m[3] - m[0] * m[5],
            m[3] * m[7] - m[4] * m[6], m[1] * m[6] - m[0] * m[7], m[0] * m[4] - m[1] * m[3]];
  }
  function mul(a, b) {
    var c = [];
    for (var i = 0; i < 3; i++) for (var j = 0; j < 3; j++) {
      var s = 0; for (var k = 0; k < 3; k++) s += a[3 * i + k] * b[3 * k + j]; c[3 * i + j] = s;
    }
    return c;
  }
  function mulv(m, v) { return [m[0] * v[0] + m[1] * v[1] + m[2] * v[2], m[3] * v[0] + m[4] * v[1] + m[5] * v[2], m[6] * v[0] + m[7] * v[1] + m[8] * v[2]]; }
  function basis(q) {
    var m = [q[0], q[2], q[4], q[1], q[3], q[5], 1, 1, 1];
    var v = mulv(adj(m), [q[6], q[7], 1]);
    return mul(m, [v[0], 0, 0, 0, v[1], 0, 0, 0, v[2]]);
  }
  // q: [tlx, tly, trx, try, blx, bly, brx, bry]
  function toQuad(w, h, q) {
    var t = mul(basis(q), adj(basis([0, 0, w, 0, 0, h, w, h])));
    for (var i = 0; i < 9; i++) t[i] /= t[8];
    return "matrix3d(" + [t[0], t[3], 0, t[6], t[1], t[4], 0, t[7], 0, 0, 1, 0, t[2], t[5], 0, t[8]].join(",") + ")";
  }
  // a point inside a quad by its own (u, v)
  function bil(q, u, v) {
    var tx = lerp(q[0], q[2], u), ty = lerp(q[1], q[3], u), bx = lerp(q[4], q[6], u), by = lerp(q[5], q[7], u);
    return [lerp(tx, bx, v), lerp(ty, by, v)];
  }
  // the largest viewport-shaped quad inside a screen quad; anchor places it along
  // the spare width (0.5 centred, 1 against the right edge)
  function subQuad(q, aspect, anchor) {
    if (anchor === undefined) anchor = 0.5;
    var w = (Math.hypot(q[2] - q[0], q[3] - q[1]) + Math.hypot(q[6] - q[4], q[7] - q[5])) / 2;
    var h = (Math.hypot(q[4] - q[0], q[5] - q[1]) + Math.hypot(q[6] - q[2], q[7] - q[3])) / 2;
    var su = 1, sv = 1;
    if (w / h > aspect) su = aspect * h / w; else sv = w / (aspect * h);
    var u0 = (1 - su) * anchor, u1 = u0 + su, v0 = 0.5 - sv / 2, v1 = 0.5 + sv / 2;
    return [].concat(bil(q, u0, v0), bil(q, u1, v0), bil(q, u0, v1), bil(q, u1, v1));
  }

  /* ── clones of the live page ───────────────────────────────────────────── */
  function strip(n) {
    var all = [n].concat(Array.prototype.slice.call(n.querySelectorAll("*")));
    all.forEach(function (e) {
      e.removeAttribute("id"); e.removeAttribute("data-ref"); e.removeAttribute("data-dc-owner");
      if (/^(A|BUTTON|INPUT|TEXTAREA|SELECT)$/.test(e.tagName)) e.setAttribute("tabindex", "-1");
    });
    n.setAttribute("aria-hidden", "true");
    try { n.inert = true; } catch (e) {}
    return n;
  }
  function clone(el) { return strip(el.cloneNode(true)); }
  // a section's reveals, played to their end: the clone and the real section must
  // show the same finished state at the cut, and nothing may re-animate after it
  function land(el) {
    var set = function (e) {
      e.style.opacity = "1"; e.style.transform = "none"; e.style.clipPath = "none"; e.style.filter = "none";
      e.dataset.lpShown = "1";
    };
    if (el.hasAttribute("data-reveal2")) set(el);
    el.querySelectorAll("[data-reveal2]").forEach(set);
    el.querySelectorAll('[data-lp-split] span > span').forEach(function (w) { w.style.transform = "none"; w.style.opacity = "1"; });
    el.querySelectorAll("[data-ct-rev]").forEach(function (e) { e.classList.add("in"); });
  }

  var SVG_ARROW = '<svg class="arrow" viewBox="0 0 26 26"><path d="M5 3 L5 20 L9.6 15.8 L12.6 22.4 L15.4 21.2 L12.5 14.7 L18.6 14.4 Z" fill="#f6efe2" stroke="#15120e" stroke-width="1.2" stroke-linejoin="round"/></svg>';
  var SVG_GRAB = '<svg class="grab" viewBox="0 0 26 26"><path d="M8.2 11.5 V9.6 a1.5 1.5 0 0 1 3 0 V11 V8.6 a1.5 1.5 0 0 1 3 0 V11 V9.2 a1.5 1.5 0 0 1 3 0 V11.4 V10.6 a1.5 1.5 0 0 1 3 0 V15.6 c0 3.6 -2.5 6.4 -6 6.4 h-1.2 c-2.2 0 -3.6 -1 -4.8 -2.8 L5.6 15.6 a1.5 1.5 0 0 1 2.4 -1.8 Z" fill="#f6efe2" stroke="#15120e" stroke-width="1.2" stroke-linejoin="round"/></svg>';

  /* ══ 1 · THE HERO BUILD ══════════════════════════════════════════════════ */
  // the laptop render, trimmed to 1520×967, and its transparent screen window
  var LAP = { w: 1520, h: 967, sx: 177 / 1520, sy: 51 / 967, sw: 1182 / 1520, sh: 694 / 967 };

  function heroBuild() {
    if (!root.classList.contains("bi-pending")) return;
    var stage = document.querySelector("[data-alpine-stage]");
    var realImg = document.querySelector("[data-hero-day]");
    var realCopy = document.querySelector("[data-hero-copy]");
    var realNav = document.querySelector("[data-portfolio-nav]");
    if (!eligible() || !day() || !stage || !realImg || !realCopy || !realNav || !root.hasAttribute("data-day-photo")) {
      root.classList.remove("bi-pending"); return;
    }

    var vw = window.innerWidth, vh = window.innerHeight;
    var el = document.createElement("div");
    el.className = "bi";
    el.innerHTML =
      '<div class="bi-bg"></div><div class="bi-grid"></div><i class="bi-glow"></i>' +
      '<div class="bi-clip"><div class="bi-plate"></div><div class="bi-glass"></div></div>' +
      '<div class="bi-lap"><img alt="" draggable="false"></div>' +
      '<div class="bi-sheen"></div><i class="bi-bloom"></i>' +
      '<div class="bi-frame"></div>' +
      '<div class="bi-tool"><div class="bi-sel"><i></i><i></i><i></i><i></i><b></b></div><i class="bi-guide v"></i><i class="bi-guide h"></i></div>' +
      '<div class="bi-cursor">' + SVG_ARROW + SVG_GRAB + '</div>' +
      '<div class="bi-hint"><span>Scroll to build</span><i></i></div>' +
      '<div class="bi-chrome"><div class="bi-steps"><ol>' +
      ['Canvas', 'Device', 'Assemble', 'Detail', 'Enter'].map(function (s, i) { return '<li><span>0' + (i + 1) + '</span>' + s + '</li>'; }).join("") +
      '</ol><div class="bi-rule"><i></i></div></div><button type="button" class="bi-skip">Skip intro ↓</button></div>';
    var $ = function (s) { return el.querySelector(s); };
    var bg = $(".bi-grid"), glow = $(".bi-glow"), clip = $(".bi-clip"), plate = $(".bi-plate"), glass = $(".bi-glass");
    var lap = $(".bi-lap"), lapImg = $(".bi-lap img"), sheen = $(".bi-sheen"), bloom = $(".bi-bloom"), frame = $(".bi-frame"), sizeKey = "";
    var sel = $(".bi-sel"), selLabel = $(".bi-sel b"), gv = $(".bi-guide.v"), gh = $(".bi-guide.h");
    var cursor = $(".bi-cursor"), hint = $(".bi-hint"), steps = el.querySelectorAll(".bi-steps li"), rule = $(".bi-rule i"), skip = $(".bi-skip");
    var chrome = $(".bi-chrome");
    lapImg.src = (window.devicePixelRatio || 1) > 1.25 ? "assets/hero-laptop-2x.webp" : "assets/hero-laptop.webp";

    // the plate: the hero's photograph, its finish and its scrim, as they are live
    var plateStage = clone(stage);
    Array.prototype.forEach.call(plateStage.querySelectorAll("[data-alpine-img], canvas, [data-alpine-wild], video, [data-hero-fx], [data-alpine-scrim='night']"), function (n) { n.remove(); });
    plateStage.style.display = "block";
    plate.appendChild(plateStage);
    var cImg = plateStage.querySelector("[data-hero-day]");
    // the interface: the copy and the nav, played to their finished state
    var cCopy = clone(realCopy), cNav = clone(realNav);
    [cCopy, cNav].forEach(function (c) { c.style.opacity = "1"; });
    cCopy.querySelectorAll("[data-reveal]").forEach(function (n) { n.style.opacity = "1"; n.style.transform = "none"; });
    cCopy.querySelectorAll("[data-hero-foot]").forEach(function (n) { n.style.opacity = "1"; n.style.transform = "none"; });
    cCopy.style.transform = realCopy.style.transform;
    frame.appendChild(cCopy); frame.appendChild(cNav);

    // the photograph's slow push is held, on both copies at the same moment, so
    // the cut lands on the same frame of it
    var anims = [];
    try {
      // only the drift: getAnimations() also returns transitions (the photo's own
      // fade-in among them), which must be left to finish underneath
      var drift = function (x) { return x.animationName === "day-drift"; };
      var ra = realImg.getAnimations().filter(drift), ca = cImg ? cImg.getAnimations().filter(drift) : [];
      ra.forEach(function (a, i) { a.pause(); if (ca[i]) { ca[i].currentTime = a.currentTime; ca[i].pause(); } anims.push(a); });
    } catch (e) {}

    // the pieces the cursor carries, in order
    var sea = cCopy.querySelector("[data-hero-sea]");
    var foot = cCopy.querySelector("[data-hero-foot]");
    var social = cCopy.querySelector("[data-social-pill]");
    var groups = [
      [cNav],
      [cCopy.querySelector("[data-hero-sky]"), cCopy.querySelector("[data-hero-name]")],
      sea ? [sea.querySelector("h1"), sea.querySelector("p")] : [],
      sea ? [sea.querySelector(":scope > div")] : [],
      [social]
    ].map(function (g) { return g.filter(Boolean); }).filter(function (g) { return g.length; });
    var decor = foot ? Array.prototype.filter.call(foot.children, function (c) { return c !== social; }) : [];
    // a piece may already be placed by its own transform (the nav is centred with
    // one); the carry is composed on top of it, never instead of it
    groups.forEach(function (g) { g.forEach(function (n) { n.classList.add("bi-piece"); n._base = n.style.transform && n.style.transform !== "none" ? n.style.transform : ""; }); });

    document.body.appendChild(el);
    root.classList.add("bi-on");
    root.classList.remove("bi-pending");

    /* geometry */
    var Lb, fBase, G = [];
    function lapBase() {
      var w = Math.min(0.6 * vw, 1.02 * vh), h = w * LAP.h / LAP.w;
      return { x: (vw - w) / 2, y: 0.55 * vh - h / 2, w: w, h: h };
    }
    function scr(L) { return { x: L.x + L.w * LAP.sx, y: L.y + L.h * LAP.sy, w: L.w * LAP.sw, h: L.h * LAP.sh }; }
    // the live page lays out inside the scrollbar, so the frame meets it there
    var cw = function () { return root.clientWidth || vw; };
    // the frame is the screen while the laptop is in view, and the viewport once
    // the screen is bigger than it: always the part of the screen that can be seen
    function frameOf(S) {
      var onH = Math.min(S.h, vh), onW = Math.min(S.w, cw()), f = onH / vh;
      return { f: f, W: onW / f, x: S.x + (S.w - onW) / 2, y: S.y + (S.h - onH) / 2 };
    }
    function layout() {
      vw = window.innerWidth; vh = window.innerHeight;
      Lb = lapBase();
      var S = scr(Lb), F = frameOf(S);
      fBase = F.f;
      lap.style.width = Lb.w + "px";
      // measure where each piece lands, in frame pixels, with nothing displaced
      frame.style.width = F.W + "px"; frame.style.height = vh + "px"; frame.style.transform = "none"; sizeKey = "";
      groups.forEach(function (g) { g.forEach(function (n) { n.style.transform = n._base || "none"; }); });
      var fr = frame.getBoundingClientRect();
      G = groups.map(function (g, i) {
        var x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
        g.forEach(function (n) { var r = n.getBoundingClientRect(); x0 = Math.min(x0, r.left); y0 = Math.min(y0, r.top); x1 = Math.max(x1, r.right); y1 = Math.max(y1, r.bottom); });
        var gw = (x1 - x0), gh2 = (y1 - y0), fx = x0 - fr.left, fy = y0 - fr.top;
        // where it floats before it is carried in: around the laptop, outside it
        var sw = gw * fBase, sh = gh2 * fBase, st;
        if (i === 0) st = [vw / 2 - sw / 2 + 40, Math.max(18, Lb.y - sh - 0.06 * vh)];
        else if (i === 1) st = [Math.max(20, Lb.x - sw * 0.72), Lb.y + Lb.h * 0.16];
        else if (i === 2) st = [Math.max(20, Lb.x - sw * 0.55), Lb.y + Lb.h * 0.58];
        else if (i === 3) st = [Math.min(vw - sw - 20, Lb.x + Lb.w - sw * 0.25), Lb.y + Lb.h * 0.22];
        else st = [Math.min(vw - sw - 20, Lb.x + Lb.w - sw * 0.35), Lb.y + Lb.h * 0.72];
        return { fx: fx, fy: fy, w: gw, h: gh2, sx: st[0], sy: st[1], rot: [-3.5, 2.5, -2, 3, -2.5][i] || 0, bob: i * 1.7 };
      });
    }
    layout();

    /* the timeline */
    var DR = [[0.30, 0.37], [0.37, 0.45], [0.45, 0.53], [0.53, 0.60], [0.60, 0.67]];
    var PUSH = 0.74;
    function lapAt(p) {
      var rise = out3(seg(p, 0.10, 0.26));
      var e = inOut(seg(p, PUSH, 1));
      // the push ends with the screen covering the viewport, however wide it is
      var we = Math.max(vh / (LAP.sh * LAP.h / LAP.w), cw() / LAP.sw);
      var w = Math.exp(lerp(Math.log(Lb.w), Math.log(we), e));
      var h = w * LAP.h / LAP.w;
      var Sb = scr(Lb);
      var cx = lerp(Sb.x + Sb.w / 2, cw() / 2, e), cy = lerp(Sb.y + Sb.h / 2, vh / 2, e);
      var L = { w: w, h: h, x: cx - (LAP.sx + LAP.sw / 2) * w, y: cy - (LAP.sy + LAP.sh / 2) * h };
      var s = lerp(0.965, 1, rise);
      if (s !== 1) { L.x += L.w * (1 - s) / 2; L.y += L.h * (1 - s) / 2; L.w *= s; L.h *= s; }
      L.y += (1 - rise) * 0.62 * vh;
      L.o = clamp(rise * 1.6, 0, 1);
      return L;
    }

    var cur = { x: vw * 0.82, y: vh * 1.1 }, fresh = null;
    function refresh() {
      var n = [clone(realNav), clone(realCopy)];
      n.forEach(function (c) { c.style.opacity = "1"; frame.appendChild(c); });
      cNav.style.visibility = cCopy.style.visibility = "hidden";
      fresh = n;
    }
    function unrefresh() {
      fresh.forEach(function (c) { c.remove(); }); fresh = null;
      cNav.style.visibility = cCopy.style.visibility = "";
    }
    function render(p, t) {
      var L = lapAt(p), S = scr(L), F = frameOf(S);
      var push = seg(p, PUSH, 1);
      bg.style.opacity = (seg(p, 0, 0.05) * (1 - seg(p, PUSH, PUSH + 0.1))).toFixed(3);
      hint.style.opacity = (1 - seg(p, 0.015, 0.05)).toFixed(3);
      chrome.style.opacity = (1 - seg(p, PUSH, PUSH + 0.06)).toFixed(3);
      var gs = Lb.w * 1.5;
      glow.style.transform = "translate(" + (S.x + S.w / 2 - gs / 2) + "px," + (S.y + S.h * 0.6 - gs / 2) + "px) scale(" + gs + ")";
      glow.style.opacity = (L.o * (0.6 + 0.4 * seg(p, 0.24, 0.34)) * (1 - push)).toFixed(3);

      lap.style.opacity = L.o.toFixed(3);
      lap.style.transform = "translate(" + L.x + "px," + L.y + "px) scale(" + (L.w / Lb.w) + ")";
      // the screen is a clip on a full-viewport layer and everything in it moves by
      // transform, so no frame of the build ever asks the page for layout
      clip.style.opacity = L.o.toFixed(3);
      var cwv = cw();
      clip.style.clipPath = "inset(" + S.y.toFixed(1) + "px " + (cwv - S.x - S.w).toFixed(1) + "px " + (vh - S.y - S.h).toFixed(1) + "px " + S.x.toFixed(1) + "px round " + (4 * S.w / 1182).toFixed(1) + "px)";
      if (sizeKey !== F.W + "|" + vh) {
        sizeKey = F.W + "|" + vh;
        plate.style.width = frame.style.width = F.W + "px"; plate.style.height = frame.style.height = vh + "px";
      }
      plate.style.transform = frame.style.transform = "translate(" + F.x.toFixed(2) + "px," + F.y.toFixed(2) + "px) scale(" + F.f.toFixed(5) + ")";
      // the screen comes on: black glass, a warm bloom, then the portrait develops
      var on = seg(p, 0.24, 0.36);
      glass.style.opacity = (1 - seg(p, 0.25, 0.31)).toFixed(3);
      plate.style.filter = on >= 1 ? "none" : "brightness(" + (0.12 + 0.88 * smooth(on)).toFixed(3) + ") saturate(" + (0.55 + 0.45 * on).toFixed(2) + ")";
      var bl = Math.sin(Math.PI * seg(p, 0.25, 0.4)) * 0.85;
      bloom.style.opacity = bl.toFixed(3);
      bloom.style.visibility = bl > 0.001 ? "visible" : "hidden";
      sheen.style.transform = bloom.style.transform = "translate(" + S.x.toFixed(2) + "px," + S.y.toFixed(2) + "px) scale(" + (S.w / 1000).toFixed(5) + "," + (S.h / 1000).toFixed(5) + ")";
      sheen.style.opacity = (L.o * (1 - seg(p, 0.86, 0.97))).toFixed(3);

      // the pieces
      var appear = seg(p, 0.26, 0.30);
      var active = -1, selBox = null, guideA = 0, grab = false;
      G.forEach(function (g, i) {
        var d = DR[i], u = seg(p, d[0], d[1]);
        var nodes = groups[i];
        var fx0 = g.fx * fBase + F.x, fy0 = g.fy * fBase + F.y; // landed position, in stage px
        var bob = Math.sin(t / 900 + g.bob) * 4 * (1 - u);
        var px, py, rot, sc = 1, op = 1, blur = 0;
        if (u <= 0.3) {
          px = g.sx; py = g.sy + bob; rot = g.rot;
          op = appear; blur = (1 - appear) * 6; sc = lerp(0.95, 1, appear);
          if (u > 0.22) { var lift = seg(u, 0.22, 0.3); sc = lerp(1, 1.04, lift); }
        } else if (u < 0.8) {
          var c = inOut(seg(u, 0.3, 0.8));
          px = lerp(g.sx, fx0, c); py = lerp(g.sy, fy0, c) - Math.sin(Math.PI * c) * 0.05 * vh;
          rot = lerp(g.rot, 0, c); sc = lerp(1.04, 1, c);
        } else {
          var v = seg(u, 0.8, 1), dx = fx0 - g.sx, dy = fy0 - g.sy, dl = Math.hypot(dx, dy) || 1;
          var sp = Math.exp(-7 * v) * Math.sin(v * 13) * 9 * (1 - v);
          px = fx0 + dx / dl * sp; py = fy0 + dy / dl * sp; rot = 0; sc = 1;
        }
        if (u >= 1) { px = fx0; py = fy0; }
        // displacement from the landed place, in the frame's own pixels
        var tx = (px - fx0) / F.f, ty = (py - fy0) / F.f;
        var still = u >= 1;
        nodes.forEach(function (n) {
          n.style.opacity = still ? "" : op.toFixed(3);
          n.style.transform = still ? (n._base || "none") : "translate(" + tx.toFixed(2) + "px," + ty.toFixed(2) + "px) " + (n._base || "") + " rotate(" + rot.toFixed(2) + "deg) scale(" + sc.toFixed(4) + ")";
          n.style.filter = blur > 0.05 ? "blur(" + blur.toFixed(1) + "px)" : "";
        });
        if (u > 0 && u < 1) {
          active = i; grab = u > 0.22 && u < 0.84;
          if (u > 0.2) selBox = { x: px, y: py, w: g.w * F.f * sc, h: g.h * F.f * sc, r: rot, o: u < 0.8 ? seg(u, 0.2, 0.26) : 1 - seg(u, 0.84, 0.95), g: g };
          if (u > 0.8) guideA = Math.sin(Math.PI * seg(u, 0.8, 1));
          // the cursor: to the piece, with it, then off it
          var gx = g.sx + g.w * fBase * 0.18, gy = g.sy + g.h * fBase * 0.5;
          if (u < 0.22) { var k = inOut(seg(u, 0, 0.22)); cur.x = lerp(cur.px, gx, k); cur.y = lerp(cur.py, gy + bob, k); }
          else { cur.x = px + g.w * F.f * 0.18; cur.y = py + g.h * F.f * 0.5; }
        }
        if (u >= 1) { cur.px = fx0 + g.w * F.f * 0.18; cur.py = fy0 + g.h * F.f * 0.5; }
      });
      if (active < 0) {
        if (p < 0.30) {
          var ent = inOut(seg(p, 0.04, 0.14));
          cur.x = lerp(vw * 0.84, vw * 0.55, ent) + Math.sin(t / 1300) * 6;
          cur.y = lerp(vh * 1.08, vh * 0.66, ent) + Math.cos(t / 1100) * 5;
          cur.px = cur.x; cur.py = cur.y;
        } else if (p >= 0.67) {
          var away = inOut(seg(p, 0.68, 0.74));
          cur.x = lerp(cur.px, vw * 0.9, away); cur.y = lerp(cur.py, vh * 1.05, away);
        }
      }
      cursor.classList.toggle("is-grab", grab);
      cursor.style.opacity = (seg(p, 0.04, 0.08) * (1 - seg(p, 0.7, 0.74))).toFixed(3);
      cursor.style.transform = "translate(" + (cur.x - 5).toFixed(1) + "px," + (cur.y - 3).toFixed(1) + "px)";

      if (selBox && selBox.o > 0.01) {
        sel.style.opacity = selBox.o.toFixed(3);
        sel.style.width = (selBox.w + 12) + "px"; sel.style.height = (selBox.h + 12) + "px";
        sel.style.transform = "translate(" + (selBox.x - 6) + "px," + (selBox.y - 6) + "px) rotate(" + selBox.r + "deg)";
        selLabel.textContent = "W " + Math.round(selBox.g.w) + " × H " + Math.round(selBox.g.h);
      } else sel.style.opacity = "0";
      if (guideA > 0.01 && active >= 0) {
        var ga = G[active];
        gv.style.opacity = gh.style.opacity = (guideA * 0.9).toFixed(3);
        gv.style.left = (ga.fx * F.f + F.x) + "px"; gv.style.top = S.y + "px"; gv.style.height = S.h + "px";
        gh.style.top = (ga.fy * F.f + F.y) + "px"; gh.style.left = S.x + "px"; gh.style.width = S.w + "px";
      } else { gv.style.opacity = gh.style.opacity = "0"; }

      var dec = seg(p, 0.66, 0.72);
      decor.forEach(function (n) { n.style.opacity = dec.toFixed(3); });

      var step = p < 0.10 ? 0 : p < 0.26 ? 1 : p < 0.60 ? 2 : p < PUSH ? 3 : 4;
      steps.forEach(function (s, i) { s.classList.toggle("on", i === step); });
      rule.style.transform = "scaleX(" + p.toFixed(4) + ")";

      // once every piece has landed, the screen takes the live hero as it is now
      // (the nav's intro and its active lens have finished underneath by then)
      if (p > 0.69 && !fresh) refresh();
      else if (p < 0.66 && fresh) unrefresh();
      // the live hero keeps moving with the cursor underneath; the clone follows it
      cCopy.style.transform = realCopy.style.transform; cCopy.style.translate = realCopy.style.translate;
      if (fresh) { fresh[1].style.transform = realCopy.style.transform; fresh[1].style.translate = realCopy.style.translate; }
      if (cImg) cImg.style.transform = realImg.style.transform;
    }

    /* the drive: the wheel and the keys move the build, not the page */
    var p = 0, vel = 0, target = 0, last = performance.now(), done = false, raf = 0;
    var VH = function () { return window.innerHeight; };
    function nudge(d) { target = clamp(target + d, 0, 1); }
    function onWheel(e) {
      if (done) return;
      e.preventDefault();
      var dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? VH() : 1);
      nudge(dy / (6 * VH()));
    }
    function onKey(e) {
      if (done) return;
      var k = e.key;
      if (k === "Escape") { e.preventDefault(); finish(true); return; }
      if (k === "ArrowDown") nudge(0.05); else if (k === "PageDown" || (k === " " && !e.shiftKey)) nudge(0.15);
      else if (k === "ArrowUp") nudge(-0.05); else if (k === "PageUp" || (k === " " && e.shiftKey)) nudge(-0.15);
      else if (k === "End") target = 1; else if (k === "Home") target = 0;
      else return;
      e.preventDefault();
    }
    function onScroll() { if (!done && window.scrollY !== 0) window.scrollTo(0, 0); }
    function onResize() { layout(); }
    window.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);
    skip.addEventListener("click", function () { finish(true); });

    function frameLoop(now) {
      var dt = Math.min(64, now - last); last = now;
      // a critically damped spring: the build eases into motion and eases out of it
      var W2 = 9, h = dt / 1000;
      vel += ((target - p) * W2 * W2 - 2 * W2 * vel) * h;
      p = clamp(p + vel * h, 0, 1);
      if (Math.abs(target - p) < 0.0004 && Math.abs(vel) < 0.002) { p = target; vel = 0; }
      render(p, now);
      // (__biHold lets a test look at the very last frame before the cut)
      if (p >= 1 && target >= 1 && !window.__biHold) { finish(false); return; }
      raf = requestAnimationFrame(frameLoop);
    }
    raf = requestAnimationFrame(frameLoop);

    function finish(fade) {
      if (done) return;
      done = true;
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      try { sessionStorage.setItem("sj-built", "1"); } catch (e) {}
      anims.forEach(function (a) { try { a.play(); } catch (e) {} });
      var close = function () {
        el.remove(); root.classList.remove("bi-on");
        // a trackpad's momentum would carry straight past the hero: let it settle
        setTimeout(function () { window.removeEventListener("wheel", onWheel); }, 650);
      };
      window.scrollTo(0, 0);
      if (fade) { el.classList.add("out"); setTimeout(close, 460); } else close();
    }
  }

  /* ══ 2 and 3 · THE FILMS ═════════════════════════════════════════════════ */
  var FILMS = [
    // the Builder's head sits in front of the left of the monitor, so the section
    // is set against the right of the screen and the push carries the head away
    { id: "cs-builder", dir: "assets/seq/builder/", before: "#selected-systems", target: "#selected-systems > div > header", screens: 5.5,
      filmEnd: 0.78, frag: true, anchor: 1, wakeAt: 156, w: 1280, h: 720 },
    // the CTA is re-mastered at 1080p: its last seconds are pushed in close
    { id: "cs-cta", dir: "assets/seq/cta/", before: "#contact", target: "#contact", screens: 5, filmEnd: 0.76, frag: false, anchor: 0.5, wakeAt: 126, w: 1920, h: 1080 }
  ];
  // every frame the camera shot, at its own 24 fps: no frame is skipped or blended
  var N = 240;
  var FRAGS = [
    { t: "retrieve → rerank → ground", x: 0.08, y: 0.22, z: 0.9 },
    { t: "p95 42 ms · queue 1", x: 0.70, y: 0.16, z: 0.5 },
    { t: "KV cache 0 / 64 blocks", x: 0.12, y: 0.74, z: 1.3 },
    { t: "24.92 TFLOP/s · BF16 GEMM", x: 0.62, y: 0.80, z: 1.1 },
    { t: "evidence gate", x: 0.40, y: 0.10, z: 0.4, lg: true },
    { svg: true, x: 0.80, y: 0.46, z: 0.7 }
  ];

  function film(cfg) {
    var before = document.querySelector(cfg.before), target = document.querySelector(cfg.target);
    if (!before || !target) return null;
    var track = document.createElement("div");
    track.className = "cs-track"; track.id = cfg.id; track.setAttribute("aria-hidden", "true");
    var ov = document.createElement("div");
    ov.className = "cs-film";
    ov.innerHTML = '<img class="cs-poster" alt="" src="' + cfg.dir + 'f001.webp"><canvas></canvas>' +
      '<div class="cs-group"><div class="cs-back"></div><div class="cs-sheen"></div></div>' +
      '<div class="cs-frame"></div><canvas class="cs-fg"></canvas><i class="cs-grain"></i><i class="cs-vig"></i>';
    // the overlay is fixed, so it can live at the very end of the document
    var cv = ov.querySelector("canvas"), ctx = cv.getContext("2d"), poster = ov.querySelector(".cs-poster");
    var fgc = ov.querySelector(".cs-fg"), fgx = fgc.getContext("2d"), fgImgs = {}, fgBox = {};
    var group = ov.querySelector(".cs-group"), back = ov.querySelector(".cs-back"), sheen = ov.querySelector(".cs-sheen"), frame = ov.querySelector(".cs-frame");
    var frags = [];
    if (cfg.frag) FRAGS.forEach(function (f) {
      var d = document.createElement("span");
      d.className = "cs-frag" + (f.lg ? " lg" : "");
      if (f.svg) d.innerHTML = '<svg width="150" height="70" viewBox="0 0 150 70" fill="none" stroke="rgba(244,214,168,0.8)" stroke-width="1"><rect x="1" y="26" width="34" height="18" rx="3"/><rect x="58" y="6" width="34" height="18" rx="3"/><rect x="58" y="46" width="34" height="18" rx="3"/><rect x="115" y="26" width="34" height="18" rx="3"/><path d="M35 35 H46 V15 H58 M46 35 V55 H58 M92 15 H104 V35 H115 M92 55 H104 V35"/></svg>';
      else d.textContent = f.t;
      ov.appendChild(d); frags.push({ el: d, f: f });
    });

    var quads = null, frames = new Array(N), loaded = 0, started = false, live = null, held = false;
    function load() {
      if (started) return; started = true;
      fetch(cfg.dir + "screen.json").then(function (r) { return r.json(); }).then(function (j) {
        quads = j.q; fgBox = j.fg || {}; dirty = true;
        // the mattes of whatever stands in front of the screen, loaded after the film
        Object.keys(fgBox).forEach(function (k) {
          var im = new Image(); im.decoding = "async";
          im.onload = function () { fgImgs[k] = im; dirty = true; };
          im.src = cfg.dir + "fg" + String(+k + 1).padStart(3, "0") + ".webp";
        });
      }).catch(function () {});
      var order = [], seen = {};
      [16, 8, 4, 2, 1].forEach(function (s) { for (var i = 0; i < N; i += s) if (!seen[i]) { seen[i] = 1; order.push(i); } });
      var next = 0, inflight = 0;
      function pump() {
        while (inflight < 6 && next < order.length) {
          (function (i) {
            inflight++;
            var im = new Image();
            im.decoding = "async";
            im.onload = function () {
              (im.decode ? im.decode() : Promise.resolve()).catch(function () {}).then(function () {
                frames[i] = im; loaded++; inflight--; dirty = true; pump();
              });
            };
            im.onerror = function () { inflight--; pump(); };
            im.src = cfg.dir + "f" + String(i + 1).padStart(3, "0") + ".webp";
          })(order[next++]);
        }
      }
      pump();
    }
    function nearest(i) {
      if (frames[i]) return i;
      for (var d = 1; d < N; d++) { if (frames[i - d]) return i - d; if (frames[i + d]) return i + d; }
      return -1;
    }
    function quadAt(fi) {
      if (!quads) return null;
      var a = Math.floor(fi), b = Math.min(N - 1, a + 1), t = fi - a, qa = quads[a], qb = quads[b];
      if (!qa) return null; if (!qb) return qa.slice();
      return qa.map(function (v, k) { return lerp(v, qb[k], t); });
    }
    var firstQ = -1;
    function wakeFrame() {
      if (firstQ >= 0 || !quads) return firstQ;
      for (var i = 0; i < N; i++) if (quads[i]) { firstQ = i; break; }
      return firstQ;
    }

    function ensureClone() {
      if (live) return;
      land(target);
      live = clone(target);
      live.classList.remove("cs-held");
      // the section's own rules are keyed on its id (#contact …); the clone keeps it,
      // and lives after the real one in the document so lookups still find the real
      if (target.id) live.id = target.id;
      // it sits where the real one sits across the page (inside its column), in the
      // section's own units, since a fitted section may be zoomed
      var r = target.getBoundingClientRect(), z = parseFloat(getComputedStyle(target).zoom) || 1;
      live.style.position = "absolute"; live.style.top = "0"; live.style.margin = "0";
      live.style.left = (r.left / z) + "px"; live.style.width = (r.width / z) + "px";
      frame.appendChild(live);
    }

    var dirty = true, lastKey = "", lastFg = "", lastFgKey = "";
    function draw(p) {
      var vw = window.innerWidth, vh = window.innerHeight;
      // a canvas much wider than the film itself only costs fill
      var FW = cfg.w, FH = cfg.h;
      var dpr = Math.min(window.devicePixelRatio || 1, 1.5, 1.25 * FW / vw);
      if (cv.width !== Math.round(vw * dpr)) { fgc.width = cv.width = Math.round(vw * dpr); fgc.height = cv.height = Math.round(vh * dpr); dirty = true; }
      var k = Math.max(vw / FW, vh / FH), ox = (vw - FW * k) / 2, oy = (vh - FH * k) / 2;
      var fp = seg(p, 0.03, cfg.filmEnd), fi = fp * (N - 1);
      var pushT = inOut(seg(p, cfg.filmEnd, 0.93));
      var qEnd = quads && quads[N - 1];
      // the camera after the film: a zoom that brings the screen to the viewport
      var a = 1, bx = 0, by = 0;
      if (qEnd && pushT > 0) {
        var sq = subQuad(qEnd.map(function (v, i) { return i % 2 ? v * k + oy : v * k + ox; }), vw / vh, cfg.anchor);
        var minx = Math.min(sq[0], sq[4]), maxx = Math.max(sq[2], sq[6]), miny = Math.min(sq[1], sq[3]), maxy = Math.max(sq[5], sq[7]);
        var a1 = Math.max(vw / (maxx - minx), vh / (maxy - miny));
        a = Math.exp(Math.log(a1) * pushT);
        var cx = (minx + maxx) / 2, cy = (miny + maxy) / 2;
        bx = lerp(cx, vw / 2, pushT) - a * cx; by = lerp(cy, vh / 2, pushT) - a * cy;
      }
      var key = Math.round(fi) + "|" + a.toFixed(4) + "|" + vw + "x" + vh;
      if (dirty || key !== lastKey) {
        lastKey = key; dirty = false;
        // every frame the camera shot is here, so the nearest one is drawn, once; a
        // blend of two would only double the cost and ghost the motion
        var A = nearest(Math.round(fi));
        ctx.setTransform(dpr * a, 0, 0, dpr * a, dpr * bx, dpr * by);
        if (A >= 0) {
          poster.style.visibility = "hidden";
          ctx.drawImage(frames[A], ox, oy, FW * k, FH * k);
        }
      }

      // the screen: a backing, a sheen, and the live section on it
      var q = quadAt(Math.min(fi, N - 1));
      var wf = Math.max(wakeFrame(), cfg.wakeAt || 0), wakeP = quads ? lerp(0.03, cfg.filmEnd, Math.min(N - 1, wf) / (N - 1)) : 2;
      var wake = seg(p, wakeP, wakeP + 0.07), show = seg(p, wakeP + 0.04, wakeP + 0.12);
      if (q && wake > 0) {
        ensureClone();
        var tq = q.map(function (v, i) { return i % 2 ? (v * k + oy) * a + by : (v * k + ox) * a + bx; });
        var sq2 = subQuad(tq, (root.clientWidth || vw) / vh, cfg.anchor);
        var cw = root.clientWidth || vw;
        var exact = [0, 0, cw, 0, 0, vh, cw, vh], wgt = Math.pow(pushT, 3);
        var fq = sq2.map(function (v, i) { return lerp(v, exact[i], wgt); });
        back.style.width = sheen.style.width = vw + "px"; back.style.height = sheen.style.height = vh + "px";
        back.style.transform = sheen.style.transform = toQuad(vw, vh, tq);
        back.style.opacity = (wake * 0.96).toFixed(3);
        sheen.style.opacity = (wake * (1 - seg(p, 0.86, 0.94))).toFixed(3);
        frame.style.width = cw + "px"; frame.style.height = vh + "px";
        frame.style.transform = toQuad(cw, vh, fq);
        frame.style.opacity = show.toFixed(3);
      } else {
        back.style.opacity = sheen.style.opacity = frame.style.opacity = "0";
      }
      // what stands in front of the screen stays in front of what is on it
      var fk = String(Math.round(Math.min(fi, N - 1)));
      if (fk !== lastFg || key !== lastFgKey) {
        lastFg = fk; lastFgKey = key;
        fgx.setTransform(1, 0, 0, 1, 0, 0); fgx.clearRect(0, 0, fgc.width, fgc.height);
        if (wake > 0 && fgImgs[fk] && fgBox[fk]) {
          var bb = fgBox[fk];
          fgx.setTransform(dpr * a, 0, 0, dpr * a, dpr * bx, dpr * by);
          fgx.drawImage(fgImgs[fk], ox + bb[0] * k, oy + bb[1] * k, bb[2] * k, bb[3] * k);
        }
      }
      // the last stretch: the room behind the section gives way to the page's own
      var gone = seg(p, 0.93, 0.995);
      cv.style.opacity = group.style.opacity = (1 - gone).toFixed(3);
      fgc.style.opacity = wake > 0 ? (1 - gone).toFixed(3) : "0";
      ov.style.background = gone > 0 ? "rgba(6,6,6," + (1 - gone).toFixed(3) + ")" : "";

      frags.forEach(function (o) {
        var f = o.f, vis = seg(p, 0.05 + f.z * 0.02, 0.14) * (1 - seg(p, 0.26 + f.z * 0.04, 0.36 + f.z * 0.03));
        var dx = -(fp - 0.35) * f.z * 0.18 * vw, dy = -(fp - 0.35) * f.z * 0.05 * vh;
        o.el.style.opacity = (vis * (f.z > 1.05 ? 0.55 : 0.85)).toFixed(3);
        o.el.style.transform = "translate(" + (f.x * vw + dx).toFixed(1) + "px," + (f.y * vh + dy).toFixed(1) + "px) scale(" + (0.8 + f.z * 0.25).toFixed(3) + ")";
        o.el.style.filter = Math.abs(f.z - 0.8) > 0.35 ? "blur(" + (Math.abs(f.z - 0.8) * 3).toFixed(1) + "px)" : "";
      });
    }

    // The Builder eases after scroll by about a tenth of a second. The CTA's
    // scroll is already eased by the pager, so follow its position directly to
    // keep the camera synchronized without adding a second layer of lag.
    var raf = 0, active = false, lastP = -1, pv = -1, lastT = 0;
    function tick(now) {
      raf = 0;
      now = now || performance.now();
      var dt = lastT ? Math.min(64, now - lastT) : 16; lastT = now;
      var vh = window.innerHeight, y = window.scrollY;
      var top = track.getBoundingClientRect().top + y, H = track.offsetHeight;
      var enter = seg(y, top - vh, top);
      var p = (y - top) / H;
      if (cfg.id === "cs-cta" || pv < 0 || p <= 0 || p >= 1) pv = clamp(p, 0, 1);
      else { pv += (p - pv) * (1 - Math.exp(-dt / 110)); if (Math.abs(p - pv) < 1e-4) pv = p; }
      // Scroll positions round to pixels, but a fitted section can end between
      // pixels. Release the overlay at that rounded endpoint too.
      var on = y > top - vh && y < top + H - 0.5;
      if (on) {
        if (!held) { target.classList.add("cs-held"); held = true; }
        land(target);
        load();
        if (!active) { ov.classList.add("on"); active = true; }
        ov.style.opacity = enter.toFixed(3);
        if (Math.abs(pv - lastP) > 1e-5 || dirty) { draw(pv); lastP = pv; }
        if (loaded < N || dirty || Math.abs(p - pv) > 1e-5) raf = requestAnimationFrame(tick);
        else lastT = 0;
      } else {
        if (active) { ov.classList.remove("on"); ov.style.opacity = "0"; active = false; lastP = -1; }
        if (held) { target.classList.remove("cs-held"); held = false; }
        lastT = 0;
      }
    }
    function queue() { if (!raf) raf = requestAnimationFrame(tick); }
    // preload once the track is near
    var io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { load(); queue(); } }); }, { rootMargin: "200% 0px" });

    function mount() {
      track.style.height = (cfg.screens * 100) + "vh";
      before.parentNode.insertBefore(track, before);
      document.body.appendChild(ov);
      io.observe(track);
      window.addEventListener("scroll", queue, { passive: true });
      window.addEventListener("resize", function () { dirty = true; queue(); });
      queue();
    }
    function unmount() {
      io.disconnect();
      window.removeEventListener("scroll", queue);
      if (raf) cancelAnimationFrame(raf);
      raf = 0; active = false; lastP = -1; pv = -1; lastT = 0;
      ov.classList.remove("on"); ov.style.opacity = "0";
      if (held) { target.classList.remove("cs-held"); held = false; }
      if (track.parentNode) track.parentNode.removeChild(track);
      if (ov.parentNode) ov.parentNode.removeChild(ov);
    }
    return { mount: mount, unmount: unmount, track: track };
  }

  function films() {
    if (!eligible()) return;
    var list = FILMS.map(film).filter(Boolean), mounted = false;
    function sync() {
      var want = day();
      if (want === mounted) return;
      // the tracks are page height: keep the reader where they are when they come and
      // go. The browser's own scroll anchoring may or may not have moved the page, so
      // measure what is at the top of the screen before and after, and settle the rest
      var anchor = null, at = 0;
      var cands = document.querySelectorAll(".fs-panel, section, article");
      for (var i = 0; i < cands.length; i++) {
        var r = cands[i].getBoundingClientRect();
        if (r.bottom > 1 && r.height > 0 && !cands[i].closest(".cs-film")) { anchor = cands[i]; at = r.top; break; }
      }
      list.forEach(function (f) { if (want) f.mount(); else f.unmount(); });
      mounted = want;
      if (anchor) { var d = anchor.getBoundingClientRect().top - at; if (Math.abs(d) > 0.5) window.scrollBy(0, d); }
    }
    sync();
    new MutationObserver(sync).observe(root, { attributes: true, attributeFilter: ["data-scene"] });
  }

  function start() {
    try { heroBuild(); } catch (e) { root.classList.remove("bi-pending", "bi-on"); var b = document.querySelector(".bi"); if (b) b.remove(); console.error("[cine] hero build", e); }
    try { films(); } catch (e) { console.error("[cine] films", e); }
  }
  // never leave the page covered, whatever happens above
  setTimeout(function () { if (root.classList.contains("bi-pending")) root.classList.remove("bi-pending"); }, 4000);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
