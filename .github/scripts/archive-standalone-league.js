// .github/scripts/archive-standalone-league.js
// Triggered via GitHub repo_dispatch event from the web app.
// Payload: { league, scorers } where league is the full league object
// from leaguesim-data.json and scorers is the scorer array for it.
// Removes the league from leaguesim-data.json and adds it to
// archive/index.json standaloneLeagues + archive/standalone-leagues.json.

const fs   = require("fs");
const path = require("path");

const root              = process.cwd();
const leaguesimPath     = path.join(root, "leaguesim-data.json");
const scorerPath        = path.join(root, "scorer-data.json");
const archiveDir        = path.join(root, "archive");
const indexPath         = path.join(archiveDir, "index.json");
const standalonePath    = path.join(archiveDir, "standalone-leagues.json");

// Payload comes from ARCHIVE_PAYLOAD env var (set by the Action)
const payloadRaw = process.env.ARCHIVE_PAYLOAD;
if (!payloadRaw) {
  console.error("ARCHIVE_PAYLOAD env var not set");
  process.exit(1);
}

let payload;
try {
  payload = JSON.parse(payloadRaw);
} catch (e) {
  console.error("Could not parse ARCHIVE_PAYLOAD:", e.message);
  process.exit(1);
}

const { leagueId } = payload;
if (!leagueId) {
  console.error("Payload missing leagueId");
  process.exit(1);
}

// Read leaguesim data
if (!fs.existsSync(leaguesimPath)) {
  console.error("leaguesim-data.json not found");
  process.exit(1);
}
const leaguesimData = JSON.parse(fs.readFileSync(leaguesimPath, "utf8"));
const leagueIndex   = (leaguesimData.leagues || []).findIndex(l => l.id === leagueId);

if (leagueIndex === -1) {
  console.error(`League with id "${leagueId}" not found in leaguesim-data.json`);
  process.exit(1);
}

const league = leaguesimData.leagues[leagueIndex];
console.log(`Archiving: "${league.name}"`);

// Get scorer data for this league
let scorers = null;
if (fs.existsSync(scorerPath)) {
  const scorerData = JSON.parse(fs.readFileSync(scorerPath, "utf8"));
  const entry = (scorerData.leagues || []).find(l => l.leagueId === leagueId || l.name === league.name);
  if (entry) scorers = entry.scorers;
}

// Build the standalone archive entry
const archivedAt = new Date().toISOString();
const entry = {
  id:         league.id,
  name:       league.name,
  type:       "standalone",
  archivedAt,
  league,
  scorers,
};

// Ensure archive dir exists
if (!fs.existsSync(archiveDir)) fs.mkdirSync(archiveDir, { recursive: true });

// Load or create standalone-leagues.json
let standalone = { leagues: [] };
if (fs.existsSync(standalonePath)) {
  standalone = JSON.parse(fs.readFileSync(standalonePath, "utf8"));
}

// Don't add duplicates — remove any existing entry with same id
standalone.leagues = standalone.leagues.filter(l => l.id !== league.id);
standalone.leagues.unshift(entry);
fs.writeFileSync(standalonePath, JSON.stringify(standalone, null, 2));
console.log(`Written: archive/standalone-leagues.json`);

// Update index.json
let index = { belgianSeasons: [], standaloneLeagues: [], legacySeasons: [] };
if (fs.existsSync(indexPath)) {
  const raw = JSON.parse(fs.readFileSync(indexPath, "utf8"));
  if (Array.isArray(raw)) {
    index.legacySeasons = raw;
  } else {
    index = { belgianSeasons: raw.belgianSeasons || [], standaloneLeagues: raw.standaloneLeagues || [], legacySeasons: raw.legacySeasons || [] };
  }
}

// Remove existing entry with same id, add new one at top
index.standaloneLeagues = index.standaloneLeagues.filter(l => l.id !== league.id);
index.standaloneLeagues.unshift({
  type:       "standalone",
  id:         league.id,
  name:       league.name,
  archivedAt,
});
fs.writeFileSync(indexPath, JSON.stringify(index, null, 2));
console.log(`Updated: archive/index.json`);

// Remove from leaguesim-data.json
leaguesimData.leagues.splice(leagueIndex, 1);
fs.writeFileSync(leaguesimPath, JSON.stringify(leaguesimData, null, 2));
console.log(`Removed "${league.name}" from leaguesim-data.json`);
console.log(`\nDone — "${league.name}" archived as standalone league.`);
