// .github/scripts/delete-archive-entry.js
// Triggered via GitHub repo_dispatch from the web app.
// ARCHIVE_PAYLOAD: { type: "belgian", season: "YYYY - YYYY" }
//               OR { type: "standalone", id: "leagueId" }
// Removes the entry from index.json and optionally the data file.

const fs   = require("fs");
const path = require("path");

const root           = process.cwd();
const archiveDir     = path.join(root, "archive");
const indexPath      = path.join(archiveDir, "index.json");
const standalonePath = path.join(archiveDir, "standalone-leagues.json");

const payloadRaw = process.env.ARCHIVE_PAYLOAD;
if (!payloadRaw) { console.error("ARCHIVE_PAYLOAD not set"); process.exit(1); }

let payload;
try { payload = JSON.parse(payloadRaw); }
catch (e) { console.error("Could not parse ARCHIVE_PAYLOAD:", e.message); process.exit(1); }

if (!fs.existsSync(indexPath)) { console.error("archive/index.json not found"); process.exit(1); }

const raw   = JSON.parse(fs.readFileSync(indexPath, "utf8"));
const index = Array.isArray(raw)
  ? { belgianSeasons: [], standaloneLeagues: [], legacySeasons: raw }
  : { belgianSeasons: raw.belgianSeasons || [], standaloneLeagues: raw.standaloneLeagues || [], legacySeasons: raw.legacySeasons || [] };

if (payload.type === "belgian") {
  const season   = payload.season;
  const entry    = index.belgianSeasons.find(s => s.season === season);
  if (!entry) { console.error(`Belgian season "${season}" not found`); process.exit(1); }

  // Delete the season data file
  const dataFile = path.join(archiveDir, entry.filename);
  if (fs.existsSync(dataFile)) { fs.unlinkSync(dataFile); console.log(`Deleted: archive/${entry.filename}`); }

  index.belgianSeasons = index.belgianSeasons.filter(s => s.season !== season);
  console.log(`Removed Belgian season "${season}" from index`);

} else if (payload.type === "standalone") {
  const id    = payload.id;
  const entry = index.standaloneLeagues.find(l => l.id === id);
  if (!entry) { console.error(`Standalone league "${id}" not found`); process.exit(1); }

  // Remove from standalone-leagues.json
  if (fs.existsSync(standalonePath)) {
    const standalone = JSON.parse(fs.readFileSync(standalonePath, "utf8"));
    standalone.leagues = standalone.leagues.filter(l => l.id !== id);
    fs.writeFileSync(standalonePath, JSON.stringify(standalone, null, 2));
    console.log(`Removed from archive/standalone-leagues.json`);
  }

  index.standaloneLeagues = index.standaloneLeagues.filter(l => l.id !== id);
  console.log(`Removed standalone league "${entry.name}" from index`);

} else {
  console.error(`Unknown type: ${payload.type}`);
  process.exit(1);
}

fs.writeFileSync(indexPath, JSON.stringify(index, null, 2));
console.log(`Updated: archive/index.json`);
console.log(`\nDone.`);
