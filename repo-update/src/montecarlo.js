// Monte Carlo season simulation.
//
// Each remaining game gets a win/draw/loss outcome from its probabilities. The
// score of that game is then drawn from the real scorelines already played in
// the league with the same outcome type, so goal difference and the
// head-to-head goal tiebreakers move realistically (rather than a made-up
// 1-goal margin). The table is ranked with the same rules as the real table
// (ranking.js).
import { rankIndices } from "./ranking.js";

// Small seedable generator so tests can be deterministic.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// teams:   [{ points }] points already earned (index = team index)
// pending: [{ homeIdx, awayIdx, homeWin, draw }] percentages, awayWin is the rest
// played:  [{ homeIdx, awayIdx, homeScore, awayScore }]
// Returns, per team, the percentage of simulations finishing in each position.
export function runMC(teams, pending, played, sims = 100000, rng = Math.random) {
  const n = teams.length;
  const hits = teams.map(() => new Array(n).fill(0));

  const basePts = Int32Array.from(teams.map(t => +t.points || 0));
  const baseWins = new Int32Array(n), baseGF = new Int32Array(n), baseGA = new Int32Array(n);
  const baseH2hPts = new Int32Array(n * n), baseH2hGF = new Int32Array(n * n), baseH2hAway = new Int32Array(n * n);
  const met = new Uint8Array(n * n);
  const homeWins = [], draws = [], awayWins = [];

  const apply = (pts, wins, gf, ga, h2hPts, h2hGF, h2hAway, hi, ai, hg, ag) => {
    gf[hi] += hg; ga[hi] += ag; gf[ai] += ag; ga[ai] += hg;
    h2hGF[hi * n + ai] += hg; h2hGF[ai * n + hi] += ag; h2hAway[ai * n + hi] += ag;
    if (hg > ag) { wins[hi]++; h2hPts[hi * n + ai] += 2; if (pts) pts[hi] += 2; }
    else if (hg < ag) { wins[ai]++; h2hPts[ai * n + hi] += 2; if (pts) pts[ai] += 2; }
    else { h2hPts[hi * n + ai]++; h2hPts[ai * n + hi]++; if (pts) { pts[hi]++; pts[ai]++; } }
  };

  for (const f of played || []) {
    const hg = +f.homeScore, ag = +f.awayScore;
    if (isNaN(hg) || isNaN(ag)) continue;
    // points are already inside teams[].points, so don't add them again
    apply(null, baseWins, baseGF, baseGA, baseH2hPts, baseH2hGF, baseH2hAway, f.homeIdx, f.awayIdx, hg, ag);
    met[f.homeIdx * n + f.awayIdx] = met[f.awayIdx * n + f.homeIdx] = 1;
    (hg > ag ? homeWins : hg < ag ? awayWins : draws).push([hg, ag]);
  }
  for (const f of pending || []) met[f.homeIdx * n + f.awayIdx] = met[f.awayIdx * n + f.homeIdx] = 1;
  // Fallback scorelines if the league has no played game of that kind yet.
  if (!homeWins.length) homeWins.push([28, 27]);
  if (!draws.length) draws.push([26, 26]);
  if (!awayWins.length) awayWins.push([27, 28]);

  const pts = new Int32Array(n), wins = new Int32Array(n), gf = new Int32Array(n), ga = new Int32Array(n);
  const h2hPts = new Int32Array(n * n), h2hGF = new Int32Array(n * n), h2hAway = new Int32Array(n * n);
  const rnd = new Float64Array(n);
  const d = { pts, wins, gf, ga, h2hPts, h2hGF, h2hAwayGF: h2hAway, met };
  const finalCompare = (a, b) => rnd[a] - rnd[b];
  const list = pending || [];

  for (let s = 0; s < sims; s++) {
    pts.set(basePts); wins.set(baseWins); gf.set(baseGF); ga.set(baseGA);
    h2hPts.set(baseH2hPts); h2hGF.set(baseH2hGF); h2hAway.set(baseH2hAway);
    for (let k = 0; k < list.length; k++) {
      const f = list[k];
      const r = rng() * 100;
      const pool = r < f.homeWin ? homeWins : r < f.homeWin + f.draw ? draws : awayWins;
      const sc = pool[(rng() * pool.length) | 0];
      apply(pts, wins, gf, ga, h2hPts, h2hGF, h2hAway, f.homeIdx, f.awayIdx, sc[0], sc[1]);
    }
    for (let i = 0; i < n; i++) rnd[i] = rng();
    const order = rankIndices(n, d, finalCompare);
    for (let rank = 0; rank < n; rank++) hits[order[rank]][rank]++;
  }
  return hits.map(row => row.map(v => (v / sims) * 100));
}
