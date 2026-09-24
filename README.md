# Soubhagya Jain — portfolio

A static site compiled from the Claude Design project
[*World alive with natural motion*](https://claude.ai/design/p/dc4e5ced-b98d-4045-a5c1-82403772017f).

**Live:** https://soubhagya-jain-portfolio.vercel.app

```bash
node build.mjs                                   # design/ + content/ -> dist/
node build.mjs --drafts                          # the same, with draft articles shown and marked
python -m http.server 4173 --directory dist      # then open http://localhost:4173
```

**Publishing an article, a LinkedIn post or a PDF of notes:** see
[`content/README.md`](content/README.md). It is one file per item, and needs no code.

## Deployment

Vercel is linked to this repository, so **every push to `main` deploys to
production** — no manual step. Build settings come from `vercel.json`
(`node build.mjs` → `dist/`); there are no dependencies to install, so a build takes
a few seconds.

`dist/` is gitignored, which is why the build config matters: without it Vercel would
treat this as a plain static site, serve the repo root, and find no `index.html`.

## Layout

```
design/           the artboards, synced from Claude Design (see "Local changes" below)
  *.dc.html         Living Photograph (the page) + the artboards it imports
  support.js        the design-canvas runtime, kept for reference; not shipped
  assets/           photographic plates, the portrait, journal-night.jpg
content/          everything written: blog/, linkedin/, notes/, journal.json
src/
  dc-lite.js        the ~100-line runtime that replaces React + Babel
  content.mjs       reads content/: front matter, Markdown, the article record
  journal.mjs       the Engineering Journal, article, domain, LinkedIn and Notes pages
  plates.mjs        the drawn engineering plates articles use when they have no cover
  pages.css         styles for those pages (graphite and paper modes)
  journal.js        their one small script: reading mode, reveals, newsletter form
  writing.css       the home page's Writing chapter
build.mjs         the compiler
dist/             the built site — generated, wiped on every build
```

## The page

The home page reads in this order, and the nav follows it: **About** (intro and a
three-fact ledger) → **Work** (Aperture, the prefix-caching benchmark, the fraud design study, the inference
engine) → **Engineering activity & credentials** (GitHub, then the credential archive) → **How I work** (philosophy, beyond the terminal, direction) → **Background**
(education, technology) → **Writing** (latest journal entries and notes) → **Contact**.
The nav's scroll spy lets one item own more than one stretch (`data-spy`), so About
lights again over Background.

The living photograph stays visible and moving behind every chapter. Below the hero
it sinks only as far as each plate needs for legibility (`DIM_CAP` in the Living
Photograph logic: more for daylight, less for night) and runs at 30fps instead of
parking. Legibility over
the lit ground comes from local shading behind each block of text rather than from
darkening the whole world.

## GitHub activity and credentials (chapter 03)

Rendered at build time by `src/activity.mjs`, styled by `src/activity.css`, animated by
`src/activity.js` (appended to `app.js`). The markup is complete on its own: with no
script, or with GitHub down, every number, repository, credential and link is still
there.

- **Data flow.** `build.mjs` reads GitHub once per deploy through `src/github.mjs` and
  bakes the result into the page. The page then asks `/api/github` (a Vercel function,
  `api/github.js`) for anything newer; the CDN caches that for six hours and serves it
  stale for a day while refreshing, so GitHub sees a few requests a day. If GitHub
  cannot be reached at build time, `content/github-snapshot.json` (public data only) is
  used instead.
- **Token (optional).** Set `GITHUB_TOKEN` in the Vercel project (a fine-grained token
  with no permissions is enough). With it, the contribution calendar and pinned repos
  come from GraphQL and the rate limit rises; without it, the calendar is read from the
  public profile. It never reaches the browser.
- **Featured repositories** are listed in `content/github.json`: exact repo name, your
  own title, category, description, stack, optional live URL, and the drawn plate shown
  on hover. Stars and "updated" dates come from GitHub.
- **Credentials** live in `content/certifications.json` and are shown on a wheel, a plain-JS port of crafterui's Works Wheel: a ring of records at rest that opens into a vertical drum and turns one record to the front per stretch of page scroll (the stage is pinned, so it never traps the reader). Readers without the script get the same records as a plain archive. Add `image` (and optionally
  `file`, a PDF) under `content/certificates/` to show the real certificate instead of
  the typeset record. Only list skills the issuer shows.
- **Metrics** are only ever read or summed from GitHub data; anything GitHub does not
  return shows as a dash rather than a guess.
- Previewing without network: `GH_FIXTURE=path/to/data.json node build.mjs` substitutes
  local data. Never set it on Vercel.

## The Engineering Journal

`/blog` is built from `content/` by `src/content.mjs` and `src/journal.mjs`:

- a featured article (`featured: true`, else the newest) in the hero slot
- the domains that have writing, each with its own page at `/blog/topic/<slug>`
- **Start here**, the reading order set with `start: 1`–`5` (falls back to the newest)
- an editorial break over the night plate, with the two newest articles as pages
- the full archive in a varying rhythm (a lead and two, a text-led pair, a feature),
  beside an author column
- LinkedIn posts in full, and all of them at `/blog/linkedin`
- `/blog/feed.xml` (RSS) and `/notes`, the PDF library

Articles without a `cover:` get a drawn plate for their domain (`src/plates.mjs`),
seeded from the slug so no two cards crop it the same way. Plates draw mechanisms, never
charts, so they cannot be mistaken for results. Reading mode follows the weather chosen
on the home page (Daylight → paper, Night/Storm → graphite), with a switch on the page.

The newsletter form appears once `content/journal.json` names an endpoint (any service
that accepts a form post with an email field, such as Buttondown); until then the band
offers the RSS feed instead of a form that goes nowhere.

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

## Local changes to the artboards

Several artboards have been edited here and now **differ from the Claude Design
project** — re-syncing one would undo its changes:

- **Living Photograph** — chapter order, nav, the About ledger, project copy and
  numbering, the Writing chapter slot, the per-weather scrim cap, the shader keeping
  its detail and motion below the hero, the portrait's mask, phone nav and hero breaks.
- **Aperture RAG Showcase**, **Direction** — stage shading moved behind the diagrams so
  the photograph shows at the edges; Direction's call to action now goes to Contact.
- **Tech System** — the board takes its phone shape on load, not only after a resize.
- **Contact** — the footer line, and the email handling described below.
- Every imported artboard — its chapter number.

`Areas System.dc.html` is no longer imported (it was the fourth listing of the same six
topics) and so is not shipped; it stays in `design/` as part of the synced source.

### Contact: email without a mail client

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
- The weather switch (day / night) persists in `localStorage` under
  `lp-theme`, and night is the default. The journal pages read the same key for their
  reading mode, and their switch writes it back.
- Every artboard honours `prefers-reduced-motion` and has its own phone layout below
  860px. The artboards' own loops stop when scrolled out of view; the hero scene is
  the exception by design, since it is the ground for every chapter (see "The page").

## Mobile layout invariants

`tools/mobile-audit.js` checks the four properties the layout has to keep. Serve
`dist/`, paste the file into the console, then:

```js
window.__audit()                      // one viewport, at rest
```

It reports horizontal overflow, text-on-text collisions, decorative layers that
escape a clipping ancestor, and the tap-target / type-size floors. Three details in
it matter, because each one changed the answer:

- **Line boxes, not bounding boxes.** An inline element that wraps has a union box
  spanning the whole column, which appears to overlap its neighbours while the
  rendered text never touches. Comparing `getClientRects()` removed a false positive
  that had survived three rounds of review.
- **Effective opacity.** `opacity` does not inherit into `getComputedStyle`, so a
  leaf inside a panel faded to zero still reports `1`. Several chapters reveal panels
  at disjoint scroll ranges; without walking the ancestor chain the audit reports
  collisions between things that are never on screen together. This alone took the
  count from 14 to 0.
- **Fixed ancestors are skipped.** The floating nav crossing scrolling content is the
  point of a floating nav, not a defect.

Sweep the whole document rather than sampling at rest — panels that never coexist
when parked can still meet mid-scroll:

```js
for (let y = 0; y <= document.body.scrollHeight; y += innerHeight * 0.7) {
  scrollTo(0, y); dispatchEvent(new Event('scroll'));
  await new Promise(r => requestAnimationFrame(r));
  const a = window.__audit();
  if (a.textCollisions) console.log(y, a.collisionSample);
}
```

`scrollTo` alone does not fire scroll events in some embedded browsers, which is why
the event is dispatched by hand.
