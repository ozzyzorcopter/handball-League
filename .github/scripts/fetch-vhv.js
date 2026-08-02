// .github/scripts/fetch-vhv.js
// Fetches Belgian handball data from Clubee (clubee.com/handballbelgium)
// by scraping SSR HTML pages — no Playwright, no auth needed.
// Writes vhv-data.json grouped by federation.
//
// HOW TO FIND LEAGUE URLS:
// 1. Go to clubee.com/handballbelgium
// 2. Navigate to a competition (e.g. Liga Heren 3)
// 3. The URL is the fixturesUrl below (e.g. .../liga-heren-3-982067v4)
// 4. The standings URL follows pattern: .../standings-371073v4/leagues/LEAGUE_ID/seasons/SEASON_ID
//    where LEAGUE_ID and SEASON_ID appear in the nav links on the fixtures page

const fs   = require("fs");
const path = require("path");

const root        = process.cwd();
const vhvDataPath = path.join(root, "vhv-data.json");

// ── LEAGUE CONFIG ─────────────────────────────────────────────────────────────
// For each league, provide:
//   fixturesUrl:  the main competition page (shows all gamedays + team names)
//   standingsUrl: the standings page (shows table with W/D/L/GF/GA/Pts)
//   name:         display name (auto-detected from page if left empty "")
//   federation:   "VHV" | "URBH-KBHB" | "LFH"
//
// Liga Heren 3 confirmed. Add other leagues as you find their URLs on Clubee.
const LEAGUES = [
  {
    id: "18709",                // Clubee league ID (from URL)
    name: "Liga Heren 3",
    federation: "VHV",
    fixturesUrl:  "https://www.clubee.com/handballbelgium/liga-heren-3-982067v4",
    standingsUrl: "https://www.clubee.com/handballbelgium/standings-371073v4/leagues/18709/seasons/220",
  },
  // Add more leagues here once you find their Clubee URLs:
  // {
  //   id: "XXXXX",
  //   name: "Liga Heren 2",
  //   federation: "VHV",
  //   fixturesUrl:  "https://www.clubee.com/handballbelgium/liga-heren-2-XXXXXXV4",
  //   standingsUrl: "https://www.clubee.com/handballbelgium/standings-371073v4/leagues/XXXXX/seasons/220",
  // },
];

// ── UTILS ─────────────────────────────────────────────────────────────────────
function log(msg)  { console.log(`[fetch-vhv] ${msg}`); }
function warn(msg) { console.warn(`[fetch-vhv] ⚠ ${msg}`); }

async function fetchHtml(url) {
  const r = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml",
    },
  });
  if (!r.ok) throw new Error(`HTTP ${r.status} for ${url}`);
  return r.text();
}

// ── PARSE STANDINGS ───────────────────────────────────────────────────────────
// Parse the HTML table from the standings page.
// Returns [{ pos, name, played, won, drawn, lost, gf, ga, points }]
function parseStandings(html) {
  const rows = [];
  // Match <tr> rows inside the table
  const trRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let tr;
  while ((tr = trRe.exec(html)) !== null) {
    const cells = [];
    const tdRe = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    let td;
    while ((td = tdRe.exec(tr[1])) !== null) {
      // Strip all HTML tags and decode common entities
      const text = td[1]
        .replace(/<[^>]+>/g, " ")
        .replace(/&amp;/g, "&").replace(/&nbsp;/g, " ")
        .replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
        .replace(/\s+/g, " ").trim();
      cells.push(text);
    }
    // Valid row: first cell is a position number, has at least 9 cells
    if (cells.length >= 9 && /^\d+\.?$/.test(cells[0])) {
      const pos    = parseInt(cells[0]);
      // Cell 1 is the team name (may include image alt text — take last word group)
      const rawName = cells[1].replace(/\(Senior [MFW]\)/g, "").trim();
      const name   = rawName || `Team ${pos}`;
      const played = parseInt(cells[2]) || 0;
      const won    = parseInt(cells[3]) || 0;
      const drawn  = parseInt(cells[4]) || 0;
      const lost   = parseInt(cells[5]) || 0;
      const gf     = parseInt(cells[6]) || 0;
      const ga     = parseInt(cells[7]) || 0;
      const points = parseInt(cells[9]) || 0; // cell 8 is GD
      rows.push({ pos, name, played, won, drawn, lost, gf, ga, points });
    }
  }
  return rows.sort((a, b) => a.pos - b.pos);
}

// ── PARSE FIXTURES ────────────────────────────────────────────────────────────
// Parse gameday fixtures from the fixtures page HTML.
// Returns { leagueName, teams, fixtures }
function parseFixtures(html, existingStandings) {
  // Extract league/season title from <h1> or <title>
  const h1Match = html.match(/<h1[^>]*>\s*(.*?)\s*<\/h1>/i);
  const leagueName = h1Match
    ? h1Match[1].replace(/<[^>]+>/g, "").replace(/\(Senior [MFW]\)/g, "").trim()
    : "";

  // Build team set from standings (most reliable source for clean names)
  const teamNames = existingStandings.length > 0
    ? existingStandings.map(r => r.name)
    : [];

  // Extract all game links: each game is a <a href=".../games/GAMEID">
  // The page shows: [Home Team][Date/Time][Away Team]
  // Pattern from the fetched page:
  // [**Home Team**](.../games/ID)[**Away Team**]
  const fixtures = [];
  let round = 0;
  let fixtureCounter = 0;

  // Find gameday markers and game entries
  // Gameday headers: "### Gameday N" or "### Dag N"
  const gamedayRe = /###\s+(?:Gameday|Dag|Round|Ronde|Speeldag)\s+(\d+)/gi;
  const gameRe = /\[(?:\*\*)?([^\]]+?)(?:\*\*)?\]\(https:\/\/www\.clubee\.com\/handballbelgium\/games\/(\d+)\)\[(?:\*\*)?([^\]]+?)(?:\*\*)?\]/g;

  // Split by gameday
  const gamedaySections = html.split(/###\s+(?:Gameday|Dag|Round|Ronde|Speeldag)\s+\d+/i);
  let gamedayNum = 0;

  // Process each section
  const fullText = html;
  let lastIdx = 0;

  // Reset and use a line-by-line approach on the markdown-like content
  const lines = html.split("\n");
  let currentRound = 0;

  for (const line of lines) {
    // Check for gameday header
    const gdMatch = line.match(/###\s+(?:Gameday|Dag|Round|Ronde|Speeldag)\s+(\d+)/i);
    if (gdMatch) { currentRound = parseInt(gdMatch[1]); continue; }

    // Check for game link pairs on the same line
    // Format: [**Home**](url/games/ID)[**Away**]
    // Or: [Home](url)[Score][Away]
    // The markdown rendered version shows: [**Team**](link)[**Team**]
    const lineGameRe = /\[(?:\*\*)?([^\]]+?)(?:\*\*)?\]\(https:\/\/www\.clubee\.com\/handballbelgium\/games\/(\d+)\)\[(?:\*\*)?([^\]]+?)(?:\*\*)?\]/g;
    let m;
    while ((m = lineGameRe.exec(line)) !== null) {
      const homeName = m[1].replace(/\(Senior [MFW]\)/g, "").replace(/\s+/g, " ").trim();
      const gameId   = m[2];
      const awayName = m[3].replace(/\(Senior [MFW]\)/g, "").replace(/\s+/g, " ").trim();

      if (!homeName || !awayName || homeName === awayName) continue;

      // Extract date from line (format: DD.MM.YYYY or similar)
      const dateMatch = line.match(/(\d{2})\.(\d{2})\.(\d{4})/);
      const date = dateMatch ? `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}` : null;

      // Add teams if not seen
      if (!teamNames.includes(homeName) && homeName !== "TBA") teamNames.push(homeName);
      if (!teamNames.includes(awayName) && awayName !== "TBA") teamNames.push(awayName);

      const homeIdx = teamNames.indexOf(homeName);
      const awayIdx = teamNames.indexOf(awayName);

      if (homeIdx < 0 || awayIdx < 0) continue;

      fixtures.push({
        id:        `f${fixtureCounter++}`,
        gameId,
        homeIdx,
        awayIdx,
        homeWin:   50, draw: 6, awayWin: 44,
        overrideOn: false, ovHW: "", ovD: "", ovAW: "",
        played:    false,
        homeScore: null,
        awayScore: null,
        week:      currentRound,
        date,
      });
    }
  }

  // Build team objects
  const teams = teamNames.map((name, i) => ({
    id:        `t_${name.replace(/\s+/g, "_").toLowerCase()}`,
    name,
    points:    0,
    homeBonus: "",
  }));

  return { leagueName, teams, fixtures };
}

// ── MAIN ──────────────────────────────────────────────────────────────────────
async function main() {
  log(`Starting at ${new Date().toUTCString()}`);
  log(`${LEAGUES.length} league(s) configured`);

  // Start fresh each run — no stale data kept
  const fresh = { updatedAt: null, federations: {} };
  const results = [];

  for (const cfg of LEAGUES) {
    log(`\n${cfg.federation} · ${cfg.name} (league ${cfg.id})`);
    try {
      // Fetch both pages in parallel
      log(`  Fetching fixtures + standings…`);
      const [fixturesHtml, standingsHtml] = await Promise.all([
        fetchHtml(cfg.fixturesUrl),
        fetchHtml(cfg.standingsUrl),
      ]);

      // Parse standings first (gives us clean team names)
      const ranking = parseStandings(standingsHtml);
      log(`  Standings: ${ranking.length} teams`);
      if (ranking.length > 0) {
        log(`  Teams: ${ranking.map(r => r.name).join(", ")}`);
      }

      // Parse fixtures (uses standings team names for matching)
      const { leagueName, teams, fixtures } = parseFixtures(fixturesHtml, ranking);
      const serieName = cfg.name || leagueName || `League ${cfg.id}`;

      const played  = fixtures.filter(f => f.played).length;
      const pending = fixtures.filter(f => !f.played).length;
      log(`  Fixtures: ${fixtures.length} (${played} played, ${pending} pending)`);
      log(`  Name: "${serieName}"`);

      if (teams.length === 0 && fixtures.length === 0) {
        throw new Error("No teams or fixtures parsed — check URL or page structure");
      }

      if (!fresh.federations[cfg.federation]) fresh.federations[cfg.federation] = {};
      fresh.federations[cfg.federation][cfg.id] = {
        serieId:    cfg.id,
        name:       serieName,
        federation: cfg.federation,
        updatedAt:  new Date().toISOString(),
        live:       pending > 0,
        teams,
        fixtures,
        ranking,
      };

      results.push({ id: cfg.id, name: serieName, ok: true, teams: teams.length, fixtures: fixtures.length, played, pending });

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
    log(`  ✓ ${r.name}: ${r.teams} teams, ${r.fixtures} fixtures (${r.played} played, ${r.pending} pending)`)
  );
  results.filter(r => !r.ok).forEach(r =>
    log(`  ✗ ${r.name}: ${r.error}`)
  );
  if (bad > 0 && bad === results.length) process.exit(1);
}

// Export config so fetch-scorers.js can read scorerUrls
module.exports = { LEAGUES };

if (require.main === module) {
  main().catch(err => { console.error(err); process.exit(1); });
}
