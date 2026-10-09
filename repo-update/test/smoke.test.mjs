// Smoke test: renders the real built app in jsdom with mock league data and
// walks the main user flows. It exists to catch crashes (for example the
// "rendered fewer hooks than expected" black screen when opening a league)
// before they are deployed.
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { JSDOM } from "jsdom";
import { build } from "esbuild";

const require = createRequire(import.meta.url);

const today = new Date().toISOString().slice(0, 10);
const league = {
  serieId: 101, id: 101, name: "Liga 3", division: "D3", federation: "VHV",
  teams: [
    { id: 1, name: "Thor D3 M VHV", points: 0 },
    { id: 2, name: "Schoten D3 M VHV", points: 0 },
    { id: 3, name: "HvH D3 M VHV", points: 0 },
  ],
  fixtures: [
    { id: "a", homeIdx: 0, awayIdx: 1, played: true, homeScore: 30, awayScore: 25, date: "2026-09-20" },
    { id: "b", homeIdx: 2, awayIdx: 0, played: true, homeScore: 28, awayScore: 28, date: "2026-09-27" },
    { id: "d", homeIdx: 1, awayIdx: 2, played: true, homeScore: 24, awayScore: 29, date: "2026-09-13" },
    { id: "e", homeIdx: 0, awayIdx: 1, played: true, homeScore: 33, awayScore: 21, date: "2026-09-06" },
    { id: "f", homeIdx: 2, awayIdx: 1, played: true, homeScore: 31, awayScore: 27, date: "2026-09-30" },
    { id: "g", homeIdx: 1, awayIdx: 0, played: true, homeScore: 26, awayScore: 29, date: "2026-10-01" },
    { id: "c", homeIdx: 0, awayIdx: 2, played: false, date: today },
  ],
  ranking: [],
  scorers: [
    { player: "A", club: "Thor D3 M VHV", goals: 10, sevenMScored: 4, sevenMMissed: 1, yellowCards: 2, twoMinSuspensions: 3 },
    { player: "B", club: "HvH", goals: 5, twoMinSuspensions: 1, redCards: 1 },
  ],
};
const data = { updatedAt: new Date().toISOString(), federations: { VHV: { L1: league } } };

async function loadApp() {
  const dom = new JSDOM('<div id="root"></div>', { runScripts: "outside-only", url: "http://localhost/" });
  const w = dom.window;
  for (const [k, v] of Object.entries({ window: w, document: w.document, navigator: w.navigator, localStorage: w.localStorage, HTMLElement: w.HTMLElement })) {
    Object.defineProperty(globalThis, k, { value: v, configurable: true, writable: true });
  }
  w.React = require("react");
  w.ReactDOM = require("react-dom/client");
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  w.fetch = () => Promise.resolve({ ok: true, json: () => Promise.resolve(data) });
  const out = await build({
    entryPoints: ["app.js"], bundle: true, write: false, outfile: "o.js",
    loader: { ".js": "jsx" }, define: { __SHARE__: "false", __MC_WORKER_SRC__: '""' }, logLevel: "silent",
  });
  w.__LEAGUESIM_TEST__ = (x) => { w.__t = x; };
  w.eval(out.outputFiles[0].text);
  return w;
}

const click = async (w, act, el) => { assert.ok(el, "element to click exists"); await act(async () => { el.click(); }); };
const byText = (w, sel, text) => [...w.document.querySelectorAll(sel)].find((e) => e.textContent === text);
const text = (w) => w.document.body.textContent;

test("follow, language, league tabs and predictions", async () => {
  const w = await loadApp();
  const { act } = require("react-dom/test-utils");
  const RD = w.ReactDOM;
  const host = w.document.createElement("div");
  w.document.body.appendChild(host);
  const root = RD.createRoot(host);
  await act(async () => { root.render(w.React.createElement(w.__t.BelgianScreen, { onBack() {} })); });
  await act(async () => { await new Promise((r) => setTimeout(r, 30)); });

  // First visit: the club picker is shown.
  assert.match(text(w), /Which club do you follow\?/);
  await click(w, act, [...w.document.querySelectorAll(".mini-row")].find((e) => /Thor/.test(e.textContent)));
  await click(w, act, byText(w, "button", "Follow selected"));
  assert.doesNotMatch(text(w), /Which club do you follow\?/);
  assert.match(text(w), /My teams/);
  assert.match(text(w), /This week · all my teams/);
  assert.match(text(w), /\d+% · \d+% · \d+% \(\d+–\d+\)/, "prediction is shown for this week's game");
  assert.equal(JSON.parse(w.localStorage.getItem("leaguesim.follow.v1")).main, "101:1");

  // Language switch.
  await click(w, act, byText(w, "button", "NL"));
  assert.match(text(w), /Mijn teams/);

  // Opening a league must not crash (hook-order regression) and shows the tabs.
  await click(w, act, byText(w, "button", "VHV"));
  await click(w, act, [...w.document.querySelectorAll(".card")].find((e) => /Liga 3/.test(e.textContent)));
  const tabs = () => [...w.document.querySelectorAll(".tab")].map((x) => x.textContent);
  assert.deepEqual(tabs().slice(0, 4), ["⌂ Start", "Klassement", "Wedstrijden (1)", "Spelers"]);
  await click(w, act, byText(w, "button", "EN"));
  assert.deepEqual(tabs(), ["⌂ Home", "Table", "Games (1)", "Players", "Cards & suspensions", "Simulator", "Sim settings"]);

  // Star to follow another team.
  await click(w, act, w.document.querySelector("button[aria-label='Follow Schoten']"));
  assert.deepEqual(JSON.parse(w.localStorage.getItem("leaguesim.follow.v1")).ids, ["101:1", "101:2"]);

  // Players tab filter, Cards tab, scorers moved out of the Table tab.
  await click(w, act, byText(w, ".tab", "Players"));
  assert.match(text(w), /Top Scorers/);
  await click(w, act, byText(w, "button", "Excl. 7m"));
  assert.match(text(w), /Goals excluding 7m/);
  await click(w, act, byText(w, ".tab", "Cards & suspensions"));
  assert.match(text(w), /Players with most suspensions/);
  await click(w, act, byText(w, ".tab", "Table"));
  assert.doesNotMatch(text(w), /Top Scorers/);

  // Back to the list.
  await click(w, act, byText(w, "button", "← All Leagues"));
  assert.match(text(w), /My teams/);
});

test("goal model gives sensible probabilities", async () => {
  const w = await loadApp();
  const p = w.__t.predictMatch(0, 2, league.teams, league.fixtures);
  assert.ok(p);
  assert.equal(p.homeWin + p.draw + p.awayWin, 100);
  assert.ok(p.homeWin > p.awayWin, "the stronger side at home is favoured");
  assert.equal(w.__t.predictMatch(0, 2, league.teams, league.fixtures.slice(0, 3)), null, "too few games gives no prediction");
});
