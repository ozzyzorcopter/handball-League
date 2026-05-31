// .github/scripts/fetch-vhv.js
// Uses Playwright to load the VHV competition page, extract the nonce,
// then fetch both game and ranking API endpoints.
// Writes vhv-data.json (raw snapshot) and merges scores/fixtures into leaguesim-data.json.
//
// KEY BEHAVIOUR:
// - Existing teams in leaguesim-data.json are PRESERVED — never replaced.
//   API team names are fuzzy-matched to existing team names.
// - Existing played fixtures are PRESERVED — only new/updated scores are written.
// - vhvLive = true when there are still unplayed fixtures remaining.

const { chromium } = require("playwright-core");
const fs = require("fs");
const path = require("path");

const root = process.cwd();
const vhvDataPath = path.join(root, "vhv-data.json");
const leaguesimPath = path.join(root, "leaguesim-data.json");

// ── LEAGUE CONFIG ─────────────────────────────────────────────────────────────
const VHV_LEAGUES = [
  {
    serieId: 652,
    seasonId: 5,
    organizationId: 2,
    leaguesimName: "VHV Liga 3",
    pageUrl: "https://www.handballbelgium.be/index.php/competition/vhv-competitions/?season_id=5&organization_id=2&serie_id=652",
  },
  // Add more leagues below:
  // { serieId: 653, seasonId: 5, organizationId: 2, leaguesimName: "VHV Liga 2",
  //   pageUrl: "https://www.handballbelgium.be/index.php/competition/vhv-competitions/?season_id=5&organization_id=2&serie_id=653" },
];

const BASE_URL = "https://www.handballbelgium.be/index.php/wp-json/bpleagues/v1/proxy";

// ── UTILS ─────────────────────────────────────────────────────────────────────
function log(msg)  { console.log(`[fetch-vhv] ${msg}`); }
function warn(msg) { console.warn(`[fetch-vhv] ⚠ ${msg}`); }

// Strip common handball club prefixes for fuzzy matching
const STRIP_RE = /^(handbalclub|handbal|hbc|hc|khc|ktsv|hv|shc|ehc|kh|hvv|sezoens|besox|derdaele|db|uilenspiegel|olse|biobest\s+sasja|sasja)\s+/i;
function normalize(name) {
  return name.replace(STRIP_RE, "").replace(STRIP_RE, "").trim().toLowerCase();
}

// Fuzzy match an API team name to the closest existing leaguesim team name.
// Returns the team index, or -1 if no match found.
function fuzzyMatchTeam(apiName, existingTeams) {
  const apiNorm = normalize(apiName);
  // 1. Exact match (case-insensitive)
  let idx = existingTeams.findIndex(t => t.name.toLowerCase() === apiName.toLowerCase());
  if (idx >= 0) return idx;
  // 2. Normalised exact match
  idx = existingTeams.findIndex(t => normalize(t.name) === apiNorm);
  if (idx >= 0) return idx;
  // 3. One contains the other (after normalisation)
  idx = existingTeams.findIndex(t => {
    const tn = normalize(t.name);
    return tn.includes(apiNorm) || apiNorm.includes(tn);
  });
  return idx;
}

// ── NONCE EXTRACTION ──────────────────────────────────────────────────────────
async function extractNonce(page) {
  return await page.evaluate(() => {
    if (window.bpleagues?.nonce) return window.bpleagues.nonce;
    if (window.wpApiSettings?.nonce) return window.wpApiSettings.nonce;
    for (const s of document.querySelectorAll("script:not([src])")) {
      const m = s.textContent.match(/"nonce"\s*:\s*"([a-f0-9]{10,})"/);
      if (m) return m[1];
      const m2 = s.textContent.match(/nonce['":\s]+['"]([a-f0-9]{10,})['"]/);
      if (m2) return m2[1];
    }
    return null;
  });
}

// ── WEEK NORMALISATION ────────────────────────────────────────────────────────
// Re-number week values to sequential integers 1..N based on date/round order.
function normalizeWeeks(fixtures) {
  const sorted = [...fixtures].sort((a, b) => {
    if (a.date && b.date) return a.date.localeCompare(b.date);
    return (a.week ?? 9999) - (b.week ?? 9999);
  });
  const groups = [];
  let lastKey = null;
  for (const f of sorted) {
    const key = f.week != null ? `w${f.week}` : (f.date ? f.date.slice(0, 10) : null);
    if (key !== lastKey) { groups.push([]); lastKey = key; }
    groups[groups.length - 1].push(f);
  }
  const weekMap = new Map();
  groups.forEach((group, i) => group.forEach(f => weekMap.set(f.id, i + 1)));
  return fixtures.map(f => ({ ...f, week: weekMap.get(f.id) ?? f.week }));
}

// ── MERGE LOGIC ───────────────────────────────────────────────────────────────
// Merges VHV game data into an existing league's fixtures.
// Preserves all existing teams and their indices — never replaces them.
// Matches API games to existing fixtures by homeIdx+awayIdx pair.
// Adds new fixtures for games not yet in the league.
// Updates scores for games that now have results.
function mergeFixtures(existingTeams, existingFixtures, rawGames) {
  // Build name → index map using fuzzy matching
  const apiNameToIdx = new Map();
  const unmatchedNames = new Set();

  for (const g of rawGames) {
    const homeName = g.home_team?.name || g.home?.name || g.team_home || "";
    const awayName = g.away_team?.name || g.away?.name || g.team_away || "";
    for (const name of [homeName, awayName]) {
      if (!name || apiNameToIdx.has(name)) continue;
      const idx = fuzzyMatchTeam(name, existingTeams);
      if (idx >= 0) {
        apiNameToIdx.set(name, idx);
        if (normalize(name) !== normalize(existingTeams[idx].name)) {
          log(`    Name mapped: "${name}" → "${existingTeams[idx].name}"`);
        }
      } else {
        unmatchedNames.add(name);
      }
    }
  }

  if (unmatchedNames.size > 0) {
    warn(`  Could not match these API team names to existing teams:`);
    for (const n of unmatchedNames) warn(`    "${n}"`);
  }

  // Build lookup of existing fixtures by homeIdx+awayIdx pair
  const existingByPair = new Map();
  for (const f of existingFixtures) {
    existingByPair.set(`${f.homeIdx}_${f.awayIdx}`, f);
  }

  let newCount = 0, updatedCount = 0, skippedCount = 0;
  const updatedFixtures = [...existingFixtures]; // start with all existing

  let fixtureCounter = existingFixtures.length;

  for (const g of rawGames) {
    const homeName = g.home_team?.name || g.home?.name || g.team_home || "";
    const awayName = g.away_team?.name || g.away?.name || g.team_away || "";
    const homeIdx = apiNameToIdx.get(homeName);
    const awayIdx = apiNameToIdx.get(awayName);

    if (homeIdx == null || awayIdx == null) { skippedCount++; continue; }

    const sh = g.score_home ?? g.home_score ?? g.result?.home ?? null;
    const sa = g.score_away ?? g.away_score ?? g.result?.away ?? null;
    const played = sh != null && sa != null && String(sh) !== "" && String(sa) !== "";
    const week   = g.round_number ?? g.round ?? g.week ?? null;
    const date   = g.date || g.game_date || g.datetime || null;
    const pairKey = `${homeIdx}_${awayIdx}`;

    if (existingByPair.has(pairKey)) {
      // Update score if the API now has a result
      const existing = existingByPair.get(pairKey);
      if (played && !existing.played) {
        const idx = updatedFixtures.findIndex(f => f.id === existing.id);
        if (idx >= 0) {
          updatedFixtures[idx] = { ...updatedFixtures[idx], played: true, homeScore: Number(sh), awayScore: Number(sa) };
          updatedCount++;
        }
      }
    } else {
      // New fixture not yet in leaguesim
      updatedFixtures.push({
        id: `vhv_f${fixtureCounter++}`,
        homeIdx,
        awayIdx,
        homeWin: 50,
        draw: 6,
        awayWin: 44,
        overrideOn: false,
        ovHW: "", ovD: "", ovAW: "",
        played,
        homeScore: played ? Number(sh) : null,
        awayScore: played ? Number(sa) : null,
        week: week != null ? Number(week) : null,
        date,
      });
      newCount++;
    }
  }

  log(`  Fixtures: ${newCount} new, ${updatedCount} updated, ${skippedCount} skipped (unmatched teams)`);
  return normalizeWeeks(updatedFixtures);
}

// Merges fetched data into leaguesim-data.json league.
// Creates the league if it doesn't exist.
function mergeIntoLeaguesim(leaguesimData, leaguesimName, rawGames, rawRanking) {
  const leagues = leaguesimData.leagues || [];
  const idx = leagues.findIndex(lg => lg.name === leaguesimName);

  if (idx === -1) {
    // Brand new league — build teams from ranking, fixtures from games
    log(`  Creating new league: "${leaguesimName}"`);
    const teams = rawRanking.map((r, i) => ({
      id: `vhv_t${r.team?.id || i}`,
      name: r.team?.name || r.team_name || r.name || `Team ${i + 1}`,
      points: 0,
      homeBonus: "",
    }));
    const fixtures = mergeFixtures(teams, [], rawGames);
    const hasUnplayed = fixtures.some(f => !f.played);
    const league = {
      id: String(Date.now()),
      name: leaguesimName,
      type: "standard",
      teams,
      fixtures,
      step: 2,
      settings: { baseWin: 47, baseDraw: 6, homeBonus: 10, rankBonus: 3, winScore: 30, lossScore: 25, drawScore: 25 },
      playoffs: null, playdowns: null,
      poSize: 6, pdSize: 4, phaseFormat: "round-robin",
      promoTop: 2, demotBot: 2,
      archivable: true,
      scorerUrl: "", playoffScorerUrl: "", playdownScorerUrl: "",
      scorerAliases: {},
      vhvLive: hasUnplayed,
    };
    return { ...leaguesimData, leagues: [...leagues, league] };
  }

  // Existing league — preserve teams, merge fixtures
  log(`  Merging into existing league: "${leaguesimName}"`);
  const existing = leagues[idx];
  const updatedFixtures = mergeFixtures(existing.teams, existing.fixtures || [], rawGames);
  const hasUnplayed = updatedFixtures.some(f => !f.played);
  const updated = { ...existing, fixtures: updatedFixtures, step: 2, vhvLive: hasUnplayed };
  return { ...leaguesimData, leagues: leagues.map((lg, i) => i === idx ? updated : lg) };
}

// ── MAIN ──────────────────────────────────────────────────────────────────────
async function main() {
  log(`Starting at ${new Date().toUTCString()}`);
  log(`${VHV_LEAGUES.length} league(s) configured`);

  let leaguesimData = { leagues: [] };
  if (fs.existsSync(leaguesimPath)) {
    leaguesimData = JSON.parse(fs.readFileSync(leaguesimPath, "utf8"));
    log(`Loaded leaguesim-data.json (${(leaguesimData.leagues || []).length} leagues)`);
  }

  const browser = await chromium.launch({ headless: true });
  const vhvResults = [];

  for (const cfg of VHV_LEAGUES) {
    log(`\nProcessing: ${cfg.leaguesimName} (serie ${cfg.serieId})`);
    const context = await browser.newContext({
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:151.0) Gecko/20100101 Firefox/151.0",
    });
    const page = await context.newPage();

    try {
      log(`  Loading page…`);
      await page.goto(cfg.pageUrl, { waitUntil: "networkidle", timeout: 30000 });

      let nonce = await extractNonce(page);

      if (!nonce) {
        warn("  Nonce not in DOM — trying network interception");
        let intercepted = null;
        page.on("request", req => { const h = req.headers(); if (h["x-wp-nonce"]) intercepted = h["x-wp-nonce"]; });
        await page.reload({ waitUntil: "networkidle", timeout: 30000 });
        nonce = intercepted;
      }
      if (!nonce) throw new Error("Could not extract nonce");
      log(`  Nonce: ${nonce}`);

      const gamesUrl   = `${BASE_URL}?with_referees=true&no_forfeit=true&season_id=${cfg.seasonId}&without_in_preparation=true&sort[0]=date&sort[1]=time&serie_id=${cfg.serieId}&_path=game/byMyLeague`;
      const rankingUrl = `${BASE_URL}?serie_id=${cfg.serieId}&_path=ranking/byMyLeague`;

      const fetchJson = async (url) => page.evaluate(async ({ url, nonce }) => {
        const r = await fetch(url, { headers: { "Accept": "application/json", "X-WP-Nonce": nonce }, credentials: "include" });
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      }, { url, nonce });

      log(`  Fetching games…`);
      const gamesData = await fetchJson(gamesUrl);
      log(`  Fetching ranking…`);
      const rankingData = await fetchJson(rankingUrl);

      const rawGames   = Array.isArray(gamesData)   ? gamesData   : (gamesData.data   || gamesData.games   || Object.values(gamesData).find(Array.isArray)   || []);
      const rawRanking = Array.isArray(rankingData)  ? rankingData : (rankingData.data || rankingData.ranking || Object.values(rankingData).find(Array.isArray) || []);

      log(`  API: ${rawRanking.length} teams in ranking, ${rawGames.length} games`);

      // Log API team names so you can verify/debug mapping
      log(`  API team names: ${rawRanking.map(r => r.team?.name || r.name || "?").join(", ")}`);

      leaguesimData = mergeIntoLeaguesim(leaguesimData, cfg.leaguesimName, rawGames, rawRanking);

      vhvResults.push({ serieId: cfg.serieId, leaguesimName: cfg.leaguesimName, fetchedAt: new Date().toISOString(), teams: rawRanking.length, games: rawGames.length });

    } catch (err) {
      console.error(`  ✗ FAILED: ${err.message}`);
      vhvResults.push({ serieId: cfg.serieId, leaguesimName: cfg.leaguesimName, fetchedAt: new Date().toISOString(), error: err.message });
    } finally {
      await context.close();
    }
  }

  await browser.close();

  fs.writeFileSync(vhvDataPath,    JSON.stringify({ updatedAt: new Date().toISOString(), leagues: vhvResults }, null, 2));
  fs.writeFileSync(leaguesimPath,  JSON.stringify(leaguesimData, null, 2));

  log(`\nWritten: vhv-data.json + leaguesim-data.json`);
  const failed = vhvResults.filter(r => r.error).length;
  log(`Done — ${vhvResults.length - failed}/${vhvResults.length} leagues succeeded`);
  if (failed === vhvResults.length && vhvResults.length > 0) process.exit(1);
}

main().catch(err => { console.error(err); process.exit(1); });
