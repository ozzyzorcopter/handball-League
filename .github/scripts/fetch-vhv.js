// .github/scripts/fetch-vhv.js
// Fetches live VHV/KBHB handball data via Playwright.
// Writes vhv-data.json grouped by federation. Does NOT touch leaguesim-data.json.
//
// API response shape (confirmed from diagnose-output.json):
//   ranking: { elements: [...], total: N }
//     entry fields: team_name, team_short_name, position, played, wins, losses,
//                   draws, score_for, score_against, points, team_id
//   games: { elements: [...], total: N }
//     entry fields: home_team_name, home_team_short_name, away_team_name,
//                   away_team_short_name, home_score, away_score,
//                   round (match round 1-N), week (calendar week),
//                   date, time, game_status_id (2=validated), serie_name

const { chromium } = require("playwright-core");
const fs   = require("fs");
const path = require("path");

const root        = process.cwd();
const vhvDataPath = path.join(root, "vhv-data.json");

// ── LEAGUE CONFIG ─────────────────────────────────────────────────────────────
// serie_ids confirmed from competition URLs.
// seasonId is NOT hardcoded — it is auto-detected from the page each run.
// name will be auto-detected from serie_name in the API response.
// organizationId: 1=URBH-KBHB, 2=VHV, 3=LFH
//
// scorerUrl (optional): URL to the nuLiga/nuscore "topscorers" HTML page for
// this serie. Used by fetch-scorers.js to populate scorer-data.json under
// leagueId="vhv:<serieId>". Leave empty/omit if not available.
const VHV_LEAGUES = [
  // ── VHV ────────────────────────────────────────────────────────────────
  { serieId: 650, organizationId: 2, federation: "VHV", scorerUrl: "",
    pageUrl: "https://www.handballbelgium.be/index.php/competition/vhv-competitions/" },
  { serieId: 651, organizationId: 2, federation: "VHV", scorerUrl: "",
    pageUrl: "https://www.handballbelgium.be/index.php/competition/vhv-competitions/" },
  { serieId: 652, organizationId: 2, federation: "VHV", scorerUrl: "",
    pageUrl: "https://www.handballbelgium.be/index.php/competition/vhv-competitions/" },
  { serieId: 653, organizationId: 2, federation: "VHV", scorerUrl: "",
    pageUrl: "https://www.handballbelgium.be/index.php/competition/vhv-competitions/" },
  { serieId: 654, organizationId: 2, federation: "VHV", scorerUrl: "",
    pageUrl: "https://www.handballbelgium.be/index.php/competition/vhv-competitions/" },
  { serieId: 655, organizationId: 2, federation: "VHV", scorerUrl: "",
    pageUrl: "https://www.handballbelgium.be/index.php/competition/vhv-competitions/" },
  { serieId: 656, organizationId: 2, federation: "VHV", scorerUrl: "",
    pageUrl: "https://www.handballbelgium.be/index.php/competition/vhv-competitions/" },

  // ── URBH-KBHB ──────────────────────────────────────────────────────────
  { serieId: 645, organizationId: 1, federation: "URBH-KBHB", scorerUrl: "",
    pageUrl: "https://www.handballbelgium.be/index.php/competition/urbh-kbhb-competitions/" },
  { serieId: 646, organizationId: 1, federation: "URBH-KBHB", scorerUrl: "",
    pageUrl: "https://www.handballbelgium.be/index.php/competition/urbh-kbhb-competitions/" },
  { serieId: 647, organizationId: 1, federation: "URBH-KBHB", scorerUrl: "",
    pageUrl: "https://www.handballbelgium.be/index.php/competition/urbh-kbhb-competitions/" },
  { serieId: 649, organizationId: 1, federation: "URBH-KBHB", scorerUrl: "",
    pageUrl: "https://www.handballbelgium.be/index.php/competition/urbh-kbhb-competitions/" },
  { serieId: 868, organizationId: 1, federation: "URBH-KBHB", scorerUrl: "",
    pageUrl: "https://www.handballbelgium.be/index.php/competition/urbh-kbhb-competitions/" },
  { serieId: 869, organizationId: 1, federation: "URBH-KBHB", scorerUrl: "",
    pageUrl: "https://www.handballbelgium.be/index.php/competition/urbh-kbhb-competitions/" },
  { serieId: 870, organizationId: 1, federation: "URBH-KBHB", scorerUrl: "",
    pageUrl: "https://www.handballbelgium.be/index.php/competition/urbh-kbhb-competitions/" },
  { serieId: 872, organizationId: 1, federation: "URBH-KBHB", scorerUrl: "",
    pageUrl: "https://www.handballbelgium.be/index.php/competition/urbh-kbhb-competitions/" },
  { serieId: 873, organizationId: 1, federation: "URBH-KBHB", scorerUrl: "",
    pageUrl: "https://www.handballbelgium.be/index.php/competition/urbh-kbhb-competitions/" },
  { serieId: 874, organizationId: 1, federation: "URBH-KBHB", scorerUrl: "",
    pageUrl: "https://www.handballbelgium.be/index.php/competition/urbh-kbhb-competitions/" },
  { serieId: 878, organizationId: 1, federation: "URBH-KBHB", scorerUrl: "",
    pageUrl: "https://www.handballbelgium.be/index.php/competition/urbh-kbhb-competitions/" },
];

// Export so fetch-scorers.js can read this config without duplicating it
module.exports = { VHV_LEAGUES };

const BASE_URL = "https://www.handballbelgium.be/index.php/wp-json/bpleagues/v1/proxy";

function log(msg)  { console.log(`[fetch-vhv] ${msg}`); }
function warn(msg) { console.warn(`[fetch-vhv] ⚠ ${msg}`); }

// ── NONCE EXTRACTION ──────────────────────────────────────────────────────────
async function extractNonce(page) {
  return page.evaluate(() => {
    if (window.bpleagues?.nonce) return window.bpleagues.nonce;
    if (window.wpApiSettings?.nonce) return window.wpApiSettings.nonce;
    for (const s of document.querySelectorAll("script:not([src])")) {
      const m  = s.textContent.match(/"nonce"\s*:\s*"([a-f0-9]{10,})"/);  if (m)  return m[1];
      const m2 = s.textContent.match(/nonce['":\s]+['"]([a-f0-9]{10,})['"]/); if (m2) return m2[1];
    }
    return null;
  });
}

// Detect current season_id from the page — reads the selected option in the
// season dropdown, or falls back to extracting it from the current page URL.
async function detectSeasonId(page) {
  return page.evaluate(() => {
    // Option 1: season select dropdown (most reliable)
    const sel = document.querySelector('select[name="season_id"], select#season_id, select[name*="season"]');
    if (sel?.value) return Number(sel.value) || null;

    // Option 2: read from bpleagues window object
    if (window.bpleagues?.season_id) return Number(window.bpleagues.season_id);

    // Option 3: extract from current URL
    const m = window.location.search.match(/season_id=(\d+)/);
    if (m) return Number(m[1]);

    // Option 4: scan inline scripts for season_id
    for (const s of document.querySelectorAll("script:not([src])")) {
      const m2 = s.textContent.match(/"season_id"\s*:\s*(\d+)/);
      if (m2) return Number(m2[1]);
      const m3 = s.textContent.match(/season_id['":\s]+(\d+)/);
      if (m3) return Number(m3[1]);
    }
    return null;
  });
}
async function loadPageAndGetNonce(page, url) {
  log(`  Loading page…`);
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
  // Wait up to 5s for nonce to appear in DOM (injected by inline script)
  let nonce = null;
  for (let i = 0; i < 10; i++) {
    nonce = await extractNonce(page);
    if (nonce) break;
    await page.waitForTimeout(500);
  }
  // Fallback: intercept network requests for nonce header
  if (!nonce) {
    warn("  Nonce not in DOM — intercepting network requests");
    let intercepted = null;
    const handler = req => { const h = req.headers(); if (h["x-wp-nonce"]) intercepted = h["x-wp-nonce"]; };
    page.on("request", handler);
    // Trigger a fetch from within the page to any bpleagues endpoint
    await page.evaluate(async () => {
      try {
        await fetch("/index.php/wp-json/bpleagues/v1/proxy?_path=ping", { credentials: "include" });
      } catch {}
    });
    await page.waitForTimeout(2000);
    page.off("request", handler);
    nonce = intercepted;
  }
  return nonce;
}

// ── DATA PARSING ──────────────────────────────────────────────────────────────
// Both ranking and games are wrapped: { elements: [...], total: N }
function getElements(resp) {
  if (Array.isArray(resp)) return resp;
  if (Array.isArray(resp?.elements)) return resp.elements;
  // Fallback: find any array value
  if (resp && typeof resp === "object") {
    const found = Object.values(resp).find(v => Array.isArray(v));
    if (found) return found;
  }
  return [];
}

function buildTeams(rankingElements) {
  // Sort by position ascending
  const sorted = [...rankingElements].sort((a, b) => (a.position || 0) - (b.position || 0));
  return sorted.map(r => ({
    id:        `t${r.team_id}`,
    name:      r.team_short_name || r.team_name,
    points:    0,
    homeBonus: "",
  }));
}

function buildRanking(rankingElements) {
  const sorted = [...rankingElements].sort((a, b) => (a.position || 0) - (b.position || 0));
  return sorted.map(r => ({
    pos:    r.position,
    name:   r.team_short_name || r.team_name,
    played: r.played       || 0,
    won:    r.wins         || 0,
    drawn:  r.draws        || 0,
    lost:   r.losses       || 0,
    gf:     r.score_for    || 0,
    ga:     r.score_against || 0,
    points: r.points       || 0,
  }));
}

function buildFixtures(gameElements, teams) {
  // Build lookup: short_name → index, full_name → index
  const nameToIdx = new Map();
  teams.forEach((t, i) => {
    nameToIdx.set(t.name.toLowerCase(), i);
  });

  // Also index by team_id via ranking — but we only have short_name in games
  // Use short_name first, fall back to full name
  function resolve(shortName, fullName) {
    const s = shortName?.toLowerCase();
    const f = fullName?.toLowerCase();
    if (s && nameToIdx.has(s)) return nameToIdx.get(s);
    if (f && nameToIdx.has(f)) return nameToIdx.get(f);
    // Partial match fallback
    if (s) {
      for (const [k, v] of nameToIdx) {
        if (k.includes(s) || s.includes(k)) return v;
      }
    }
    return -1;
  }

  let counter = 0;
  const fixtures = [];
  const unmatched = new Set();

  for (const g of gameElements) {
    const homeIdx = resolve(g.home_team_short_name, g.home_team_name);
    const awayIdx = resolve(g.away_team_short_name, g.away_team_name);

    if (homeIdx < 0) { unmatched.add(g.home_team_short_name || g.home_team_name); continue; }
    if (awayIdx < 0) { unmatched.add(g.away_team_short_name || g.away_team_name); continue; }

    // game_status_id=2 means validated/played. score_status_id=2 means score confirmed.
    // A game is "played" if it has a game_status_id of 2 AND scores are present.
    const played = g.game_status_id === 2
      && g.home_score != null && g.away_score != null;

    fixtures.push({
      id:        `f${counter++}`,
      homeIdx,
      awayIdx,
      homeWin:   50,
      draw:      6,
      awayWin:   44,
      overrideOn: false,
      ovHW: "", ovD: "", ovAW: "",
      played,
      homeScore: played ? Number(g.home_score) : null,
      awayScore: played ? Number(g.away_score) : null,
      week:      Number(g.round),   // round = match round (1-N), not calendar week
      date:      g.date || null,
    });
  }

  if (unmatched.size > 0) {
    warn(`  Unmatched team names: ${[...unmatched].join(", ")}`);
    warn(`  Known team names: ${teams.map(t => t.name).join(", ")}`);
  }

  // Sort by round then date
  fixtures.sort((a, b) => (a.week || 0) - (b.week || 0) || (a.date || "").localeCompare(b.date || ""));
  return fixtures;
}

// ── MAIN ──────────────────────────────────────────────────────────────────────
async function main() {
  log(`Starting at ${new Date().toUTCString()}`);
  log(`${VHV_LEAGUES.length} league(s) configured`);

  // Load existing vhv-data to preserve leagues not being re-fetched
  let existing = { updatedAt: null, federations: {} };
  if (fs.existsSync(vhvDataPath)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(vhvDataPath, "utf8"));
      existing = { updatedAt: parsed.updatedAt || null, federations: parsed.federations || {} };
    } catch { warn("Could not parse existing vhv-data.json — starting fresh"); }
  }

  const browser = await chromium.launch({ headless: true });
  const results  = [];

  // Group leagues by federation base URL — one page load per federation
  const pageGroups = new Map();
  for (const cfg of VHV_LEAGUES) {
    const baseUrl = cfg.pageUrl.split("?")[0];
    if (!pageGroups.has(baseUrl)) pageGroups.set(baseUrl, []);
    pageGroups.get(baseUrl).push(cfg);
  }

  for (const [, leagues] of pageGroups) {
    const firstCfg = leagues[0];
    const context = await browser.newContext({
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:151.0) Gecko/20100101 Firefox/151.0",
    });
    const page = await context.newPage();

    log(`\nLoading ${firstCfg.federation} page (${leagues.length} leagues)…`);
    let nonce;
    let seasonId;
    try {
      nonce = await loadPageAndGetNonce(page, firstCfg.pageUrl);
      if (!nonce) throw new Error("Could not extract nonce from page");
      log(`  Nonce: ${nonce}`);

      // Detect current season_id from the page
      seasonId = await detectSeasonId(page);
      if (seasonId) {
        log(`  Season ID: ${seasonId} (auto-detected)`);
      } else {
        // Fallback: try loading with serie_id to trigger season detection
        const probeUrl = `${firstCfg.pageUrl}?serie_id=${firstCfg.serieId}`;
        await page.goto(probeUrl, { waitUntil: "domcontentloaded", timeout: 15000 }).catch(() => {});
        seasonId = await detectSeasonId(page);
        if (seasonId) {
          log(`  Season ID: ${seasonId} (detected from serie URL)`);
        } else {
          // Last resort: extract from the games API response below per league
          log(`  Season ID: could not auto-detect — will read from API response`);
        }
      }
    } catch (err) {
      console.error(`  ✗ Failed to load ${firstCfg.federation} page: ${err.message}`);
      for (const cfg of leagues) results.push({ serieId: cfg.serieId, ok: false, error: err.message });
      await context.close();
      continue;
    }

    const fetchJson = (url) => page.evaluate(async ({ url, nonce }) => {
      const r = await fetch(url, {
        headers: { Accept: "application/json", "X-WP-Nonce": nonce },
        credentials: "include",
      });
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    }, { url, nonce });

    for (const cfg of leagues) {
      log(`\n  Serie ${cfg.serieId}`);
      try {
        // Build URLs — use detected seasonId, or omit it and let the API use its default
        const rankingUrl = `${BASE_URL}?serie_id=${cfg.serieId}&_path=ranking/byMyLeague`;
        const gamesUrl   = seasonId
          ? `${BASE_URL}?with_referees=true&no_forfeit=true&season_id=${seasonId}&without_in_preparation=true&sort[0]=date&sort[1]=time&serie_id=${cfg.serieId}&_path=game/byMyLeague`
          : `${BASE_URL}?with_referees=true&no_forfeit=true&without_in_preparation=true&sort[0]=date&sort[1]=time&serie_id=${cfg.serieId}&_path=game/byMyLeague`;

        const [rankingData, gamesData] = await Promise.all([
          fetchJson(rankingUrl),
          fetchJson(gamesUrl),
        ]);

        const rankingElements = getElements(rankingData);
        const gameElements    = getElements(gamesData);

        // If we didn't detect seasonId yet, try reading it from a game entry
        if (!seasonId && gameElements.length > 0 && gameElements[0].season_id) {
          seasonId = gameElements[0].season_id;
          log(`    Season ID: ${seasonId} (read from game entry)`);
        }

        if (rankingElements.length === 0 && gameElements.length === 0) {
          throw new Error("Empty response — serie may not exist or have no data for this season");
        }

        const serieName = gameElements[0]?.serie_name
          || gameElements[0]?.serie_short_name
          || rankingElements[0]?.serie_name
          || `Serie ${cfg.serieId}`;

        log(`    "${serieName}" · ${rankingElements.length} teams · ${gameElements.length} games`);

        const teams    = buildTeams(rankingElements);
        const ranking  = buildRanking(rankingElements);
        const fixtures = buildFixtures(gameElements, teams);

        const played  = fixtures.filter(f => f.played).length;
        const pending = fixtures.filter(f => !f.played).length;
        log(`    Fixtures: ${fixtures.length} (${played} played, ${pending} pending)`);
        log(`    Teams: ${teams.map(t => t.name).join(", ")}`);

        if (!existing.federations[cfg.federation]) existing.federations[cfg.federation] = {};
        existing.federations[cfg.federation][String(cfg.serieId)] = {
          serieId:    cfg.serieId,
          name:       serieName,
          federation: cfg.federation,
          updatedAt:  new Date().toISOString(),
          live:       pending > 0,
          teams,
          fixtures,
          ranking,
        };

        results.push({ serieId: cfg.serieId, name: serieName, ok: true, played, pending });

      } catch (err) {
        console.error(`    ✗ FAILED: ${err.message}`);
        results.push({ serieId: cfg.serieId, ok: false, error: err.message });
      }
    }

    await context.close();
  }

  await browser.close();

  existing.updatedAt = new Date().toISOString();
  fs.writeFileSync(vhvDataPath, JSON.stringify(existing, null, 2));

  const ok  = results.filter(r => r.ok).length;
  const bad = results.filter(r => !r.ok).length;
  log(`\nDone — ${ok}/${results.length} succeeded`);
  results.filter(r => r.ok).forEach(r => log(`  ✓ ${r.name} (${r.played} played, ${r.pending} pending)`));
  results.filter(r => !r.ok).forEach(r => log(`  ✗ serie ${r.serieId}: ${r.error}`));
  if (bad > 0 && bad === results.length) process.exit(1);
}

if (require.main === module) {
  main().catch(err => { console.error(err); process.exit(1); });
}
