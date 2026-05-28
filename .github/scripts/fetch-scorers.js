// .github/scripts/fetch-scorers.js
// Reads scorer URLs from leaguesim-data.json, fetches each, stores by leagueId
// Computes goal delta per player per team (0 if team was updated but player didn't score)

const fs = require("fs");
const path = require("path");

const root = process.cwd();
const leaguesimPath = path.join(root, "leaguesim-data.json");
const scorerPath = path.join(root, "scorer-data.json");

if (!fs.existsSync(leaguesimPath)) {
  console.error("leaguesim-data.json not found");
  process.exit(1);
}

const leaguesimData = JSON.parse(fs.readFileSync(leaguesimPath, "utf8"));
const leagues = (leaguesimData.leagues || []).filter(lg => lg.scorerUrl && lg.scorerUrl.trim());

if (leagues.length === 0) {
  console.log("No leagues with scorerUrl set — nothing to fetch");
  process.exit(0);
}

// Load previous scorer data for delta calculation
let prevData = { leagues: [] };
if (fs.existsSync(scorerPath)) {
  prevData = JSON.parse(fs.readFileSync(scorerPath, "utf8"));
}
const prevByLeagueId = {};
for (const l of (prevData.leagues || [])) {
  if (l.leagueId) prevByLeagueId[l.leagueId] = l.scorers || [];
}

function parseScorers(html) {
  const results = [];
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
      if (!isNaN(goals) && player && club) results.push({ player, club, goals });
    }
  }
  return results;
}

function computeDeltas(newScorers, prevScorers) {
  // Build previous goals by player
  const prevByPlayer = {};
  for (const s of prevScorers) prevByPlayer[s.player] = s.goals;

  // Find which clubs had any change
  const prevByClub = {};
  for (const s of prevScorers) {
    if (!prevByClub[s.club]) prevByClub[s.club] = {};
    prevByClub[s.club][s.player] = s.goals;
  }
  const newByClub = {};
  for (const s of newScorers) {
    if (!newByClub[s.club]) newByClub[s.club] = {};
    newByClub[s.club][s.player] = s.goals;
  }

  // For each club, check if any player increased — if so, club was updated
  const updatedClubs = new Set();
  for (const club of Object.keys(newByClub)) {
    const newPlayers = newByClub[club];
    const oldPlayers = prevByClub[club] || {};
    for (const [player, goals] of Object.entries(newPlayers)) {
      if (goals > (oldPlayers[player] ?? goals)) {
        updatedClubs.add(club);
        break;
      }
    }
    // Also check if total goals for club changed
    const newTotal = Object.values(newPlayers).reduce((a, b) => a + b, 0);
    const oldTotal = Object.values(oldPlayers).reduce((a, b) => a + b, 0);
    if (newTotal > oldTotal) updatedClubs.add(club);
  }

  return newScorers.map(s => {
    const prev = prevByPlayer[s.player];
    let delta = null;
    if (updatedClubs.has(s.club)) {
      // Club was updated this round — show delta (0 if player didn't score)
      delta = prev != null ? s.goals - prev : null;
    }
    return { ...s, delta };
  });
}

async function fetchLeague(league) {
  try {
    const res = await fetch(league.scorerUrl.trim(), {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "nl-BE,nl;q=0.9",
      }
    });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const html = await res.text();
    const rawScorers = parseScorers(html);
    if (rawScorers.length === 0) throw new Error("Parsed 0 scorers");

    const prevScorers = prevByLeagueId[league.id] || [];
    const scorers = computeDeltas(rawScorers, prevScorers);

    const updatedClubs = [...new Set(scorers.filter(s => s.delta != null && s.delta > 0).map(s => s.club))];
    console.log(`  ✓ ${league.name}: ${scorers.length} scorers — #1: ${scorers[0].player} (${scorers[0].goals}g, ${scorers[0].club})${updatedClubs.length ? " — updated: " + updatedClubs.join(", ") : ""}`);
    return { leagueId: league.id, name: league.name, scorers, updatedAt: new Date().toISOString() };
  } catch (err) {
    console.error(`  ✗ ${league.name}: FAILED — ${err.message}`);
    // Keep previous data on failure
    const prev = prevByLeagueId[league.id] || [];
    return { leagueId: league.id, name: league.name, scorers: prev, error: err.message, updatedAt: new Date().toISOString() };
  }
}

async function main() {
  console.log(`\nFetching scorer data at ${new Date().toUTCString()}`);
  console.log(`Found ${leagues.length} league(s) with scorer URLs\n`);

  const results = await Promise.all(leagues.map(fetchLeague));
  const total = results.reduce((s, l) => s + l.scorers.length, 0);
  const failed = results.filter(l => l.error).length;

  const output = { updatedAt: new Date().toISOString(), leagues: results };
  fs.writeFileSync(scorerPath, JSON.stringify(output, null, 2));

  console.log(`\nDone — ${total} scorers across ${results.length - failed}/${results.length} leagues`);
  if (failed === results.length && results.length > 0) process.exit(1);
}

main().catch(err => { console.error(err); process.exit(1); });
