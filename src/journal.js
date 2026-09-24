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
      root.setAttribute("data-mode", m);
      try { localStorage.setItem("lp-theme", m === "light" ? "day" : "dark"); } catch (e) {}
      paintMode();
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

  /* ── the article: place in the text, contents, notes, code, maths ───────── */
  var post = document.querySelector(".post .prose");
  if (post) {
    var bar = document.querySelector(".read-progress span");
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
      if (left && minutes) {
        var m = Math.ceil(minutes * (1 - p));
        left.textContent = p > 0.985 ? "Finished" : p < 0.01 ? minutes + " min read" : m + " min left";
      }
      var on = null;
      for (var i = 0; i < heads.length; i++) { if (heads[i].getBoundingClientRect().top < vh * 0.28) on = heads[i]; else break; }
      if (on !== current) {
        current = on;
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
