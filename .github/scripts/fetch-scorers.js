// .github/scripts/fetch-scorers.js
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

// Build list of fetch tasks: regular, playoff, playdown
const tasks = [];
for (const lg of (leaguesimData.leagues || [])) {
  if (lg.scorerUrl?.trim())        tasks.push({ leagueId: lg.id, name: lg.name, phase: "regular",  url: lg.scorerUrl.trim() });
  if (lg.playoffScorerUrl?.trim()) tasks.push({ leagueId: lg.id, name: lg.name, phase: "playoff",  url: lg.playoffScorerUrl.trim() });
  if (lg.playdownScorerUrl?.trim())tasks.push({ leagueId: lg.id, name: lg.name, phase: "playdown", url: lg.playdownScorerUrl.trim() });
}

if (tasks.length === 0) {
  console.log("No scorer URLs configured — nothing to fetch");
  process.exit(0);
}

// Load previous scorer data for delta
let prevData = { leagues: [] };
if (fs.existsSync(scorerPath)) prevData = JSON.parse(fs.readFileSync(scorerPath, "utf8"));

function prevKey(leagueId, phase) { return leagueId + ":" + phase; }
const prevByKey = {};
for (const l of (prevData.leagues || [])) {
  prevByKey[prevKey(l.leagueId, l.phase || "regular")] = l.scorers || [];
}

function parseScorers(html) {
  const results = [];
  const segments = html.split(/<tr>/i);
  for (const seg of segments) {
    const cells = [];
    const cellRe = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    let m;
    while ((m = cellRe.exec(seg)) !== null) {
      cells.push(m[1].replace(/<[^>]+>/g, "").replace(/\[\d+\]\s*/g, "").trim());
    }
    if (cells.length >= 4) {
      const goals = parseInt(cells[3]);
      if (!isNaN(goals) && cells[1] && cells[2]) results.push({ player: cells[1], club: cells[2], goals });
    }
  }
  return results;
}

function computeDeltas(newScorers, prevScorers) {
  const prevByPlayer = {};
  for (const s of prevScorers) prevByPlayer[s.player] = s.goals;

  const prevByClub = {}, newByClub = {};
  for (const s of prevScorers) { if (!prevByClub[s.club]) prevByClub[s.club] = {}; prevByClub[s.club][s.player] = s.goals; }
  for (const s of newScorers)  { if (!newByClub[s.club])  newByClub[s.club]  = {}; newByClub[s.club][s.player]  = s.goals; }

  const updatedClubs = new Set();
  for (const club of Object.keys(newByClub)) {
    const newTotal = Object.values(newByClub[club]).reduce((a, b) => a + b, 0);
    const oldTotal = Object.values(prevByClub[club] || {}).reduce((a, b) => a + b, 0);
    if (newTotal > oldTotal) updatedClubs.add(club);
  }

  return newScorers.map(s => {
    const prev = prevByPlayer[s.player];
    const delta = updatedClubs.has(s.club) ? (prev != null ? s.goals - prev : null) : null;
    return { ...s, delta };
  });
}

async function fetchTask(task) {
  const key = prevKey(task.leagueId, task.phase);
  try {
    const res = await fetch(task.url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "nl-BE,nl;q=0.9",
      }
    });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const html = await res.text();
    const raw = parseScorers(html);
    if (raw.length === 0) throw new Error("Parsed 0 scorers");
    const scorers = computeDeltas(raw, prevByKey[key] || []);
    const updated = [...new Set(scorers.filter(s => s.delta > 0).map(s => s.club))];
    console.log(`  ✓ ${task.name} [${task.phase}]: ${scorers.length} scorers — #1: ${scorers[0].player} (${scorers[0].goals}g)${updated.length ? " — updated: " + updated.join(", ") : ""}`);
    return { leagueId: task.leagueId, name: task.name, phase: task.phase, scorers, updatedAt: new Date().toISOString() };
  } catch (err) {
    console.error(`  ✗ ${task.name} [${task.phase}]: FAILED — ${err.message}`);
    return { leagueId: task.leagueId, name: task.name, phase: task.phase, scorers: prevByKey[key] || [], error: err.message, updatedAt: new Date().toISOString() };
  }
}

async function main() {
  console.log(`\nFetching scorer data at ${new Date().toUTCString()}`);
  console.log(`${tasks.length} task(s): ${tasks.map(t => t.name + " [" + t.phase + "]").join(", ")}\n`);
  const results = await Promise.all(tasks.map(fetchTask));
  const total = results.reduce((s, l) => s + l.scorers.length, 0);
  const failed = results.filter(l => l.error).length;
  const output = { updatedAt: new Date().toISOString(), leagues: results };
  fs.writeFileSync(scorerPath, JSON.stringify(output, null, 2));
  console.log(`\nDone — ${total} scorers, ${results.length - failed}/${results.length} tasks succeeded`);
  if (failed === results.length && results.length > 0) process.exit(1);
}

main().catch(err => { console.error(err); process.exit(1); });
