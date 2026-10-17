// Last-season priors: matching archived teams to current ones, and their effect on predictions.
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { predictMatch } from "../src/probabilities.js";
const { findTeam, applyPriors, ratings } = createRequire(import.meta.url)("../.github/scripts/priors.js");

test("findTeam matches club names across naming styles and refuses ambiguity", () => {
  const archived = ["Olse Merksem HC", "Hestia Bilzen", "HC Atomix", "Elita Lebbeke", "Elita Lebbeke B"];
  assert.equal(findTeam("Olse Merksem D3 M VHV", archived), 0);
  assert.equal(findTeam("H. Bilzen D3 M VHV", archived), 1);
  assert.equal(findTeam("AtomiX D2 M VHV", archived), 2);
  assert.equal(findTeam("Evergem D3 M VHV", archived), -1, "unknown club");
  assert.equal(findTeam("Lebbeke D2 M VHV", archived), -1, "two Lebbeke teams: cannot tell");
});

// A 4-team league, every pair twice. Team 0 scores a lot, team 3 concedes a lot.
function season(scores) {
  const fixtures = []; let id = 0;
  for (let h = 0; h < 4; h++) for (let a = 0; a < 4; a++) if (h !== a) {
    const [hs, as] = scores(h, a); fixtures.push({ id: "f" + id++, homeIdx: h, awayIdx: a, played: true, homeScore: hs, awayScore: as, date: "2026-0" + (1 + (id % 9)) + "-01" });
  }
  return fixtures;
}
const strong = (h, a) => [h === 0 ? 36 : 26, a === 0 ? 34 : 24];

test("ratings need enough games and are relative to the league average", () => {
  const lg = { teams: [{}, {}, {}, {}], fixtures: season(strong) };
  assert.equal(ratings(lg), null, "12 games are too few");
  const big = { teams: lg.teams, fixtures: [...season(strong), ...season(strong), ...season(strong)] };
  const r = ratings(big);
  assert.ok(r[0].att > 1.1 && r[1].att < 1, "team 0 attacks above, others below average");
});

test("applyPriors fills team.prior only where a safe match exists and clears stale ones", () => {
  const archive = { leagues: [{ name: "VHV Liga 2", teams: [{ name: "Elita Lebbeke" }, { name: "HC Overpelt" }, { name: "DB Gent" }, { name: "HC Atomix" }],
    fixtures: [...season(strong), ...season(strong), ...season(strong)] }] };
  const data = { federations: { VHV: { 1: { name: "Liga Heren 2", teams: [
    { name: "Lebbeke D2 M VHV", prior: { att: 9, def: 9 } }, { name: "HC Overpelt D2 M VHV" }, { name: "Newcomer D2 M VHV" }, { name: "AtomiX D2 M VHV" }] } } } };
  const r = applyPriors(data, archive);
  const t = data.federations.VHV[1].teams;
  assert.equal(r.matched, 3);
  assert.ok(t[0].prior.att > 1.1, "stale prior replaced");
  assert.equal(t[2].prior, undefined);
  assert.equal(applyPriors({ federations: {} }, null).matched, 0);
});

test("a prior moves the prediction towards last season's strength, and none changes nothing", () => {
  const fixtures = season((h, a) => [28, 26]).slice(0, 8);
  const teams = [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }];
  const plain = predictMatch(0, 1, teams, fixtures);
  const withPrior = predictMatch(0, 1, teams.map((t, i) => i === 0 ? { ...t, prior: { att: 1.2, def: 0.85 } } : t), fixtures);
  assert.ok(withPrior.homeWin > plain.homeWin, `${withPrior.homeWin} should beat ${plain.homeWin}`);
  assert.deepEqual(predictMatch(0, 1, teams.map(t => ({ ...t, prior: undefined })), fixtures), plain);
});
