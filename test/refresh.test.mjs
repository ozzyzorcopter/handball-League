import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const { refreshReason } = createRequire(import.meta.url)("../.github/scripts/fetch-vhv.js");

const NOW = new Date("2026-10-10T12:00:00Z");
const mk = (fixtures, updatedAt = "2026-10-10T08:00:00Z") => ({ updatedAt, fixtures });

test("no previous data -> refresh", () => {
  assert.equal(refreshReason(undefined, NOW), "no previous data");
  assert.equal(refreshReason(mk([]), NOW), "no previous data");
});
test("game today or yesterday -> refresh", () => {
  assert.equal(refreshReason(mk([{ date: "2026-10-10T20:00:00", played: false }]), NOW), "game today/yesterday");
  assert.equal(refreshReason(mk([{ date: "2026-10-09T20:00:00", played: true }]), NOW), "game today/yesterday");
});
test("unplayed game in the past -> refresh", () => {
  assert.equal(refreshReason(mk([{ date: "2026-10-03T20:00:00", played: false }]), NOW), "result pending");
});
test("quiet league with fresh data -> skipped", () => {
  assert.equal(refreshReason(mk([{ date: "2026-10-03T20:00:00", played: true }, { date: "2026-10-17T20:00:00", played: false }]), NOW), null);
});
test("stale data -> daily refresh", () => {
  assert.equal(refreshReason(mk([{ date: "2026-10-17T20:00:00", played: false }], "2026-10-09T01:00:00Z"), NOW), "daily refresh");
});
