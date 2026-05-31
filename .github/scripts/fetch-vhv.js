// .github/scripts/fetch-vhv.js
// Uses Playwright to load the VHV competition page, extract the nonce,
// then fetch both game and ranking API endpoints.
// Writes vhv-data.json (raw data) and merges into leaguesim-data.json.

const { chromium } = require("playwright-core");
const fs = require("fs");
const path = require("path");

const root = process.cwd();
const vhvDataPath = path.join(root, "vhv-data.json");
const leaguesimPath = path.join(root, "leaguesim-data.json");

// ── LEAGUE CONFIG ─────────────────────────────────────────────────────────────
// Add or remove leagues here. Each entry maps a VHV serie_id to a league in
// leaguesim-data.json (matched by name). The page URL is only used to load the
// page and extract the nonce — the actual data comes from the API endpoints.
const VHV_LEAGUES = [
  {
    serieId: 652,
    seasonId: 5,
    organizationId: 2,
    leaguesimName: "VHV Liga 3",      // must match the "name" field in leaguesim-data.json
    pageUrl: "https://www.handballbelgium.be/index.php/competition/vhv-competitions/?season_id=5&organization_id=2&serie_id=652",
  },
  // Add more leagues here, e.g.:
  // {
  //   serieId: 653,
  //   seasonId: 5,
  //   organizationId: 2,
  //   leaguesimName: "VHV Liga 2",
  //   pageUrl: "https://www.handballbelgium.be/index.php/competition/vhv-competitions/?season_id=5&organization_id=2&serie_id=653",
  // },
];

const BASE_URL = "https://www.handballbelgium.be/index.php/wp-json/bpleagues/v1/proxy";

// ── UTILS ─────────────────────────────────────────────────────────────────────
function log(msg) { console.log(`[fetch-vhv] ${msg}`); }
function warn(msg) { console.warn(`[fetch-vhv] ⚠ ${msg}`); }

// Extract nonce from page source — the bpleagues WP plugin embeds it as
// window.bpleagues = { nonce: "xxxx" } or wp_localize_script style JSON.
// We try several known patterns.
async function extractNonce(page) {
  return await page.evaluate(() => {
    // Pattern 1: window.bpleagues.nonce
    if (window.bpleagues && window.bpleagues.nonce) return window.bpleagues.nonce;
    // Pattern 2: wpApiSettings.nonce
    if (window.wpApiSettings && window.wpApiSettings.nonce) return window.wpApiSettings.nonce;
    // Pattern 3: search all inline scripts for a nonce value near "bpleagues" or "wp-nonce"
    const scripts = Array.from(document.querySelectorAll("script:not([src])")).map(s => s.textContent);
    for (const src of scripts) {
      // "nonce":"xxxxxxxxxx"
      const m = src.match(/"nonce"\s*:\s*"([a-f0-9]{10,})"/);
      if (m) return m[1];
      // nonce: 'xxxxxxxxxx'
      const m2 = src.match(/nonce['":\s]+['"]([a-f0-9]{10,})['"]/);
      if (m2) return m2[1];
    }
    return null;
  });
}

// Fetch JSON from the WP proxy with nonce auth
async function fetchApi(url, nonce, cookies) {
  const res = await fetch(url, {
    headers: {
      "Accept": "application/json, text/plain, */*",
      "X-WP-Nonce": nonce,
      "Referer": "https://www.handballbelgium.be/index.php/competition/vhv-competitions/",
      "Cookie": cookies,
    },
    credentials: "omit",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
}

// ── DATA MAPPING ──────────────────────────────────────────────────────────────
// Map VHV ranking entry to a leaguesim team object
function rankingToTeam(r, idx) {
  const name = r.team?.name || r.team_name || r.name || `Team ${idx + 1}`;
  return {
    id: `vhv_t${r.team?.id || idx}`,
    name,
    points: 0,       // starting pts — actual pts come from fixtures
    homeBonus: "",
  };
}

// Build team name → index map
function buildTeamIndex(teams) {
  const m = {};
  teams.forEach((t, i) => { m[t.name] = i; });
  return m;
}

// Parse a game object from the API into a leaguesim fixture.
// Returns null if teams can't be resolved.
function gameToFixture(g, teamIndex, settings, fixtureId) {
  const homeName = g.home_team?.name || g.home?.name || g.team_home;
  const awayName = g.away_team?.name || g.away?.name || g.team_away;
  if (!homeName || !awayName) return null;

  const homeIdx = teamIndex[homeName];
  const awayIdx = teamIndex[awayName];
  if (homeIdx == null || awayIdx == null) {
    warn(`Could not resolve teams: "${homeName}" vs "${awayName}"`);
    return null;
  }

  const sh = g.score_home ?? g.home_score ?? g.result?.home ?? null;
  const sa = g.score_away ?? g.away_score ?? g.result?.away ?? null;
  const played = sh != null && sa != null && sh !== "" && sa !== "";

  // Week: derive from round number if available, else from date order
  const week = g.round_number ?? g.round ?? g.week ?? null;

  // Date string for sorting/display
  const date = g.date || g.game_date || g.datetime || null;

  return {
    id: fixtureId,
    homeIdx,
    awayIdx,
    homeWin: 50,   // probabilities recalculated by the app at runtime
    draw: 6,
    awayWin: 44,
    overrideOn: false,
    ovHW: "",
    ovD: "",
    ovAW: "",
    played,
    homeScore: played ? Number(sh) : null,
    awayScore: played ? Number(sa) : null,
    week: week != null ? Number(week) : null,
    date,           // stored for reference; not used by leaguesim core
  };
}

// Re-number week values to be sequential integers 1..N based on date order,
// in case the VHV API gives inconsistent round numbers.
function normalizeWeeks(fixtures) {
  // Sort by date then by existing week number
  const sorted = [...fixtures].sort((a, b) => {
    if (a.date && b.date) return a.date.localeCompare(b.date);
    return (a.week ?? 9999) - (b.week ?? 9999);
  });

  // Group by original week/date, assign sequential week numbers
  const groups = [];
  let lastKey = null;
  for (const f of sorted) {
    const key = f.week != null ? `w${f.week}` : (f.date ? f.date.slice(0, 10) : null);
    if (key !== lastKey) { groups.push([]); lastKey = key; }
    groups[groups.length - 1].push(f);
  }

  const weekMap = new Map();
  const fixtureMap = new Map(fixtures.map(f => [f.id, f]));
  groups.forEach((group, i) => {
    const weekNum = i + 1;
    group.forEach(f => { weekMap.set(f.id, weekNum); });
  });

  return fixtures.map(f => ({ ...f, week: weekMap.get(f.id) ?? f.week }));
}

// ── LEAGUESIM MERGE ──────────────────────────────────────────────────────────
// Merges fetched VHV data into an existing league in leaguesim-data.json,
// or creates a new league if it doesn't exist yet.
// Strategy: preserve all settings, scorer URLs, etc. Only update teams +
// fixtures + live status. Existing played scores are NOT overwritten unless
// the API also has them (API is source of truth for scores).
function mergeIntoLeaguesim(leaguesimData, leaguesimName, teams, fixtures) {
  const leagues = leaguesimData.leagues || [];
  const idx = leagues.findIndex(lg => lg.name === leaguesimName);

  const isNew = idx === -1;
  const base = isNew
    ? {
        id: String(Date.now()),
        name: leaguesimName,
        type: "standard",
        teams: [],
        fixtures: [],
        step: 2,           // skip setup — go straight to sim view
        settings: { baseWin: 47, baseDraw: 6, homeBonus: 10, rankBonus: 3, winScore: 30, lossScore: 25, drawScore: 25 },
        playoffs: null,
        playdowns: null,
        poSize: 6,
        pdSize: 4,
        phaseFormat: "round-robin",
        promoTop: 2,
        demotBot: 2,
        archivable: true,
        scorerUrl: "",
        playoffScorerUrl: "",
        playdownScorerUrl: "",
        scorerAliases: {},
        vhvLive: true,
      }
    : { ...leagues[idx], vhvLive: true };

  // Determine if there are still unplayed fixtures → live tag
  const hasUnplayed = fixtures.some(f => !f.played);
  const updated = { ...base, teams, fixtures, vhvLive: hasUnplayed };

  if (isNew) {
    log(`  Creating new league: "${leaguesimName}"`);
    return { ...leaguesimData, leagues: [...leagues, updated] };
  } else {
    log(`  Updating existing league: "${leaguesimName}"`);
    const newLeagues = leagues.map((lg, i) => i === idx ? updated : lg);
    return { ...leaguesimData, leagues: newLeagues };
  }
}

// ── MAIN ──────────────────────────────────────────────────────────────────────
async function main() {
  log(`Starting at ${new Date().toUTCString()}`);
  log(`${VHV_LEAGUES.length} league(s) configured`);

  const browser = await chromium.launch({ headless: true });
  const vhvResults = [];

  // Load leaguesim data (create empty if missing)
  let leaguesimData = { leagues: [] };
  if (fs.existsSync(leaguesimPath)) {
    leaguesimData = JSON.parse(fs.readFileSync(leaguesimPath, "utf8"));
    log(`Loaded leaguesim-data.json (${(leaguesimData.leagues || []).length} existing leagues)`);
  } else {
    log("leaguesim-data.json not found — will create it");
  }

  for (const cfg of VHV_LEAGUES) {
    log(`\nProcessing: ${cfg.leaguesimName} (serie ${cfg.serieId})`);

    const context = await browser.newContext({
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:151.0) Gecko/20100101 Firefox/151.0",
    });
    const page = await context.newPage();

    let nonce = null;
    let cookieStr = "";

    try {
      // Load the competition page to get a fresh nonce + session cookies
      log(`  Loading page: ${cfg.pageUrl}`);
      await page.goto(cfg.pageUrl, { waitUntil: "networkidle", timeout: 30000 });

      nonce = await extractNonce(page);
      if (!nonce) {
        // Fallback: intercept the actual XHR and grab nonce from its request headers
        warn("  Could not find nonce in DOM — trying network interception fallback");
      } else {
        log(`  Nonce: ${nonce}`);
      }

      // Extract cookies for the API call
      const cookies = await context.cookies();
      cookieStr = cookies.map(c => `${c.name}=${c.value}`).join("; ");

      // If no nonce from DOM, try intercepting network requests
      if (!nonce) {
        // Re-navigate with network interception
        let interceptedNonce = null;
        page.on("request", req => {
          const h = req.headers();
          if (h["x-wp-nonce"]) interceptedNonce = h["x-wp-nonce"];
        });
        await page.reload({ waitUntil: "networkidle", timeout: 30000 });
        nonce = interceptedNonce;
        if (nonce) {
          log(`  Nonce (intercepted): ${nonce}`);
        } else {
          throw new Error("Could not extract nonce via DOM or network interception");
        }
      }

      // Build API URLs
      const gamesUrl = `${BASE_URL}?with_referees=true&no_forfeit=true&season_id=${cfg.seasonId}&without_in_preparation=true&sort[0]=date&sort[1]=time&serie_id=${cfg.serieId}&_path=game/byMyLeague`;
      const rankingUrl = `${BASE_URL}?serie_id=${cfg.serieId}&_path=ranking/byMyLeague`;

      // Fetch both endpoints from within the browser context (has cookies + correct origin)
      log(`  Fetching games API…`);
      const gamesData = await page.evaluate(async ({ url, nonce }) => {
        const res = await fetch(url, {
          headers: {
            "Accept": "application/json",
            "X-WP-Nonce": nonce,
          },
          credentials: "include",
        });
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
      }, { url: gamesUrl, nonce });

      log(`  Fetching ranking API…`);
      const rankingData = await page.evaluate(async ({ url, nonce }) => {
        const res = await fetch(url, {
          headers: {
            "Accept": "application/json",
            "X-WP-Nonce": nonce,
          },
          credentials: "include",
        });
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
      }, { url: rankingUrl, nonce });

      // Parse teams from ranking
      const rawRanking = Array.isArray(rankingData)
        ? rankingData
        : (rankingData.data || rankingData.ranking || rankingData.standings || Object.values(rankingData).find(v => Array.isArray(v)) || []);

      const rawGames = Array.isArray(gamesData)
        ? gamesData
        : (gamesData.data || gamesData.games || gamesData.results || Object.values(gamesData).find(v => Array.isArray(v)) || []);

      log(`  Teams from ranking: ${rawRanking.length}, games: ${rawGames.length}`);

      // Build teams array from ranking (preserves table order)
      const teams = rawRanking.map((r, i) => rankingToTeam(r, i));
      const teamIndex = buildTeamIndex(teams);

      // Build fixtures from games
      let fixtureCounter = 0;
      const rawFixtures = rawGames
        .map(g => gameToFixture(g, teamIndex, null, `vhv_f${fixtureCounter++}`))
        .filter(Boolean);

      // Normalize week numbers to be clean sequential integers
      const fixtures = rawFixtures.length > 0 ? normalizeWeeks(rawFixtures) : rawFixtures;

      const playedCount = fixtures.filter(f => f.played).length;
      const pendingCount = fixtures.filter(f => !f.played).length;
      log(`  Fixtures: ${fixtures.length} total, ${playedCount} played, ${pendingCount} pending`);

      // Save raw VHV data
      vhvResults.push({
        serieId: cfg.serieId,
        leaguesimName: cfg.leaguesimName,
        fetchedAt: new Date().toISOString(),
        teams,
        fixtures,
        rawRanking,
        rawGames,
      });

      // Merge into leaguesim data
      leaguesimData = mergeIntoLeaguesim(leaguesimData, cfg.leaguesimName, teams, fixtures);

    } catch (err) {
      console.error(`  ✗ FAILED for ${cfg.leaguesimName}: ${err.message}`);
      vhvResults.push({
        serieId: cfg.serieId,
        leaguesimName: cfg.leaguesimName,
        fetchedAt: new Date().toISOString(),
        error: err.message,
      });
    } finally {
      await context.close();
    }
  }

  await browser.close();

  // Write vhv-data.json (raw snapshot)
  const vhvOutput = {
    updatedAt: new Date().toISOString(),
    leagues: vhvResults,
  };
  fs.writeFileSync(vhvDataPath, JSON.stringify(vhvOutput, null, 2));
  log(`\nWritten: vhv-data.json`);

  // Write leaguesim-data.json (merged)
  fs.writeFileSync(leaguesimPath, JSON.stringify(leaguesimData, null, 2));
  log(`Written: leaguesim-data.json`);

  const failed = vhvResults.filter(r => r.error).length;
  log(`\nDone — ${vhvResults.length - failed}/${vhvResults.length} leagues succeeded`);
  if (failed === vhvResults.length && vhvResults.length > 0) process.exit(1);
}

main().catch(err => { console.error(err); process.exit(1); });
