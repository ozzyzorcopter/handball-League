// One-off probe: does Clubee expose JSON we can use instead of scraping HTML?
// Runs from GitHub Actions (clubee.com is not reachable from everywhere).
// Prints a compact report and saves raw samples to probe-output/ (uploaded as
// a workflow artifact) so they can become fixtures for parser tests.
const fs = require("fs");
const path = require("path");

const OUT = "probe-output";
fs.mkdirSync(OUT, { recursive: true });

const LEAGUE = process.env.PROBE_LEAGUE || "19333";
const BASE = "https://www.clubee.com/handballbelgium";
const PAGES = {
  standings: `${BASE}/standings-371073v4/leagues/${LEAGUE}/seasons/0`,
  games:     `${BASE}/games-371075v4/leagues/${LEAGUE}/seasons/0`,
  stats:     `${BASE}/stats-371072v4/leagues/${LEAGUE}/seasons/0`,
};
const HEADERS = { "User-Agent": "Mozilla/5.0 (compatible; LeagueSimProbe/1.0)", "Accept": "text/html,application/json;q=0.9,*/*;q=0.8" };

const log = (...a) => console.log(...a);
const shorten = (s, n = 300) => (s.length > n ? s.slice(0, n) + `…(+${s.length - n})` : s);

async function get(url, extra = {}) {
  try {
    const res = await fetch(url, { headers: { ...HEADERS, ...extra }, redirect: "follow" });
    const text = await res.text();
    return { ok: res.ok, status: res.status, type: res.headers.get("content-type") || "", text, url: res.url };
  } catch (e) {
    return { ok: false, status: 0, type: "", text: "", error: String(e.message || e), url };
  }
}

function describe(value, depth = 0, maxDepth = 3) {
  if (Array.isArray(value)) return `array(${value.length})` + (value.length && depth < maxDepth ? ` of ${describe(value[0], depth + 1, maxDepth)}` : "");
  if (value && typeof value === "object") {
    const keys = Object.keys(value);
    if (depth >= maxDepth) return `{${keys.slice(0, 8).join(",")}${keys.length > 8 ? ",…" : ""}}`;
    return "{" + keys.slice(0, 14).map(k => `${k}: ${describe(value[k], depth + 1, maxDepth)}`).join("; ") + (keys.length > 14 ? "; …" : "") + "}";
  }
  return typeof value;
}

(async () => {
  let buildId = null;
  for (const [name, url] of Object.entries(PAGES)) {
    log(`\n=== ${name}: ${url}`);
    const r = await get(url);
    log(`status ${r.status} · ${r.type} · ${r.text.length} bytes${r.error ? " · ERROR " + r.error : ""}`);
    if (!r.text) continue;
    fs.writeFileSync(path.join(OUT, `${name}.html`), r.text);

    // 1. Next.js payload?
    const nd = r.text.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
    if (nd) {
      try {
        const data = JSON.parse(nd[1]);
        buildId = buildId || data.buildId;
        fs.writeFileSync(path.join(OUT, `${name}.next-data.json`), JSON.stringify(data, null, 1));
        log(`__NEXT_DATA__ FOUND · buildId=${data.buildId} · page=${data.page}`);
        log(`props shape: ${shorten(describe(data.props), 1500)}`);
      } catch (e) { log("__NEXT_DATA__ present but not valid JSON:", e.message); }
    } else log("no __NEXT_DATA__");

    // 2. Other embedded JSON / state blobs
    const blobs = [...r.text.matchAll(/<script[^>]*type="application\/(?:ld\+)?json"[^>]*>([\s\S]*?)<\/script>/g)];
    log(`application/json script tags: ${blobs.length}`);
    const states = [...r.text.matchAll(/window\.(__[A-Z_]+__|__\w+)\s*=/g)].map(m => m[1]);
    if (states.length) log(`window state globals: ${[...new Set(states)].join(", ")}`);

    // 3. API-looking URLs referenced anywhere in the HTML
    const api = [...new Set([...r.text.matchAll(/https?:\/\/[^"'\s<>\\)]*(?:api|graphql|json|\/data\/)[^"'\s<>\\)]*/gi)].map(m => m[0]))];
    log(`API-looking URLs in page (${api.length}):`);
    api.slice(0, 25).forEach(u => log("  " + shorten(u, 200)));
    const scripts = [...new Set([...r.text.matchAll(/<script[^>]+src="([^"]+)"/g)].map(m => m[1]))];
    log(`script src (${scripts.length}): ${scripts.slice(0, 12).map(s => shorten(s, 90)).join(" | ")}`);
  }

  // 4. Next.js data route, if we found a buildId
  if (buildId) {
    log(`\n=== trying _next/data routes with buildId ${buildId}`);
    for (const [name, url] of Object.entries(PAGES)) {
      const p = new URL(url).pathname;
      const dataUrl = `https://www.clubee.com/_next/data/${buildId}${p}.json`;
      const r = await get(dataUrl, { Accept: "application/json" });
      log(`${name}: ${r.status} ${r.type} ${r.text.length} bytes ${dataUrl}`);
      if (r.ok && r.type.includes("json")) {
        fs.writeFileSync(path.join(OUT, `${name}.next-route.json`), r.text);
        try { log(`  shape: ${shorten(describe(JSON.parse(r.text)), 1500)}`); } catch {}
      }
    }
  }

  // 5. Guess at a few common endpoints (cheap; just reports status codes)
  log("\n=== endpoint guesses");
  for (const u of [
    `https://www.clubee.com/api/leagues/${LEAGUE}/standings`,
    `https://www.clubee.com/api/leagues/${LEAGUE}/games`,
    `https://api.clubee.com/leagues/${LEAGUE}`,
    `${PAGES.standings}.json`,
  ]) {
    const r = await get(u, { Accept: "application/json" });
    log(`${r.status} ${r.type.split(";")[0]} ${r.text.length}b  ${u}`);
  }
  log(`\nSamples saved in ${OUT}/`);
})();
