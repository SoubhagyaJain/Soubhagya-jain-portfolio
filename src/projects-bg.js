/* ── the Projects backdrop (see projects-bg.css) ─────────────────────────────
   Behind "Selected systems." only: a node-graph film, scrubbed by the scroll.
   As the reader moves through the projects the signal travels through the graph
   and the camera pans down it, its top at the first project, its bottom at the
   last. It fades in as the title card leaves (so the Builder film still lands on
   the page's own ground), steps back while the Aperture pipeline draws its own
   diagram, and scrolls away with the section's end like any background.
   Every screen and both themes; reduced motion gets one still frame. */
(function () {
  "use strict";
  var section = document.getElementById("selected-systems");
  if (!section) return;
  var DIR = "assets/seq/projects/", N = 120, FW = 720, FH = 1280;
  var still = !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches);

  var clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
  var seg = function (v, a, b) { return b > a ? clamp((v - a) / (b - a), 0, 1) : v >= b ? 1 : 0; };
  var smooth = function (t) { return t * t * (3 - 2 * t); };

  var bg = document.createElement("div");
  bg.className = "pj-bg";
  bg.setAttribute("aria-hidden", "true");
  bg.innerHTML = '<canvas class="pj-cv"></canvas><i class="pj-scrim"></i>';
  section.insertBefore(bg, section.firstChild);
  var cv = bg.firstChild, ctx = cv.getContext("2d");

  /* frames: coarse first, then filled in, so a fast reader always has one near */
  var frames = new Array(N), started = false;
  function load() {
    if (started) return; started = true;
    var order = [], seen = {};
    var from = still ? [Math.round(N * 0.6)] : [];
    from.forEach(function (i) { seen[i] = 1; order.push(i); });
    if (!still) [16, 8, 4, 2, 1].forEach(function (s) { for (var i = 0; i < N; i += s) if (!seen[i]) { seen[i] = 1; order.push(i); } });
    var next = 0, inflight = 0;
    (function pump() {
      while (inflight < 4 && next < order.length) {
        (function (i) {
          inflight++;
          var im = new Image();
          im.decoding = "async";
          im.onload = function () {
            (im.decode ? im.decode() : Promise.resolve()).catch(function () {}).then(function () {
              frames[i] = im; inflight--; dirty = true; pump();
            });
          };
          im.onerror = function () { inflight--; pump(); };
          im.src = DIR + "f" + String(i + 1).padStart(3, "0") + ".webp";
        })(order[next++]);
      }
    })();
  }
  function nearest(i) {
    if (frames[i]) return i;
    for (var d = 1; d < N; d++) { if (frames[i - d]) return i - d; if (frames[i + d]) return i + d; }
    return -1;
  }

  /* where the reader is: the title card, the pipeline's track, the section's end */
  var head, pipe;
  function parts() {
    head = head || section.querySelector(":scope > div > header");
    pipe = pipe || document.getElementById("aperture-pipeline");
  }
  function state() {
    parts();
    var vh = window.innerHeight, s = section.getBoundingClientRect();
    var h = head ? head.getBoundingClientRect() : s;
    // fades in while the title card scrolls away, out as the section's end goes by
    var fadeIn = smooth(seg(-h.top, vh * 0.04, vh * 0.9));
    var top = Math.max(0, s.top), bottom = Math.min(vh, s.bottom);
    // the film runs from the title card at the top to the last project filling the screen
    var p = seg(-h.top, 0, s.bottom - h.top - vh);
    // the pipeline draws its own diagram: the graph steps back while it is pinned
    var dim = 1;
    if (pipe) {
      var r = pipe.getBoundingClientRect();
      var inside = Math.min(seg(-r.top, -vh * 0.2, vh * 0.5), seg(r.bottom, vh * 0.8, vh * 1.5));
      dim = 1 - 0.62 * smooth(inside);
    }
    return { p: p, op: fadeIn * dim, top: top, bottom: bottom, vh: vh, on: s.bottom > 0 && s.top < vh && fadeIn > 0 };
  }

  var dirty = true, lastKey = "";
  function draw(pv) {
    var vw = window.innerWidth, vh = window.innerHeight;
    // cover the screen; on a tall phone screen zoom a little more so there is still a pan
    var k = Math.max(vw / FW, vh * 1.3 / FH), dw = FW * k, dh = FH * k;
    // no point in more canvas pixels than the film has
    var dpr = Math.max(0.5, Math.min(window.devicePixelRatio || 1, 1.5, 1.25 / k));
    var cw = Math.round(vw * dpr), ch = Math.round(vh * dpr);
    if (cv.width !== cw || cv.height !== ch) { cv.width = cw; cv.height = ch; dirty = true; }
    var fi = nearest(still ? Math.round(N * 0.6) : Math.round(pv * (N - 1)));
    if (fi < 0) return;
    var y = still ? (vh - dh) / 2 : -(dh - vh) * pv;
    var key = fi + "|" + Math.round(y * dpr) + "|" + cw;
    if (!dirty && key === lastKey) return;
    dirty = false; lastKey = key;
    ctx.drawImage(frames[fi], Math.round((vw - dw) / 2 * dpr), Math.round(y * dpr), Math.round(dw * dpr), Math.round(dh * dpr));
  }

  /* the film eases after the scroll, so wheel notches and glides read as one move */
  var pv = -1, lastT = 0, raf = 0, near = false, shown = false, lastOp = "", lastClip = "";
  function tick(now) {
    raf = 0;
    if (!near) return;
    var st = state();
    if (st.on) {
      var dt = lastT ? Math.min(64, now - lastT) : 16; lastT = now;
      if (pv < 0 || Math.abs(st.p - pv) > 0.25) pv = st.p;
      else pv += (st.p - pv) * (1 - Math.exp(-dt / 110));
      if (Math.abs(st.p - pv) < 0.0004) pv = st.p;
      if (!shown) { shown = true; bg.classList.add("on"); }
      var op = st.op.toFixed(3);
      if (op !== lastOp) { lastOp = op; bg.style.opacity = op; }
      // it ends with the section, and never reaches above it
      var clip = "inset(" + Math.round(st.top) + "px 0 " + Math.round(st.vh - st.bottom) + "px 0)";
      if (clip !== lastClip) { lastClip = clip; bg.style.clipPath = clip; }
      draw(pv);
    } else {
      lastT = 0;
      if (shown) { shown = false; bg.classList.remove("on"); }
    }
    raf = requestAnimationFrame(tick);
  }
  function wake() { if (!raf && near) raf = requestAnimationFrame(tick); }

  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (es) {
      near = es[0].isIntersecting;
      if (near) { load(); wake(); }
    }, { rootMargin: "200% 0px 200% 0px" }).observe(section);
  } else { near = true; load(); wake(); }
  window.addEventListener("resize", function () { dirty = true; wake(); });
})();
