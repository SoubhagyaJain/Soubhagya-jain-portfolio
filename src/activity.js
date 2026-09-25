/* Chapter 03 in the browser: the contribution landscape, the chapter's choreography,
   a fresher copy of the GitHub numbers, and the credential archive. The markup it
   works on is complete without it (src/activity.mjs); nothing here is required to
   read the chapter, only to see it move. */
(function () {
  "use strict";
  var root = document.getElementById("activity");
  var dataEl = document.getElementById("activity-data");
  if (!root || !dataEl) return;
  var DATA;
  try { DATA = JSON.parse(dataEl.textContent); } catch (e) { return; }

  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  var clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
  var sm = function (k) { k = clamp(k, 0, 1); return k * k * (3 - 2 * k); };
  var MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  var MONTH = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  var scene = function () { return document.documentElement.dataset.scene === "day" ? "day" : "dark"; };
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); };
  var once = function (el, fn, opts) {
    if (!el) return;
    if (!("IntersectionObserver" in window)) { fn(); return; }
    var io = new IntersectionObserver(function (es) {
      if (es.some(function (e) { return e.isIntersecting; })) { io.disconnect(); fn(); }
    }, opts || { threshold: 0.2 });
    io.observe(el);
  };

  /* ── the numbers, derived exactly as the build derives them ─────────────── */
  function derive(d) {
    var days = d.calendar ? d.calendar.days : [];
    var exact = !!(d.calendar && d.calendar.exact);
    var langs = {};
    d.repos.forEach(function (r) { if (r.language) langs[r.language] = (langs[r.language] || 0) + 1; });
    var languages = Object.keys(langs).map(function (k) { return { name: k, count: langs[k] }; }).sort(function (a, b) { return b.count - a.count; });
    return {
      contributions: exact ? days.reduce(function (s, x) { return s + x.count; }, 0) : null,
      activeDays: days.length ? days.filter(function (x) { return exact ? x.count > 0 : x.level > 0; }).length : null,
      stars: d.repos.reduce(function (s, r) { return s + (r.stars || 0); }, 0),
      repositories: d.user.publicRepos,
      languages: languages
    };
  }

  /* ── the contribution landscape ──────────────────────────────────────────
     Every day is a small block on a sheared plane, seen from a little above and to
     the right. Activity raises a block and lights its top; the busiest days take the
     page's amber. Drawn on one canvas, back to front, only while something moves. */
  var figure = root.querySelector(".gx-graph");
  var canvas = root.querySelector(".gx-canvas");
  var scroller = root.querySelector(".gx-scroll");
  var tip = root.querySelector(".gx-tip");
  var G = {
    days: [], cells: [], cols: 0, max: 1, exact: false,
    p: 16, SH: 0.34, padL: 40, padR: 24, padT: 10, W: 0, H: 0, dpr: 1,
    scan: reduced ? 1e9 : -1e9, scanStart: 0, revealed: reduced,
    hover: -1, sel: -1, pointer: false, raf: 0
  };

  function setCalendar(cal) {
    G.days = cal ? cal.days : [];
    G.exact = !!(cal && cal.exact);
    var off = G.days.length ? new Date(G.days[0].date + "T00:00:00Z").getUTCDay() : 0;
    G.max = 1;
    G.days.forEach(function (d) { if (d.count > G.max) G.max = d.count; });
    G.cells = G.days.map(function (d, i) {
      var k = i + off;
      var v = G.exact ? (d.count ? 0.2 + 0.8 * Math.sqrt(d.count / G.max) : 0) : d.level / 4;
      return { d: d, c: Math.floor(k / 7), r: k % 7, v: v, lift: 0, glow: 0 };
    });
    G.cols = G.cells.length ? G.cells[G.cells.length - 1].c + 1 : 53;
    figure.classList.toggle("is-empty", !cal);
    layout();
  }

  // when there is no calendar the plane is still drawn, empty, so the figure keeps its
  // size and the note sits on something rather than in a hole
  function ghostCells() {
    var out = [];
    for (var c = 0; c < 53; c++) for (var r = 0; r < 7; r++) out.push({ d: null, c: c, r: r, v: 0, lift: 0, glow: 0 });
    return out;
  }

  function layout() {
    if (!canvas) return;
    var cols = G.cols || 53;
    var avail = scroller.clientWidth || 800;
    var narrow = avail < 700;
    G.padL = narrow ? 30 : 40;
    // fill the measure on a desktop; on a phone keep blocks readable and let it scroll
    G.p = clamp((avail - G.padL - G.padR) / (cols + 7 * G.SH), narrow ? 14 : 12, 26);
    var rowH = G.p * 0.62, hMax = G.p * 1.35;
    G.padT = hMax + 8;
    G.W = Math.ceil(G.padL + cols * G.p + 7 * G.p * G.SH + G.padR);
    G.H = Math.ceil(G.padT + 7 * rowH + 30);
    G.dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = G.W * G.dpr; canvas.height = G.H * G.dpr;
    canvas.style.width = G.W + "px"; canvas.style.height = G.H + "px";
    if (G.W > avail) scroller.scrollLeft = G.W;          // start at the most recent weeks
    draw();
  }

  function geom(cell, h) {
    var p = G.p, rowH = p * 0.62, w = p * 0.76, d = rowH * 0.76, sh = p * G.SH * 0.76;
    var x0 = G.padL + cell.c * p + cell.r * p * G.SH, y0 = G.padT + cell.r * rowH;
    return { x0: x0, y0: y0, w: w, d: d, sh: sh, h: h, cx: x0 + w / 2 + sh / 2, cy: y0 + d / 2 - h };
  }

  var PAL = {
    dark: { zero: [226, 234, 238], lo: [132, 142, 148], hi: [244, 241, 230], acc: [226, 178, 116], label: "rgba(232,240,236,0.5)", beam: "246,236,210" },
    day: { zero: [255, 246, 232], lo: [196, 186, 170], hi: [255, 248, 232], acc: [242, 190, 112], label: "rgba(250,244,232,0.62)", beam: "255,238,200" }
  };
  var mix = function (a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; };
  var rgba = function (c, k, a) { return "rgba(" + Math.round(c[0] * k) + "," + Math.round(c[1] * k) + "," + Math.round(c[2] * k) + "," + a.toFixed(3) + ")"; };

  function draw() {
    if (!canvas) return;
    var c = canvas.getContext("2d");
    var pal = PAL[scene()];
    c.setTransform(G.dpr, 0, 0, G.dpr, 0, 0);
    c.clearRect(0, 0, G.W, G.H);
    var cells = G.cells.length ? G.cells : ghostCells();
    var hMax = G.p * 1.35, now = G.scan;

    for (var i = 0; i < cells.length; i++) {
      var cell = cells[i];
      // emergence: the scan has passed this week, or is passing it now
      var e = G.revealed ? 1 : sm((now - cell.c) / 5);
      var beam = G.revealed && !reduced ? Math.exp(-Math.pow((now - cell.c) / 2.2, 2)) : 0;
      var lift = cell.lift;
      var h = cell.v > 0 ? (1.2 + cell.v * hMax) * e + lift * G.p * 0.22 : lift * G.p * 0.12;
      var g = geom(cell, h);
      var light = 1 + beam * 0.35 + cell.glow * 0.3;
      var col, a;
      if (cell.v > 0) {
        col = mix(pal.lo, pal.hi, Math.min(1, cell.v * 1.15));
        if (cell.v > 0.72) col = mix(col, pal.acc, (cell.v - 0.72) / 0.28 * 0.75);
        a = (0.3 + 0.7 * cell.v) * (0.08 + 0.92 * e);
      } else {
        col = pal.zero;
        a = (0.07 + cell.glow * 0.08) * (0.25 + 0.75 * e);
      }
      var k = Math.min(1.15, light);
      if (h > 0.6) {
        // east face, then the south face, then the lit top
        c.fillStyle = rgba(col, 0.62 * k, a);
        c.beginPath(); c.moveTo(g.x0 + g.w, g.y0 - h); c.lineTo(g.x0 + g.w + g.sh, g.y0 + g.d - h); c.lineTo(g.x0 + g.w + g.sh, g.y0 + g.d); c.lineTo(g.x0 + g.w, g.y0); c.closePath(); c.fill();
        c.fillStyle = rgba(col, 0.46 * k, a);
        c.fillRect(g.x0 + g.sh, g.y0 + g.d - h, g.w, h);
      }
      c.fillStyle = rgba(col, k, a);
      c.beginPath(); c.moveTo(g.x0, g.y0 - h); c.lineTo(g.x0 + g.w, g.y0 - h); c.lineTo(g.x0 + g.w + g.sh, g.y0 + g.d - h); c.lineTo(g.x0 + g.sh, g.y0 + g.d - h); c.closePath(); c.fill();
      if (i === G.hover || i === G.sel) {
        c.strokeStyle = "rgba(255,255,255,0.9)"; c.lineWidth = 1; c.stroke();
      }
    }

    // the scanning light: a soft vertical band over the week it is reading
    if (!G.revealed || (now < G.cols + 8 && !reduced)) {
      var bx = G.padL + now * G.p + 3.5 * G.p * G.SH;
      var fade = 1 - sm((now - G.cols) / 8);
      if (bx > -40 && bx < G.W + 40 && fade > 0) {
        var gr = c.createLinearGradient(bx - 60, 0, bx + 16, 0);
        gr.addColorStop(0, "rgba(" + pal.beam + ",0)");
        gr.addColorStop(0.8, "rgba(" + pal.beam + "," + (0.1 * fade).toFixed(3) + ")");
        gr.addColorStop(1, "rgba(" + pal.beam + ",0)");
        c.fillStyle = gr; c.fillRect(bx - 60, 0, 76, G.H - 24);
        c.fillStyle = "rgba(" + pal.beam + "," + (0.5 * fade).toFixed(3) + ")";
        c.fillRect(bx + 12, 4, 1, G.H - 30);
      }
    }

    // months along the near edge, weekdays along the left, both in the page's mono
    c.font = "500 9px 'IBM Plex Mono', monospace";
    c.fillStyle = pal.label;
    c.textBaseline = "alphabetic";
    var yM = G.padT + 7 * G.p * 0.62 + 16, lastC = -9;
    G.cells.forEach(function (cell) {
      if (cell.d && cell.d.date.slice(8) === "01" && cell.c - lastC > 2) {
        lastC = cell.c;
        var m = +cell.d.date.slice(5, 7) - 1;
        c.fillText(MON[m].toUpperCase(), G.padL + cell.c * G.p + 6.2 * G.p * G.SH, yM);
      }
    });
    c.textAlign = "right";
    [[1, "MON"], [3, "WED"], [5, "FRI"]].forEach(function (x) {
      c.fillText(x[1], G.padL - 8 + x[0] * G.p * G.SH, G.padT + x[0] * G.p * 0.62 + G.p * 0.42);
    });
    c.textAlign = "left";
  }

  function frame(t) {
    G.raf = 0;
    var busy = false;
    if (!G.revealed) {
      // about 2.6s to cross a year, whatever the width
      G.scan = -6 + (t - G.scanStart) / 2600 * (G.cols + 14);
      if (G.scan >= G.cols + 8) { G.revealed = true; G.scan = G.cols + 8; } else busy = true;
    }
    // the neighbourhood of the pointer rises and brightens, very slightly
    var h = G.hover >= 0 ? G.cells[G.hover] : (G.sel >= 0 ? G.cells[G.sel] : null);
    G.cells.forEach(function (cell) {
      var target = 0;
      if (h && !reduced) {
        var dc = cell.c - h.c, dr = (cell.r - h.r) * 0.8;
        target = Math.exp(-(dc * dc + dr * dr) / 3.2);
      }
      var tg = h ? (cell === h ? 1 : target * 0.6) : 0;
      cell.lift += (target - cell.lift) * 0.18;
      cell.glow += (tg - cell.glow) * 0.2;
      if (Math.abs(target - cell.lift) > 0.004 || Math.abs(tg - cell.glow) > 0.004) busy = true;
    });
    draw();
    if (busy) G.raf = requestAnimationFrame(frame);
  }
  var kick = function () { if (!G.raf) G.raf = requestAnimationFrame(frame); };

  function showTip(i) {
    var cell = G.cells[i];
    if (!cell || !cell.d) { tip.classList.remove("on"); return; }
    var d = new Date(cell.d.date + "T00:00:00Z");
    var when = MONTH[d.getUTCMonth()] + " " + d.getUTCDate() + ", " + d.getUTCFullYear();
    var what = G.exact
      ? (cell.d.count ? cell.d.count + " contribution" + (cell.d.count === 1 ? "" : "s") : "No contributions")
      : (cell.d.level ? "Activity level " + cell.d.level + " of 4" : "No contributions");
    tip.innerHTML = "<b>" + what + "</b><span>" + when + "</span>";
    var g = geom(cell, 0);
    var stage = tip.parentElement.getBoundingClientRect(), cr = canvas.getBoundingClientRect();
    var x = cr.left - stage.left + g.cx, y = cr.top - stage.top + g.cy - G.p * 1.6;
    var tw = tip.offsetWidth || 150;
    tip.style.setProperty("--tx", clamp(x - tw / 2, 0, stage.width - tw) + "px");
    tip.style.setProperty("--ty", Math.max(0, y - 52) + "px");
    tip.classList.add("on");
  }

  function hit(mx, my) {
    var best = -1, bd = G.p * G.p * 0.9;
    for (var i = 0; i < G.cells.length; i++) {
      var cell = G.cells[i];
      var h = cell.v > 0 ? 1.2 + cell.v * G.p * 1.35 : 0;
      var g = geom(cell, h);
      var dx = mx - g.cx, dy = (my - g.cy) * 1.4;
      var dd = dx * dx + dy * dy;
      if (dd < bd) { bd = dd; best = i; }
    }
    return best;
  }

  if (canvas) {
    canvas.addEventListener("pointermove", function (e) {
      if (e.pointerType !== "mouse" && e.pointerType !== "pen") return;
      var r = canvas.getBoundingClientRect();
      var i = hit(e.clientX - r.left, e.clientY - r.top);
      if (i !== G.hover) { G.hover = i; G.sel = -1; if (i >= 0) showTip(i); else tip.classList.remove("on"); kick(); }
    });
    canvas.addEventListener("pointerleave", function () { G.hover = -1; tip.classList.remove("on"); kick(); });
    // a tap reads a day on touch screens, where there is no hover
    canvas.addEventListener("click", function (e) {
      var r = canvas.getBoundingClientRect();
      var i = hit(e.clientX - r.left, e.clientY - r.top);
      G.sel = i; G.hover = -1; if (i >= 0) showTip(i); else tip.classList.remove("on"); kick();
    });
    canvas.addEventListener("keydown", function (e) {
      if (!G.cells.length) return;
      var i = G.sel >= 0 ? G.sel : G.cells.length - 1;
      var map = { ArrowLeft: -7, ArrowRight: 7, ArrowUp: -1, ArrowDown: 1, Home: -1e9, End: 1e9 };
      if (!(e.key in map)) return;
      e.preventDefault();
      i = clamp(i + map[e.key], 0, G.cells.length - 1);
      G.sel = i; G.hover = -1;
      var g = geom(G.cells[i], 0);
      if (g.x0 < scroller.scrollLeft + 20 || g.x0 > scroller.scrollLeft + scroller.clientWidth - 40) scroller.scrollLeft = g.x0 - scroller.clientWidth / 2;
      showTip(i); kick();
    });
    canvas.addEventListener("blur", function () { G.sel = -1; tip.classList.remove("on"); kick(); });
    scroller.addEventListener("scroll", function () { tip.classList.remove("on"); }, { passive: true });
  }

  setCalendar(DATA.github.calendar);
  if ("ResizeObserver" in window && scroller) {
    var lastW = scroller.clientWidth;
    new ResizeObserver(function () { if (Math.abs(scroller.clientWidth - lastW) > 2) { lastW = scroller.clientWidth; layout(); } }).observe(scroller);
  }
  // the weather switch repaints the landscape in the other light
  new MutationObserver(function () { draw(); drawBridge(); }).observe(document.documentElement, { attributes: true, attributeFilter: ["data-scene"] });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(draw);

  /* ── choreography ───────────────────────────────────────────────────────── */
  function steps(scope, gap) {
    var els = scope.querySelectorAll("[data-step]");
    once(scope, function () {
      Array.prototype.forEach.call(els, function (el) {
        var k = +el.getAttribute("data-step");
        setTimeout(function () { el.classList.add("in"); }, reduced ? 0 : k * gap);
      });
    }, { threshold: 0.25 });
  }
  var head = root.querySelector(".gx-head");
  if (head) steps(head, 160);
  once(root.querySelector(".gx-id"), function () { setTimeout(function () { root.querySelector(".gx-id").classList.add("in"); }, reduced ? 0 : 200); }, { threshold: 0.4 });

  once(figure, function () {
    if (reduced) { G.revealed = true; draw(); return; }
    G.scanStart = performance.now() + 150;
    G.scan = -6;
    kick();
  }, { threshold: 0.35 });

  function countUp(el, to) {
    if (to === "" || isNaN(to)) return;
    to = +to;
    if (reduced || to < 2) { el.textContent = to.toLocaleString("en-US"); return; }
    var t0 = performance.now(), dur = 1100;
    (function step(t) {
      var k = clamp((t - t0) / dur, 0, 1);
      var e = 1 - Math.pow(1 - k, 3);
      el.textContent = Math.round(to * e).toLocaleString("en-US");
      if (k < 1) requestAnimationFrame(step);
    })(t0);
  }
  var metricsEl = root.querySelector(".gx-metrics");
  var counted = false;
  once(metricsEl, function () {
    Array.prototype.forEach.call(metricsEl.querySelectorAll(".gx-m"), function (m, k) { m.style.setProperty("--k", k); });
    metricsEl.classList.add("in");
    counted = true;
    Array.prototype.forEach.call(metricsEl.querySelectorAll(".v"), function (v) { countUp(v, v.getAttribute("data-to")); });
  }, { threshold: 0.5 });
  once(root.querySelector(".gx-langs"), function () { root.querySelector(".gx-langs").classList.add("in"); }, { threshold: 0.4 });
  once(root.querySelector(".gx-repos"), function () { root.querySelector(".gx-repos").classList.add("in"); }, { threshold: 0.08 });

  /* ── fresher numbers, from the cached API route ─────────────────────────── */
  function apply(d) {
    if (!d || !d.user || !Array.isArray(d.repos)) return;
    DATA.github = d;
    var dv = derive(d);
    if (d.calendar) {
      var wasRevealed = G.revealed;
      setCalendar(d.calendar);
      G.revealed = wasRevealed || reduced;
      canvas.setAttribute("aria-label", (dv.contributions !== null
        ? "Contribution landscape: " + dv.contributions.toLocaleString("en-US") + " contributions on " + dv.activeDays + " active days over the last twelve months."
        : "Contribution landscape: activity on " + dv.activeDays + " days over the last twelve months.") + " Use the arrow keys to read individual days.");
      draw();
    }
    ["contributions", "repositories", "stars", "activeDays"].forEach(function (k) {
      var v = root.querySelector('[data-gx-m="' + k + '"] .v');
      if (!v || dv[k] === null || dv[k] === undefined) return;
      v.setAttribute("data-to", dv[k]);
      if (counted) v.textContent = dv[k].toLocaleString("en-US");
      else v.textContent = dv[k].toLocaleString("en-US");
    });
    var f = root.querySelector('[data-f="followers"]');
    if (f) f.textContent = d.user.followers + " follower" + (d.user.followers === 1 ? "" : "s");
    var byName = {};
    d.repos.forEach(function (r) { byName[r.name.toLowerCase()] = r; });
    Array.prototype.forEach.call(root.querySelectorAll(".gx-repo"), function (li) {
      var r = byName[(li.getAttribute("data-repo") || "").toLowerCase()];
      if (!r) return;
      var s = li.querySelector('[data-f="stars"]'), u = li.querySelector('[data-f="updated"]');
      if (s) s.textContent = r.stars ? "★ " + r.stars : "";
      if (u) { var dt = new Date(r.pushedAt); u.textContent = "Updated " + MON[dt.getUTCMonth()] + " " + dt.getUTCFullYear(); }
    });
    var ev = root.querySelector("[data-gx-events]");
    if (ev && d.events && d.events.length) {
      ev.innerHTML = "<ol>" + d.events.slice(0, 5).map(function (e) {
        var dt = new Date(e.at);
        return '<li><a href="' + esc(e.url) + '" rel="noopener"><span class="what">' + esc(e.what) + '</span><span class="repo">' + esc(e.repo) + '</span><time datetime="' + esc(e.at) + '">' + dt.getUTCDate() + " " + MON[dt.getUTCMonth()] + "</time></a></li>";
      }).join("") + "</ol>";
    }
  }
  once(root, function () {
    if (!window.fetch || location.protocol === "file:") return;
    fetch("/api/github").then(function (r) { return r.ok ? r.json() : null; }).then(function (d) {
      if (d && (!DATA.github.fetchedAt || d.fetchedAt >= DATA.github.fetchedAt)) apply(d);
    }).catch(function () { /* the built copy stays; nothing to say */ });
  }, { rootMargin: "100% 0px" });

  /* ── the bridge: cells simplify into the archive's grid ─────────────────── */
  var bridge = root.querySelector(".gx-bridge canvas");
  var bridgeP = 0;
  function drawBridge() {
    if (!bridge) return;
    var w = bridge.clientWidth, h = bridge.clientHeight;
    if (!w) return;
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    if (bridge.width !== Math.round(w * dpr)) { bridge.width = Math.round(w * dpr); bridge.height = Math.round(h * dpr); }
    var c = bridge.getContext("2d");
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, w, h);
    var pal = PAL[scene()];
    var P = 46, cols = Math.ceil(w / P) + 1, rows = Math.ceil(h / P) + 1;
    var p = reduced ? 1 : bridgeP;
    var cellP = 1 - sm(p / 0.55);                 // blocks shrink to points
    var lineP = sm((p - 0.35) / 0.55);            // points reach out into lines
    // the most recent weeks, so the blocks that shrink are the real ones
    var src = G.cells.length ? G.cells.slice(-cols * rows) : [];
    for (var r = 0; r < rows; r++) {
      for (var q = 0; q < cols; q++) {
        var x = q * P, y = r * P;
        var cell = src[(q * rows + r) % Math.max(1, src.length)];
        var v = cell ? cell.v : 0;
        var fadeY = 1 - r / rows * 0.6;
        var s = 3 + (6 + v * 10) * cellP;
        var a = (0.16 + v * 0.62 * cellP) * fadeY;
        c.fillStyle = rgba(v > 0.72 ? mix(pal.hi, pal.acc, 0.6) : pal.hi, 1, a);
        c.fillRect(x - s / 2, y - s / 2, s, s);
        if (lineP > 0) {
          c.fillStyle = "rgba(214,230,236," + (0.11 * lineP * fadeY).toFixed(3) + ")";
          c.fillRect(x, y, P * lineP, 1);
          c.fillRect(x, y, 1, P * lineP);
        }
      }
    }
    // fade the band's left and right edges into the page
    c.globalCompositeOperation = "destination-in";
    var gr = c.createLinearGradient(0, 0, w, 0);
    gr.addColorStop(0, "rgba(0,0,0,0)"); gr.addColorStop(0.12, "rgba(0,0,0,1)"); gr.addColorStop(0.88, "rgba(0,0,0,1)"); gr.addColorStop(1, "rgba(0,0,0,0)");
    c.fillStyle = gr; c.fillRect(0, 0, w, h);
    c.globalCompositeOperation = "source-over";
  }

  /* ── 03.2 the credential wheel ───────────────────────────────────────────
     A port of crafterui's Works Wheel. At rest the records sit in a ring around
     the label, each tangent to the circle; the first stretch of scroll blows the
     ring open into a vertical drum, one record flat at the front and its
     neighbours rotated away into perspective; every further stretch carries the
     next one round. The whole thing is one number, `turn`: 0 is the ring, 1 the
     drum with record 0 at the front, n the drum with record n-1 there.

     One change from the original, deliberately: the original turns on captured
     wheel and drag events inside its own box. Here the stage is pinned and page
     scroll is the turn, so it can never trap a reader, and it works by touch with
     no gesture of its own. The geometry is the original's. */
  var cx = root.querySelector("[data-cx-root]");
  var track = cx ? cx.querySelector(".cxw-track") : null;
  var cards = track ? Array.prototype.slice.call(track.querySelectorAll(".cxw-card")) : [];
  if (cx) steps(cx.querySelector(".cx-head"), 150);

  var CARD_H = 0.38, CARD_RATIO = 1.414, STEP = 40, DRUM = 2.22, LENS = 2.7, BOW = 1.82, TITLE = 0.124, CULL = 1.6, EASE = 0.12, SETTLE = 180;
  var W = { turn: 0, target: 0, active: 0, m: {}, live: false, raf: 0, settle: 0 };
  var rad = function (d) { return d * Math.PI / 180; };
  var lerp = function (a, b, t) { return a + (b - a) * t; };

  function wheelMetrics() {
    var stage = track.querySelector(".cxw-stage");
    var w = stage.clientWidth, h = stage.clientHeight, n = cards.length;
    var narrow = w < 700;
    // a phone's stage is tall and narrow: the card is capped by width, and the
    // ring pulls in so it still closes inside the frame
    var cardW = Math.min(h * (narrow ? 0.3 : CARD_H) * CARD_RATIO, w * (narrow ? 0.74 : 0.34));
    var cardH = cardW / CARD_RATIO;
    // the ring keeps clear of the nav above and the index beside it
    var ringR = Math.min(cardH * (narrow ? 0.9 : 1.14), h * 0.3, w * (narrow ? 0.34 : 0.26));
    W.m = {
      cardW: cardW, cardH: cardH, ringR: ringR, drumR: cardH * DRUM, bow: cardH * BOW,
      ringScale: n ? clamp(2 * Math.PI * ringR / n * 0.82 / (cardW || 1), 0.16, 1) : 1
    };
    stage.querySelector(".cxw-view").style.perspective = cardH * LENS + "px";
    stage.style.setProperty("--t", Math.max(26, cardH * TITLE * (narrow ? 1.25 : 1)) + "px");
    cards.forEach(function (c) {
      c.style.width = cardW + "px"; c.style.height = cardH + "px";
      c.style.marginLeft = -cardW / 2 + "px"; c.style.marginTop = -cardH / 2 + "px";
    });
  }

  // how far a turn is down the track, and back
  function trackSpan() { return track.offsetHeight - window.innerHeight; }
  function turnFromScroll() {
    var r = track.getBoundingClientRect();
    return clamp(-r.top / Math.max(1, trackSpan()), 0, 1) * cards.length;
  }
  function scrollToTurn(t, smooth) {
    var top = track.getBoundingClientRect().top + window.scrollY;
    window.scrollTo({ top: top + t / cards.length * trackSpan(), behavior: smooth && !reduced ? "smooth" : "auto" });
  }

  var wTitle = track && track.querySelector('[data-cxw="title"]');
  var wIss = track && track.querySelector('[data-cxw="iss"]');
  var wIx = track && track.querySelector('[data-cxw="ix"]');
  var wVerify = track && track.querySelector('[data-cxw="verify"]');
  var wLabel = track && track.querySelector(".cxw-label");
  var wPanel = track && track.querySelector(".cxw-title");
  var wHint = track && track.querySelector(".cxw-hint");
  var wView = track && track.querySelector(".cxw-view");
  var wIndex = track ? Array.prototype.slice.call(track.querySelectorAll("[data-cxw-to]")) : [];
  function monthLong(s) { var p = s.split("-"); return MONTH[+p[1] - 1] + " " + p[0]; }

  function setActive(i) {
    if (i === W.active) return;
    W.active = i;
    var c = DATA.certs[i];
    wTitle.textContent = c.title;
    wIss.textContent = c.issuer + " · " + monthLong(c.date);
    wIx.textContent = String(i + 1).padStart(2, "0") + " / " + String(cards.length).padStart(2, "0");
    if (c.verificationUrl) { wVerify.href = c.verificationUrl; wVerify.hidden = false; } else wVerify.hidden = true;
    cards.forEach(function (el, k) { el.setAttribute("aria-selected", k === i ? "true" : "false"); });
    wIndex.forEach(function (b, k) { b.classList.toggle("on", k === i); });
    wView.setAttribute("aria-activedescendant", "cxw-" + i);
  }

  // Everything per-frame is cached so a frame writes only what changed, and the loop
  // stops the moment the wheel has arrived: at rest it costs nothing at all.
  var wheelEl = track && track.querySelector(".cxw-wheel");
  var last = { z: [], vis: [], op: -1, m: -1 };
  function drawWheel() {
    W.raf = 0;
    var n = cards.length, M = W.m;
    var gap = W.target - W.turn;
    if (Math.abs(gap) < 0.0005) W.turn = W.target; else W.turn += gap * (reduced ? 1 : EASE);
    var t = W.turn, m = clamp(t, 0, 1), pos = Math.max(0, t - 1);
    var r2 = function (v) { return Math.round(v * 100) / 100; };
    // the drum is pulled back so its front face lands on the picture plane, and the
    // set-back arrives with it, or the ring would sit deep in the perspective
    if (m !== last.m) wheelEl.style.transform = "translateZ(" + r2(-m * M.drumR) + "px)";
    var s = lerp(M.ringScale, 1, m);
    for (var i = 0; i < n; i++) {
      var d = i - pos, drumDeg = d * STEP;
      var el = cards[i];
      var hide = m > 0.5 && Math.abs(d) > CULL;
      // hidden cards are skipped entirely: not painted, not transformed
      var vis = hide ? "hidden" : "";
      if (last.vis[i] !== vis) { el.style.visibility = vis; last.vis[i] = vis; }
      if (hide) continue;
      var bowX = -M.bow * (1 - Math.cos(rad(drumDeg)));
      // one transform per card, scale last, so the compositor moves and scales a
      // layer it already has instead of the page re-drawing the record each frame
      el.style.transform =
        "translateX(" + r2(m * bowX) + "px)" +
        " rotateZ(" + r2((1 - m) * d * (360 / n)) + "deg) translateY(" + r2(-(1 - m) * M.ringR) + "px)" +
        " rotateX(" + r2(m * drumDeg) + "deg) translateZ(" + r2(m * M.drumR) + "px) scale(" + Math.round(s * 1000) / 1000 + ")";
      var z = Math.round(100 - Math.abs(d) * 2);
      if (last.z[i] !== z) { el.style.zIndex = String(z); last.z[i] = z; }
    }
    if (m !== last.m) {
      wLabel.style.opacity = String(1 - m);
      wPanel.style.opacity = String(m);
      wPanel.style.pointerEvents = m > 0.5 ? "" : "none";
      wHint.style.opacity = String(1 - clamp(t * 3, 0, 1));
      last.m = m;
    }
    setActive(clamp(Math.round(pos), 0, n - 1));
    if (W.turn !== W.target) W.raf = requestAnimationFrame(drawWheel);
  }
  // scroll moves the target; the loop runs only until the wheel catches up
  function wheelKick() {
    if (!W.live) return;
    W.target = turnFromScroll();
    if (!W.raf && W.target !== W.turn) W.raf = requestAnimationFrame(drawWheel);
  }

  if (track && cards.length) {
    wheelMetrics();
    W.target = W.turn = turnFromScroll();
    drawWheel();
    var redraw = function () { last.m = -1; last.z = []; last.vis = []; W.target = turnFromScroll(); if (!W.raf) W.raf = requestAnimationFrame(drawWheel); };
    if ("ResizeObserver" in window) new ResizeObserver(function () { wheelMetrics(); redraw(); }).observe(track.querySelector(".cxw-stage"));
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (es) {
        W.live = es[0].isIntersecting;
        if (W.live) redraw(); else { cancelAnimationFrame(W.raf); W.raf = 0; }
      }).observe(track);
    } else { W.live = true; }
    window.addEventListener("scroll", wheelKick, { passive: true });

    // a gesture has no end of its own, so the rest position is wherever it
    // stopped; left there the drum sits between two records. Settle onto one.
    window.addEventListener("scroll", function () {
      clearTimeout(W.settle);
      if (reduced || !finePointer) return;   // never pull the page out from under a finger
      W.settle = setTimeout(function () {
        var t = turnFromScroll();
        if (t > 1 && t < cards.length && Math.abs(t - Math.round(t)) > 0.03) scrollToTurn(Math.round(t), true);
      }, SETTLE);
    }, { passive: true });

    cards.forEach(function (el, i) {
      el.addEventListener("click", function () {
        // the front record opens; any other turns the wheel to it
        if (i === W.active && W.turn > 0.9) open(i); else scrollToTurn(i + 1, true);
      });
      if (finePointer && !reduced) {
        var paper = el.querySelector(".cx-paper");
        el.addEventListener("pointermove", function (e) {
          var r = el.getBoundingClientRect();
          paper.style.setProperty("--lx", ((e.clientX - r.left) / r.width * 100).toFixed(1) + "%");
          paper.style.setProperty("--ly", ((e.clientY - r.top) / r.height * 100).toFixed(1) + "%");
        });
      }
    });
    wIndex.forEach(function (b) { b.addEventListener("click", function () { scrollToTurn(+b.getAttribute("data-cxw-to") + 1, true); }); });
    track.querySelector('[data-cxw="open"]').addEventListener("click", function () { open(W.active); });
    wView.addEventListener("keydown", function (e) {
      var t = Math.round(turnFromScroll());
      if (e.key === "ArrowDown" || e.key === "ArrowRight") scrollToTurn(Math.min(cards.length, Math.max(1, t + 1)), true);
      else if (e.key === "ArrowUp" || e.key === "ArrowLeft") scrollToTurn(Math.max(0, t - 1), true);
      else if (e.key === "Enter" || e.key === " ") { if (W.turn > 0.9) open(W.active); else scrollToTurn(1, true); }
      else return;
      e.preventDefault();
    });
  }

  // the bridge follows the page
  function onScroll() {
    scrollQueued = false;
    if (!bridge) return;
    var vh = window.innerHeight, br = bridge.getBoundingClientRect();
    if (br.bottom > -50 && br.top < vh + 50) {
      var np = clamp((vh * 0.72 - br.top) / (br.height + vh * 0.3), 0, 1);
      if (Math.abs(np - bridgeP) > 0.002 || !bridge._drawn) { bridgeP = np; bridge._drawn = true; drawBridge(); }
    }
  }
  var scrollQueued = false;
  var queue = function () { if (!scrollQueued) { scrollQueued = true; requestAnimationFrame(onScroll); } };
  window.addEventListener("scroll", queue, { passive: true });
  window.addEventListener("resize", queue);
  onScroll();

  /* the expanded record: the document grows out of its place on the wheel */
  var dlg = null, srcDoc = null;
  function buildDialog() {
    dlg = document.createElement("dialog");
    dlg.className = "cx-dialog";
    dlg.setAttribute("aria-labelledby", "cxd-title");
    dlg.innerHTML = '<button type="button" class="close">Close</button><div class="cxd"><div class="cxd-doc"></div><div class="cxd-info"></div></div>';
    document.body.appendChild(dlg);
    dlg.querySelector(".close").addEventListener("click", close);
    dlg.addEventListener("cancel", function (e) { e.preventDefault(); close(); });
    dlg.addEventListener("click", function (e) { if (e.target === dlg || e.target.classList.contains("cxd")) close(); });
  }
  function flip(el, from, to, dur) {
    el.style.transition = "none";
    el.style.transform = "translate(" + (from.left - to.left) + "px," + (from.top - to.top) + "px) scale(" + (from.width / to.width) + ")";
    el.getBoundingClientRect();
    requestAnimationFrame(function () {
      el.style.transition = "transform " + dur + "ms cubic-bezier(.2,.7,.2,1)";
      el.style.transform = "";
    });
  }
  function open(i) {
    var c = DATA.certs[i];
    if (!c || !cards[i]) return;
    if (!dlg) buildDialog();
    srcDoc = cards[i];
    var paper = srcDoc.querySelector(".cx-paper");
    var holder = dlg.querySelector(".cxd-doc");
    holder.innerHTML = "";
    holder.appendChild(paper.cloneNode(true));
    var rows = [["Issuer", esc(c.issuer)], ["Issued", monthLong(c.date)]];
    if (c.credentialId) rows.push(["Credential ID", esc(c.credentialId)]);
    if (c.skills && c.skills.length) rows.push(["Skills", c.skills.map(esc).join(" · ")]);
    var acts = [];
    if (c.verificationUrl) acts.push('<a href="' + esc(c.verificationUrl) + '" rel="noopener" data-cursor="Verify ↗">Verify credential ↗</a>');
    if (c.file) acts.push('<a href="/' + esc(c.file) + '" download>Download certificate ↓</a>');
    dlg.querySelector(".cxd-info").innerHTML =
      '<span style="font-family:\'IBM Plex Mono\',monospace;font-size:10px;letter-spacing:.28em;text-transform:uppercase;color:rgba(232,240,236,0.58)">Record ' + String(i + 1).padStart(2, "0") + " / " + String(DATA.certs.length).padStart(2, "0") + "</span>" +
      '<h3 id="cxd-title">' + esc(c.title) + "</h3>" +
      "<dl>" + rows.map(function (r) { return "<dt>" + r[0] + "</dt><dd>" + r[1] + "</dd>"; }).join("") + "</dl>" +
      (acts.length ? '<div class="acts">' + acts.join("") + "</div>" : "") +
      (c.image ? "" : '<p class="cxd-note">A typeset record of the credential, not the certificate itself' + (c.verificationUrl ? "; the issuer’s page above is the original." : ".") + "</p>");
    var from = paper.getBoundingClientRect();
    dlg.showModal();
    document.documentElement.style.overflow = "hidden";
    requestAnimationFrame(function () { dlg.classList.add("open"); });
    if (!reduced) {
      srcDoc.style.visibility = "hidden";
      flip(holder, from, holder.getBoundingClientRect(), 620);
    }
    var first = dlg.querySelector(".acts a") || dlg.querySelector(".close");
    if (first) first.focus({ preventScroll: true });
  }
  function close() {
    if (!dlg || !dlg.open) return;
    var holder = dlg.querySelector(".cxd-doc");
    var finish = function () {
      dlg.classList.remove("open");
      dlg.close();
      document.documentElement.style.overflow = "";
      holder.style.transform = ""; holder.style.transition = "";
      if (srcDoc) srcDoc.style.visibility = "";
      if (wView) wView.focus({ preventScroll: true });
    };
    if (reduced || !srcDoc) { finish(); return; }
    dlg.classList.remove("open");
    var to = srcDoc.querySelector(".cx-paper").getBoundingClientRect();
    var from = holder.getBoundingClientRect();
    holder.style.transition = "transform 480ms cubic-bezier(.2,.7,.2,1)";
    holder.style.transform = "translate(" + (to.left - from.left) + "px," + (to.top - from.top) + "px) scale(" + (to.width / from.width) + ")";
    setTimeout(finish, 480);
  }

  /* ── page-wide: decorative loops rest while their chapter is out of view ────
     Some thirty infinite CSS animations (packets on the fraud diagram, pulses,
     carets) otherwise keep the browser restyling every frame wherever the reader
     is. Each chapter's are paused a screen before it leaves and resumed a screen
     before it returns, so nobody ever sees one stop. */
  if ("IntersectionObserver" in window) {
    var chapters = document.querySelectorAll("#dc-root > [data-dc-component] > section, #dc-root section[id], #dc-root article[id], [data-hero-copy]");
    var rest = new IntersectionObserver(function (es) {
      es.forEach(function (e) { e.target.classList.toggle("dc-off", !e.isIntersecting); });
    }, { rootMargin: "100% 0px" });
    Array.prototype.forEach.call(chapters, function (el) { if (el.id !== "writing") rest.observe(el); });
  }

  /* ── the cursor's note ──────────────────────────────────────────────────── */
  if (finePointer && !reduced) {
    var tag = document.createElement("div");
    tag.className = "act-cursor";
    tag.setAttribute("aria-hidden", "true");
    document.body.appendChild(tag);
    var cur = null, mx = 0, my = 0, q = false;
    var place = function () { q = false; tag.style.setProperty("--cx", mx + 16 + "px"); tag.style.setProperty("--cy", my + 18 + "px"); };
    document.addEventListener("pointermove", function (e) {
      if (e.pointerType !== "mouse") return;
      mx = e.clientX; my = e.clientY;
      var t = e.target && e.target.closest ? e.target.closest("#activity [data-cursor], .cx-dialog [data-cursor]") : null;
      if (t !== cur) {
        cur = t;
        if (t) { tag.textContent = t.getAttribute("data-cursor"); tag.classList.add("on"); } else tag.classList.remove("on");
      }
      if (!q) { q = true; requestAnimationFrame(place); }
    }, { passive: true });
    document.addEventListener("pointerleave", function () { tag.classList.remove("on"); cur = null; });
  }
})();
