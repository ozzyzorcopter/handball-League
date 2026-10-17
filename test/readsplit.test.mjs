// The pipeline keeps league data only in data/ (index + one file per league); this checks it reads back whole.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
const { writeSplit, readSplit, loadLeagueData } = createRequire(import.meta.url)("../.github/scripts/split-data.js");

const lg = (id, name) => ({ serieId: id, name, federation: "VHV", division: "D1", teams: [{ id: 1, name: "A" }], fixtures: [{ id: "x", played: true, homeIdx: 0, awayIdx: 0, homeScore: 1, awayScore: 2 }], scorers: [{ player: "P", goals: 3 }] });
const data = { updatedAt: "2026-10-17T00:00:00Z", federations: { VHV: { 1: lg(1, "One"), 2: lg(2, "Two") }, LFH: { 3: lg(3, "Three") } } };

test("writeSplit then readSplit gives back the same data", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "split-"));
  writeSplit(data, path.join(root, "data"));
  assert.deepEqual(readSplit(path.join(root, "data")), data);
  assert.deepEqual(loadLeagueData(root), data);
});

test("a league whose file is missing is left out, not returned as a stub", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "split-"));
  writeSplit(data, path.join(root, "data"));
  fs.unlinkSync(path.join(root, "data", "leagues", "2.json"));
  const r = readSplit(path.join(root, "data"));
  assert.deepEqual(Object.keys(r.federations.VHV), ["1"]);
});

test("falls back to the old vhv-data.json only when data/ does not exist, and to null when neither does", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "split-"));
  assert.equal(loadLeagueData(root), null);
  fs.writeFileSync(path.join(root, "vhv-data.json"), JSON.stringify(data));
  assert.deepEqual(loadLeagueData(root), data);
});
