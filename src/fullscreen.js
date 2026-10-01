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
      // the last screen of the pin, so the stage can be seen at rest; when it is only a
      // sliver past the last screen it takes that screen's place, so the section after
      // the pin is never more than a page away
      if (H - vh - last <= vh * 0.25 && n > 0) ys.pop();
      ys.push(top + H - vh);
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
     than PAGE screens (a panel that runs long), the reader scrolls freely and is only
     drawn to a stop once it is close. Touch keeps the platform's own scrolling. */
  // a gap up to this many screens is paged; only a panel longer than that scrolls freely
  var PAGE = 1.3;
  var pagerStops = [], settled = 0, gliding = false, target = 0, idle = 0, held = false;
  var reducedMq = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)");
  function pagerOn() {
    // while the hero is being built, the wheel drives the build, not the page
    if (root.classList.contains("bi-on")) return false;
    return window.innerWidth > 820 && !!(window.matchMedia && matchMedia("(hover: hover) and (pointer: fine)").matches);
  }
  /* One gesture, one page, one unbroken move. A wheel or trackpad gesture that
     starts at a stop is taken whole: the glide begins on its first event and the
     rest of it (a trackpad's momentum included) is absorbed, so there is never a
     native half-move followed by a correction. The glide is our own eased tween,
     slower and softer than the browser's smooth scroll, and it can be retargeted
     in flight. Keys page the same way. */
  var anim = 0, aFrom = 0, aTo = 0, aT0 = 0, aDur = 0, aEase = null, lastSet = -1;
  var inOut = function (t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
  var easeOut = function (t) { return 1 - Math.pow(1 - t, 3); };
  function progress() { return gliding ? Math.min(1, (performance.now() - aT0) / aDur) : 1; }
  function glide(y) {
    target = y; settled = y;
    var from = window.scrollY;
    if ((reducedMq && reducedMq.matches) || Math.abs(y - from) < 1) {
      if (anim) { cancelAnimationFrame(anim); anim = 0; }
      gliding = false; lastSet = -1; window.scrollTo(0, y); return;
    }
    // already moving: carry on from here without stopping first
    aEase = gliding ? easeOut : inOut;
    aFrom = from; aTo = y; aT0 = performance.now();
    aDur = Math.max(620, Math.min(1150, 520 + 0.42 * Math.abs(y - from)));
    gliding = true;
    if (!anim) anim = requestAnimationFrame(step);
  }
  function step(now) {
    var t = Math.min(1, (now - aT0) / aDur);
    lastSet = aFrom + (aTo - aFrom) * aEase(t);
    window.scrollTo(0, lastSet);
    if (t < 1) anim = requestAnimationFrame(step);
    else { anim = 0; gliding = false; lastSet = -1; }
  }
  function stopGlide() { if (anim) cancelAnimationFrame(anim); anim = 0; gliding = false; lastSet = -1; }
  // the next stop from y in a direction, if it is a page away and not a long scroll
  function nextStop(y, dir) {
    var ys = pagerStops, vh = window.innerHeight, t = null;
    if (dir > 0) { for (var i = 0; i < ys.length; i++) if (ys[i] > y + 2) { t = ys[i]; break; } }
    else { for (var j = ys.length - 1; j >= 0; j--) if (ys[j] < y - 2) { t = ys[j]; break; } }
    if (t === null || Math.abs(t - y) > vh * PAGE) return null;
    return t;
  }
  // the first stop strictly between two scroll positions, in the direction of travel
  function crossed(from, to) {
    var ys = pagerStops;
    if (to > from) { for (var i = 0; i < ys.length; i++) if (ys[i] > from + 2 && ys[i] < to - 2) return ys[i]; }
    else { for (var j = ys.length - 1; j >= 0; j--) if (ys[j] < from - 2 && ys[j] > to + 2) return ys[j]; }
    return null;
  }
  // gestures: a wheel stream is one gesture until it pauses, or until a trackpad
  // flicks again (the deltas rise after decaying) once the current glide is well on
  var wLast = 0, wAbs = 0, wPeak = 0, wDecay = false, wDir = 0;
  function onWheel(e) {
    if (!pagerOn() || e.ctrlKey || held) return;
    var vh = window.innerHeight;
    var dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? vh : 1);
    if (Math.abs(dy) < 0.5 || Math.abs(e.deltaX) > Math.abs(dy)) return;
    var now = performance.now(), abs = Math.abs(dy), dir = dy > 0 ? 1 : -1;
    var fresh = now - wLast > 180 || dir !== wDir;
    // after a short lull, a weaker event is still the tail of the same gesture (a
    // trackpad's momentum can stutter); a new flick arrives at least as strong
    // (a real new flick is recognised by its deltas rising again, just below)
    if (fresh && dir === wDir && now - wLast < 700 && abs <= wAbs * 1.02) fresh = false;
    // a new flick inside the stream: a sharp rise, nearly as strong as the gesture's
    // own peak, once the glide is well on (a noisy device's momentum wobbles, but
    // never back up to its peak)
    if (!fresh && wDecay && abs > wAbs * 2 && abs >= wPeak * 0.6 && progress() > 0.6 && now - aT0 > 350) fresh = true;
    wPeak = fresh ? abs : Math.max(wPeak, abs);
    wDecay = abs < wAbs; wAbs = abs; wLast = now; wDir = dir;
    // where the reader is headed: the glide's end if one is under way
    var same = gliding && dir === Math.sign(aTo - aFrom);
    var t = nextStop(same ? aTo : window.scrollY, dir);
    if (t === null) {
      // a long panel or the footer: scroll natively, unless a glide is still running
      if (gliding) { e.preventDefault(); return; }
      // but never past a stop: a native step that would cross one lands on it instead
      var c = crossed(window.scrollY, window.scrollY + dy + dir * 3);
      if (c !== null) { e.preventDefault(); clearTimeout(idle); glide(c); }
      return;
    }
    e.preventDefault();
    clearTimeout(idle);
    if (!fresh) return;
    if (same && progress() < 0.6) return;
    glide(t);
  }
  function onKey(e) {
    if (!pagerOn() || e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
    var el = document.activeElement, tag = el && el.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || tag === "BUTTON" || (el && el.isContentEditable)) return;
    var k = e.key, dir = 0;
    if (k === "ArrowDown" || k === "PageDown" || (k === " " && !e.shiftKey)) dir = 1;
    else if (k === "ArrowUp" || k === "PageUp" || (k === " " && e.shiftKey)) dir = -1;
    else if (k === "Home") { e.preventDefault(); glide(0); return; }
    else return;
    var t = nextStop(gliding ? aTo : window.scrollY, dir);
    if (t === null) return;             // a long panel: the key scrolls it natively
    e.preventDefault();
    glide(t);
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
    if (Math.abs(d) > vh * 1.5) { if (gap <= vh * PAGE || Math.min(y - prev, next - y) < vh * 0.3) glide(y - prev <= next - y ? prev : next); else settled = y; return; }
    if (Math.abs(d) < 24 && Math.abs(from - y) < vh) { glide(from); return; }
    // a scroll that ran past a stop comes back to it: no section is ever skipped
    var c = crossed(from, y);
    if (c !== null) { glide(c); return; }
    if (gap <= vh * PAGE) { glide(d > 0 ? next : prev); return; }
    if (d > 0 && next - y < vh * 0.3) { glide(next); return; }
    if (d < 0 && y - prev < vh * 0.3) { glide(prev); return; }
    settled = y;
  }
  function onScroll() {
    if (!pagerOn()) return;
    if (gliding) {
      // our own tween moves the page; anything else (a scrollbar drag) takes over
      if (lastSet >= 0 && Math.abs(window.scrollY - lastSet) > 4) stopGlide();
      else return;
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
    window.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("keydown", onKey);
    // a held button is a scrollbar drag or a text selection: leave the page where it is
    window.addEventListener("pointerdown", function (e) { if (e.pointerType === "mouse") { held = true; stopGlide(); } }, true);
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
