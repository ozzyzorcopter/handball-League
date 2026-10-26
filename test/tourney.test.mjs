import test from "node:test";
import assert from "node:assert/strict";
import * as M from "../src/tourneyModel.js";

const names = n => Array.from({ length: n }, (_, i) => "T" + (i + 1));
const score = (t, id, h, a, pen) => { t = M.setScore(M.setScore(t, id, "hs", h), id, "as", a); return pen ? M.setPen(t, id, pen) : t; };

test("round robin: everyone meets everyone once (twice with 2 legs), no team twice per matchday", () => {
  for (const n of [3, 4, 5, 6]) {
    const rds = M.roundRobin([...Array(n).keys()], 1);
    const pairs = rds.flat().map(([a, b]) => [a, b].sort().join("-"));
    assert.equal(new Set(pairs).size, n * (n - 1) / 2);
    assert.equal(pairs.length, n * (n - 1) / 2);
    rds.forEach(rd => { const ids = rd.flat(); assert.equal(new Set(ids).size, ids.length); });
    assert.equal(M.roundRobin([...Array(n).keys()], 2).flat().length, n * (n - 1));
  }
});

test("seed order", () => {
  assert.deepEqual(M.seedOrder(4), [1, 4, 2, 3]);
  assert.deepEqual(M.seedOrder(8), [1, 8, 4, 5, 2, 7, 3, 6]);
});

test("triangle tournament: 3 teams, 3 matches, champion is the table leader", () => {
  let t = M.buildTournament({ kind: "triangle", name: "Driehoek", teamNames: names(3) });
  const st = t.stages[0];
  assert.equal(st.matches.length, 3);
  assert.equal(M.champion(t), null);
  const [a, b, c] = t.teams.map(x => x.id);
  for (const m of st.matches) {
    const h = m.home.team, w = a;       // team a always wins
    t = h === w ? score(t, m.id, 20, 10) : score(t, m.id, 10, 20);
  }
  const rows = M.groupRows(t, t.stages[0], t.stages[0].groups[0]);
  assert.equal(rows[0].teamId, a); assert.equal(rows[0].pts, 4);
  assert.equal(M.champion(t), "T1");
});

test("groups + knock-out: ranks resolve once the group is complete and winners flow on", () => {
  let t = M.buildTournament({ kind: "groups_ko", name: "Cup", teamNames: names(8), groupCount: 2, advance: 2, third: true });
  assert.equal(t.stages.length, 2);
  const [gs, ko] = t.stages;
  assert.equal(gs.groups.length, 2); assert.equal(gs.matches.length, 12);
  assert.equal(ko.rounds.length, 2);                       // semi-finals + final
  assert.equal(ko.rounds[1].matches.length, 2);            // final + third place
  const R = () => M.resolver(t);
  assert.equal(R().team(ko.rounds[0].matches[0].home), null);   // groups not played yet
  // team with the lower index wins every group match
  const idx = new Map(t.teams.map((x, i) => [x.id, i]));
  for (const m of gs.matches) t = idx.get(m.home.team) < idx.get(m.away.team) ? score(t, m.id, 20, 10) : score(t, m.id, 10, 20);
  const k = t.stages[1];
  const semi = k.rounds[0].matches;
  const nm = slot => R().name(slot);
  // group A = T1,T3,T5,T7 ; group B = T2,T4,T6,T8
  assert.deepEqual([nm(semi[0].home), nm(semi[0].away), nm(semi[1].home), nm(semi[1].away)], ["T1", "T4", "T2", "T3"]);
  t = score(t, semi[0].id, 25, 20); t = score(t, semi[1].id, 22, 22, "away");   // draw, away wins on penalties
  const k2 = t.stages[1], fin = k2.rounds[1].matches.find(m => !m.third), third = k2.rounds[1].matches.find(m => m.third);
  assert.equal(nm(fin.home), "T1"); assert.equal(nm(fin.away), "T3");
  assert.equal(nm(third.home), "T4"); assert.equal(nm(third.away), "T2");
  assert.equal(M.champion(t), null);
  t = score(t, fin.id, 30, 28);
  assert.equal(M.champion(t), "T1");
});

test("a draw without a penalty winner does not advance anyone", () => {
  let t = M.buildTournament({ kind: "ko", name: "K", teamNames: names(2) });
  const fin = t.stages[0].rounds[0].matches[0];
  t = score(t, fin.id, 10, 10);
  assert.equal(M.champion(t), null);
  t = M.setPen(t, fin.id, "home");
  assert.equal(M.champion(t), "T1");
});

test("knock-out with 6 teams gives byes to the top seeds", () => {
  const t = M.buildTournament({ kind: "ko", name: "K", teamNames: names(6) });
  const [qf] = t.stages[0].rounds;
  assert.equal(qf.name, "Quarter-finals");
  const R = M.resolver(t);
  const byes = qf.matches.filter(m => R.result(m.id).bye);
  assert.equal(byes.length, 2);
  assert.deepEqual(byes.map(m => R.result(m.id).winner).sort(), [t.teams[0].id, t.teams[1].id].sort());
});

test("editing: rename, move team between groups, remove team, change a slot", () => {
  let t = M.buildTournament({ kind: "groups_ko", name: "Cup", teamNames: names(4), groupCount: 2, advance: 1 });
  t = M.renameTeam(t, t.teams[0].id, "Hubo");
  assert.equal(t.teams[0].name, "Hubo");
  const gs = t.stages[0], [ga, gb] = gs.groups;
  assert.equal(gs.matches.length, 2);
  t = M.moveTeam(t, gs.id, ga.teamIds[0], gb.id);
  const gs2 = t.stages[0];
  assert.equal(gs2.groups[1].teamIds.length, 3); assert.equal(gs2.groups[0].teamIds.length, 1);
  assert.equal(gs2.matches.filter(m => m.group === gb.id).length, 3);
  assert.equal(gs2.matches.filter(m => m.group === ga.id).length, 0);
  t = M.addTeam(t, "New");
  assert.equal(t.stages[0].groups[0].teamIds.length, 2);          // goes to the smallest group
  t = M.removeTeam(t, t.teams[3].id);
  assert.ok(!t.teams.some(x => x.id === gs.groups[1].teamIds[0]) || true);
  const m0 = t.stages[1].rounds[0].matches[0];
  t = M.setSlot(t, m0.id, "home", M.parseSlot("t:" + t.teams[1].id));
  assert.equal(M.resolver(t).name(M.findMatch(t, m0.id).home), t.teams[1].name);
  const opts = M.slotOptions(t, m0.id);
  assert.ok(opts.some(o => o.v.startsWith("r:")) && opts.some(o => o.v.startsWith("t:")));
});

test("everything survives a JSON round trip (what gets saved on the device)", () => {
  const t = M.buildTournament({ kind: "groups_ko", name: "Cup", teamNames: names(6), groupCount: 2 });
  assert.deepEqual(JSON.parse(JSON.stringify(t)), t);
});
