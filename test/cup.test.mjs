import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { buildCupRounds, aliveTeams, isCupLeague, nextPhase } from "../src/cupRounds.js";
import { cleanTeamName } from "../src/names.js";

const fx = (h, a, date, hs = null, as = null) => ({ homeIdx: h, awayIdx: a, date, homeScore: hs, awayScore: as, played: hs != null });

test("qualifying rounds are staged backwards from the federation rounds", () => {
  const rounds = buildCupRounds([
    fx(0, 1, "2026-08-29", 30, 20),                                   // 1/64: team 0 goes on
    fx(0, 2, "2026-09-03", 31, 30), fx(3, 4, "2026-08-29", 20, 22),   // 1/32 (team 3 entered directly)
    fx(0, 5, "2026-09-26", 25, 20), fx(4, 6, "2026-09-26", 25, 26),   // 1/16
    fx(0, 6, "2026-11-07"), fx(7, 8, "2026-11-07"), fx(9, 10, "2026-11-08"), fx(11, 12, "2026-11-08"),
    fx(13, 14, "2026-11-08"), fx(15, 16, "2026-11-08"), fx(17, 18, "2026-11-08"), fx(19, 20, "2026-11-08"),
  ]);
  assert.deepEqual(rounds.map(r => r.label.key), ["1/64 finals", "1/32 finals", "1/16 finals", "Round of 16"]);
  assert.deepEqual(rounds.map(r => r.count), [1, 2, 2, 8]);
});

test("a played game without score still lets the continuing team decide it", () => {
  const rounds = buildCupRounds([
    { homeIdx: 0, awayIdx: 1, date: "2026-08-30", played: true, homeScore: null, awayScore: null },
    fx(1, 2, "2026-09-03", 20, 18),
  ]);
  assert.equal(rounds[0].label.key, "1/32 finals");
  assert.deepEqual(aliveTeams(rounds), [1]);
});

test("only Lotto Cup counts as a cup league", () => {
  assert.ok(isCupLeague({ name: "Lotto Cup Men" }));
  assert.ok(!isCupLeague({ name: "Supercup Men" }));
  assert.ok(!isCupLeague({ name: "Beker Regio JM16" }));
});

test("cup labels disappear from team names", () => {
  assert.equal(cleanTeamName("Kwanten Arena Cup M"), "Kwanten Arena");
  assert.equal(cleanTeamName("Jeunesse Jemeppe Lotto Cup"), "Jeunesse Jemeppe");
  assert.equal(cleanTeamName("DHC Waasmunster Beker Van Belgie"), "DHC Waasmunster");
  assert.equal(cleanTeamName("HVH 't Noorden"), "HVH 't Noorden");
});

test("winners of the last round are listed in the next phase until it is drawn", () => {
  const rounds = buildCupRounds([fx(0, 1, "2026-10-10", 30, 20), fx(2, 3, "2026-10-10", 20, 25), fx(4, 5, "2026-10-11")]);
  const next = nextPhase(rounds);
  assert.equal(rounds[0].label.key, "1/16 finals");
  assert.equal(next.label.key, "Round of 16");
  assert.deepEqual(next.teams, [0, 3]);
  assert.equal(next.open, 1);
});
