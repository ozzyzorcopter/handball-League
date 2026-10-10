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

const { extractGameTimes } = createRequire(import.meta.url)("../.github/scripts/fetch-vhv.js");
test("kick-off times are read from raw (escaped) and plain flight JSON", () => {
  const raw = String.raw`\"completed\":true,\"id\":2942786,\"start_date\":\"2026-08-29T20:15:00+00:00\",\"information\":\"0\"`;
  const plain = '"id":3009544,"start_date":"2026-10-10T18:30:00+00:00","x":1';
  const t = extractGameTimes(raw + " " + plain);
  assert.deepEqual(t.get("2942786"), { date: "2026-08-29", time: "20:15" });
  assert.equal(t.get("3009544").time, "18:30");
  assert.equal(extractGameTimes("").size, 0);
});

import fs from "node:fs";
const { extractFlightGames } = createRequire(import.meta.url)("../.github/scripts/fetch-vhv.js");
test("embedded Clubee game data (real sample) gives ids, score, time and venue coordinates", () => {
  const game = JSON.parse(fs.readFileSync(new URL("./fixtures/clubee-game-sample.json", import.meta.url), "utf8"));
  // Wrap it the way the page does: a flight chunk inside a script tag, string-escaped.
  const flight = '1:["$","div",null,{"leagues":[],"games":[' + JSON.stringify(game) + "," + JSON.stringify({ ...game, id: 5, cancelled: true, start_date: "2026-09-01T00:00:00+00:00" }) + "]}]\n";
  const html = "<html><script>self.__next_f.push([1," + JSON.stringify(flight) + "])</script></html>";
  const g = extractFlightGames(html);
  assert.equal(g.size, 2);
  const a = g.get("2942786");
  assert.equal(a.homeId, 451279);
  assert.equal(a.awayId, 451716);
  assert.equal(a.time, "20:15");
  assert.equal(a.date, "2026-08-29");
  assert.equal(a.score1, 32);
  assert.equal(a.completed, true);
  assert.deepEqual([a.venue.lat, a.venue.lon], [50.9390602, 5.3211552]);
  assert.match(a.venue.address, /Herkenrodesingel.*Hasselt/);
  assert.equal(g.get("5").cancelled, true);
  assert.equal(g.get("5").time, null, "00:00 means no time known");
  assert.equal(extractFlightGames("<html></html>").size, 0);
});
