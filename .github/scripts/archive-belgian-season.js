// .github/scripts/archive-belgian-season.js
// Snapshots vhv-data.json into archive/belgian-season-YYYY-YYYY.json
// and updates archive/index.json under the "belgianSeasons" key.
// Never overwrites existing data — only adds new leagues.
// Run automatically on 31 May each year via GitHub Actions cron.

const fs   = require("fs");
const path = require("path");

const root        = process.cwd();
const vhvDataPath = path.join(root, "vhv-data.json");
const archiveDir  = path.join(root, "archive");
const indexPath   = path.join(archiveDir, "index.json");

// Derive season label from current date, e.g. "2025 - 2026"
function deriveSeasonLabel(now = new Date()) {
  const y = now.getFullYear();
  const m = now.getMonth() + 1; // 1-based
  // Handball season runs Aug–May: if Jan–May we're in (y-1)–y, else y–(y+1)
  const startYear = m <= 6 ? y - 1 : y;
  return `${startYear} - ${startYear + 1}`;
}

if (!fs.existsSync(vhvDataPath)) {
  console.error("vhv-data.json not found — nothing to archive");
  process.exit(1);
}

const vhvData = JSON.parse(fs.readFileSync(vhvDataPath, "utf8"));
const federations = vhvData.federations || {};
const totalLeagues = Object.values(federations).reduce((n, fed) => n + Object.keys(fed).length, 0);

if (totalLeagues === 0) {
  console.log("No Belgian leagues in vhv-data.json — skipping archive");
  process.exit(0);
}

const seasonLabel = deriveSeasonLabel();
const seasonNorm  = seasonLabel.replace(/\s*-\s*/, "-");
const filename    = `belgian-season-${seasonNorm}.json`;
const outPath     = path.join(archiveDir, filename);

if (!fs.existsSync(archiveDir)) fs.mkdirSync(archiveDir, { recursive: true });

// Load or create the archive file for this season
let existing = { season: seasonLabel, archivedAt: null, federations: {} };
if (fs.existsSync(outPath)) {
  existing = JSON.parse(fs.readFileSync(outPath, "utf8"));
  console.log(`Found existing archive for ${seasonLabel} — merging (no overwrite)`);
}

// Merge: for each federation/serie, only add if not already present
let added = 0;
for (const [fed, leagues] of Object.entries(federations)) {
  if (!existing.federations[fed]) existing.federations[fed] = {};
  for (const [serieId, league] of Object.entries(leagues)) {
    if (!existing.federations[fed][serieId]) {
      existing.federations[fed][serieId] = league;
      added++;
      console.log(`  + ${fed} / ${league.name} (serie ${serieId})`);
    } else {
      console.log(`  ~ ${fed} / ${league.name} (serie ${serieId}) — already archived, skipping`);
    }
  }
}

existing.archivedAt = new Date().toISOString();
fs.writeFileSync(outPath, JSON.stringify(existing, null, 2));
console.log(`Written: archive/${filename} (${added} new leagues added)`);

// Update index.json
let index = { belgianSeasons: [], standaloneLeagues: [], legacySeasons: [] };
if (fs.existsSync(indexPath)) {
  const raw = JSON.parse(fs.readFileSync(indexPath, "utf8"));
  if (Array.isArray(raw)) {
    // Old flat array = manual-league seasons → move to legacySeasons
    index.legacySeasons = raw;
    console.log(`Migrated ${raw.length} legacy season(s) to legacySeasons`);
  } else {
    index = {
      belgianSeasons:    raw.belgianSeasons    || [],
      standaloneLeagues: raw.standaloneLeagues  || [],
      legacySeasons:     raw.legacySeasons      || [],
    };
  }
}

// Remove existing entry for this season then re-add (update archivedAt)
index.belgianSeasons = index.belgianSeasons.filter(s => s.season !== seasonLabel);
const totalNew = Object.values(existing.federations).reduce((n, f) => n + Object.keys(f).length, 0);
index.belgianSeasons.unshift({
  type: "belgian",
  season: seasonLabel,
  filename,
  leagueCount: totalNew,
  archivedAt: existing.archivedAt,
});
// Sort newest first
index.belgianSeasons.sort((a, b) => b.season.localeCompare(a.season));

fs.writeFileSync(indexPath, JSON.stringify(index, null, 2));
console.log(`Updated: archive/index.json`);
console.log(`\nDone — ${seasonLabel} Belgian season archived.`);
