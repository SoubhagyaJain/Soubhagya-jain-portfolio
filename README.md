# Soubhagya Jain — portfolio

A static site compiled from the Claude Design project
[*World alive with natural motion*](https://claude.ai/design/p/dc4e5ced-b98d-4045-a5c1-82403772017f).

**Live:** https://soubhagya-jain-portfolio.vercel.app

```bash
node build.mjs                                   # design/ -> dist/
python -m http.server 4173 --directory dist      # then open http://localhost:4173
```

## Deployment

Vercel is linked to this repository, so **every push to `main` deploys to
production** — no manual step. Build settings come from `vercel.json`
(`node build.mjs` → `dist/`); there are no dependencies to install, so a build takes
a few seconds.

`dist/` is gitignored, which is why the build config matters: without it Vercel would
treat this as a plain static site, serve the repo root, and find no `index.html`.

## Layout

```
design/           the artboards, synced from Claude Design — the source of truth
  *.dc.html         10 artboards: Living Photograph (the page) + 9 it imports
  support.js        the design-canvas runtime, kept for reference; not shipped
  assets/           photographic plates and the portrait
src/dc-lite.js    the ~100-line runtime that replaces React + Babel
build.mjs         the compiler
dist/             the built site — generated, wiped on every build
```

## What the build does

Each artboard is an `<x-dc>` template plus a `class Component extends DCLogic`
script. In the design canvas, `support.js` renders that by pulling React, ReactDOM
and Babel-standalone off unpkg at page load and evaluating the logic classes in the
browser. None of that is needed here — the templates carry no control flow
(`sc-if` / `sc-for` are unused), and the logic classes never render: they hold refs
and drive the DOM directly out of `componentDidMount`.

So `build.mjs` does the three things the runtime was there for, and leaves the rest
byte-for-byte alone:

| design source | compiled output |
| --- | --- |
| `ref="{{ x }}"` | `data-ref="x" data-dc-owner="<artboard>"`, bound to a `{current}` box |
| `style-hover="…"` | a real `:hover` rule in `styles.css` |
| `<dc-import name="X">` | X's markup, inlined in place |

Two details worth knowing:

- **Hover declarations are marked `!important`.** The elements carry their base
  styles inline, and an inline style beats a class rule — so a plain `:hover` rule
  would never apply. `support.js` solves this the same way; `importantify()` in
  `build.mjs` is a port of its version, splitting on top-level `;` only so
  semicolons inside gradients and `url()` don't split a declaration.

- **Inline `style` attributes stay inline.** They look like something a build
  should hoist into classes, but the design's own JS reads them:
  `initParallax` selects atmosphere planes with
  `div[style*='radial-gradient']`, and every artboard writes over the inline
  values at runtime. Hoisting them would quietly break the choreography.

`data-dc-owner` exists because three artboards each declare a `canvasRef`, and
several share `rootRef` / `hostRef`. Once everything is inlined into one document,
the owner attribute is what keeps each ref pointing at its own element.

The logic classes are embedded **verbatim**, each wrapped in a function that takes
`DCLogic` and `React` as parameters. Re-syncing an artboard from the design is a
straight file copy into `design/` followed by `node build.mjs` — there is no
hand-merge step, and no edits to carry forward.

## Assets

The two hero plates — `plate-day.jpg` and `plate-night.jpg` — are in
`design/assets/`, supplied directly and transcoded from WebP at quality 82
(mean error ≈3/255 against the source, invisible once the shader grades, blurs and
vignettes it, and ~125 KB lighter on the hero's critical path). They are 941×1672;
the shader's `TEX_ASPECT` assumes 2133/1200 = 1.7775 and these are 1.7768, so
nothing is stretched.

### The demo contact sheets

`demo-sheet-0.jpg` and `demo-sheet-1.jpg` are built from the screen recording, not
copied from the design. The Aperture artboard deliberately avoids a `<video>` element
— *"the page's own clock: true speed, even spacing, and no codec or autoplay
dependency"* — and instead flips through 96 frames held in two sprite sheets. That
geometry is hardcoded in its playback (`TW=720 TH=405 COLS=8 PER=48 TOTAL=96 FPS=12`,
and `draw(n)` reads sheet `n/48` at cell `n%48`, row-major), so the sheets have to be
exactly two 8×6 grids of 720×405 cells — 5760×2430 each.

To regenerate from a new recording:

```bash
ffmpeg -i recording.mp4 -vf "fps=96/<duration_seconds>,scale=720:405:flags=lanczos" \
       -frames:v 96 frames/f-%03d.png
# then tile 48 frames per sheet, 8 across, row-major, into design/assets/
```

The source was 25.03 s at 3840×2160 — exactly 16:9, so it maps onto 720×405 with no
crop. Playback is a fixed 96-frame/12 fps loop, i.e. 8 seconds, so sampling evenly
across the full clip shows the whole walkthrough at roughly 3.1× speed; that is the
only way a clip longer than 8 s fits this component without dropping the tail.

**These are the heaviest assets on the page** — ~2.5 MB for the pair at quality 70
(a screen recording of UI text is expensive in JPEG, and the cell size is not
negotiable without editing the artboard). They are also fetched in
`componentDidMount`, so they download on first load even though the section sits far
down the page. If that matters more than the animation, deleting them is a safe
downgrade: the artboard falls back to its own panel.

### The fallback ground

This no longer triggers now that the plates are in place, but it is worth keeping:
the plate is not only the hero. It lives in a `position: fixed` layer that is the
ground for the *entire* page, and the WebGL scene is a shader that reads it as a
texture. With the file absent, the texture never uploads, the canvas stays
transparent, and every section from the hero to the footer loses its background — the
page reads as broken rather than as missing one file.

So `dc-lite` paints that fixed layer with a dusk gradient when a plate fails to load,
in the tones the shader itself grades toward at night, so the type, the glass chrome
and the scrims above it all still sit correctly. It is deliberately a gradient and not
a stand-in photograph — it should look like a considered ground, never like it is
passing for the real plate. Dropping the real files in and rebuilding makes it inert;
there is nothing to undo.

The Aperture demo-sheet frames need no such handling: that artboard already ships its
own fallback panel and switches to it on load failure.

## Local change to the Contact artboard

`design/Contact.dc.html` is the one artboard that has been edited here, so it now
**differs from the Claude Design project** — re-syncing that file would undo it.

The section had no backend and handed the message to `mailto:`. That is only as good
as the visitor's machine: with no desktop mail client registered — the common case on
Windows, and on plenty of phones — clicking one does nothing at all, so the form read
as broken and the message was lost. All four email paths (the form, the headline CTA,
the Email channel row, the footer link) now open Gmail's compose window prefilled to
`jainsoubhagya632@gmail.com`, falling back to `mailto:` if the popup is blocked.

The `href` attributes are still real `mailto:` links, so the address stays copyable
and the markup still says "email"; the clicks are intercepted. The form also no
longer navigates away mid-send, so its "Signal received" acknowledgement is actually
visible now.

If you want messages to arrive without the visitor having a Gmail session, this is
the point to swap in a form backend (Formspree, Resend, a serverless function) — the
submit handler already validates and assembles the payload.

## Notes

- No build-time dependencies — `build.mjs` is plain Node with only `node:fs` and
  `node:path`. The only network requests the page makes are the Google Fonts
  stylesheet and its font files.
- The night/day toggle persists in `localStorage` under `lp-night`, and night is
  the default.
- Every artboard honours `prefers-reduced-motion`, drops its animation loop when
  scrolled out of view, and has its own phone layout below 860px.
