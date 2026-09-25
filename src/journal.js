/* The journal's only script. Everything it does is an enhancement: without it the
   pages are complete, readable and navigable — the reveal states are keyed on the
   `js` class this file's own head snippet adds, so nothing can be left hidden. */
(function () {
  "use strict";
  var root = document.documentElement;
  window.__jr = 1;   // the head snippet shows everything if this never runs
  var reduced = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ── reading mode ───────────────────────────────────────────────────────
     Shared with the home page's weather: Light writes "day", Dark writes "dark", so
     the next visit to the home page opens on the matching plate. */
  var btns = [].slice.call(document.querySelectorAll("[data-set-mode]"));
  function paintMode() {
    var m = root.getAttribute("data-mode");
    btns.forEach(function (b) { b.setAttribute("aria-pressed", b.getAttribute("data-set-mode") === m ? "true" : "false"); });
  }
  btns.forEach(function (b) {
    b.addEventListener("click", function () {
      var m = b.getAttribute("data-set-mode");
      if (root.getAttribute("data-mode") === m) return;
      var apply = function () { root.setAttribute("data-mode", m); paintMode(); };
      // one GPU cross-fade of the page, rather than animating every colour on it
      if (document.startViewTransition && !reduced) document.startViewTransition(apply);
      else apply();
      try { localStorage.setItem("lp-theme", m === "light" ? "day" : "dark"); } catch (e) {}
    });
  });
  paintMode();

  if (reduced || !("IntersectionObserver" in window)) { root.classList.add("still"); }
  else {
    /* ── headlines: words rise out of a mask, the same gesture as the home page ── */
    [].slice.call(document.querySelectorAll("[data-split]")).forEach(function (h) {
      var target = h.querySelector("a") || h;
      var words = target.textContent.trim().split(/\s+/);
      if (words.length > 24) return;
      target.textContent = "";
      words.forEach(function (w, i) {
        var m = document.createElement("span"); m.className = "w";
        var s = document.createElement("span"); s.textContent = w; s.style.transitionDelay = (120 + i * 38) + "ms";
        m.appendChild(s); target.appendChild(m);
        if (i < words.length - 1) target.appendChild(document.createTextNode(" "));
      });
      h.classList.add("split");
      requestAnimationFrame(function () { requestAnimationFrame(function () { h.classList.add("in"); }); });
    });

    /* ── everything else arrives once, as it enters, and then stays still ── */
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        en.target.classList.add("in");
        io.unobserve(en.target);
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.06 });
    [].slice.call(document.querySelectorAll("[data-rv]")).forEach(function (el) { io.observe(el); });
  }

  /* ── carousels: arrows step one slide; the strip itself stays natively scrollable ── */
  [].slice.call(document.querySelectorAll("[data-deck]")).forEach(function (deck) {
    var fig = deck.parentNode, prev = fig.querySelector('[data-deck-go="-1"]'), next = fig.querySelector('[data-deck-go="1"]');
    function step() { var s = deck.querySelector("img"); return s ? s.getBoundingClientRect().width + 10 : deck.clientWidth; }
    function sync() {
      if (prev) prev.disabled = deck.scrollLeft < 4;
      if (next) next.disabled = deck.scrollLeft + deck.clientWidth > deck.scrollWidth - 4;
    }
    [prev, next].forEach(function (b) { if (b) b.addEventListener("click", function () { deck.scrollBy({ left: step() * +b.getAttribute("data-deck-go"), behavior: reduced ? "auto" : "smooth" }); }); });
    deck.addEventListener("keydown", function (e) {
      if (e.key === "ArrowRight" || e.key === "ArrowLeft") { e.preventDefault(); deck.scrollBy({ left: step() * (e.key === "ArrowRight" ? 1 : -1), behavior: reduced ? "auto" : "smooth" }); }
    });
    deck.addEventListener("scroll", sync, { passive: true });
    sync();
  });

  /* ── the nav as a Dynamic Island (see pages.css) ───────────────────────── */
  var island = (function () {
    var bar = document.querySelector(".pnav"), nav = bar && bar.querySelector("nav");
    var mini = nav && nav.querySelector(".isl-mini"), label = nav && nav.querySelector(".isl-label"), dot = nav && nav.querySelector(".isl-dot");
    if (!mini || !label) return null;
    var fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    var state = "open", lastY = window.scrollY, hover = false, holdUntil = 0, idle = 0, queued = false;
    function fit() {
      var phone = window.matchMedia("(max-width: 660px)").matches;
      var W = nav.offsetWidth, H = nav.offsetHeight, ih = phone ? 42 : 40;
      label.style.flex = "none";
      var want = Math.ceil(label.scrollWidth) + 26 + 16 + 20 + 22;
      label.style.flex = "";
      var iw = Math.min(W - 16, 420, Math.max(phone ? 176 : 188, want));
      var it = phone ? 6 : Math.max(0, (H - ih) / 2), il = Math.max(0, (W - iw) / 2);
      nav.style.setProperty("--iw", iw.toFixed(1) + "px"); nav.style.setProperty("--ih", ih + "px");
      nav.style.setProperty("--il", il.toFixed(1) + "px"); nav.style.setProperty("--ir", il.toFixed(1) + "px");
      nav.style.setProperty("--it", it.toFixed(1) + "px"); nav.style.setProperty("--ib", Math.max(0, H - it - ih).toFixed(1) + "px");
    }
    function set(next) {
      if (next === state) return;
      state = next;
      if (next === "mini") { fit(); bar.setAttribute("data-island", "mini"); } else bar.removeAttribute("data-island");
      mini.setAttribute("aria-hidden", next === "mini" ? "false" : "true");
    }
    function decide() {
      queued = false;
      var y = window.scrollY, dy = y - lastY;
      lastY = y;
      if (y < 160) return set("open");
      if (hover || (nav.contains(document.activeElement) && document.activeElement !== mini)) return set("open");
      if (performance.now() < holdUntil) return;
      if (dy > 3) set("mini"); else if (dy < -10) set("open");
    }
    window.addEventListener("scroll", function () { if (!queued) { queued = true; requestAnimationFrame(decide); } }, { passive: true });
    window.addEventListener("resize", function () { if (state === "mini") fit(); });
    mini.addEventListener("click", function () { holdUntil = performance.now() + 700; set("open"); });
    nav.addEventListener("focusin", function (e) { if (e.target !== mini) set("open"); });
    if (fine) {
      nav.addEventListener("pointerenter", function () { hover = true; clearTimeout(idle); set("open"); });
      nav.addEventListener("pointerleave", function () {
        hover = false; clearTimeout(idle);
        idle = setTimeout(function () { if (!hover && window.scrollY > 160) set("mini"); }, 900);
      });
    }
    return {
      label: function (t) {
        if (!t || label.textContent === t) return;
        label.textContent = t;
        label.classList.remove("swap"); void label.offsetWidth; label.classList.add("swap");
        if (state === "mini") fit();
      },
      progress: function (p) { if (dot) { dot.classList.add("ring"); dot.style.setProperty("--p", p.toFixed(3)); } }
    };
  })();

  /* ── the article: place in the text, contents, notes, code, maths ───────── */
  var post = document.querySelector(".post .prose");
  if (post) {
    var bar = document.querySelector(".read-progress span");
    if (island) island.label("Reading");
    var links = [].slice.call(document.querySelectorAll("[data-toc]"));
    var heads = links.map(function (a) { return document.getElementById(a.getAttribute("data-toc")); }).filter(Boolean);
    var left = document.querySelector("[data-read-left]");
    var minutes = left ? parseInt(left.textContent, 10) || 0 : 0;
    var queued = false, current = null;
    function place() {
      queued = false;
      var r = post.getBoundingClientRect(), vh = window.innerHeight;
      var p = Math.min(1, Math.max(0, (vh * 0.3 - r.top) / Math.max(1, r.height - vh * 0.5)));
      if (bar) bar.style.setProperty("--p", p.toFixed(4));
      if (island) island.progress(p);
      if (left && minutes) {
        var m = Math.ceil(minutes * (1 - p));
        left.textContent = p > 0.985 ? "Finished" : p < 0.01 ? minutes + " min read" : m + " min left";
      }
      var on = null;
      for (var i = 0; i < heads.length; i++) { if (heads[i].getBoundingClientRect().top < vh * 0.28) on = heads[i]; else break; }
      if (on !== current) {
        current = on;
        if (island) island.label(on ? on.textContent.replace(/^\s*\d+[.)]?\s*/, "").replace(/\s*#\s*$/, "").trim() : "Reading");
        links.forEach(function (a) {
          if (on && a.getAttribute("data-toc") === on.id) a.setAttribute("aria-current", "true"); else a.removeAttribute("aria-current");
        });
      }
    }
    window.addEventListener("scroll", function () { if (!queued) { queued = true; requestAnimationFrame(place); } }, { passive: true });
    window.addEventListener("resize", place);
    place();

    // code: copy what the block holds, and say so for a moment
    [].slice.call(post.querySelectorAll("[data-copy]")).forEach(function (b) {
      if (!navigator.clipboard) return;
      b.hidden = false;
      b.addEventListener("click", function () {
        var code = b.closest(".codeblock").querySelector("code").textContent;
        navigator.clipboard.writeText(code).then(function () {
          b.textContent = "Copied"; setTimeout(function () { b.textContent = "Copy"; }, 1600);
        });
      });
    });

    // notes: beside their sentence in the margin when there is a margin; they stay
    // at the foot as well, which is where a narrow screen and a screen reader find them
    var refs = [].slice.call(post.querySelectorAll("sup.fn a"));
    var notes = [];
    refs.forEach(function (a) {
      var id = a.getAttribute("data-fn");
      if (notes.some(function (n) { return n.id === id; })) return;
      var src = document.getElementById("fn-" + id);
      if (!src) return;
      var el = document.createElement("aside");
      el.className = "sidenote"; el.setAttribute("aria-hidden", "true");
      var body = src.cloneNode(true);
      [].slice.call(body.querySelectorAll(".fn-back")).forEach(function (x) { x.remove(); });
      el.innerHTML = '<span class="n">' + a.textContent + "</span>" + body.innerHTML;
      post.appendChild(el);
      notes.push({ id: id, ref: a, el: el });
      a.addEventListener("mouseenter", function () { el.classList.add("hot"); });
      a.addEventListener("mouseleave", function () { el.classList.remove("hot"); });
    });
    // anything that spans into the margin (figures, tables, code, results) is an
    // obstacle: a note that would overlap one waits below it
    var wide = [].slice.call(post.querySelectorAll(":scope > figure:not([data-size='narrow']), :scope > .codeblock, :scope > pre, :scope > .math-block, :scope > .callout[data-kind='key-results'], :scope > .callout[data-kind='setup']"));
    function setNotes() {
      if (!notes.length) return;
      var top = post.getBoundingClientRect().top, floor = 0;
      var blocks = wide.map(function (w) { var r = w.getBoundingClientRect(); return [r.top - top - 12, r.bottom - top + 16]; });
      notes.forEach(function (n) {
        if (getComputedStyle(n.el).display === "none") return;
        var y = Math.max(floor, n.ref.getBoundingClientRect().top - top - 4);
        var h = n.el.offsetHeight;
        blocks.forEach(function (b) { if (y < b[1] && y + h > b[0]) y = b[1]; });
        n.el.style.top = y + "px";
        floor = y + h + 14;
      });
    }
    setNotes();
    window.addEventListener("resize", setNotes);
    window.addEventListener("load", setNotes);
    // images arrive late and move everything below them
    if ("ResizeObserver" in window) new ResizeObserver(function () { requestAnimationFrame(setNotes); }).observe(post);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(setNotes);

    // maths: typeset by KaTeX where an article has any; the TeX stays readable if not
    var maths = post.querySelectorAll(".math[data-tex]");
    if (maths.length) {
      var K = "https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/";
      var css = document.createElement("link"); css.rel = "stylesheet"; css.href = K + "katex.min.css"; document.head.appendChild(css);
      var js = document.createElement("script"); js.src = K + "katex.min.js"; js.defer = true;
      js.onload = function () {
        [].forEach.call(maths, function (el) {
          try { window.katex.render(el.textContent, el, { displayMode: el.hasAttribute("data-display"), throwOnError: false }); el.classList.add("katex-done"); } catch (e) {}
        });
        setNotes();
      };
      document.head.appendChild(js);
    }
  }

  /* ── newsletter: posts to whatever endpoint content/journal.json names ──
     Most providers (Buttondown, ConvertKit, a serverless function) accept a plain form
     post. It is sent in the background so the reader stays on the page; if that is
     refused, the form falls back to submitting normally into a new tab. */
  var form = document.querySelector("form[data-newsletter]");
  if (form && window.fetch) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var note = form.querySelector(".nl-note"), btn = form.querySelector("button");
      btn.disabled = true;
      fetch(form.action, { method: "POST", body: new FormData(form), mode: "no-cors" })
        .then(function () { form.classList.add("done"); if (note) note.textContent = "Thanks — check your inbox to confirm."; })
        .catch(function () { btn.disabled = false; form.submit(); });
    });
  }
})();
