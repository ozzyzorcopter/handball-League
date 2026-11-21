import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { groupsOf, leagueForGroup } from "../src/groups.js";
const { parseStandingsHtml } = createRequire(import.meta.url)("../.github/scripts/fetch-vhv.js");

const row = (p, n) => `<tr><td>${p}.</td><td>${n} (Senior M)</td><td>3</td><td>1</td><td>1</td><td>1</td><td>80</td><td>82</td><td>-2</td><td>3</td></tr>`;

test("standings with one table per pool get a group and the heading as name", () => {
  const r = parseStandingsHtml(`<h3>Poule A</h3><table>${row(1, "A1")}${row(2, "A2")}</table><h3>Poule B</h3><table>${row(1, "B1")}${row(2, "B2")}</table>`);
  assert.deepEqual(r.map(x => [x.group, x.groupName, x.name]), [[0, "Poule A", "A1"], [0, "Poule A", "A2"], [1, "Poule B", "B1"], [1, "Poule B", "B2"]]);
});

test("one table whose positions start again is split in pools", () => {
  const r = parseStandingsHtml(`<table>${row(1, "A1")}${row(2, "A2")}${row(1, "B1")}${row(2, "B2")}${row(3, "B3")}</table>`);
  assert.deepEqual(r.map(x => x.group), [0, 0, 1, 1, 1]);
  assert.ok(r.every(x => x.groupName == null), "no heading, no name");
});

test("a league with one table is not split", () => {
  const r = parseStandingsHtml(`<table>${row(1, "A1")}${row(2, "A2")}</table>`);
  assert.ok(r.every(x => x.group === 0));
  assert.equal(groupsOf({ ranking: r }), null);
});

test("a league in pools becomes one small league per pool", () => {
  const ranking = [
    { pos: 1, name: "A1", group: 0, points: 6 }, { pos: 2, name: "A2", group: 0, points: 2 },
    { pos: 1, name: "B1", group: 1, points: 4 }, { pos: 2, name: "B2", group: 1, points: 0 },
  ];
  const league = {
    teams: [{ name: "A1" }, { name: "A2" }, { name: "B1" }, { name: "B2" }], ranking,
    fixtures: [{ homeIdx: 0, awayIdx: 1 }, { homeIdx: 2, awayIdx: 3 }, { homeIdx: 3, awayIdx: 2 }],
    scorers: [{ player: "x", club: "B2" }, { player: "y", club: "A1" }],
  };
  const groups = groupsOf(league);
  assert.equal(groups.length, 2);
  assert.equal(groups[1].letter, "B");
  const b = leagueForGroup(league, groups[1]);
  assert.deepEqual(b.teams.map(t => t.name), ["B1", "B2"]);
  assert.deepEqual(b.fixtures.map(f => [f.homeIdx, f.awayIdx]), [[0, 1], [1, 0]]);
  assert.deepEqual(b.ranking.map(r => [r.name, r.pos]), [["B1", 1], ["B2", 2]]);
  assert.deepEqual(b.scorers.map(s => s.club), ["B2"]);
});

test("a team that is listed in two pools is in each pool once, with the games of that pool", () => {
  const ranking = [
    { pos: 1, name: "X", group: 0 }, { pos: 2, name: "Y", group: 0 },
    { pos: 1, name: "X", group: 1 }, { pos: 2, name: "Z", group: 1 },
  ];
  const league = { teams: ranking.map(r => ({ name: r.name })), ranking, fixtures: [{ homeIdx: 0, awayIdx: 1 }, { homeIdx: 2, awayIdx: 3 }] };
  const [a, b] = groupsOf(league).map(g => leagueForGroup(league, g));
  assert.deepEqual(a.teams.map(t => t.name), ["X", "Y"]);
  assert.deepEqual(b.teams.map(t => t.name), ["X", "Z"]);
  assert.equal(a.fixtures.length, 1);
  assert.equal(b.fixtures.length, 1);
});
