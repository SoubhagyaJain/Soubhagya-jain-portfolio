/* ── Nightfall / Daybreak ──────────────────────────────────────────────────
   The theme switch as a shot, not a fade. The old frame is held as a still while the
   new one is revealed live beneath a soft edge: night falls from the sky (top down),
   day rises from the horizon (bottom up). The still stops down or lifts in exposure as
   the light leaves or reaches it, film letterbox bars close in and open again, and
   stars prick in behind the nightfall. One implementation for the home page and the
   journal; see cine.css. Only user toggles come through here, never the first paint.

   cineTheme(to, apply, revert): to is "dark" or "light"; apply(instant) makes the switch;
   given revert(), going dark is the hand-driven nightfall below and revert() undoes the
   switch if the reader lets the day spring back. With no View Transitions, or under
   reduced motion, apply() simply runs as before. */
(function () {
  "use strict";
  var root = document.documentElement, running = null;
  var reduced = function () { return !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches); };

  function overlay(to) {
    var el = document.createElement("div");
    el.className = "cine";
    el.setAttribute("aria-hidden", "true");
    el.setAttribute("data-to", to);
    var h = '<i class="cine-edge"></i><i class="cine-grain"></i>';
    if (to === "dark") {
      // stars appear just after the nightfall passes their height
      var seed = 7, r = function () { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
      for (var i = 0; i < 18; i++) {
        var x = 4 + r() * 92, y = 15 + r() * 32, s = (1 + r() * 1.8).toFixed(1);
        var d = (0.28 + 1.25 * (y / 100) + r() * 0.12).toFixed(2);
        h += '<i class="cine-star" style="left:' + x.toFixed(1) + "%;top:" + y.toFixed(1) + "%;--s:" + s + "px;--d:" + d + 's"></i>';
      }
    } else {
      h += '<i class="cine-sun"></i>';
    }
    // the letterbox goes on last, over everything else in the shot
    el.innerHTML = h + '<i class="cine-bar cine-t"></i><i class="cine-bar cine-b"></i>';
    return el;
  }

  /* ── Nightfall, by hand ─────────────────────────────────────────────────
     Going dark is something the reader does, not watches. A horizon line drops in at
     the top; night is revealed above it and the day stays below. Drag it down (mouse,
     finger, or the arrow keys): past halfway and night falls the rest of the way, short
     of it and the day springs back. Leave it alone and it falls by itself. The view
     transition is held open for as long as the hand is on it (a no-op keep-alive
     animation), and --night on <html> drives both the reveal mask and the overlay. */
  function dragOverlay() {
    var el = document.createElement("div");
    el.className = "cine";
    el.setAttribute("aria-hidden", "true");
    el.setAttribute("data-to", "drag");
    var stars = "", seed = 11, r = function () { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    for (var i = 0; i < 26; i++) {
      stars += '<i class="cd-star" style="left:' + (3 + r() * 94).toFixed(1) + "%;top:" + (4 + r() * 70).toFixed(1) + "%;--s:" + (1 + r() * 1.8).toFixed(1) +
        "px;--tw:" + (1.6 + r() * 2.4).toFixed(2) + "s;--dl:" + (-r() * 3).toFixed(2) + 's"></i>';
    }
    el.innerHTML = '<i class="cd-sky">' + stars + '</i><i class="cine-grain"></i><i class="cd-dusk"></i>' +
      '<i class="cd-line"><i class="cd-pill"><i class="cd-pill-in"><b>&#8597;</b><span class="cd-hint">Drag night down</span></i></i></i>';
    return el;
  }

  function dragNight(apply, revert) {
    var vh = window.innerHeight, cur = 0, raf = 0, grabbed = false, closing = false, autoT = 0, ov = null, hint = null;
    root.style.setProperty("--night", "0px");
    root.classList.add("vt-drag");
    var vt = document.startViewTransition(function () {
      root.classList.add("theme-cut");
      apply(true);
      ov = dragOverlay();
      document.body.appendChild(ov);
      hint = ov.querySelector(".cd-hint");
      requestAnimationFrame(function () { requestAnimationFrame(function () { root.classList.remove("theme-cut"); }); });
    });
    running = vt;
    var set = function (y) {
      cur = Math.max(0, Math.min(vh + 90, y));
      root.style.setProperty("--night", cur.toFixed(1) + "px");
      var past = cur > vh * 0.5;
      if (ov && ov.classList.contains("past") !== past) ov.classList.toggle("past", past);
      if (hint) {
        var t = !grabbed ? "Drag night down" : past ? "Release to let night fall" : "Release to keep the day";
        if (hint.textContent !== t) hint.textContent = t;
      }
    };
    var tween = function (to, dur, cb) {
      cancelAnimationFrame(raf);
      var from = cur, t0 = performance.now();
      var step = function (now) {
        var k = Math.min(1, (now - t0) / dur), e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
        set(from + (to - from) * e);
        if (k < 1) raf = requestAnimationFrame(step); else if (cb) cb();
      };
      raf = requestAnimationFrame(step);
    };
    var finish = function (commit, dur) {
      if (closing) return;
      closing = true; clearTimeout(autoT); unbind();
      if (ov) ov.classList.add("closing");
      tween(commit ? vh + 90 : 0, dur || (commit ? 700 : 520), function () {
        // springing back: the live frame goes back to day before the held one is let go
        if (!commit) { root.classList.add("theme-cut"); revert(); }
        try { vt.skipTransition(); } catch (e) {}
      });
    };
    var grab = function () { grabbed = true; clearTimeout(autoT); cancelAnimationFrame(raf); if (ov) ov.classList.add("grabbed"); };
    var onDown = function (e) { if (closing) return; grab(); set(e.clientY); e.preventDefault(); };
    var onMove = function (e) { if (grabbed && !closing && e.buttons !== 0) set(e.clientY); };
    var onUp = function () { if (grabbed && !closing) finish(cur > vh * 0.5); };
    var onKey = function (e) {
      if (closing) return;
      if (e.key === "Escape") { finish(false); e.preventDefault(); }
      else if (e.key === "Enter" || e.key === " ") { finish(true); e.preventDefault(); }
      else if (e.key === "ArrowDown" || e.key === "ArrowUp") { grab(); set(cur + (e.key === "ArrowDown" ? 1 : -1) * vh * 0.1); e.preventDefault(); }
    };
    var onVis = function () { if (document.hidden) finish(true, 1); };
    var bound = false;
    var bind = function () {
      bound = true;
      root.style.touchAction = "none";
      window.addEventListener("pointerdown", onDown, { passive: false });
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onUp);
      window.addEventListener("keydown", onKey);
      document.addEventListener("visibilitychange", onVis);
    };
    var unbind = function () {
      if (!bound) return; bound = false;
      window.removeEventListener("pointerdown", onDown, { passive: false });
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("visibilitychange", onVis);
    };
    vt.ready.then(function () {
      bind();
      tween(vh * 0.2, 600);                                   // the peek
      autoT = setTimeout(function () { if (!grabbed) finish(true, 1100); }, 1800);   // no hand: night falls
    }, function () {});
    var done = function () {
      unbind(); cancelAnimationFrame(raf); clearTimeout(autoT);
      if (running === vt) running = null;
      root.classList.remove("vt-drag", "theme-cut");
      root.style.removeProperty("--night");
      root.style.touchAction = "";
      if (ov && ov.parentNode) ov.parentNode.removeChild(ov);
    };
    vt.finished.then(done, done);
  }

  window.cineTheme = function (to, apply, revert) {
    if (!document.startViewTransition || reduced()) { apply(false); return; }
    if (running) { try { running.skipTransition(); } catch (e) {} }
    if (to === "dark" && revert) { dragNight(apply, revert); return; }
    var cls = to === "dark" ? "vt-night" : "vt-day";
    root.classList.remove("vt-night", "vt-day");
    root.classList.add(cls);
    var ov = null;
    var vt = document.startViewTransition(function () {
      // the new frame should already be the finished night or day: the reveal is the
      // transition, not a dozen layers each fading on their own clock
      root.classList.add("theme-cut");
      apply(true);
      ov = overlay(to);
      document.body.appendChild(ov);
      requestAnimationFrame(function () { requestAnimationFrame(function () { root.classList.remove("theme-cut"); }); });
    });
    running = vt;
    var done = function () {
      if (running === vt) { running = null; root.classList.remove(cls); }
      if (ov && ov.parentNode) ov.parentNode.removeChild(ov);
    };
    vt.finished.then(done, done);
  };
})();
