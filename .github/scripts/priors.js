// Last season's strength as a starting point for the goal model.
//
// For every current league that has a counterpart in the latest archived season,
// each team that can be matched with a team of that archived league gets
//   team.prior = { att, def }
// = goals scored / conceded per game last season relative to that league's
// average (1 = average, att > 1 = scores more, def > 1 = concedes more).
// predictMatch (src/probabilities.js) blends it with this season's games.
//
// Teams that moved up or down, or whose name cannot be matched safely, get no
// prior and are treated as average. Backtest (early season, 71 games in five
// leagues): Brier score 0.411 -> 0.384 with priors.
const fs = require("fs");
const path = require("path");

// current league name -> league name in the archive. Review once per season.
const PRIOR_MAP = {
  "Liga Heren 1": "VHV Liga 1",
  "Liga Heren 2": "VHV Liga 2",
  "Liga Heren 3": "VHV Liga 3",
  "First Division Men": "1e Nationale",
  "Second Division Men": "2e Nationale",
};

const NOISE = new Set(["hc", "hbc", "hv", "hk", "handbal", "handball", "dhc", "ehc", "hhv", "vhv", "lfh", "owv", "owvb", "d1", "d2", "d3", "m", "w", "b", "de"]);
function tokens(name) {
  return String(name || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, " ").split(" ")
    .filter(t => t && !/^\d+$/.test(t) && !NOISE.has(t) && t.length > 1);
}
const ALIAS = { atomix: "atomix", arena: "arena", kwanten: "arena" };
function core(name) { return tokens(name).map(t => ALIAS[t] || t); }

// Same team if one name's tokens are all contained in the other's. Only a single
// candidate counts: two candidates means we cannot tell, so no prior.
function findTeam(name, candidates) {
  const a = core(name);
  if (!a.length) return -1;
  const hits = [];
  candidates.forEach((cn, i) => {
    const b = core(cn);
    if (!b.length) return;
    const small = a.length <= b.length ? a : b, big = a.length <= b.length ? b : a;
    if (small.every(t => big.includes(t))) hits.push(i);
  });
  return hits.length === 1 ? hits[0] : -1;
}

function ratings(lg) {
  const played = (lg.fixtures || []).filter(f => f.played && f.homeScore != null && f.awayScore != null && !isNaN(+f.homeScore) && !isNaN(+f.awayScore));
  if (played.length < 20) return null;
  const avg = played.reduce((s, f) => s + +f.homeScore + +f.awayScore, 0) / (2 * played.length);
  if (!(avg > 0)) return null;
  const r = (lg.teams || []).map(() => ({ gf: 0, ga: 0, n: 0 }));
  for (const f of played) {
    const h = r[f.homeIdx], a = r[f.awayIdx];
    if (!h || !a) continue;
    h.gf += +f.homeScore; h.ga += +f.awayScore; h.n++;
    a.gf += +f.awayScore; a.ga += +f.homeScore; a.n++;
  }
  return r.map(x => (x.n >= 8 ? { att: x.gf / x.n / avg, def: x.ga / x.n / avg } : null));
}

function latestArchive(archiveDir) {
  try {
    const index = JSON.parse(fs.readFileSync(path.join(archiveDir, "index.json"), "utf8"));
    const latest = [...index].sort((x, y) => String(y.season).localeCompare(String(x.season)))[0];
    if (!latest) return null;
    return JSON.parse(fs.readFileSync(path.join(archiveDir, latest.filename), "utf8"));
  } catch { return null; }
}

// Adds/removes team.prior on every league of `data` (the combined federations object).
function applyPriors(data, archive, map = PRIOR_MAP) {
  let leagues = 0, teams = 0, matched = 0;
  if (!archive) return { leagues, teams, matched };
  const byName = new Map((archive.leagues || []).map(l => [l.name, l]));
  for (const byId of Object.values(data.federations || {})) {
    for (const lg of Object.values(byId || {})) {
      for (const t of lg.teams || []) delete t.prior;
      const an = map[lg.name];
      const arch = an && byName.get(an);
      const rt = arch && ratings(arch);
      if (!rt) continue;
      leagues++;
      const names = (arch.teams || []).map(t => t.name);
      for (const t of lg.teams || []) {
        teams++;
        const i = findTeam(t.name, names);
        if (i >= 0 && rt[i]) { t.prior = { att: +rt[i].att.toFixed(3), def: +rt[i].def.toFixed(3) }; matched++; }
      }
    }
  }
  return { leagues, teams, matched };
}

module.exports = { applyPriors, latestArchive, findTeam, ratings, PRIOR_MAP };
