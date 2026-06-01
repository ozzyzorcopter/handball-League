// .github/scripts/fetch-vhv.js
// Fetches live VHV handball data via Playwright (headless browser for nonce).
// Writes vhv-data.json — grouped by federation. Does NOT touch leaguesim-data.json.

const { chromium } = require("playwright-core");
const fs   = require("fs");
const path = require("path");

const root        = process.cwd();
const vhvDataPath = path.join(root, "vhv-data.json");

// ── LEAGUE CONFIG ─────────────────────────────────────────────────────────────
// federation: "VHV" | "URBH-KBHB" | "LFH"
// region: shown as subtitle on the league card (e.g. "Antwerpen", "Oost-Vlaanderen")
const VHV_LEAGUES = [
  { serieId: 652, seasonId: 5, organizationId: 2, name: "Liga 3",    federation: "VHV", region: "Oost-Vlaanderen",
    pageUrl: "https://www.handballbelgium.be/index.php/competition/vhv-competitions/?season_id=5&organization_id=2&serie_id=652" },
  // Add more:
  // { serieId: 653, seasonId: 5, organizationId: 2, name: "Liga 2", federation: "VHV", region: "...",
  //   pageUrl: "https://www.handballbelgium.be/index.php/competition/vhv-competitions/?season_id=5&organization_id=2&serie_id=653" },
  // { serieId: 700, seasonId: 5, organizationId: 1, name: "Division 1", federation: "URBH-KBHB", region: "National",
  //   pageUrl: "https://www.handballbelgium.be/index.php/competition/vhv-competitions/?season_id=5&organization_id=1&serie_id=700" },
];

const BASE_URL = "https://www.handballbelgium.be/index.php/wp-json/bpleagues/v1/proxy";

function log(msg)  { console.log(`[fetch-vhv] ${msg}`); }
function warn(msg) { console.warn(`[fetch-vhv] ⚠ ${msg}`); }

// ── NONCE ─────────────────────────────────────────────────────────────────────
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

// ── WEEK NORMALISATION ────────────────────────────────────────────────────────
function normalizeWeeks(fixtures) {
  const sorted = [...fixtures].sort((a, b) => {
    if (a.date && b.date) return a.date.localeCompare(b.date);
    return (a.week ?? 9999) - (b.week ?? 9999);
  });
  const groups = []; let lastKey = null;
  for (const f of sorted) {
    const key = f.week != null ? `w${f.week}` : (f.date?.slice(0, 10) ?? null);
    if (key !== lastKey) { groups.push([]); lastKey = key; }
    groups[groups.length - 1].push(f);
  }
  const weekMap = new Map();
  groups.forEach((g, i) => g.forEach(f => weekMap.set(f.id, i + 1)));
  return fixtures.map(f => ({ ...f, week: weekMap.get(f.id) ?? f.week }));
}

// ── FUZZY TEAM MATCHING ───────────────────────────────────────────────────────
const STRIP_RE = /^(handbalclub|handbal|hbc|hc|khc|ktsv|hv|shc|ehc|kh|hvv|sezoens|besox|derdaele|db|uilenspiegel|olse|biobest\s+sasja|sasja)\s+/i;
function norm(name) { return name.replace(STRIP_RE, "").replace(STRIP_RE, "").trim().toLowerCase(); }

function buildTeamsFromRanking(rawRanking) {
  return rawRanking.map((r, i) => ({
    id: `t${r.team?.id ?? i}`,
    name: r.team?.name || r.team_name || r.name || `Team ${i + 1}`,
    points: 0,
    homeBonus: "",
  }));
}

function buildFixturesFromGames(rawGames, teams) {
  // Build name → index both exact and normalised
  const nameToIdx = new Map();
  teams.forEach((t, i) => {
    nameToIdx.set(t.name.toLowerCase(), i);
    nameToIdx.set(norm(t.name), i);
  });

  const resolve = (apiName) => {
    if (!apiName) return -1;
    const exact = nameToIdx.get(apiName.toLowerCase());
    if (exact != null) return exact;
    const normalised = nameToIdx.get(norm(apiName));
    if (normalised != null) return normalised;
    // Substring fallback
    for (const [k, v] of nameToIdx) {
      if (k.includes(norm(apiName)) || norm(apiName).includes(k)) return v;
    }
    return -1;
  };

  let counter = 0;
  const fixtures = [];
  for (const g of rawGames) {
    const homeName = g.home_team?.name || g.home?.name || g.team_home || "";
    const awayName = g.away_team?.name || g.away?.name || g.team_away || "";
    const homeIdx = resolve(homeName);
    const awayIdx = resolve(awayName);
    if (homeIdx < 0 || awayIdx < 0) {
      if (homeName || awayName) warn(`  Unmatched: "${homeName}" vs "${awayName}"`);
      continue;
    }
    const sh = g.score_home ?? g.home_score ?? g.result?.home ?? null;
    const sa = g.score_away ?? g.away_score ?? g.result?.away ?? null;
    const played = sh != null && sa != null && String(sh) !== "" && String(sa) !== "";
    fixtures.push({
      id: `f${counter++}`,
      homeIdx, awayIdx,
      homeWin: 50, draw: 6, awayWin: 44,
      overrideOn: false, ovHW: "", ovD: "", ovAW: "",
      played,
      homeScore: played ? Number(sh) : null,
      awayScore: played ? Number(sa) : null,
      week: g.round_number ?? g.round ?? g.week ?? null,
      date:  g.date || g.game_date || g.datetime || null,
    });
  }
  return normalizeWeeks(fixtures);
}

// ── MAIN ──────────────────────────────────────────────────────────────────────
async function main() {
  log(`Starting at ${new Date().toUTCString()}`);

  // Load existing vhv-data to preserve leagues we're not fetching this run
  let existing = { updatedAt: null, federations: {} };
  if (fs.existsSync(vhvDataPath)) {
    try { existing = JSON.parse(fs.readFileSync(vhvDataPath, "utf8")); }
    catch { warn("Could not parse existing vhv-data.json — starting fresh"); }
  }

  const browser = await chromium.launch({ headless: true });
  const results  = [];   // per-league fetch results for logging

  for (const cfg of VHV_LEAGUES) {
    log(`\n${cfg.federation} · ${cfg.name} (${cfg.region}) — serie ${cfg.serieId}`);
    const context = await browser.newContext({
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:151.0) Gecko/20100101 Firefox/151.0",
    });
    const page = await context.newPage();

    try {
      log(`  Loading page…`);
      await page.goto(cfg.pageUrl, { waitUntil: "networkidle", timeout: 30000 });
      let nonce = await extractNonce(page);

      if (!nonce) {
        warn("  Nonce not in DOM — intercepting network");
        let intercepted = null;
        page.on("request", req => { const h = req.headers(); if (h["x-wp-nonce"]) intercepted = h["x-wp-nonce"]; });
        await page.reload({ waitUntil: "networkidle", timeout: 30000 });
        nonce = intercepted;
      }
      if (!nonce) throw new Error("Could not extract nonce");
      log(`  Nonce: ${nonce}`);

      const fetchJson = (url) => page.evaluate(async ({ url, nonce }) => {
        const r = await fetch(url, { headers: { Accept: "application/json", "X-WP-Nonce": nonce }, credentials: "include" });
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      }, { url, nonce });

      const gamesUrl   = `${BASE_URL}?with_referees=true&no_forfeit=true&season_id=${cfg.seasonId}&without_in_preparation=true&sort[0]=date&sort[1]=time&serie_id=${cfg.serieId}&_path=game/byMyLeague`;
      const rankingUrl = `${BASE_URL}?serie_id=${cfg.serieId}&_path=ranking/byMyLeague`;

      log(`  Fetching ranking + games…`);
      const [rankingData, gamesData] = await Promise.all([fetchJson(rankingUrl), fetchJson(gamesUrl)]);

      const rawRanking = Array.isArray(rankingData) ? rankingData : (rankingData.data || rankingData.ranking || Object.values(rankingData).find(Array.isArray) || []);
      const rawGames   = Array.isArray(gamesData)   ? gamesData   : (gamesData.data   || gamesData.games   || Object.values(gamesData).find(Array.isArray)   || []);

      log(`  ${rawRanking.length} teams · ${rawGames.length} games`);
      log(`  Teams: ${rawRanking.map(r => r.team?.name || r.name || "?").join(", ")}`);

      const teams    = buildTeamsFromRanking(rawRanking);
      const fixtures = buildFixturesFromGames(rawGames, teams);
      const played   = fixtures.filter(f => f.played).length;
      const pending  = fixtures.filter(f => !f.played).length;
      log(`  Fixtures: ${fixtures.length} (${played} played, ${pending} pending)`);

      // Build ranking table from raw API data
      const ranking = rawRanking.map((r, i) => ({
        pos:    r.rank || r.position || (i + 1),
        name:   r.team?.name || r.team_name || r.name || `Team ${i + 1}`,
        played: r.games_played ?? r.played ?? r.gp ?? 0,
        won:    r.wins  ?? r.won   ?? r.w   ?? 0,
        drawn:  r.draws ?? r.draw  ?? r.d   ?? 0,
        lost:   r.losses ?? r.lost ?? r.l   ?? 0,
        gf:     r.goals_for     ?? r.gf ?? 0,
        ga:     r.goals_against ?? r.ga ?? 0,
        points: r.points ?? r.pts ?? 0,
      }));

      // Store under federation → league key
      const leagueKey = `${cfg.serieId}`;
      if (!existing.federations[cfg.federation]) existing.federations[cfg.federation] = {};
      existing.federations[cfg.federation][leagueKey] = {
        serieId:     cfg.serieId,
        name:        cfg.name,
        federation:  cfg.federation,
        region:      cfg.region,
        updatedAt:   new Date().toISOString(),
        live:        pending > 0,
        teams,
        fixtures,
        ranking,
      };

      results.push({ key: leagueKey, name: cfg.name, ok: true, played, pending });

    } catch (err) {
      console.error(`  ✗ FAILED: ${err.message}`);
      results.push({ key: `${cfg.serieId}`, name: cfg.name, ok: false, error: err.message });
    } finally {
      await context.close();
    }
  }

  await browser.close();

  existing.updatedAt = new Date().toISOString();
  fs.writeFileSync(vhvDataPath, JSON.stringify(existing, null, 2));

  const ok  = results.filter(r => r.ok).length;
  const bad = results.filter(r => !r.ok).length;
  log(`\nDone — ${ok}/${results.length} succeeded · vhv-data.json written`);
  if (bad > 0 && bad === results.length) process.exit(1);
}

main().catch(err => { console.error(err); process.exit(1); });
