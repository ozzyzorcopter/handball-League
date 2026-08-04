// .github/scripts/diagnose-vhv.js
// Tests the Clubee standings + games parsing for the first few leagues.
// Run via: Actions → Diagnose VHV API → Run workflow

const fs   = require("fs");
const path = require("path");
const OUT  = path.join(process.cwd(), "diagnose-output.json");

const BASE = "https://www.clubee.com/handballbelgium";

// Test a sample of leagues across all federations
const TEST_LEAGUES = [
  { id: "18709", name: "Liga Heren 3",     standingsUrl: `${BASE}/standings-371073v4/leagues/18709/seasons/220`, gamesUrl: `${BASE}/games-371075v4/leagues/18709/seasons/220` },
  { id: "18702", name: "First Div Men",    standingsUrl: `${BASE}/standings-371073v4/leagues/18702/seasons/220`, gamesUrl: `${BASE}/games-371075v4/leagues/18702/seasons/220` },
  { id: "18692", name: "D1 LFH Men",       standingsUrl: `${BASE}/standings-371073v4/leagues/18692/seasons/220`, gamesUrl: `${BASE}/games-371075v4/leagues/18692/seasons/220` },
];

async function fetchHtml(url) {
  const r = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml",
      "Accept-Language": "en-US,en;q=0.9",
    },
  });
  console.log(`  [${r.status}] ${url.replace(BASE,"")}`);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.text();
}

function parseStandings(html) {
  const rows = [];
  const chunks = html.split(/<tr[\s>]/i);
  for (const chunk of chunks) {
    const rowContent = chunk.split(/<\/tr>/i)[0];
    const cells = [];
    const tdRe = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    let td;
    while ((td = tdRe.exec(rowContent)) !== null) {
      const text = td[1].replace(/<[^>]+>/g," ").replace(/&amp;/g,"&").replace(/&nbsp;/g," ").replace(/&#39;/g,"'").replace(/&#x27;/g,"'").replace(/\s+/g," ").trim();
      cells.push(text);
    }
    if (cells.length >= 9 && /^\d+\.?$/.test(cells[0])) {
      rows.push({ pos: parseInt(cells[0]), name: cells[1].replace(/\(Senior [A-Z]\)/g,"").trim(), played: parseInt(cells[2])||0, won: parseInt(cells[3])||0, drawn: parseInt(cells[4])||0, lost: parseInt(cells[5])||0, gf: parseInt(cells[6])||0, ga: parseInt(cells[7])||0, points: parseInt(cells[9])||0 });
    }
  }
  return rows.sort((a,b) => a.pos - b.pos);
}

async function main() {
  console.log("=== DIAGNOSE VHV (Clubee — new URL pattern) ===\n");
  const output = {};

  for (const lg of TEST_LEAGUES) {
    console.log(`\n--- ${lg.name} ---`);
    try {
      const [standingsHtml, gamesHtml] = await Promise.all([
        fetchHtml(lg.standingsUrl),
        fetchHtml(lg.gamesUrl),
      ]);

      // Test standings parser
      const ranking = parseStandings(standingsHtml);
      console.log(`  Standings: ${ranking.length} teams`);
      ranking.slice(0,3).forEach(r => console.log(`    ${r.pos}. ${r.name} — ${r.played}P ${r.points}pts`));

      // Log raw HTML structure around first <tr> with data
      const trIdx = standingsHtml.search(/<tr[\s>]/i);
      if (trIdx >= 0) {
        console.log(`  First <tr> context: ${standingsHtml.slice(trIdx, trIdx+200).replace(/\n/g," ")}`);
      }

      // Check games page
      const hasH3 = standingsHtml.includes("<h3");
      const gameLinks = (gamesHtml.match(/\/games\/\d+/g) || []).length;
      console.log(`  Games page: ${gameLinks} game links, has <h3>: ${gamesHtml.includes("<h3")}`);

      // Show first game link context
      const gIdx = gamesHtml.indexOf("/games/");
      if (gIdx >= 0) {
        const aStart = gamesHtml.lastIndexOf("<a ", gIdx);
        const aEnd   = gamesHtml.indexOf("</a>", gIdx) + 4;
        console.log(`  First game <a>: ${gamesHtml.slice(aStart, aEnd).replace(/\n/g," ").slice(0,300)}`);
      }

      // Show first <h3> context (gameday header)
      const h3Idx = gamesHtml.indexOf("<h3");
      if (h3Idx >= 0) {
        console.log(`  First <h3>: ${gamesHtml.slice(h3Idx, h3Idx+100).replace(/\n/g," ")}`);
      }

      output[lg.id] = { ranking, gameLinks, standingsHtmlLength: standingsHtml.length, gamesHtmlLength: gamesHtml.length };

    } catch(e) {
      console.log(`  ERROR: ${e.message}`);
      output[lg.id] = { error: e.message };
    }
  }

  fs.writeFileSync(OUT, JSON.stringify(output, null, 2));
  console.log(`\n✓ Written to diagnose-output.json`);
}

main().catch(err => { console.error(err); process.exit(1); });
