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

module.exports = { splitFederations, writeSplit, makeStub };

// CLI: node split-data.js [vhv-data.json] [outDir]  (handy for the first run / backfill)
if (require.main === module) {
  const src = process.argv[2] || "vhv-data.json", out = process.argv[3] || "data";
  const r = writeSplit(JSON.parse(fs.readFileSync(src, "utf8")), out);
  console.log(`Wrote ${r.leagues} league file(s) to ${out}/`);
}
