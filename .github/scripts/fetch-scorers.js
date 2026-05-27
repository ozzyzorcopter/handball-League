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
  // Split on <tr> since rows end with <tr> instead of </tr> (malformed HTML)
  const segments = html.split(/<tr>/i);
  for (const seg of segments) {
    const cells = [];
    const cellRe = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    let cellMatch;
    while ((cellMatch = cellRe.exec(seg)) !== null) {
      const text = cellMatch[1]
        .replace(/<[^>]+>/g, "")
        .replace(/\[\d+\]\s*/g, "")
        .trim();
      cells.push(text);
    }
    if (cells.length >= 4) {
      const goals = parseInt(cells[3]);
      const player = cells[1];
      const club = cells[2];
      if (!isNaN(goals) && player && club) {
        results.push({ player, club, goals });
      }
    }
  }
  return results;
}

async function fetchLeague(league) {
  try {
    const res = await fetch(league.url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "nl-BE,nl;q=0.9",
      }
    });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const html = await res.text();
    const scorers = parseScorers(html);
    if (scorers.length === 0) throw new Error("Parsed 0 scorers — page may have changed structure");
    console.log(`  ✓ ${league.name}: ${scorers.length} scorers — #1: ${scorers[0].player} (${scorers[0].goals} goals, ${scorers[0].club})`);
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
  fs.writeFileSync(path.join(process.cwd(), "scorer-data.json"), JSON.stringify(output, null, 2));
  console.log(`\nDone — ${total} scorers across ${results.length - failed}/${results.length} leagues`);
  if (failed === results.length) process.exit(1);
}

main().catch(err => { console.error(err); process.exit(1); });
