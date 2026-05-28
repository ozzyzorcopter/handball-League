// .github/scripts/archive-season.js
// Usage: node archive-season.js "2025-2026"
// Reads leaguesim-data.json and scorer-data.json, archives all leagues
// marked archivable: true, saves to archive/season-YYYY-YYYY.json
// and updates archive/index.json

const fs = require("fs");
const path = require("path");

const season = process.argv[2]?.trim();
if (!season || !/^\d{4}\s*-\s*\d{4}$/.test(season)) {
  console.error("Usage: node archive-season.js \"YYYY-YYYY\" or \"YYYY - YYYY\"");
  process.exit(1);
}

// Normalize to YYYY-YYYY for filename, keep original for display
const seasonNorm = season.replace(/\s*-\s*/, "-");
const seasonDisplay = season;

const root = process.cwd();
const leaguesimPath = path.join(root, "leaguesim-data.json");
const scorerPath = path.join(root, "scorer-data.json");
const archiveDir = path.join(root, "archive");
const indexPath = path.join(archiveDir, "index.json");
const outPath = path.join(archiveDir, `season-${seasonNorm}.json`);

// Read leaguesim data
if (!fs.existsSync(leaguesimPath)) {
  console.error("leaguesim-data.json not found");
  process.exit(1);
}
const leaguesimData = JSON.parse(fs.readFileSync(leaguesimPath, "utf8"));

// Filter to archivable leagues
const archivableLeagues = (leaguesimData.leagues || []).filter(lg => lg.archivable);
if (archivableLeagues.length === 0) {
  console.error("No leagues tagged for archive (archivable: true)");
  process.exit(1);
}
console.log(`Archiving ${archivableLeagues.length} leagues: ${archivableLeagues.map(l => l.name).join(", ")}`);

// Read scorer data if available
let scorers = {};
if (fs.existsSync(scorerPath)) {
  const scorerData = JSON.parse(fs.readFileSync(scorerPath, "utf8"));
  for (const league of (scorerData.leagues || [])) {
    if (league.scorers && league.scorers.length > 0) {
      scorers[league.name] = league.scorers;
    }
  }
  console.log(`Scorer data: ${Object.keys(scorers).length} leagues with data`);
} else {
  console.log("No scorer-data.json found — archiving without scorers");
}

// Build archive object
const archive = {
  season: seasonDisplay,
  archivedAt: new Date().toISOString(),
  leagues: archivableLeagues,
  scorers,
};

// Ensure archive directory exists
if (!fs.existsSync(archiveDir)) fs.mkdirSync(archiveDir);

// Write season file
fs.writeFileSync(outPath, JSON.stringify(archive, null, 2));
console.log(`Written: archive/season-${seasonNorm}.json`);

// Update index
let index = [];
if (fs.existsSync(indexPath)) {
  index = JSON.parse(fs.readFileSync(indexPath, "utf8"));
}

// Remove existing entry for this season if re-archiving
index = index.filter(s => s.season !== seasonDisplay);
index.unshift({
  season: seasonDisplay,
  filename: `season-${seasonNorm}.json`,
  leagueCount: archivableLeagues.length,
  archivedAt: archive.archivedAt,
});

// Sort newest first
index.sort((a, b) => b.season.localeCompare(a.season));

fs.writeFileSync(indexPath, JSON.stringify(index, null, 2));
console.log(`Updated: archive/index.json (${index.length} seasons total)`);
console.log(`\nDone! Season ${seasonDisplay} archived successfully.`);
