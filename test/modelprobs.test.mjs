// modelProbs: Belgian leagues use the goal model, self-made leagues keep the settings-driven rank model.
import test from "node:test";
import assert from "node:assert/strict";
import { modelProbs, predictMatch, calcProbs } from "../src/probabilities.js";

const teams = [0, 1, 2].map(i => ({ id: i, name: "T" + i, points: 0 }));
const settings = { baseWin: 47, baseDraw: 6, homeBonus: 10, rankBonus: 3 };
const mk = (h, a, hs, as, i) => ({ id: "f" + i, homeIdx: h, awayIdx: a, played: true, homeScore: hs, awayScore: as });
const played = [mk(0, 1, 32, 20, 1), mk(1, 2, 25, 24, 2), mk(2, 0, 22, 30, 3), mk(1, 0, 21, 29, 4), mk(2, 1, 26, 25, 5), mk(0, 2, 31, 23, 6)];
const pend = { id: "p", homeIdx: 0, awayIdx: 1, played: false };

test("goal mode follows the goal model once there are enough games", () => {
  const g = predictMatch(0, 1, teams, played);
  assert.deepEqual(modelProbs(pend, teams, played, settings, "goal"), { homeWin: g.homeWin, draw: g.draw, awayWin: g.awayWin });
});

test("goal mode falls back to the rank model with too few games", () => {
  const few = played.slice(0, 3);
  assert.deepEqual(modelProbs(pend, teams, few, settings, "goal"), calcProbs(0, 1, teams, few, settings));
});

test("rank mode (self-made leagues) ignores the goal model and uses the settings", () => {
  assert.deepEqual(modelProbs(pend, teams, played, settings), calcProbs(0, 1, teams, played, settings));
  const changed = modelProbs(pend, teams, played, { ...settings, baseWin: 60 });
  assert.notDeepEqual(changed, modelProbs(pend, teams, played, settings));
});

test("goal mode ignores the probability sliders", () => {
  assert.deepEqual(modelProbs(pend, teams, played, settings, "goal"), modelProbs(pend, teams, played, { ...settings, baseWin: 80 }, "goal"));
});

test("a manual override still wins", () => {
  const f = { ...pend, overrideOn: true, ovHW: "70", ovD: "10", ovAW: "20" };
  assert.deepEqual(modelProbs(f, teams, played, settings, "goal"), { homeWin: 70, draw: 10, awayWin: 20 });
});
