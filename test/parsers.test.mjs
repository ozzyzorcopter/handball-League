// Parser tests for the Clubee pages fetch-vhv.js scrapes.
//
// Part 1 runs on small hand-written pages that follow the formats documented in the parsers.
// Part 2 runs on REAL saved pages when they are present in test/fixtures/clubee/
// (standings.html, games.html - saved by the "Probe Clubee (manual)" workflow); it is skipped otherwise.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
const { parseStatsHtml, parseLineupHtml, parseStandingsHtml, parseGamesHtml, extractFlightGames, extractGameTimes } = createRequire(import.meta.url)("../.github/scripts/fetch-vhv.js");

const standingsHtml = `<table><tbody>
<tr><th>#</th><th>Club</th></tr>
<tr><td>2.</td><td><img src="/logos/b.png?w=40"> Club B (Senior M)</td><td>3</td><td>1</td><td>1</td><td>1</td><td>80</td><td>82</td><td>-2</td><td>3</td><td></td></tr>
<tr><td>1.</td><td><img data-src="/logos/a.png"> Club &amp; Co (Senior M)</td><td>3</td><td>3</td><td>0</td><td>0</td><td>90</td><td>70</td><td>20</td><td>6</td><td></td></tr>
<tr><td>x</td><td>short row</td></tr>
</tbody></table>`;

test("standings: rows are read, sorted by position and cleaned", () => {
  const rows = parseStandingsHtml(standingsHtml);
  assert.equal(rows.length, 2);
  assert.deepEqual(rows.map(r => r.pos), [1, 2]);
  assert.equal(rows[0].name, "Club & Co");
  assert.deepEqual([rows[0].played, rows[0].won, rows[0].drawn, rows[0].lost, rows[0].gf, rows[0].ga, rows[0].points], [3, 3, 0, 0, 90, 70, 6]);
  assert.ok(rows[0].logoKey && rows[1].logoKey, "logo key taken from src or data-src");
});

const ranking = [{ name: "Club & Co" }, { name: "Club B" }, { name: "HBC Gamma" }];
const card = (id, home, away, h3, date) => `<a href="/handballbelgium/games/${id}" class="x"><div class="teamInnerParapraph"><strong>${home} (Senior M)</strong></div><h3> ${h3} </h3><p>${date}</p><div class="teamInnerParapraphSecond"><strong>${away} (Senior M)</strong></div></a>`;

test("games: played and scheduled cards, bye rows and unknown teams are handled", () => {
  const html = [
    card(101, "Club &amp; Co", "Club B", "26 : 25", "22.08.2026"),
    card(102, "Club B", "Gamma", "-  :  -", "01.12.2099"),
    card(103, "Bye", "Club B", "- : -", "01.12.2099"),
    card(104, "Nobody FC", "Club B", "- : -", "01.12.2099"),
  ].join("\n");
  const { fixtures } = parseGamesHtml(html, ranking, new Map());
  assert.equal(fixtures.length, 2, "bye and unknown team are skipped");
  const [a, b] = fixtures;
  assert.deepEqual([a.gameId, a.homeIdx, a.awayIdx, a.played, a.homeScore, a.awayScore, a.date], ["101", 0, 1, true, 26, 25, "2026-08-22"]);
  assert.deepEqual([b.gameId, b.homeIdx, b.awayIdx, b.played, b.homeScore, b.date], ["102", 1, 2, false, null, "2099-12-01"]);
});

test("games: kick-off time is added from the embedded data, 00:00 is ignored", () => {
  const html = card(201, "Club B", "Gamma", "- : -", "01.12.2099") + card(202, "Gamma", "Club B", "- : -", "02.12.2099");
  const times = new Map([["201", { date: "2099-12-01", time: "20:15" }], ["202", { date: "2099-12-02", time: "00:00" }]]);
  const { fixtures } = parseGamesHtml(html, ranking, times);
  assert.equal(fixtures[0].time, "20:15");
  assert.equal("time" in fixtures[1], false);
});

test("embedded game data: times and games are read from the escaped page payload", () => {
  const flightGames = JSON.stringify({ games: [{ id: 301, start_date: "2026-09-05T19:30:00+00:00", completed: true, score1: 30, score2: 28, cancelled: false, team1: { id: 11 }, team2: { id: 22 } }] });
  const chunk = JSON.stringify("1:" + flightGames);
  const html = `<script>self.__next_f.push([1,${chunk}])</script>`;
  const games = extractFlightGames(html);
  assert.equal(games.size, 1);
  const g = games.get("301");
  assert.deepEqual([g.homeId, g.awayId, g.date, g.time, g.score1, g.score2, g.completed], [11, 22, "2026-09-05", "19:30", 30, 28, true]);
  const raw = 'x\\"id\\":301,\\"start_date\\":\\"2026-09-05T19:30:00+00:00\\"';
  assert.equal(extractGameTimes(raw).get("301").time, "19:30");
});

const real = f => new URL("./fixtures/clubee/" + f, import.meta.url);

test("REAL standings page parses into a sane table", { skip: !fs.existsSync(real("standings.html")) && "no test/fixtures/clubee/standings.html" }, () => {
  const rows = parseStandingsHtml(fs.readFileSync(real("standings.html"), "utf8"));
  assert.ok(rows.length >= 4, "found " + rows.length + " teams");
  rows.forEach((r, i) => { assert.equal(r.pos, i + 1); assert.ok(r.name.length > 1); assert.ok(r.won + r.drawn + r.lost === r.played, r.name + ": W+D+L = played"); });
});

test("REAL games page parses into fixtures that match the standings", { skip: !(fs.existsSync(real("standings.html")) && fs.existsSync(real("games.html"))) && "needs standings.html and games.html in test/fixtures/clubee/" }, () => {
  const rank = parseStandingsHtml(fs.readFileSync(real("standings.html"), "utf8"));
  const html = fs.readFileSync(real("games.html"), "utf8");
  const { fixtures } = parseGamesHtml(html, rank, extractGameTimes(html));
  assert.ok(fixtures.length > 0, "fixtures found");
  const playedGames = fixtures.filter(f => f.played && f.homeScore != null);
  const sum = rank.reduce((a, r) => a + r.played, 0) / 2;
  assert.equal(playedGames.length, sum, "played games match the standings");
  assert.equal(new Set(fixtures.map(f => f.gameId)).size, fixtures.length, "every game id appears once");
  assert.ok(fixtures.every(f => f.homeIdx !== f.awayIdx && f.date), "every fixture has two different teams and a date");
  const flight = extractFlightGames(html);
  assert.equal(flight.size, fixtures.length, "the embedded game data covers the same games");
  assert.ok(fixtures.every(f => flight.has(f.gameId)), "and the same ids");
  assert.ok(fixtures.filter(f => f.time).length > 0, "kick-off times are found");
});

const have = (...f) => f.every(x => fs.existsSync(real(x)));
const rd = f => fs.readFileSync(real(f), "utf8");

test("REAL stats pages: scorers per page, clubs matched through the standings logos", { skip: !have("stats.html", "stats-p2.html", "standings.html") && "needs stats.html, stats-p2.html, standings.html" }, () => {
  const logoMap = new Map(parseStandingsHtml(rd("standings.html")).map(r => [r.logoKey, r.name]));
  const p1 = parseStatsHtml(rd("stats.html"), logoMap), p2 = parseStatsHtml(rd("stats-p2.html"), logoMap);
  assert.equal(p1.realRows, 10);
  assert.equal(p2.realRows, 10);
  assert.notEqual(p1.signature, p2.signature, "page 2 differs from page 1");
  const all = [...p1.scorers, ...p2.scorers];
  assert.ok(all.every(s => s.player && s.goals > 0 && s.matchesPlayed > 0));
  assert.ok(all.every((s, i) => i === 0 || all[i - 1].goals >= s.goals), "sorted by goals descending");
  assert.ok(all.every(s => s.club), "every scorer's club found: " + all.filter(s => !s.club).map(s => s.player));
});

test("REAL lineup page: both teams, named from the headings", { skip: !have("lineup.html") && "needs lineup.html" }, () => {
  const players = parseLineupHtml(rd("lineup.html"));
  const clubs = new Set(players.map(p => p.club));
  assert.equal(clubs.size, 2, [...clubs].join(" | "));
  assert.ok(players.length >= 10 && players.every(p => p.player && !/\(/.test(p.club)));
  assert.ok(players.reduce((a, p) => a + p.goals, 0) > 0, "goals are counted");
});

test("stats parsers return nothing for a page without tables", () => {
  assert.deepEqual(parseStatsHtml("<html><body>No information added yet</body></html>").scorers, []);
  assert.deepEqual(parseLineupHtml("<html></html>"), []);
});

test("venue address comes from the directions link", async () => {
  const { parseVenueAddress } = createRequire(import.meta.url)("../.github/scripts/fetch-vhv.js");
  assert.equal(parseVenueAddress('<a href="https://maps.google.com/?daddr=Sporthal+De+Gryse%2C+Schapenstraat+45a%2C+Oostende">x</a>'), "Sporthal De Gryse, Schapenstraat 45a, Oostende");
  assert.equal(parseVenueAddress("<html>no link</html>"), null);
});
