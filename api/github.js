/* GET /api/github — the page's source of fresh GitHub data.

   browser -> this function -> GitHub, and the CDN in front of it answers almost every
   request: s-maxage keeps one copy for six hours, stale-while-revalidate serves that
   copy for a day while a single background request refreshes it. GitHub sees a few
   requests a day however many people visit. GITHUB_TOKEN, if set, stays here. */
import { readFileSync } from "node:fs";
import { fetchGitHub } from "../src/github.mjs";

const config = JSON.parse(readFileSync(new URL("../content/github.json", import.meta.url), "utf8"));

export default async function handler(req, res) {
  try {
    const data = await fetchGitHub(config.username, { token: process.env.GITHUB_TOKEN || "" });
    res.setHeader("Cache-Control", "public, s-maxage=21600, stale-while-revalidate=86400");
    res.status(200).json(data);
  } catch (e) {
    // A short cache on failure, so a rate limit is not hammered by every visitor; the
    // page keeps the copy it was built with and says nothing is wrong, because nothing is.
    res.setHeader("Cache-Control", "public, s-maxage=300");
    res.status(e.rateLimited ? 429 : 502).json({ error: e.rateLimited ? "rate-limited" : "unavailable" });
  }
}
