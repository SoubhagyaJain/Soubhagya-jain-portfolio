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
  const face = c.image
    ? `<img src="/${esc(c.image)}" alt="Certificate: ${esc(c.title)}, issued by ${esc(c.issuer)}" loading="lazy" decoding="async">`
    : `<span class="pp-top"><span>${esc(c.issuer)}</span><span>Record ${n2(i + 1)} / ${n2(total)}</span></span>
       <span class="pp-title">${esc(c.title)}</span>
       <span class="pp-rule"></span>
       <span class="pp-foot"><span>Issued ${d.short}</span>${c.credentialId ? `<span class="id">${esc(c.credentialId)}</span>` : ""}</span>`;
  return `<article class="cx-item" data-cx="${i}" style="--i:${i % 3}">
    <button type="button" class="cx-doc${c.image ? " has-img" : ""}" data-cx-open="${i}" aria-haspopup="dialog" data-cursor="View">
      <span class="cx-paper${c.image ? " has-img" : ""}">${face}</span>
      <span class="sr">Open the record for ${esc(c.title)}</span>
    </button>
    <div class="cx-meta">
      <span class="cx-ix">${n2(i + 1)}</span>
      <h4>${esc(c.title)}</h4>
      <span class="cx-iss">${esc(c.issuer)} · ${d.short}</span>
      ${c.verificationUrl ? `<a class="cx-verify" href="${esc(c.verificationUrl)}" rel="noopener" data-cursor="Verify ↗">Verify credential ${ARROW}</a>` : ""}
    </div>
  </article>`;
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
    <div class="cx-body">
      <nav class="cx-rail" aria-label="Credentials by month">
        <span class="cx-now" aria-hidden="true"><span data-cx-now>01</span><span class="of">/ ${n2(list.length)}</span></span>
        <ol>${groups.map((g, k) => `<li><a href="#cx-${g.date}" data-cx-month="${g.date}"${k ? "" : ' aria-current="true"'}><span class="m">${ym(g.date).long}</span><span class="c">${n2(g.items.length)}</span></a></li>`).join("")}</ol>
      </nav>
      <div class="cx-archive">
        ${groups.map((g) => `<section class="cx-month" id="cx-${g.date}" data-cx-group="${g.date}">
          <h3 class="cx-mh"><span>${ym(g.date).long}</span></h3>
          <div class="cx-list">${g.items.map(([c, i]) => record(c, i, list.length)).join("")}</div>
        </section>`).join("")}
      </div>
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
