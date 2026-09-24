/* GitHub, read once and normalised. Shared by build.mjs (which bakes a copy into the
   page) and api/github.js (which the page asks for fresher data, behind a CDN cache).
   Nothing here runs in the browser, so GITHUB_TOKEN never leaves the server.

   Without a token everything still works: the REST calls are unauthenticated (60 an
   hour per IP, which a six-hour CDN cache never approaches) and the contribution
   calendar is read from the public profile's own calendar markup. With a token the
   calendar and pinned repositories come from GraphQL instead, which is exact. */

const UA = "soubhagya-jain-portfolio";
const API = "https://api.github.com";

const withTimeout = (ms) => {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(new Error(`timed out after ${ms}ms`)), ms);
  return { signal: c.signal, done: () => clearTimeout(t) };
};

async function get(url, { token, accept = "application/vnd.github+json", ms = 8000, text = false } = {}) {
  const { signal, done } = withTimeout(ms);
  try {
    const headers = { "User-Agent": UA, Accept: accept };
    if (token && url.startsWith(API)) headers.Authorization = `Bearer ${token}`;
    const r = await fetch(url, { headers, signal });
    if (!r.ok) {
      const limited = r.status === 403 || r.status === 429;
      const e = new Error(`${url} -> ${r.status}${limited ? " (rate limited)" : ""}`);
      e.status = r.status;
      e.rateLimited = limited && r.headers.get("x-ratelimit-remaining") === "0";
      throw e;
    }
    return text ? r.text() : r.json();
  } finally { done(); }
}

const LEVELS = { NONE: 0, FIRST_QUARTILE: 1, SECOND_QUARTILE: 2, THIRD_QUARTILE: 3, FOURTH_QUARTILE: 4 };

async function graphql(login, token) {
  const query = `query($login: String!) { user(login: $login) {
    contributionsCollection { contributionCalendar { totalContributions
      weeks { contributionDays { date contributionCount contributionLevel } } } }
    pinnedItems(first: 6, types: REPOSITORY) { nodes { ... on Repository { name } } } } }`;
  const { signal, done } = withTimeout(9000);
  try {
    const r = await fetch(`${API}/graphql`, {
      method: "POST", signal,
      headers: { "User-Agent": UA, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query, variables: { login } })
    });
    if (!r.ok) throw new Error(`graphql -> ${r.status}`);
    const j = await r.json();
    if (j.errors) throw new Error(`graphql -> ${j.errors[0].message}`);
    const u = j.data.user;
    const days = u.contributionsCollection.contributionCalendar.weeks
      .flatMap((w) => w.contributionDays)
      .map((d) => ({ date: d.date, count: d.contributionCount, level: LEVELS[d.contributionLevel] ?? 0 }));
    return { calendar: { days, exact: true }, pinned: u.pinnedItems.nodes.map((n) => n.name) };
  } finally { done(); }
}

/* The public calendar: one <td data-date data-level id> per day, and a <tool-tip for=id>
   carrying the count as text ("No contributions on…", "1 contribution on…",
   "12 contributions on…"). Attribute order is not relied on. */
export function parseCalendarHtml(html) {
  const byId = new Map();
  for (const m of html.matchAll(/<td\b[^>]*>/g)) {
    const tag = m[0];
    const date = /data-date="(\d{4}-\d{2}-\d{2})"/.exec(tag);
    if (!date) continue;
    const id = /\bid="([^"]+)"/.exec(tag);
    const level = /data-level="(\d)"/.exec(tag);
    byId.set(id ? id[1] : date[1], { date: date[1], level: level ? +level[1] : 0, count: null });
  }
  for (const m of html.matchAll(/<tool-tip\b[^>]*\bfor="([^"]+)"[^>]*>([^<]*)<\/tool-tip>/g)) {
    const day = byId.get(m[1]);
    if (!day) continue;
    const n = /([\d,]+)\s+contributions?/i.exec(m[2]);
    day.count = n ? +n[1].replace(/,/g, "") : 0;
  }
  const days = [...byId.values()].sort((a, b) => (a.date < b.date ? -1 : 1));
  if (days.length < 300) throw new Error(`calendar markup not recognised (${days.length} days)`);
  // Counts come from the tooltips; if GitHub ever drops them, keep the levels and say so
  // rather than invent numbers.
  const exact = days.every((d) => d.count !== null);
  if (!exact) days.forEach((d) => { d.count = null; });
  return { days, exact };
}

const EVENT = {
  PushEvent: (e) => {
    const n = e.payload.size ?? (e.payload.commits || []).length;
    return n ? `Pushed ${n} commit${n === 1 ? "" : "s"}` : "Pushed";
  },
  CreateEvent: (e) => e.payload.ref_type === "repository" ? "Created repository" : `Created ${e.payload.ref_type}`,
  PullRequestEvent: (e) => `${e.payload.action === "closed" && e.payload.pull_request?.merged ? "Merged" : cap(e.payload.action)} pull request`,
  IssuesEvent: (e) => `${cap(e.payload.action)} an issue`,
  ReleaseEvent: () => "Published a release",
  PublicEvent: () => "Made public",
  WatchEvent: () => "Starred"
};
const cap = (s = "") => s.charAt(0).toUpperCase() + s.slice(1);

export async function fetchGitHub(login, { token = "" } = {}) {
  try { return await read(login, token); }
  catch (e) {
    // a revoked or mistyped token should cost precision, not the data
    if (token && e.status === 401) return read(login, "");
    throw e;
  }
}

async function read(login, token) {
  const [user, repos, events] = await Promise.all([
    get(`${API}/users/${login}`, { token }),
    get(`${API}/users/${login}/repos?per_page=100&type=owner&sort=pushed`, { token }),
    get(`${API}/users/${login}/events/public?per_page=60`, { token }).catch(() => [])
  ]);

  let calendar = null, pinned = [];
  if (token) {
    try { ({ calendar, pinned } = await graphql(login, token)); } catch (e) { /* fall through */ }
  }
  if (!calendar) {
    try {
      const html = await get(`https://github.com/users/${login}/contributions`, { accept: "text/html", text: true });
      calendar = parseCalendarHtml(html);
    } catch (e) { calendar = null; }
  }

  const own = repos.filter((r) => !r.fork && !r.private);
  return {
    fetchedAt: new Date().toISOString(),
    source: "live",
    user: {
      login: user.login, name: user.name || user.login, avatar: user.avatar_url, bio: user.bio || "",
      followers: user.followers, following: user.following, publicRepos: user.public_repos,
      location: user.location || "", url: user.html_url, createdAt: user.created_at
    },
    repos: own.map((r) => ({
      name: r.name, url: r.html_url, description: r.description || "", language: r.language,
      stars: r.stargazers_count, forks: r.forks_count, pushedAt: r.pushed_at, homepage: r.homepage || ""
    })),
    pinned,
    calendar,
    events: (Array.isArray(events) ? events : [])
      .filter((e) => EVENT[e.type] && !(e.type === "WatchEvent"))
      .slice(0, 8)
      .map((e) => ({ what: EVENT[e.type](e), repo: e.repo.name.split("/")[1], url: `https://github.com/${e.repo.name}`, at: e.created_at }))
  };
}

/* Everything the page shows that is derived rather than read: computed in one place so
   the build, the API and the browser can never disagree about a number. */
export function derive(data) {
  const days = data.calendar ? data.calendar.days : [];
  const exact = !!(data.calendar && data.calendar.exact);
  const langs = new Map();
  for (const r of data.repos) if (r.language) langs.set(r.language, (langs.get(r.language) || 0) + 1);
  const languages = [...langs].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
  return {
    contributions: exact ? days.reduce((s, d) => s + d.count, 0) : null,
    activeDays: days.length ? days.filter((d) => (exact ? d.count > 0 : d.level > 0)).length : null,
    stars: data.repos.reduce((s, r) => s + (r.stars || 0), 0),
    repositories: data.user.publicRepos,
    languages,
    languageRepos: languages.reduce((s, l) => s + l.count, 0)
  };
}
