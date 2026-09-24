/* Chapter 03 of the home page, rendered at build time: 03.1 Engineering activity (from
   GitHub) and 03.2 Credentials (from content/certifications.json). Everything a reader
   needs is in this markup, so the chapter reads fully with no script and never
   collapses when GitHub is unreachable; src/activity.js only adds motion, the
   contribution landscape's interaction, and a fresher copy of the numbers. */
import { esc } from "./content.mjs";
import { derive } from "./github.mjs";
import { plate } from "./plates.mjs";

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTH = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const monYear = (iso) => { const d = new Date(iso); return `${MON[d.getUTCMonth()]} ${d.getUTCFullYear()}`; };
const dayMonth = (iso) => { const d = new Date(iso); return `${d.getUTCDate()} ${MON[d.getUTCMonth()]}`; };
const ym = (s) => { const [y, m] = s.split("-").map(Number); return { y, m, short: `${MON[m - 1]} ${y}`, long: `${MONTH[m - 1]} ${y}` }; };
const n2 = (i) => String(i).padStart(2, "0");
const num = (v) => v === null || v === undefined ? "—" : v.toLocaleString("en-US");
const ARROW = `<span class="ar" aria-hidden="true">↗</span>`;

function metrics(dv) {
  const cell = (key, value, label, note) =>
    `<div class="gx-m" data-gx-m="${key}"><dt>${label}</dt><dd><span class="v" data-to="${value ?? ""}">${num(value)}</span>${note ? `<span class="note">${note}</span>` : ""}</dd></div>`;
  return `<dl class="gx-metrics">${[
    cell("contributions", dv.contributions, "Contributions", "last 12 months"),
    cell("repositories", dv.repositories, "Public repositories"),
    cell("stars", dv.stars, "Stars", "across my own repos"),
    cell("activeDays", dv.activeDays, "Active days", "last 12 months")
  ].join("")}</dl>`;
}

function languages(dv) {
  if (!dv.languages.length) return "";
  const top = dv.languages.slice(0, 6);
  const max = top[0].count;
  return `<div class="gx-langs"><div class="gx-label">Primary language, by repository</div><ol>${top.map((l) =>
    `<li style="--w:${(l.count / max).toFixed(3)}"><span class="nm">${esc(l.name)}</span><span class="bar" aria-hidden="true"></span><span class="ct">${l.count}</span></li>`).join("")}</ol>
    <p class="gx-fine">The primary language GitHub reports, across the ${dv.languageRepos} of my public repositories that report one.</p></div>`;
}

export function eventsList(events) {
  if (!events.length) return `<p class="gx-fine">Recent public activity loads from GitHub.</p>`;
  return `<ol>${events.slice(0, 5).map((e) =>
    `<li><a href="${esc(e.url)}" rel="noopener"><span class="what">${esc(e.what)}</span><span class="repo">${esc(e.repo)}</span><time datetime="${esc(e.at)}">${dayMonth(e.at)}</time></a></li>`).join("")}</ol>`;
}

function repos(config, data) {
  const live = new Map(data.repos.map((r) => [r.name, r]));
  const rows = config.featured.map((f, i) => {
    const r = live.get(f.repo);
    const url = r ? r.url : `https://github.com/${config.username}/${f.repo}`;
    const stack = f.technologies && f.technologies.length ? f.technologies : (r && r.language ? [r.language] : []);
    const demo = f.liveUrl || "";
    return `<li class="gx-repo" data-repo="${esc(f.repo)}" style="--i:${i}">
      <div class="gx-media" aria-hidden="true">${plate(f.plate || "ai-systems", f.repo, { zoom: [1.2, 1.6] })}</div>
      <span class="gx-ix">${n2(i + 1)}</span>
      <div class="gx-rb">
        <span class="gx-cat">${esc(f.category || "")}</span>
        <h4><a href="${esc(url)}" rel="noopener" data-cursor="View code ↗">${esc(f.name || f.repo)}<span class="sr"> — view repository on GitHub</span></a></h4>
        <p>${esc(f.description || (r && r.description) || "")}</p>
      </div>
      <div class="gx-rmeta">
        ${stack.length ? `<span class="stack">${stack.map(esc).join(" / ")}</span>` : ""}
        <span class="facts"><span data-f="stars">${r && r.stars ? `★ ${r.stars}` : ""}</span><span data-f="updated">${r ? `Updated ${monYear(r.pushedAt)}` : ""}</span></span>
        <span class="links"><span class="go">View repository ${ARROW}</span>${demo ? `<a class="demo" href="${esc(demo)}" rel="noopener">Live demo ${ARROW}</a>` : ""}</span>
      </div>
    </li>`;
  });
  return `<ol class="gx-repos">${rows.join("")}</ol>`;
}

function github(config, data) {
  const u = data.user;
  const dv = derive(data);
  const cal = data.calendar;
  const label = cal
    ? (dv.contributions !== null
      ? `Contribution landscape: ${num(dv.contributions)} contributions on ${dv.activeDays} active days over the last twelve months. Use the arrow keys to read individual days.`
      : `Contribution landscape: activity on ${dv.activeDays} days over the last twelve months. Use the arrow keys to read individual days.`)
    : "Contribution landscape: the calendar could not be loaded from GitHub.";
  return `
  <article id="github" class="gx" data-gx>
    <header class="gx-head">
      <div class="gx-eyebrow" data-step="0"><span class="n">03</span><span class="s">/</span>Engineering activity</div>
      <h2 data-step="1"><span class="ln"><span>Engineering,</span></span> <span class="ln"><span>in public.</span></span></h2>
      <p class="gx-lead" data-step="2">A live trail of experiments, systems, failures, commits and things I’m still learning.</p>
    </header>

    <div class="gx-id" data-step="3">
      <img src="${esc(u.avatar)}&s=160" width="56" height="56" alt="GitHub avatar of ${esc(u.login)}" loading="lazy" decoding="async">
      <div class="who">
        <span class="nm">${esc(u.name)} <span class="lg">@${esc(u.login)}</span></span>
        <span class="bio">${esc(u.bio.replace(/\s*\|\s*/g, " · ").replace(/\s+/g, " ").trim())}</span>
        <span class="facts"><span data-f="followers">${num(u.followers)} follower${u.followers === 1 ? "" : "s"}</span>${u.location ? `<span>${esc(u.location)}</span>` : ""}</span>
      </div>
      <a class="gx-all" href="${esc(u.url)}" rel="noopener" data-cursor="Open ↗">View GitHub <span aria-hidden="true">→</span></a>
    </div>

    <figure class="gx-graph${cal ? "" : " is-empty"}" data-step="4">
      <figcaption>
        <span class="gx-label">Contributions · last 12 months</span>
        <span class="gx-legend" aria-hidden="true">Less<i data-l="0"></i><i data-l="1"></i><i data-l="2"></i><i data-l="3"></i><i data-l="4"></i>More</span>
      </figcaption>
      <div class="gx-stage">
        <div class="gx-scroll"><canvas class="gx-canvas" role="img" tabindex="0" aria-label="${esc(label)}" data-cursor="Explore"></canvas></div>
        <div class="gx-tip" role="status" aria-live="polite"></div>
        <p class="gx-empty-note">The contribution calendar could not be loaded just now. <a href="${esc(u.url)}" rel="noopener">See it on GitHub ${ARROW}</a></p>
      </div>
    </figure>

    ${metrics(dv)}

    <div class="gx-side">
      ${languages(dv)}
      <div class="gx-events"><div class="gx-label">Recent public activity</div><div data-gx-events>${eventsList(data.events || [])}</div></div>
    </div>

    <div class="gx-repos-head"><span class="gx-label">Selected repositories</span><a href="${esc(u.url)}?tab=repositories" rel="noopener" class="gx-all sm">All ${num(dv.repositories)} repositories <span aria-hidden="true">→</span></a></div>
    ${repos(config, data)}
  </article>`;
}

/* ── 03.2 credentials ──────────────────────────────────────────────────────── */

function record(c, i, total) {
  const d = ym(c.date);
  return `<article class="cx-item" data-cx="${i}">
    <div class="cx-doc${c.image ? " has-img" : ""}">
      <span class="cx-paper${c.image ? " has-img" : ""}">${face(c, i, total)}</span>
    </div>
    <div class="cx-meta">
      <span class="cx-ix">${n2(i + 1)}</span>
      <h4>${esc(c.title)}</h4>
      <span class="cx-iss">${esc(c.issuer)} · ${d.short}</span>
      ${c.credentialId ? `<span class="cx-iss">ID ${esc(c.credentialId)}</span>` : ""}
      ${c.verificationUrl ? `<a class="cx-verify" href="${esc(c.verificationUrl)}" rel="noopener">Verify credential ${ARROW}</a>` : ""}
    </div>
  </article>`;
}

/* The face of a record, shared by the wheel and the plain archive */
function face(c, i, total) {
  const d = ym(c.date);
  return c.image
    ? `<img src="/${esc(c.image)}" alt="Certificate: ${esc(c.title)}, issued by ${esc(c.issuer)}" loading="lazy" decoding="async" draggable="false">`
    : `<span class="pp-top"><span>${esc(c.issuer)}</span><span>Record ${n2(i + 1)} / ${n2(total)}</span></span>
       <span class="pp-title">${esc(c.title)}</span>
       <span class="pp-rule"></span>
       <span class="pp-foot"><span>Issued ${d.short}</span>${c.credentialId ? `<span class="id">${esc(c.credentialId)}</span>` : ""}</span>`;
}

/* The archive as a wheel you turn (after crafterui's Works Wheel): at rest the
   records sit in a ring around the label; scrolling blows the ring open into a
   vertical drum with one record flat at the front, and every further stretch of
   scroll carries the next one round. src/activity.js drives it. The plain archive
   below it is what a reader without the script gets. */
function wheel(list) {
  const years = [...new Set(list.map((c) => c.date.slice(2, 4)))].sort();
  const label = `Credentials ’${years.length > 1 ? `${years[0]}–’${years[years.length - 1]}` : years[0]}`;
  const first = list[0], d0 = ym(first.date);
  return `<div class="cxw-track" data-cxw style="--n:${list.length}">
    <div class="cxw-stage">
      <div class="cxw-view" tabindex="0" role="listbox" aria-label="${list.length} credentials. Scroll, or use the arrow keys, to turn; Enter opens the front record." aria-activedescendant="cxw-0">
        <div class="cxw-wheel">
          ${list.map((c, i) => `<button type="button" tabindex="-1" class="cxw-card" id="cxw-${i}" role="option" aria-selected="${i ? "false" : "true"}" data-i="${i}" data-cursor="View" aria-label="${esc(c.title)}, ${esc(c.issuer)}, ${ym(c.date).long}"><span class="cxw-face"><span class="cx-paper${c.image ? " has-img" : ""}">${face(c, i, list.length)}</span></span></button>`).join("")}
        </div>
      </div>
      <div class="cxw-label" aria-hidden="true">${esc(label)}</div>
      <div class="cxw-title">
        <span class="ix" data-cxw="ix">01 / ${n2(list.length)}</span>
        <h3 data-cxw="title">${esc(first.title)}</h3>
        <span class="iss" data-cxw="iss">${esc(first.issuer)} · ${d0.long}</span>
        <span class="acts"><button type="button" class="cxw-open" data-cxw="open">Open record</button><a class="cx-verify" data-cxw="verify" href="${esc(first.verificationUrl || "#")}" rel="noopener" data-cursor="Verify ↗"${first.verificationUrl ? "" : " hidden"}>Verify ↗</a></span>
      </div>
      <ol class="cxw-index" aria-label="All credentials">
        ${list.map((c, i) => `<li><button type="button" data-cxw-to="${i}"${i ? "" : ' class="on"'}>${esc(c.title)}</button></li>`).join("")}
      </ol>
      <p class="cxw-hint" aria-hidden="true">Scroll to turn the wheel</p>
    </div>
  </div>`;
}

function credentials(list) {
  if (!list.length) return "";
  const groups = [];
  list.forEach((c, i) => {
    const g = groups.find((x) => x.date === c.date);
    if (g) g.items.push([c, i]); else groups.push({ date: c.date, items: [[c, i]] });
  });
  const issuers = new Set(list.map((c) => c.issuer)).size;
  const span = `${ym(list[list.length - 1].date).short} – ${ym(list[0].date).short}`;
  return `
  <div class="gx-bridge" aria-hidden="true"><canvas></canvas><span class="b0">What I build</span><span class="b1">What I study</span></div>
  <article id="credentials" class="cx" data-cx-root>
    <header class="cx-head">
      <div class="gx-eyebrow" data-step="0"><span class="n">03.2</span><span class="s">/</span>Credentials</div>
      <h2 data-step="1"><span class="ln"><span>Credentials &amp;</span></span> <span class="ln"><span>continued learning.</span></span></h2>
      <p class="gx-lead" data-step="2">Formal checkpoints along a much larger engineering education.</p>
      <p class="cx-count" data-step="3">${list.length} credentials · ${issuers} issuers · ${span}</p>
    </header>
    ${wheel(list)}
    <div class="cxw-fallback">
      ${groups.map((g) => `<section class="cx-month" id="cx-${g.date}">
        <h3 class="cx-mh"><span>${ym(g.date).long}</span></h3>
        <div class="cx-list">${g.items.map(([c, i]) => record(c, i, list.length)).join("")}</div>
      </section>`).join("")}
    </div>
  </article>`;
}

export function renderActivity({ config, data, certifications }) {
  // what the browser needs to redraw and to open a record; nothing it could not read
  // from the page already
  const payload = {
    username: config.username,
    featured: config.featured.map((f) => f.repo),
    github: data,
    certs: certifications
  };
  const json = JSON.stringify(payload).replace(/</g, "\\u003c");
  return `${github(config, data)}${credentials(certifications)}
  <script type="application/json" id="activity-data">${json}</script>`;
}
