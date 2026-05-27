// .github/scripts/fetch-scorers.js
const fs = require("fs");
const path = require("path");

const LEAGUES = [
  { name: "VHV Regio OWv", url: "https://admin.handballbelgium.be/lms_league_ws/scripts/urbh_goals_rankings.php?organization=VHV&serie=655" },
  { name: "VHV Liga 1",    url: "https://admin.handballbelgium.be/lms_league_ws/scripts/urbh_goals_rankings.php?organization=VHV&serie=650" },
  { name: "VHV Liga 2",    url: "https://admin.handballbelgium.be/lms_league_ws/scripts/urbh_goals_rankings.php?organization=VHV&serie=651" },
  { name: "VHV Liga 3",    url: "https://admin.handballbelgium.be/lms_league_ws/scripts/urbh_goals_rankings.php?organization=VHV&serie=652" },
  { name: "1e Nationale",  url: "https://admin.handballbelgium.be/lms_league_ws/scripts/urbh_goals_rankings.php?organization=URBH-KBHB&serie=655" },
  { name: "2e Nationale",  url: "https://admin.handballbelgium.be/lms_league_ws/scripts/urbh_goals_rankings.php?organization=URBH-KBHB&serie=646" },
];

function parseScorers(html) {
  const results = [];
  const rowRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowMatch;
  while ((rowMatch = rowRe.exec(html)) !== null) {
    const cells = [];
    const cellRe = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    let cellMatch;
    while ((cellMatch = cellRe.exec(rowMatch[1])) !== null) {
      cells.push(cellMatch[1].replace(/<[^>]+>/g, "").replace(/\[\d+\]\s*/g, "").trim());
    }
    if (cells.length >= 4) {
      const goals = parseInt(cells[3]);
      if (!isNaN(goals) && cells[1]) {
        results.push({ player: cells[1], club: cells[2], goals });
      }
    }
  }
  return results;
}

async function fetchLeague(league) {
  try {
    const res = await fetch(league.url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; LeagueSim/1.0)" }
    });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const html = await res.text();
    const scorers = parseScorers(html);
    console.log(`  ✓ ${league.name}: ${scorers.length} scorers — top: ${scorers[0] ? scorers[0].player + " (" + scorers[0].goals + ")" : "none"}`);
    return { name: league.name, scorers, updatedAt: new Date().toISOString() };
  } catch (err) {
    console.error(`  ✗ ${league.name}: FAILED — ${err.message}`);
    return { name: league.name, scorers: [], error: err.message, updatedAt: new Date().toISOString() };
  }
}

async function main() {
  console.log(`\nFetching scorer data at ${new Date().toUTCString()}\n`);
  const results = await Promise.all(LEAGUES.map(fetchLeague));
  const total = results.reduce((s, l) => s + l.scorers.length, 0);
  const failed = results.filter(l => l.error).length;

  const output = { updatedAt: new Date().toISOString(), leagues: results };
  const outPath = path.join(process.cwd(), "scorer-data.json");
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2));

  console.log(`\nDone — ${total} scorers across ${results.length - failed} leagues (${failed} failed)`);
  if (failed > 0) process.exit(1); // fail the action if any league failed
}

main().catch(err => { console.error(err); process.exit(1); });
