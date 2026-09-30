/* ── Nightfall / Daybreak ──────────────────────────────────────────────────
   The theme switch as a shot, not a fade. The old frame is held as a still while the
   new one is revealed live beneath a soft edge: night falls from the sky (top down),
   day rises from the horizon (bottom up). The still stops down or lifts in exposure as
   the light leaves or reaches it, film letterbox bars close in and open again, and
   stars prick in behind the nightfall. One implementation for the home page and the
   journal; see cine.css. Only user toggles come through here, never the first paint.

   cineTheme(to, apply): to is "dark" or "light"; apply(instant) makes the switch. With
   no View Transitions, or under reduced motion, apply() simply runs as before. */
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

  window.cineTheme = function (to, apply) {
    if (!document.startViewTransition || reduced()) { apply(false); return; }
    if (running) { try { running.skipTransition(); } catch (e) {} }
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
