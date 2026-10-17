// Backtest of the goal model behind the match percentages.
//
//   node tools/backtest.mjs [data-dir | file.json] [minPlayed]   (default: data/)
//
// Replays every league day by day: each played game is predicted using only the
// games played on earlier days, then compared with what happened. Reports how
// often the most likely result was right, the Brier score (lower is better,
// 0.667 = guessing 1/3 each) and calibration, next to two simple baselines:
// the league's own home/draw/away rates so far, and the simulator's rank model.
import fs from "node:fs";
import { createRequire } from "node:module";
import { predictMatch, calcProbs } from "../src/probabilities.js";
const { applyPriors, latestArchive } = createRequire(import.meta.url)("../.github/scripts/priors.js");

const { readSplit } = createRequire(import.meta.url)("../.github/scripts/split-data.js");
const src = process.argv[2] && !process.argv[2].startsWith("--") ? process.argv[2] : "data";
const minPlayed = +(process.argv[3] && !process.argv[3].startsWith("--") ? process.argv[3] : 40);
const data = fs.statSync(src).isDirectory() ? readSplit(src) : JSON.parse(fs.readFileSync(src, "utf8"));
// Last season's strength, exactly as the data pipeline adds it (archive/ folder); `--no-priors` skips it.
const pri = process.argv.includes("--no-priors") ? null : applyPriors(data, latestArchive("archive"));
if (pri) console.log(`Priors from the archive: ${pri.matched}/${pri.teams} teams in ${pri.leagues} league(s)`);
const stripPriors = (teams) => teams.map(t => { const { prior, ...rest } = t; return rest; });
const RANK_SETTINGS = { baseWin: 47, baseDraw: 6, homeBonus: 10, rankBonus: 3 };

const outcome = (f) => (+f.homeScore > +f.awayScore ? 0 : +f.homeScore === +f.awayScore ? 1 : 2);
const brier = (p, o) => p.reduce((s, v, i) => s + (v - (i === o ? 1 : 0)) ** 2, 0);
const logLoss = (p, o) => -Math.log(Math.max(p[o], 0.01));
const argmax = (p) => p.indexOf(Math.max(...p));

function newStats() { return { n: 0, hit: 0, brier: 0, ll: 0, gdErr: 0, gdN: 0 }; }
function add(st, p, o) { st.n++; st.hit += argmax(p) === o ? 1 : 0; st.brier += brier(p, o); st.ll += logLoss(p, o); }

const models = { goal: newStats(), goal0: newStats(), rank: newStats(), rates: newStats() };
const calib = Array.from({ length: 5 }, () => ({ n: 0, p: 0, won: 0 })); // home-win bins: <30,30-45,45-60,60-75,75+
const perLeague = [];

for (const fed of Object.values(data.federations || {})) {
  for (const lg of Object.values(fed)) {
    const teams = lg.teams || [];
    const played = (lg.fixtures || []).filter(f => f.played && f.homeScore != null && f.awayScore != null && f.date)
      .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    if (played.length < minPlayed) continue;
    const local = { goal: newStats(), goal0: newStats(), rank: newStats(), rates: newStats() };
    const teams0 = stripPriors(teams);
    for (const f of played) {
      const before = played.filter(g => g.date < f.date);
      const o = outcome(f);
      const g = predictMatch(f.homeIdx, f.awayIdx, teams, before);
      if (!g) continue; // needs 6 earlier games in the league
      const pg = [g.homeWin / 100, g.draw / 100, g.awayWin / 100];
      const g0 = predictMatch(f.homeIdx, f.awayIdx, teams0, before);
      const pg0 = [g0.homeWin / 100, g0.draw / 100, g0.awayWin / 100];
      let pr;
      try { const r = calcProbs(f.homeIdx, f.awayIdx, teams, before, RANK_SETTINGS); pr = [r.homeWin / 100, r.draw / 100, r.awayWin / 100]; } catch { pr = [0.47, 0.06, 0.47]; }
      const c = [0, 0, 0]; before.forEach(x => c[outcome(x)]++);
      const pf = c.map(v => (v + 1) / (before.length + 3));
      for (const [k, p] of [["goal", pg], ["goal0", pg0], ["rank", pr], ["rates", pf]]) { add(models[k], p, o); add(local[k], p, o); }
      const m = models.goal; m.gdErr += Math.abs((g.eh - g.ea) - (+f.homeScore - +f.awayScore)); m.gdN++;
      const bin = pg[0] < 0.3 ? 0 : pg[0] < 0.45 ? 1 : pg[0] < 0.6 ? 2 : pg[0] < 0.75 ? 3 : 4;
      calib[bin].n++; calib[bin].p += pg[0]; calib[bin].won += o === 0 ? 1 : 0;
    }
    perLeague.push([lg.name, local]);
  }
}

const fmt = (st) => st.n ? `n=${st.n}  right ${(100 * st.hit / st.n).toFixed(1)}%  Brier ${(st.brier / st.n).toFixed(3)}  logloss ${(st.ll / st.n).toFixed(3)}` : "no games";
console.log(`Backtest on ${src} (leagues with >= ${minPlayed} played games)\n`);
console.log("goal model :", fmt(models.goal));
if (pri) console.log("  without last-season priors:", fmt(models.goal0));
console.log("rank model :", fmt(models.rank));
console.log("league rates:", fmt(models.rates));
if (models.goal.gdN) console.log(`\ngoal model: average error of the expected goal difference ${(models.goal.gdErr / models.goal.gdN).toFixed(1)} goals`);
console.log("\nCalibration of the home-win chance (goal model):");
["< 30%", "30-45%", "45-60%", "60-75%", "75%+"].forEach((l, i) => {
  const b = calib[i]; if (b.n) console.log(`  ${l.padEnd(7)} predicted ${(100 * b.p / b.n).toFixed(0)}%  actual ${(100 * b.won / b.n).toFixed(0)}%  (${b.n} games)`);
});
console.log("\nPer league (Brier, goal vs rank model):");
for (const [name, l] of perLeague) if (l.goal.n >= 10) console.log(`  ${String(name).padEnd(24)} n=${String(l.goal.n).padStart(3)}  goal ${(l.goal.brier / l.goal.n).toFixed(3)} (no priors ${(l.goal0.brier / l.goal0.n).toFixed(3)})  rank ${(l.rank.brier / l.rank.n).toFixed(3)}  rates ${(l.rates.brier / l.rates.n).toFixed(3)}`);
