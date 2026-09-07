// .github/scripts/fetch-vhv.js
// Fetches Belgian handball data from Clubee (clubee.com/handballbelgium).
// Uses seasons/0 = current season (auto-updates each year).
// Standings: /standings-371073v4/leagues/ID/seasons/0
// Games:     /games-371075v4/leagues/ID/seasons/0  (full club names, no scores)
// Stats:     /stats-371072v4/leagues/ID/seasons/0
// Scores come from individual game pages: /games/GAMEID/gamesheet
// Writes vhv-data.json grouped by federation/division.

const fs   = require("fs");
const path = require("path");
const root        = process.cwd();
const vhvDataPath = path.join(root, "vhv-data.json");


// ── UTILS ─────────────────────────────────────────────────────────────────────
function log(msg)  { console.log(`[fetch-vhv] ${msg}`); }
function warn(msg) { console.warn(`[fetch-vhv] ⚠ ${msg}`); }

const PLACEHOLDER = /^(TBA|heren liga \d+|dames liga \d+|ploeg \d+)$/i;

async function fetchHtml(url) {
  const r = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
    },
  });
  if (!r.ok) throw new Error(`HTTP ${r.status} for ${url}`);
  return r.text();
}

// Clean a team name: strip (Senior M/F/X), strip D3/D2 suffixes, normalise whitespace
function cleanTeam(raw) {
  return raw
    .replace(/\(Senior [A-Z]\)/gi, "")
    .replace(/\s+/g, " ").trim();
}

// ── STANDINGS PARSER ──────────────────────────────────────────────────────────
// Splits on <tr to handle Next.js multiline <tr class="...">\n tags
function parseStandings(html) {
  const rows = [];
  const chunks = html.split(/<tr[\s>]/i);
  for (const chunk of chunks) {
    const rowContent = chunk.split(/<\/tr>/i)[0];
    const cells = [];
    const tdRe = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    let td;
    while ((td = tdRe.exec(rowContent)) !== null) {
      const text = td[1]
        .replace(/<[^>]+>/g, " ")
        .replace(/&amp;/g,"&").replace(/&nbsp;/g," ")
        .replace(/&#39;/g,"'").replace(/&#x27;/g,"'")
        .replace(/&lt;/g,"<").replace(/&gt;/g,">")
        .replace(/\s+/g," ").trim();
      cells.push(text);
    }
    // Columns: # | Club | MP | W | D | L | GS | GA | GD | Pts | (action)
    if (cells.length >= 9 && /^\d+\.?$/.test(cells[0])) {
      const name = cleanTeam(cells[1]);
      if (!name || PLACEHOLDER.test(name)) continue;
      rows.push({
        pos:    parseInt(cells[0]),
        name,
        played: parseInt(cells[2])||0,
        won:    parseInt(cells[3])||0,
        drawn:  parseInt(cells[4])||0,
        lost:   parseInt(cells[5])||0,
        gf:     parseInt(cells[6])||0,
        ga:     parseInt(cells[7])||0,
        points: parseInt(cells[9])||0,
      });
    }
  }
  return rows.sort((a,b) => a.pos - b.pos);
}

// ── STATS PARSER (top scorers) ─────────────────────────────────────────────────
function parseStats(html) {
  if (!html || html.includes("No information added yet")) return [];
  const scorers = [];
  const chunks  = html.split(/<tr[\s>]/i);
  for (const chunk of chunks) {
    const rowContent = chunk.split(/<\/tr>/i)[0];
    const cells = [];
    const tdRe  = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    let td;
    while ((td = tdRe.exec(rowContent)) !== null) {
      const text = td[1].replace(/<[^>]+>/g," ").replace(/&amp;/g,"&").replace(/&nbsp;/g," ").replace(/&#39;/g,"'").replace(/&#x27;/g,"'").replace(/\s+/g," ").trim();
      cells.push(text);
    }
    if (cells.length >= 4 && /^\d+\.?$/.test(cells[0])) {
      const goals = parseInt(cells[cells.length - 1]);
      if (!isNaN(goals) && cells[1] && cells[2]) {
        scorers.push({ player: cells[1], club: cleanTeam(cells[2]), goals });
      }
    }
  }
  return scorers;
}

// ── GAMES PARSER ──────────────────────────────────────────────────────────────
// Game link format (inside one <a> tag):
//   [**Home (Senior M)**HH:MMDD.MM.YYYY**Away (Senior M)**](url/games/ID)
// With score (if entered):
//   [**Home (Senior M)**HS-ASDD.MM.YYYY**Away (Senior M)**](url)
// Or in raw HTML: <a href="...games/ID"><strong>Home</strong>time<strong>Away</strong></a>
function parseGames(html, ranking) {
  // Build team lookup from standings (source of truth for names/indices)
  const teamNames = ranking.map(r => r.name);
  const nameIdx   = new Map(teamNames.map((n, i) => [n.toLowerCase(), i]));

  const fixtures = [];
  let counter    = 0;

  // Split on <h3> for gameday sections
  const sections = html.split(/<h3[^>]*>/i);

  for (const section of sections) {
    const gdMatch = section.match(/Gameday\s+(\d+)/i);
    const round   = gdMatch ? parseInt(gdMatch[1]) : 0;

    // Find all <a href=".../games/ID">...</a> blocks
    const linkRe  = /<a[^>]+href="[^"]*\/games\/(\d+)"[^>]*>([\s\S]*?)<\/a>/gi;
    let m;
    while ((m = linkRe.exec(section)) !== null) {
      const gameId  = m[1];
      // Strip all HTML tags from link content
      const content = m[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

      // Extract date (DD.MM.YYYY)
      const dateM   = content.match(/(\d{2})\.(\d{2})\.(\d{4})/);
      const date    = dateM ? `${dateM[3]}-${dateM[2]}-${dateM[1]}` : null;

      // Extract score: two numbers separated by - or – between non-digit chars
      // Only treat as score if both numbers <= 99 and NOT a time (HH:MM)
      const scoreM  = content.match(/(?<!\d:)\b(\d{1,2})\s*[-–]\s*(\d{1,2})\b(?!:\d)/);
      const homeScore = scoreM ? parseInt(scoreM[1]) : null;
      const awayScore = scoreM ? parseInt(scoreM[2]) : null;
      const played    = homeScore !== null && awayScore !== null;

      // Remove date, time (HH:MM), score from content to get team name string
      let stripped = content
        .replace(/\d{2}\.\d{2}\.\d{4}/, " ")     // date
        .replace(/\b\d{1,2}:\d{2}\b/, " ")        // time HH:MM
        .replace(/(?<!\d:)\b\d{1,2}\s*[-–]\s*\d{1,2}\b(?!:\d)/, " ")  // score
        .replace(/\(Senior [A-Z]\)/gi, " ")        // category suffix
        .replace(/\s+/g, " ").trim();

      // The string is now "HomeTeamName AwayTeamName" (two teams side by side)
      // Find split point: try matching known team names greedily from left
      let homeIdx = -1, awayIdx = -1;

      // Try each team name as a prefix match
      for (const [nameLower, idx] of nameIdx) {
        if (stripped.toLowerCase().startsWith(nameLower)) {
          const rest = stripped.slice(nameLower.length).trim();
          const awayI = nameIdx.get(rest.toLowerCase());
          if (awayI !== undefined) {
            homeIdx = idx; awayIdx = awayI; break;
          }
          // Partial match: rest starts with another team name
          for (const [n2, i2] of nameIdx) {
            if (rest.toLowerCase().startsWith(n2)) {
              homeIdx = idx; awayIdx = i2; break;
            }
          }
          if (homeIdx >= 0) break;
        }
      }

      // Skip TBA/placeholder games
      if (PLACEHOLDER.test(stripped.split(" ")[0]) || stripped.toLowerCase().includes("tba")) continue;
      if (homeIdx < 0 || awayIdx < 0 || homeIdx === awayIdx) continue;

      fixtures.push({
        id: `f${counter++}`, gameId, homeIdx, awayIdx,
        homeWin: 50, draw: 6, awayWin: 44,
        overrideOn: false, ovHW: "", ovD: "", ovAW: "",
        played,
        homeScore: played ? homeScore : null,
        awayScore: played ? awayScore : null,
        week: round, date,
      });
    }
  }

  return { fixtures };
}

// ── MAIN ──────────────────────────────────────────────────────────────────────
async function main() {
  log(`Starting at ${new Date().toUTCString()}`);
  log(`${LEAGUES.length} league(s) configured`);

  const fresh = { updatedAt: null, federations: {} };
  const results = [];

  for (const cfg of LEAGUES) {
    log(`\n${cfg.federation} · ${cfg.name} (${cfg.id})`);
    try {
      log(`  Fetching standings, games, stats…`);
      const [standingsHtml, gamesHtml, statsHtml] = await Promise.all([
        fetchHtml(cfg.standingsUrl),
        fetchHtml(cfg.gamesUrl),
        fetchHtml(cfg.statsUrl).catch(() => ""),
      ]);

      const ranking          = parseStandings(standingsHtml);
      const { fixtures }     = parseGames(gamesHtml, ranking);
      const scorers          = parseStats(statsHtml);

      // Build teams from rankings (source of truth for names/order)
      const teams = ranking.map(r => ({
        id:        `t_${r.name.replace(/\W+/g,"_").toLowerCase()}`,
        name:      r.name,
        points:    0,
        homeBonus: "",
      }));

      const played  = fixtures.filter(f => f.played).length;
      const pending = fixtures.filter(f => !f.played).length;

      log(`  Teams: ${teams.length} | Fixtures: ${fixtures.length} (${played} played, ${pending} pending) | Scorers: ${scorers.length}`);
      if (teams.length > 0) log(`  ${teams.slice(0,4).map(t=>t.name).join(", ")}…`);

      if (teams.length === 0 && fixtures.length === 0) {
        throw new Error("No data parsed — page may be empty or structure changed");
      }

      if (!fresh.federations[cfg.federation]) fresh.federations[cfg.federation] = {};
      fresh.federations[cfg.federation][cfg.id] = {
        serieId:    cfg.id,
        name:       cfg.name,
        federation: cfg.federation,
        division:   cfg.division,
        updatedAt:  new Date().toISOString(),
        live:       pending > 0,
        teams,
        fixtures,
        ranking,
        scorers,
      };

      results.push({ id: cfg.id, name: cfg.name, ok: true, teams: teams.length, fixtures: fixtures.length, played, pending, scorers: scorers.length });

    } catch (err) {
      console.error(`  ✗ FAILED: ${err.message}`);
      results.push({ id: cfg.id, name: cfg.name, ok: false, error: err.message });
    }
  }

  fresh.updatedAt = new Date().toISOString();
  fs.writeFileSync(vhvDataPath, JSON.stringify(fresh, null, 2));

  const ok  = results.filter(r => r.ok).length;
  const bad = results.filter(r => !r.ok).length;
  log(`\nDone — ${ok}/${results.length} succeeded`);
  results.filter(r => r.ok).forEach(r =>
    log(`  ✓ ${r.name}: ${r.teams}t ${r.fixtures}fx (${r.played}/${r.pending}) ${r.scorers}sc`)
  );
  results.filter(r => !r.ok).forEach(r =>
    log(`  ✗ ${r.name}: ${r.error}`)
  );
  if (bad > 0 && bad === results.length) process.exit(1);
}

module.exports = { LEAGUES };
if (require.main === module) {
  main().catch(err => { console.error(err); process.exit(1); });
}
