// .github/scripts/fetch-vhv.js
// Fetches live VHV handball data via Playwright (headless browser for nonce).
// Writes vhv-data.json — grouped by federation. Does NOT touch leaguesim-data.json.

const { chromium } = require("playwright-core");
const fs   = require("fs");
const path = require("path");

const root        = process.cwd();
const vhvDataPath = path.join(root, "vhv-data.json");

// ── LEAGUE CONFIG ─────────────────────────────────────────────────────────────
// To find serie_id for a league:
// 1. Open the competition page in browser
// 2. DevTools → Network → XHR/Fetch → reload
// 3. Find the request to wp-json/bpleagues/v1/proxy?...&serie_id=NNN
//
// organizationId: 1 = URBH-KBHB, 2 = VHV, 3 = LFH
// Page URLs per federation:
//   VHV:       https://www.handballbelgium.be/index.php/competition/vhv-competitions/
//   URBH-KBHB: https://www.handballbelgium.be/index.php/competition/urbh-kbhb-competitions/
//   LFH:       https://www.handballbelgium.be/index.php/competition/lfh-competitions/
//   LFH Liège: https://www.handballbelgium.be/index.php/competition/lfh-competitions/cpl-competitions/
//   LFH BH:    https://www.handballbelgium.be/index.php/competition/lfh-competitions/cpbh-competitions/
//   SHL:       https://www.handballbelgium.be/index.php/competition/beneleague/

const VHV_LEAGUES = [
  // ── VHV ──────────────────────────────────────────────────────────────────
  { serieId: 652, seasonId: 5, organizationId: 2, name: "Liga 3", federation: "VHV", region: "Oost-Vlaanderen",
    pageUrl: "https://www.handballbelgium.be/index.php/competition/vhv-competitions/?season_id=5&organization_id=2&serie_id=652" },
  // Add more VHV leagues — replace 0 with the actual serie_id from DevTools:
  // { serieId: 0, seasonId: 5, organizationId: 2, name: "Liga 2", federation: "VHV", region: "...",
  //   pageUrl: "https://www.handballbelgium.be/index.php/competition/vhv-competitions/?season_id=5&organization_id=2&serie_id=0" },
  // { serieId: 0, seasonId: 5, organizationId: 2, name: "Liga 1", federation: "VHV", region: "...",
  //   pageUrl: "https://www.handballbelgium.be/index.php/competition/vhv-competitions/?season_id=5&organization_id=2&serie_id=0" },
  // { serieId: 0, seasonId: 5, organizationId: 2, name: "Regio OWv", federation: "VHV", region: "Oost-Vlaanderen",
  //   pageUrl: "https://www.handballbelgium.be/index.php/competition/vhv-competitions/?season_id=5&organization_id=2&serie_id=0" },

  // ── URBH-KBHB ────────────────────────────────────────────────────────────
  // { serieId: 0, seasonId: 5, organizationId: 1, name: "1e Nationale", federation: "URBH-KBHB", region: "National",
  //   pageUrl: "https://www.handballbelgium.be/index.php/competition/urbh-kbhb-competitions/?season_id=5&organization_id=1&serie_id=0" },
  // { serieId: 0, seasonId: 5, organizationId: 1, name: "2e Nationale", federation: "URBH-KBHB", region: "National",
  //   pageUrl: "https://www.handballbelgium.be/index.php/competition/urbh-kbhb-competitions/?season_id=5&organization_id=1&serie_id=0" },

  // ── LFH ──────────────────────────────────────────────────────────────────
  // { serieId: 0, seasonId: 5, organizationId: 3, name: "Division 1", federation: "LFH", region: "Liège",
  //   pageUrl: "https://www.handballbelgium.be/index.php/competition/lfh-competitions/cpl-competitions/?season_id=5&organization_id=3&serie_id=0" },

  // ── SHL ───────────────────────────────────────────────────────────────────
  // { serieId: 0, seasonId: 5, organizationId: 1, name: "Super Handball League", federation: "URBH-KBHB", region: "National",
  //   pageUrl: "https://www.handballbelgium.be/index.php/competition/beneleague/?season_id=5&organization_id=1&serie_id=0" },
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


function buildFixturesFromGames(rawGames, teams, gameTeamName) {
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
    const homeName = gameTeamName(g, "home") || "";
    const awayName = gameTeamName(g, "away") || "";
    const homeIdx = resolve(homeName);
    const awayIdx = resolve(awayName);
    if (homeIdx < 0 || awayIdx < 0) {
      if (homeName || awayName) warn(`  Unmatched: "${homeName}" vs "${awayName}"`);
      continue;
    }
    const sh = g.score_home ?? g.home_score ?? g.scoreHome ?? g.result?.home ?? g.goals_home ?? g.goalsHome ?? null;
    const sa = g.score_away ?? g.away_score ?? g.scoreAway ?? g.result?.away ?? g.goals_away ?? g.goalsAway ?? null;
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
    try {
      const parsed = JSON.parse(fs.readFileSync(vhvDataPath, "utf8"));
      existing = { updatedAt: parsed.updatedAt || null, federations: parsed.federations || {} };
    } catch { warn("Could not parse existing vhv-data.json — starting fresh"); }
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

      // Unwrap the response — the bpleagues proxy wraps in { success, data } or returns array directly
      function unwrapArray(resp) {
        if (Array.isArray(resp)) return resp;
        if (resp && Array.isArray(resp.data)) return resp.data;
        if (resp && Array.isArray(resp.results)) return resp.results;
        if (resp && Array.isArray(resp.ranking)) return resp.ranking;
        if (resp && Array.isArray(resp.games)) return resp.games;
        if (resp && typeof resp === "object") {
          const found = Object.values(resp).find(v => Array.isArray(v) && v.length > 0);
          if (found) return found;
        }
        return [];
      }
      const rawRanking = unwrapArray(rankingData);
      const rawGames   = unwrapArray(gamesData);

      log(`  ${rawRanking.length} teams · ${rawGames.length} games`);

      // Log first ranking entry shape so we can see field names
      if (rawRanking.length > 0) {
        log(`  Ranking entry keys: ${Object.keys(rawRanking[0]).join(", ")}`);
        const first = rawRanking[0];
        log(`  First team sample: ${JSON.stringify(first).slice(0, 200)}`);
      }
      if (rawGames.length > 0) {
        log(`  Game entry keys: ${Object.keys(rawGames[0]).join(", ")}`);
        log(`  First game sample: ${JSON.stringify(rawGames[0]).slice(0, 200)}`);
      }

      // Extract team name from ranking entry — try every known shape
      function rankingTeamName(r) {
        return r.team_name
          || r.teamName
          || r.name
          || r.club_name
          || r.clubName
          || r.team?.name
          || r.club?.name
          || (r.team ? (typeof r.team === "string" ? r.team : null) : null)
          || null;
      }

      log(`  Teams: ${rawRanking.map(r => rankingTeamName(r) || "?").join(", ")}`);

      const teams    = rawRanking.map((r, i) => ({
        id: `t${r.team_id || r.id || r.team?.id || i}`,
        name: rankingTeamName(r) || `Team ${i + 1}`,
        points: 0,
        homeBonus: "",
      }));
      // Extract team names from game entry — try every known shape
      function gameTeamName(g, side) {
        // side: "home" or "away"
        const t = side === "home"
          ? (g.home_team || g.home || g.homeTeam || {})
          : (g.away_team || g.away || g.awayTeam || {});
        return (typeof t === "string" ? t : null)
          || t?.name || t?.team_name || t?.club_name
          || g[side + "_team_name"] || g[side + "TeamName"]
          || g["team_" + side] || g[side + "Team"]
          || null;
      }

      const fixtures = buildFixturesFromGames(rawGames, teams, gameTeamName);
      const played   = fixtures.filter(f => f.played).length;
      const pending  = fixtures.filter(f => !f.played).length;
      log(`  Fixtures: ${fixtures.length} (${played} played, ${pending} pending)`);

      // Build ranking table from raw API data using flexible field extraction
      const ranking = rawRanking.map((r, i) => {
        const gf = r.goals_for  ?? r.gf ?? r.goalsFor  ?? r.scored  ?? 0;
        const ga = r.goals_against ?? r.ga ?? r.goalsAgainst ?? r.conceded ?? 0;
        return {
          pos:    r.rank || r.position || r.pos || (i + 1),
          name:   rankingTeamName(r) || `Team ${i + 1}`,
          played: r.games_played ?? r.played ?? r.gp ?? r.games ?? 0,
          won:    r.wins  ?? r.won   ?? r.w  ?? 0,
          drawn:  r.draws ?? r.draw  ?? r.d  ?? 0,
          lost:   r.losses ?? r.lost ?? r.l  ?? 0,
          gf, ga,
          points: r.points ?? r.pts ?? r.point ?? 0,
        };
      });

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
