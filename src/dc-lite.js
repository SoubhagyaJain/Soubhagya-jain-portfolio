/* dc-lite — the slice of the design-canvas runtime the shipped page actually needs.
 *
 * The artboard logic classes look like React components, but none of them render:
 * they extend DCLogic, hold refs, and drive the DOM directly from
 * componentDidMount. So all that is required to run them against static markup is
 *
 *   - a `React.createRef()` that returns a {current} box,
 *   - a DCLogic base with props/state/setState,
 *   - a mount pass that points each ref at its element and calls componentDidMount.
 *
 * That is this file. No React, no ReactDOM, no Babel, no CDN.
 */
var dc = (function () {
  "use strict";

  var React = {
    createRef: function () { return { current: null }; }
  };

  function DCLogic(props) {
    this.props = props || {};
    this.state = {};
  }
  // Nothing re-renders, so setState is the merge and the read is direct. The
  // artboards use it exactly that way (Living Photograph reads this.state.night
  // straight out of its draw loop).
  DCLogic.prototype.setState = function (patch) {
    if (!patch) return;
    for (var k in patch) if (Object.prototype.hasOwnProperty.call(patch, k)) this.state[k] = patch[k];
  };
  DCLogic.prototype.renderVals = function () { return {}; };
  DCLogic.prototype.componentDidMount = function () {};
  DCLogic.prototype.componentWillUnmount = function () {};

  /* The hero photograph is not just the hero: it lives in a `position: fixed` layer
   * that is the ground for the entire page, and the WebGL scene is a shader reading
   * it as a texture. If the plate 404s, the texture never uploads, the canvas stays
   * transparent, and every section from the hero to the footer loses its background
   * — the page reads as broken rather than as missing one file.
   *
   * So when a plate fails, paint that fixed layer with a dusk field. It is
   * deliberately a gradient and not a stand-in photograph: it should look like a
   * considered ground, never like it is passing for the real plate. The tones are
   * the ones the shader itself grades toward at night, so the type, the glass
   * chrome and the scrims above it all sit correctly. Adding the real plate and
   * rebuilding makes this inert — nothing to undo.
   */
  var FALLBACK_GROUND =
    "radial-gradient(124% 72% at 74% 6%, rgba(96,132,170,0.42), rgba(20,32,48,0) 58%)," +
    "linear-gradient(180deg, #1d3350 0%, #22405c 34%, #183048 46%, #152538 72%, #131c28 100%)";

  function plateMissing(img) {
    img.style.visibility = "hidden";
    console.warn(
      "[dc] missing image: " + img.getAttribute("src") +
      " — using the fallback ground. Add the file to design/assets/ and rebuild."
    );
    for (var n = img.parentElement; n; n = n.parentElement) {
      if (getComputedStyle(n).position === "fixed") { n.style.background = FALLBACK_GROUND; return; }
    }
  }

  var registry = [];

  function define(name, defaults, factory) {
    var Cls;
    try {
      Cls = factory(DCLogic, React);
    } catch (e) {
      console.error('[dc] "' + name + '" failed to evaluate — its section will be static.', e);
      return;
    }
    if (typeof Cls !== "function") {
      console.error('[dc] "' + name + '" did not return a Component class.');
      return;
    }
    registry.push({ name: name, defaults: defaults || {}, Cls: Cls });
  }

  function depth(el) {
    var d = 0;
    for (var n = el.parentNode; n; n = n.parentNode) d++;
    return d;
  }

  var mounted = [];

  function mount(root) {
    root = root || document;
    var byName = Object.create(null);
    registry.forEach(function (e) { byName[e.name] = e; });

    var hosts = Array.prototype.slice.call(root.querySelectorAll("[data-dc-component]"));
    // Deepest first, matching React's bottom-up componentDidMount order: the entry
    // artboard's choreography walks the whole assembled page, so it must run last.
    hosts.sort(function (a, b) { return depth(b) - depth(a); });

    hosts.forEach(function (host) {
      var name = host.getAttribute("data-dc-component");
      var entry = byName[name];
      if (!entry) return;

      var inst;
      try {
        inst = new entry.Cls(entry.defaults);
      } catch (e) {
        console.error('[dc] "' + name + '" constructor threw.', e);
        return;
      }

      // Bind refs. The owner attribute keeps a name that several artboards share
      // (canvasRef, rootRef, hostRef) pointing at this component's own element.
      var vals;
      try { vals = inst.renderVals() || {}; } catch (e) { vals = {}; }
      var sel = '[data-dc-owner="' + name.replace(/"/g, '\\"') + '"]';
      for (var key in vals) {
        var ref = vals[key];
        if (!ref || typeof ref !== "object" || !("current" in ref)) continue;
        ref.current = host.querySelector('[data-ref="' + key + '"]' + sel);
        if (!ref.current) console.warn('[dc] "' + name + '": no element for ref ' + key);
      }

      try {
        inst.componentDidMount();
        mounted.push(inst);
      } catch (e) {
        console.error('[dc] "' + name + '" failed while mounting — the rest of the page is unaffected.' + String(e && e.stack || e));
      }
    });

    // app.js is deferred, so an image that 404s has usually already fired its error
    // event by the time we get here. Check the ones that have finished, and listen
    // only for the ones still in flight.
    Array.prototype.forEach.call(document.images, function (img) {
      if (img.complete) {
        if (!img.naturalWidth) plateMissing(img);
      } else {
        img.addEventListener("error", function () { plateMissing(img); });
      }
    });
  }

  function unmount() {
    mounted.forEach(function (i) {
      try { i.componentWillUnmount(); } catch (e) { /* teardown is best-effort */ }
    });
    mounted = [];
  }

  return { define: define, mount: mount, unmount: unmount, DCLogic: DCLogic, React: React };
})();
