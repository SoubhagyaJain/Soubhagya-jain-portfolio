/* ── one screen per section (see fullscreen.css) ────────────────────────────
   Each panel is fitted to exactly one screen. Its content is measured with no
   padding; if it is shorter than the screen, the spare height becomes padding
   (a little more below than above, which reads as centred under the navbar). If it
   runs long on a desktop, the panel is zoomed down to fit, but never below MIN_ZOOM:
   past that the type would be too small, so the panel grows past one screen instead.
   CSS zoom is used rather than a transform because it changes layout, so the panel
   really is one screen tall and the next one starts where the snap lands.
   Phones never zoom: their panels centre when short and grow when long.
   The pinned stages get an invisible snap stop per screen of their track. */
(function () {
  "use strict";
  var root = document.documentElement;
  var MIN_ZOOM = 0.8, NAV = 84;
  var PANELS = [
    "#about",
    "#selected-systems > div > header",
    '[data-dc-component="Aperture RAG Showcase"] > div > header',
    "#selected-systems > div > article",
    "#activity .fs-panel",
    "#philosophy", "#beyond", "#education", "#technology",
    "#writing", "#contact"
  ];
  // the pinned stages, and the films' tracks (src/cine-seq.js), a stop per screen
  var TRACKS = ["#aperture-pipeline", "#activity .cxw-track", "#direction", "#cs-builder", "#cs-cta"];
  var panels = [];

  function collect() {
    panels = [];
    PANELS.forEach(function (s) {
      document.querySelectorAll(s).forEach(function (el) {
        if (panels.indexOf(el) < 0) { el.classList.add("fs-panel"); panels.push(el); }
      });
    });
  }

  function set(el, prop, v) { el.style.setProperty(prop, v, "important"); }

  // the panel's in-flow children: its content, without the shading layers behind it
  function content(el) {
    return Array.prototype.filter.call(el.children, function (c) {
      var p = getComputedStyle(c).position;
      return p !== "absolute" && p !== "fixed";
    });
  }

  function apply(el, z, pt, pb) {
    el.style.zoom = z < 1 ? z.toFixed(4) : "";
    // padding sits inside the zoom, so it is divided back out
    set(el, "padding-top", (pt / z).toFixed(1) + "px");
    set(el, "padding-bottom", (pb / z).toFixed(1) + "px");
  }

  function fit() {
    var vh = window.innerHeight, phone = window.innerWidth <= 820;
    var top = Math.max(NAV, vh * 0.09), bot = Math.max(28, vh * 0.04);
    // a short laptop screen (1366×768) may go a little smaller before a panel runs long
    MIN_ZOOM = vh < 800 ? 0.72 : 0.8;
    panels.forEach(function (el) {
      // measure the bare content, at its natural width
      el.style.zoom = "";
      var kids = content(el);
      kids.forEach(function (c) { c.style.removeProperty("max-width"); c.style.removeProperty("margin-left"); c.style.removeProperty("margin-right"); if (c.dataset.fsMw) c.style.maxWidth = c.dataset.fsMw; });
      var widths = kids.map(function (c) { return c.offsetWidth; });
      set(el, "padding-top", "0px"); set(el, "padding-bottom", "0px"); set(el, "min-height", "0px");
      var h = el.offsetHeight;
      el.style.removeProperty("min-height");
      var z = 1;
      if (!phone && h + top + bot > vh) z = Math.max(MIN_ZOOM, (vh - top - bot) / h);
      var spare = Math.max(0, vh - h * z - top - bot);
      var pt = top + spare * 0.46, pb = bot + spare * 0.54;
      // Under zoom the panel has more CSS pixels of width to lay out in, and anything
      // whose height follows its width (aspect-ratio boxes, canvases) would grow back
      // by as much as the zoom took off. Pinning the content to the width it had keeps
      // the layout identical, so the zoom scales the panel down as a whole.
      if (z < 1) kids.forEach(function (c, i) {
        if (c.dataset.fsMw === undefined) c.dataset.fsMw = c.style.maxWidth || "";
        set(c, "max-width", widths[i] + "px"); set(c, "margin-left", "auto"); set(c, "margin-right", "auto");
      });
      apply(el, z, pt, pb);
      // viewport units and percentages inside the panel do not all scale with the
      // zoom, so check what actually rendered and correct, a couple of times at most
      for (var k = 0; k < 3 && !phone; k++) {
        var got = el.getBoundingClientRect().height;
        if (Math.abs(got - vh) <= 1.5) break;
        if (got > vh && z <= MIN_ZOOM) {
          // at the floor: give back some of the navbar clearance and the foot margin
          // before letting the panel run past the screen
          var over = got - vh, give = Math.min(over, (pt - NAV * 0.86) + (pb - 12));
          if (give > 0) { var gt = Math.min(pt - NAV * 0.86, give * 0.5); pt -= gt; pb -= Math.min(pb - 12, give - gt); apply(el, z, pt, pb); }
          break;
        }
        if (got < vh && z >= 1) break;
        var inner = got - pt - pb;
        z = Math.min(1, Math.max(MIN_ZOOM, z * (vh - top - bot) / inner));
        pt = top; pb = bot;
        apply(el, z, pt, pb);
        got = el.getBoundingClientRect().height;
        if (got < vh) { var add = vh - got; pt += add * 0.46; pb += add * 0.54; apply(el, z, pt, pb); }
      }
    });
    stops(vh);
  }

  // every snap stop lives in one unzoomed layer at the top of the page: one per panel,
  // one for the hero, and one per screen down each pinned stage's track
  var layer = null;
  function stops(vh) {
    if (!layer) {
      layer = document.createElement("div");
      layer.setAttribute("aria-hidden", "true");
      layer.style.cssText = "position:absolute;left:0;top:0;width:0;height:0;pointer-events:none";
      document.body.appendChild(layer);
    }
    var sy = window.scrollY, ys = [0];  // local; the pager reads pagerStops
    panels.forEach(function (el) { ys.push(el.getBoundingClientRect().top + sy); });
    TRACKS.forEach(function (s) {
      var t = document.querySelector(s);
      if (!t) return;
      var top = t.getBoundingClientRect().top + sy, H = t.offsetHeight;
      if (H <= vh * 1.2) return;
      var n = Math.floor((H - vh) / vh), last = 0;
      for (var i = 0; i <= n; i++) { ys.push(top + i * vh); last = i * vh; }
      // the last screen of the pin, so the stage can be seen at rest
      if (H - vh - last > vh * 0.25) ys.push(top + H - vh);
    });
    ys = ys.map(Math.round).sort(function (a, b) { return a - b; })
      .filter(function (y, i, a) { return i === 0 || y - a[i - 1] > 2; });
    var have = layer.children;
    while (have.length > ys.length) layer.removeChild(layer.lastChild);
    while (have.length < ys.length) { var m = document.createElement("i"); m.className = "fs-stop"; layer.appendChild(m); }
    ys.forEach(function (y, i) { have[i].style.top = y + "px"; });
    pagerStops = ys;
  }

  /* ── the pager ──────────────────────────────────────────────────────────
     When a wheel, trackpad or keyboard scroll comes to rest between two stops, it
     glides on to the next stop in the direction the reader was going; a nudge too
     small to mean anything settles back. Where the space between two stops is more
     than a screen (a panel that runs long), the reader scrolls freely and is only
     drawn to a stop once it is close. Touch keeps the platform's own scrolling. */
  var pagerStops = [], settled = 0, gliding = false, target = 0, idle = 0, guard = 0, held = false;
  var reducedMq = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)");
  function pagerOn() {
    // while the hero is being built, the wheel drives the build, not the page
    if (root.classList.contains("bi-on")) return false;
    return window.innerWidth > 820 && !!(window.matchMedia && matchMedia("(hover: hover) and (pointer: fine)").matches);
  }
  function glide(y) {
    gliding = true; target = y; settled = y;
    clearTimeout(guard); guard = setTimeout(function () { gliding = false; }, 1400);
    window.scrollTo({ top: y, behavior: reducedMq && reducedMq.matches ? "auto" : "smooth" });
  }
  function settle() {
    var y = window.scrollY, vh = window.innerHeight, from = settled;
    var ys = pagerStops;
    if (!ys.length || held) { settled = y; return; }
    for (var j = 0; j < ys.length; j++) if (Math.abs(ys[j] - y) <= 2) { settled = ys[j]; return; }
    var k = -1;
    for (var i = 0; i < ys.length; i++) if (ys[i] < y) k = i;
    var prev = k >= 0 ? ys[k] : 0, next = k + 1 < ys.length ? ys[k + 1] : null;
    if (next === null) { settled = y; return; }          // past the last stop: the footer
    var d = y - from, gap = next - prev;
    // a long jump is a link or a hash, not a gesture: settle on the nearest stop
    if (Math.abs(d) > vh * 1.5) { if (gap <= vh * 1.05 || Math.min(y - prev, next - y) < vh * 0.3) glide(y - prev <= next - y ? prev : next); else settled = y; return; }
    if (Math.abs(d) < 24 && Math.abs(from - y) < vh) { glide(from); return; }
    if (gap <= vh * 1.05) { glide(d > 0 ? next : prev); return; }
    if (d > 0 && next - y < vh * 0.3) { glide(next); return; }
    if (d < 0 && y - prev < vh * 0.3) { glide(prev); return; }
    settled = y;
  }
  function onScroll() {
    if (!pagerOn()) return;
    if (gliding) {
      if (Math.abs(window.scrollY - target) <= 2) { gliding = false; clearTimeout(guard); }
      return;
    }
    clearTimeout(idle);
    idle = setTimeout(settle, 160);
  }

  var queued = 0;
  function refit() { if (queued) return; queued = requestAnimationFrame(function () { queued = 0; fit(); }); }

  function start() {
    if (!document.querySelector("[data-dc-component]")) return;
    collect();
    fit();
    var w = window.innerWidth, h = window.innerHeight;
    window.addEventListener("resize", function () {
      // a phone's toolbar sliding away changes the height by a few dozen pixels;
      // refitting then would jolt the page under the reader's thumb
      if (window.innerWidth === w && Math.abs(window.innerHeight - h) < 120) return;
      w = window.innerWidth; h = window.innerHeight; refit();
    });
    window.addEventListener("load", refit);
    settled = window.scrollY;
    window.addEventListener("scroll", onScroll, { passive: true });
    // a held button is a scrollbar drag or a text selection: leave the page where it is
    window.addEventListener("pointerdown", function (e) { if (e.pointerType === "mouse") held = true; }, true);
    window.addEventListener("pointerup", function () { if (held) { held = false; clearTimeout(idle); idle = setTimeout(settle, 160); } }, true);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(refit);
    // late content: the GitHub data refresh, lazy images
    setTimeout(refit, 1500); setTimeout(refit, 4000);
    if ("ResizeObserver" in window) {
      var rq = 0;
      new ResizeObserver(function () {
        if (rq) return;
        rq = requestAnimationFrame(function () { rq = 0; stops(window.innerHeight); });
      }).observe(document.getElementById("dc-root") || document.body);
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
