import test from "node:test";
import assert from "node:assert/strict";
import { rankIndices } from "../src/ranking.js";
import { runMC, mulberry32 } from "../src/montecarlo.js";

function mk(n) {
  return { pts: new Int32Array(n), wins: new Int32Array(n), gf: new Int32Array(n), ga: new Int32Array(n),
    h2hPts: new Int32Array(n * n), h2hGF: new Int32Array(n * n), h2hAwayGF: new Int32Array(n * n), met: new Uint8Array(n * n) };
}
const meet = (d, n, a, b) => { d.met[a * n + b] = d.met[b * n + a] = 1; };

test("points, then wins", () => {
  const d = mk(3);
  d.pts.set([4, 4, 6]); d.wins.set([1, 2, 3]);
  assert.deepEqual(rankIndices(3, d), [2, 1, 0]);
});

test("incomplete head-to-head group is skipped; goal difference decides", () => {
  const d = mk(3);
  d.pts.set([4, 4, 4]); d.wins.set([2, 2, 2]);
  d.gf.set([30, 30, 30]); d.ga.set([25, 20, 28]);
  meet(d, 3, 0, 1); // 0 and 2 / 1 and 2 never met
  d.h2hPts[0 * 3 + 1] = 2; // 0 beat 1
  assert.deepEqual(rankIndices(3, d), [1, 0, 2]);
});

test("complete group applies head-to-head before overall goal difference", () => {
  const d = mk(2);
  d.pts.set([4, 4]); d.wins.set([2, 2]);
  d.gf.set([30, 30]); d.ga.set([29, 20]); // team 1 better overall GD
  meet(d, 2, 0, 1);
  d.h2hPts[0 * 2 + 1] = 2; // but 0 won the head-to-head
  assert.deepEqual(rankIndices(2, d), [0, 1]);
});

test("final compare is used last", () => {
  const d = mk(2);
  assert.deepEqual(rankIndices(2, d, (a, b) => b - a), [1, 0]);
});

test("MC: certain outcomes give 100% to the expected positions and rows sum to 100", () => {
  const teams = [{ points: 0 }, { points: 0 }, { points: 0 }];
  const pending = [
    { homeIdx: 0, awayIdx: 1, homeWin: 100, draw: 0 },
    { homeIdx: 0, awayIdx: 2, homeWin: 100, draw: 0 },
    { homeIdx: 1, awayIdx: 2, homeWin: 100, draw: 0 },
  ];
  const played = [{ homeIdx: 2, awayIdx: 0, homeScore: 30, awayScore: 20 }];
  const res = runMC(teams, pending, played, 200, mulberry32(1));
  // 0 wins twice (4 pts), 1 once (2), 2 once at home vs 0 (2 pts from played is already in basePts=0 here)
  for (const row of res) assert.ok(Math.abs(row.reduce((a, b) => a + b, 0) - 100) < 1e-9);
  assert.equal(res[0][0], 100);
  const colSum = [0, 1, 2].map(p => res.reduce((a, r) => a + r[p], 0));
  colSum.forEach(c => assert.ok(Math.abs(c - 100) < 1e-9));
});

test("three teams level: the one split off first, the other two ranked by their own game", () => {
  // Real case (Liga Heren 3): Thor beat Schoten 27-25, Schoten beat Lebbeke 28-18, Lebbeke beat Thor 32-26.
  // Everyone has 2 head-to-head points; Schoten leads on head-to-head goal difference (+8),
  // Thor and Lebbeke are both on -4, so their own game (Lebbeke won) decides, before away goals.
  const n = 3; // 0 Thor, 1 Lebbeke, 2 Schoten
  const h2hPts = new Int32Array(9), h2hGF = new Int32Array(9), h2hAwayGF = new Int32Array(9), met = new Uint8Array(9);
  const game = (h, a, hg, ag) => {
    met[h * n + a] = met[a * n + h] = 1;
    h2hGF[h * n + a] += hg; h2hGF[a * n + h] += ag; h2hAwayGF[a * n + h] += ag;
    if (hg > ag) h2hPts[h * n + a] += 2; else h2hPts[a * n + h] += 2;
  };
  game(0, 2, 27, 25); game(2, 1, 28, 18); game(1, 0, 32, 26);
  const d = { pts: [4, 4, 4], wins: [2, 2, 2], gf: [149, 124, 171], ga: [175, 145, 183], h2hPts, h2hGF, h2hAwayGF, met };
  const order = rankIndices(n, d, (a, b) => (a === 0 ? -1 : b === 0 ? 1 : 0)); // fallback would favour Thor
  assert.deepEqual(order, [2, 1, 0]);
});
