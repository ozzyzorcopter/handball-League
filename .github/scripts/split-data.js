// Splits the combined federations structure into a small index plus one file per
// league, so the app only downloads the leagues it actually shows.
//
//   data/index.json            { updatedAt, federations: { FED: { serieId: stub } } }
//   data/leagues/<serieId>.json  the full league (teams, fixtures, ranking, scorers, ...)
//
// A stub keeps what the league list and the club picker need (names, division,
// live flag, team names/ids, played/pending counts) and has NO `fixtures`, which
// is how the app tells a stub from a full league.
const fs = require("fs");
const path = require("path");

function makeStub(lg) {
  const fixtures = lg.fixtures || [];
  const played = fixtures.filter(f => f.played).length;
  return {
    serieId: lg.serieId, name: lg.name, federation: lg.federation, division: lg.division,
    updatedAt: lg.updatedAt, live: !!lg.live,
    teams: (lg.teams || []).map(t => ({ id: t.id, name: t.name, ...(t.clubeeId != null ? { clubeeId: t.clubeeId } : {}) })),
    played, pending: fixtures.length - played,
  };
}

function splitFederations(data) {
  const index = { updatedAt: data.updatedAt || null, federations: {} };
  const leagues = new Map();
  for (const [fed, byId] of Object.entries(data.federations || {})) {
    index.federations[fed] = {};
    for (const [id, lg] of Object.entries(byId || {})) {
      const sid = String(lg.serieId != null ? lg.serieId : id);
      index.federations[fed][sid] = makeStub({ ...lg, serieId: lg.serieId != null ? lg.serieId : id });
      leagues.set(sid, lg);
    }
  }
  return { index, leagues };
}

// Writes dir/index.json and dir/leagues/*.json; deletes league files that no longer exist.
function writeSplit(data, dir) {
  const { index, leagues } = splitFederations(data);
  const leagueDir = path.join(dir, "leagues");
  fs.mkdirSync(leagueDir, { recursive: true });
  for (const [sid, lg] of leagues) fs.writeFileSync(path.join(leagueDir, `${sid}.json`), JSON.stringify(lg));
  for (const f of fs.readdirSync(leagueDir)) {
    if (f.endsWith(".json") && !leagues.has(f.slice(0, -5))) fs.unlinkSync(path.join(leagueDir, f));
  }
  fs.writeFileSync(path.join(dir, "index.json"), JSON.stringify(index));
  return { leagues: leagues.size };
}

// Reads dir/index.json + dir/leagues/*.json back into { updatedAt, federations } with FULL leagues.
// A league whose file is missing is left out (the index only holds a stub of it).
function readSplit(dir) {
  const index = JSON.parse(fs.readFileSync(path.join(dir, "index.json"), "utf8"));
  const out = { updatedAt: index.updatedAt || null, federations: {} };
  for (const [fed, byId] of Object.entries(index.federations || {})) {
    out.federations[fed] = {};
    for (const id of Object.keys(byId || {})) {
      const file = path.join(dir, "leagues", `${id}.json`);
      if (fs.existsSync(file)) out.federations[fed][id] = JSON.parse(fs.readFileSync(file, "utf8"));
    }
  }
  return out;
}

// The league data as the pipeline currently stores it: data/ under `root` (preferred),
// or the old single vhv-data.json while a repo has not been through a fetch run yet.
function loadLeagueData(root) {
  if (fs.existsSync(path.join(root, "data", "index.json"))) return readSplit(path.join(root, "data"));
  const legacy = path.join(root, "vhv-data.json");
  if (fs.existsSync(legacy)) return JSON.parse(fs.readFileSync(legacy, "utf8"));
  return null;
}

module.exports = { splitFederations, writeSplit, makeStub, readSplit, loadLeagueData };

// CLI: node split-data.js [vhv-data.json] [outDir]  (one-off: turn an old single file into data/)
if (require.main === module) {
  const src = process.argv[2] || "vhv-data.json", out = process.argv[3] || "data";
  const r = writeSplit(JSON.parse(fs.readFileSync(src, "utf8")), out);
  console.log(`Wrote ${r.leagues} league file(s) to ${out}/`);
}
