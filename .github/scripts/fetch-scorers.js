// .github/scripts/fetch-scorers.js
// Fetches scorer data from handballbelgium.be and saves to scorer-data.json

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

// Parse scorer HTML table into [{player, club, goals}]
function parseScorers(html) {
  const results = [];
  const rowRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowMatch;
  while ((rowMatch = rowRe.exec(html)) !== null) {
    const cells = [];
    const cellRe = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    let cellMatch;
    while ((cellMatch = cellRe.exec(rowMatch[1])) !== null) {
      cells.push(cellMatch[1].replace(/<[^>]+>/g, "").replace(/\[[\d]+\]\s*/g, "").trim());
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
    const res = await fetch(league.url);
    if (!res.ok) throw new Error("HTTP " + res.status);
    const html = await res.text();
    const scorers = parseScorers(html);
    console.log(`  ${league.name}: ${scorers.length} scorers`);
    return { name: league.name, scorers, updatedAt: new Date().toISOString() };
  } catch (err) {
    console.error(`  ${league.name}: FAILED — ${err.message}`);
    return { name: league.name, scorers: [], error: err.message, updatedAt: new Date().toISOString() };
  }
}

async function main() {
  console.log("Fetching scorer data...");
  const results = await Promise.all(LEAGUES.map(fetchLeague));
  const output = {
    updatedAt: new Date().toISOString(),
    leagues: results,
  };

  const outPath = path.join(process.cwd(), "scorer-data.json");
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2));
  console.log(`Saved to scorer-data.json (${results.reduce((s, l) => s + l.scorers.length, 0)} total scorers)`);
}

main().catch(err => { console.error(err); process.exit(1); });
