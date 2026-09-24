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
