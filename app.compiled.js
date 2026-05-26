var __defProp = Object.defineProperty;
var __defProps = Object.defineProperties;
var __getOwnPropDescs = Object.getOwnPropertyDescriptors;
var __getOwnPropSymbols = Object.getOwnPropertySymbols;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __propIsEnum = Object.prototype.propertyIsEnumerable;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __spreadValues = (a, b) => {
  for (var prop in b || (b = {}))
    if (__hasOwnProp.call(b, prop))
      __defNormalProp(a, prop, b[prop]);
  if (__getOwnPropSymbols)
    for (var prop of __getOwnPropSymbols(b)) {
      if (__propIsEnum.call(b, prop))
        __defNormalProp(a, prop, b[prop]);
    }
  return a;
};
var __spreadProps = (a, b) => __defProps(a, __getOwnPropDescs(b));
const { useState, useMemo, useRef, useEffect } = React;
function saveData(data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement("a"), { href: url, download: "leaguesim-data.json" });
  a.click();
  URL.revokeObjectURL(url);
}
function loadData() {
  return new Promise((resolve, reject) => {
    const input = Object.assign(document.createElement("input"), { type: "file", accept: ".json" });
    input.onchange = () => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          resolve(JSON.parse(e.target.result));
        } catch (e2) {
          reject("Invalid file");
        }
      };
      reader.readAsText(input.files[0]);
    };
    input.click();
  });
}
function defaultSettings() {
  return { baseWin: 47, baseDraw: 6, homeBonus: 10, rankBonus: 3, winScore: 30, lossScore: 25, drawScore: 25 };
}
function makeTeam(index) {
  return { id: "t" + Date.now() + index, name: "Team " + (index + 1), points: 0, homeBonus: "" };
}
function makeLeague(name, type, poSize, pdSize, phaseFormat) {
  return {
    id: String(Date.now()),
    name,
    type: type || "standard",
    teams: [makeTeam(0)],
    fixtures: [],
    step: 0,
    settings: defaultSettings(),
    playoffs: null,
    playdowns: null,
    poSize: poSize || 6,
    pdSize: pdSize || 4,
    phaseFormat: phaseFormat || "round-robin",
    promoTop: 2,
    demotBot: 2
  };
}
function nearestPow2GTE(n) {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}
function generateTournament(sourceStats, settings, isPlaydown) {
  let ctr = 0;
  const mid = () => "tm" + ctr++;
  const n = sourceStats.length;
  const phTeams = sourceStats.map((r) => ({ id: r.id, name: r.name, points: r.startingPts, homeBonus: "" }));
  const bracketSize = nearestPow2GTE(n);
  const numByes = bracketSize - n;
  const r1Teams = [];
  for (let i = numByes; i < n; i++) r1Teams.push(i);
  const r1Pairs = [];
  let lo = 0, hi = r1Teams.length - 1;
  while (lo < hi) {
    r1Pairs.push([r1Teams[lo], r1Teams[hi]]);
    lo++;
    hi--;
  }
  const rounds = [];
  if (r1Pairs.length > 0) {
    const r1Matches = [];
    r1Pairs.forEach(([seedA, seedB]) => {
      const legAId = mid(), legBId = mid();
      const p1 = calcProbsNeutral(seedA, seedB, phTeams, settings);
      const p2 = calcProbsNeutral(seedB, seedA, phTeams, settings);
      r1Matches.push({ id: legAId, leg: 1, duelId: legAId, homeRef: { type: "team", teamIdx: seedA }, awayRef: { type: "team", teamIdx: seedB }, neutral: true, played: false, homeScore: null, awayScore: null, homeWin: p1.homeWin, draw: p1.draw, awayWin: p1.awayWin, overrideOn: false, ovHW: "", ovD: "", ovAW: "", pairedLegId: legBId });
      r1Matches.push({ id: legBId, leg: 2, duelId: legAId, homeRef: { type: "team", teamIdx: seedB }, awayRef: { type: "team", teamIdx: seedA }, neutral: true, played: false, homeScore: null, awayScore: null, homeWin: p2.homeWin, draw: p2.draw, awayWin: p2.awayWin, overrideOn: false, ovHW: "", ovD: "", ovAW: "", pairedLegId: legAId });
    });
    rounds.push({ id: mid(), label: "Round 1", type: "r1", matches: r1Matches });
  }
  let prevRoundRefs = [];
  for (let i = 0; i < numByes; i++) prevRoundRefs.push({ type: "team", teamIdx: i, seed: i });
  r1Pairs.forEach(([seedA, seedB], pi) => {
    var _a, _b;
    const duelId = ((_b = (_a = rounds[0]) == null ? void 0 : _a.matches[pi * 2]) == null ? void 0 : _b.duelId) || "d" + pi;
    prevRoundRefs.push({ type: "duel_winner", duelId, seed: numByes + pi });
  });
  let roundNum = 2;
  while (prevRoundRefs.length > 1) {
    const matches = [];
    const nextRefs = [];
    const refs = [...prevRoundRefs];
    let lo2 = 0, hi2 = refs.length - 1;
    while (lo2 < hi2) {
      const mId = mid();
      const homeRef = refs[lo2];
      const awayRef = refs[hi2];
      const p = { homeWin: 50, draw: 0, awayWin: 50 };
      matches.push({ id: mId, leg: null, homeRef, awayRef, neutral: false, played: false, homeScore: null, awayScore: null, homeWin: p.homeWin, draw: p.draw, awayWin: p.awayWin, overrideOn: false, ovHW: "", ovD: "", ovAW: "", tbd: true });
      nextRefs.push({ type: "winner", matchId: mId, seed: lo2 });
      lo2++;
      hi2--;
    }
    const isFinal = prevRoundRefs.length === 2;
    const label = isFinal ? "Final" : prevRoundRefs.length === 4 ? "Semi-finals" : "Round " + roundNum;
    rounds.push({ id: mid(), label, type: isFinal ? "final" : "winners", matches });
    prevRoundRefs = nextRefs;
    roundNum++;
  }
  if (isPlaydown) {
    let loserRefs = [];
    r1Pairs.forEach(([seedA, seedB], pi) => {
      var _a, _b;
      const duelId = ((_b = (_a = rounds[0]) == null ? void 0 : _a.matches[pi * 2]) == null ? void 0 : _b.duelId) || "d" + pi;
      loserRefs.push({ type: "duel_loser", duelId, seed: numByes + pi });
    });
    rounds.filter((r) => r.type === "winners").forEach((r) => {
      r.matches.forEach((m) => {
        loserRefs.push({ type: "loser", matchId: m.id, seed: loserRefs.length });
      });
    });
    let lRoundNum = 1;
    let lRefs = loserRefs.slice(0, Math.max(2, r1Pairs.length));
    while (lRefs.length > 1) {
      const lMatches = [];
      const lNext = [];
      let ll = 0, lh = lRefs.length - 1;
      while (ll < lh) {
        const mId = mid();
        lMatches.push({ id: mId, leg: null, homeRef: lRefs[ll], awayRef: lRefs[lh], neutral: false, played: false, homeScore: null, awayScore: null, homeWin: 50, draw: 0, awayWin: 50, overrideOn: false, ovHW: "", ovD: "", ovAW: "", tbd: true, losersBracket: true });
        lNext.push({ type: "winner", matchId: mId, seed: ll });
        ll++;
        lh--;
      }
      const label = lRefs.length === 2 ? "Losers Final" : "Losers Round " + lRoundNum;
      rounds.push({ id: mid(), label, type: "losers", matches: lMatches });
      lRefs = lNext;
      lRoundNum++;
    }
  }
  return { teams: phTeams, rounds };
}
function calcProbsNeutral(homeIdx, awayIdx, teams, settings) {
  const neutralSettings = __spreadProps(__spreadValues({}, settings), { homeBonus: 0 });
  const neutralTeams = teams.map((t) => __spreadProps(__spreadValues({}, t), { homeBonus: "" }));
  return calcProbs(homeIdx, awayIdx, neutralTeams, [], neutralSettings);
}
function resolveRef(ref, teams, rounds) {
  if (!ref) return null;
  if (ref.type === "team") return ref.teamIdx;
  if (ref.type === "duel_winner" || ref.type === "duel_loser") {
    const leg1 = rounds.flatMap((r) => r.matches).find((m) => m.duelId === ref.duelId && m.leg === 1);
    const leg2 = rounds.flatMap((r) => r.matches).find((m) => m.duelId === ref.duelId && m.leg === 2);
    if (!leg1 || !leg2 || !leg1.played || !leg2.played) return null;
    const seedA = resolveRef(leg1.homeRef, teams, rounds);
    const seedB = resolveRef(leg1.awayRef, teams, rounds);
    const goalsA = (+leg1.homeScore || 0) + (+leg2.awayScore || 0);
    const goalsB = (+leg1.awayScore || 0) + (+leg2.homeScore || 0);
    if (goalsA > goalsB) return ref.type === "duel_winner" ? seedA : seedB;
    if (goalsB > goalsA) return ref.type === "duel_winner" ? seedB : seedA;
    const winner = seedA < seedB ? seedA : seedB;
    const loser = seedA < seedB ? seedB : seedA;
    return ref.type === "duel_winner" ? winner : loser;
  }
  if (ref.type === "winner" || ref.type === "loser") {
    const match = rounds.flatMap((r) => r.matches).find((m) => m.id === ref.matchId);
    if (!match || !match.played) return null;
    const hIdx = resolveRef(match.homeRef, teams, rounds);
    const aIdx = resolveRef(match.awayRef, teams, rounds);
    const hg = +match.homeScore, ag = +match.awayScore;
    if (hg > ag) return ref.type === "winner" ? hIdx : aIdx;
    if (ag > hg) return ref.type === "winner" ? aIdx : hIdx;
    const winner = hIdx < aIdx ? hIdx : aIdx;
    const loser = hIdx < aIdx ? aIdx : hIdx;
    return ref.type === "winner" ? winner : loser;
  }
  return null;
}
function makeFixtures(teams, settings) {
  const n = teams.length;
  let counter = 0;
  const id = () => "f" + counter++;
  const fixtures = [];
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const p1 = calcProbs(i, j, teams, [], settings);
      const p2 = calcProbs(j, i, teams, [], settings);
      fixtures.push({ id: id(), homeIdx: i, awayIdx: j, homeWin: p1.homeWin, draw: p1.draw, awayWin: p1.awayWin, overrideOn: false, ovHW: "", ovD: "", ovAW: "", played: false, homeScore: null, awayScore: null, week: null });
      fixtures.push({ id: id(), homeIdx: j, awayIdx: i, homeWin: p2.homeWin, draw: p2.draw, awayWin: p2.awayWin, overrideOn: false, ovHW: "", ovD: "", ovAW: "", played: false, homeScore: null, awayScore: null, week: null });
    }
  }
  return fixtures;
}
function calcStats(teams, fixtures) {
  const played = fixtures.filter((f) => f.played && f.homeScore != null && f.awayScore != null);
  const s = {};
  teams.forEach((t) => {
    s[t.id] = { id: t.id, name: t.name, basePts: t.points, P: 0, W: 0, D: 0, L: 0, GF: 0, GA: 0 };
  });
  played.forEach((f) => {
    var _a, _b;
    const hg = +f.homeScore, ag = +f.awayScore;
    if (isNaN(hg) || isNaN(ag)) return;
    const h = s[(_a = teams[f.homeIdx]) == null ? void 0 : _a.id], a = s[(_b = teams[f.awayIdx]) == null ? void 0 : _b.id];
    if (!h || !a) return;
    h.P++;
    a.P++;
    h.GF += hg;
    h.GA += ag;
    a.GF += ag;
    a.GA += hg;
    if (hg > ag) {
      h.W++;
      a.L++;
    } else if (hg < ag) {
      a.W++;
      h.L++;
    } else {
      h.D++;
      a.D++;
    }
  });
  const rows = Object.values(s).map((r) => __spreadProps(__spreadValues({}, r), { GD: r.GF - r.GA, totalPts: r.basePts + r.W * 2 + r.D }));
  function h2h(ids) {
    const h = {};
    ids.forEach((id) => {
      h[id] = { pts: 0, GF: 0, GA: 0, awayGF: 0 };
    });
    played.forEach((f) => {
      var _a, _b;
      const hid = (_a = teams[f.homeIdx]) == null ? void 0 : _a.id, aid = (_b = teams[f.awayIdx]) == null ? void 0 : _b.id;
      if (!ids.includes(hid) || !ids.includes(aid)) return;
      const hg = +f.homeScore, ag = +f.awayScore;
      if (isNaN(hg) || isNaN(ag)) return;
      if (hg > ag) {
        h[hid].pts += 2;
      } else if (hg < ag) {
        h[aid].pts += 2;
      } else {
        h[hid].pts++;
        h[aid].pts++;
      }
      h[hid].GF += hg;
      h[hid].GA += ag;
      h[aid].GF += ag;
      h[aid].GA += hg;
      h[aid].awayGF += ag;
    });
    return h;
  }
  return rows.sort((a, b) => {
    if (b.totalPts !== a.totalPts) return b.totalPts - a.totalPts;
    const ids = rows.filter((r) => r.totalPts === a.totalPts).map((r) => r.id);
    const hh = h2h(ids);
    const ha = hh[a.id], hb = hh[b.id];
    if (b.W !== a.W) return b.W - a.W;
    if (hb.pts !== ha.pts) return hb.pts - ha.pts;
    const gdA = ha.GF - ha.GA, gdB = hb.GF - hb.GA;
    if (gdB !== gdA) return gdB - gdA;
    if (hb.awayGF !== ha.awayGF) return hb.awayGF - ha.awayGF;
    if (b.GD !== a.GD) return b.GD - a.GD;
    return a.name.localeCompare(b.name);
  });
}
function calcProbs(homeIdx, awayIdx, teams, fixtures, settings) {
  const { baseWin, baseDraw, rankBonus } = settings;
  const ht = teams[homeIdx], at = teams[awayIdx];
  const hBonus = ht && ht.homeBonus !== "" && ht.homeBonus != null ? parseFloat(ht.homeBonus) || 0 : settings.homeBonus;
  const table = calcStats(teams, fixtures);
  const homeRow = table.find((r) => r.id === (ht == null ? void 0 : ht.id));
  const awayRow = table.find((r) => r.id === (at == null ? void 0 : at.id));
  const hp = table.indexOf(homeRow);
  const ap = table.indexOf(awayRow);
  let gap = 0;
  if (homeRow && awayRow && homeRow.totalPts !== awayRow.totalPts) {
    const hGrp = table.map((r, i) => r.totalPts === homeRow.totalPts ? i : -1).filter((i) => i >= 0);
    const aGrp = table.map((r, i) => r.totalPts === awayRow.totalPts ? i : -1).filter((i) => i >= 0);
    gap = hp < ap ? Math.min(...aGrp) - Math.max(...hGrp) : Math.max(...aGrp) - Math.min(...hGrp);
  }
  const shift = gap * rankBonus;
  let hw = Math.max(0, Math.min(100 - baseDraw, baseWin + hBonus + shift));
  let aw = 100 - baseDraw - hw;
  if (aw < 0) {
    hw += aw;
    aw = 0;
  }
  return { homeWin: Math.round(hw), draw: Math.round(baseDraw), awayWin: Math.max(0, Math.round(aw)) };
}
function runMC(teams, pending, played) {
  const n = teams.length, SIMS = 1e5;
  const hits = teams.map(() => new Array(n).fill(0));
  const basePts = teams.map((t) => t.points);
  const baseWins = new Array(n).fill(0);
  const baseH2H = Array.from({ length: n }, () => new Array(n).fill(0));
  (played || []).forEach((f) => {
    const hi = f.homeIdx, ai = f.awayIdx;
    const hg = +f.homeScore, ag = +f.awayScore;
    if (isNaN(hg) || isNaN(ag)) return;
    if (hg > ag) {
      baseWins[hi]++;
      baseH2H[hi][ai] += 2;
    } else if (hg < ag) {
      baseWins[ai]++;
      baseH2H[ai][hi] += 2;
    } else {
      baseH2H[hi][ai]++;
      baseH2H[ai][hi]++;
    }
  });
  for (let s = 0; s < SIMS; s++) {
    const pts = basePts.slice();
    const wins = baseWins.slice();
    const h2h = baseH2H.map((row) => row.slice());
    for (const f of pending) {
      const r = Math.random() * 100;
      const hi = f.homeIdx, ai = f.awayIdx;
      if (r < f.homeWin) {
        pts[hi] += 2;
        wins[hi]++;
        h2h[hi][ai] += 2;
      } else if (r < f.homeWin + f.draw) {
        pts[hi]++;
        pts[ai]++;
        h2h[hi][ai]++;
        h2h[ai][hi]++;
      } else {
        pts[ai] += 2;
        wins[ai]++;
        h2h[ai][hi] += 2;
      }
    }
    const entries = pts.map((p, i) => ({ p, i, w: wins[i], rnd: Math.random() }));
    entries.sort((a, b) => {
      if (b.p !== a.p) return b.p - a.p;
      if (b.w !== a.w) return b.w - a.w;
      const tiedIdxs = entries.filter((e) => e.p === a.p).map((e) => e.i);
      const sumA = tiedIdxs.reduce((s2, j) => s2 + (j !== a.i ? h2h[a.i][j] : 0), 0);
      const sumB = tiedIdxs.reduce((s2, j) => s2 + (j !== b.i ? h2h[b.i][j] : 0), 0);
      if (sumB !== sumA) return sumB - sumA;
      return a.rnd - b.rnd;
    });
    entries.forEach(({ i }, rank) => {
      hits[i][rank]++;
    });
  }
  return hits.map((row) => row.map((v) => v / SIMS * 100));
}
function heatColor(v) {
  if (v < 0.01) return "transparent";
  const t = Math.min(v / 55, 1);
  return "rgba(" + Math.round(30 + t * 220) + "," + Math.round(180 - t * 120) + "," + Math.round(120 - t * 70) + "," + (0.12 + t * 0.78) + ")";
}
function fmtPct(v) {
  if (v < 1e-3) return "";
  if (v < 0.1) return "<0.1%";
  return v.toFixed(1) + "%";
}
function fixProbs(f, teams, fixtures, settings) {
  if (f.overrideOn && f.ovHW !== "") return { homeWin: parseFloat(f.ovHW) || 0, draw: parseFloat(f.ovD) || 0, awayWin: parseFloat(f.ovAW) || 0 };
  return calcProbs(f.homeIdx, f.awayIdx, teams, fixtures, settings);
}
function SettingsPanel({ settings, onChange, showTiebreakers, league, onLeagueChange }) {
  const pf = [
    { k: "baseWin", l: "Base Win %", n: "Starting win % per side" },
    { k: "baseDraw", l: "Base Draw %", n: "Fixed, never adjusted" },
    { k: "homeBonus", l: "Global Home %", n: "Used if no team override" },
    { k: "rankBonus", l: "Rank Gap % / pos", n: "Per effective position gap" }
  ];
  const sf = [
    { k: "winScore", l: "Win score", n: "Goals for winner" },
    { k: "lossScore", l: "Loss score", n: "Goals for loser" },
    { k: "drawScore", l: "Draw score", n: "Goals each side" }
  ];
  return /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "sbox" }, /* @__PURE__ */ React.createElement("div", { className: "sub-ttl" }, "Probability settings"), /* @__PURE__ */ React.createElement("div", { className: "sgrid", style: { gridTemplateColumns: "1fr 1fr 1fr 1fr" } }, pf.map(({ k, l, n }) => /* @__PURE__ */ React.createElement("div", { key: k, className: "sfield" }, /* @__PURE__ */ React.createElement("span", { className: "lbl" }, l), /* @__PURE__ */ React.createElement("input", { className: "sinp", type: "number", min: "0", max: "100", value: settings[k] || 0, onChange: (e) => onChange(k, parseFloat(e.target.value) || 0) }), /* @__PURE__ */ React.createElement("span", { className: "snote" }, n)))), /* @__PURE__ */ React.createElement("hr", { className: "sdivider" }), /* @__PURE__ */ React.createElement("div", { className: "sub-ttl" }, "Quick result scores"), /* @__PURE__ */ React.createElement("div", { className: "sgrid", style: { gridTemplateColumns: "1fr 1fr 1fr" } }, sf.map(({ k, l, n }) => /* @__PURE__ */ React.createElement("div", { key: k, className: "sfield" }, /* @__PURE__ */ React.createElement("span", { className: "lbl" }, l), /* @__PURE__ */ React.createElement("input", { className: "sinp", type: "number", min: "0", value: settings[k] || 0, onChange: (e) => onChange(k, parseFloat(e.target.value) || 0) }), /* @__PURE__ */ React.createElement("span", { className: "snote" }, n))))), league && league.type !== "playoff" && onLeagueChange && /* @__PURE__ */ React.createElement("div", { className: "sbox" }, /* @__PURE__ */ React.createElement("div", { className: "sub-ttl" }, "Highlight zones"), /* @__PURE__ */ React.createElement("div", { className: "config-row", style: { marginBottom: ".6rem" } }, /* @__PURE__ */ React.createElement("span", { style: { fontSize: ".82rem", color: "#4ade80", minWidth: "140px" } }, "Promotion (top):"), /* @__PURE__ */ React.createElement("div", { className: "config-opts" }, [0, 1, 2, 3, 4].map((n) => {
    var _a, _b;
    return /* @__PURE__ */ React.createElement(
      "span",
      {
        key: n,
        className: "config-opt" + (((_a = league.promoTop) != null ? _a : 2) === n ? " sel" : ""),
        style: ((_b = league.promoTop) != null ? _b : 2) === n ? { borderColor: "#4ade80", background: "rgba(74,222,128,.1)", color: "#4ade80" } : {},
        onClick: () => onLeagueChange((lg) => __spreadProps(__spreadValues({}, lg), { promoTop: n }))
      },
      n
    );
  }))), /* @__PURE__ */ React.createElement("div", { className: "config-row" }, /* @__PURE__ */ React.createElement("span", { style: { fontSize: ".82rem", color: "#f87171", minWidth: "140px" } }, "Relegation (bottom):"), /* @__PURE__ */ React.createElement("div", { className: "config-opts" }, [0, 1, 2, 3, 4].map((n) => {
    var _a, _b;
    return /* @__PURE__ */ React.createElement(
      "span",
      {
        key: n,
        className: "config-opt" + (((_a = league.demotBot) != null ? _a : 2) === n ? " sel" : ""),
        style: ((_b = league.demotBot) != null ? _b : 2) === n ? { borderColor: "#f87171", background: "rgba(248,113,113,.1)", color: "#f87171" } : {},
        onClick: () => onLeagueChange((lg) => __spreadProps(__spreadValues({}, lg), { demotBot: n }))
      },
      n
    );
  })))), showTiebreakers && /* @__PURE__ */ React.createElement("div", { className: "sbox" }, /* @__PURE__ */ React.createElement("div", { className: "sub-ttl" }, "End-of-season tiebreakers (always applied)"), /* @__PURE__ */ React.createElement("ul", { className: "tb-list" }, [
    "Most wins overall",
    "Most points in head-to-head matches among tied teams",
    "Best goal difference in those head-to-head matches",
    "Most goals scored as away team in tied opponents home fixtures",
    "Best overall goal difference",
    "Alphabetical (final fallback)"
  ].map((tb, i) => /* @__PURE__ */ React.createElement("li", { key: i }, /* @__PURE__ */ React.createElement("span", { className: "tb-num" }, i + 1, "."), tb)))));
}
function HomeScreen({ leagues, onOpen, onCreate, onDelete }) {
  const [modal, setModal] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState("standard");
  const [poSize, setPoSize] = useState(6);
  const [pdSize, setPdSize] = useState(4);
  const [phaseFormat, setPhaseFormat] = useState("round-robin");
  const [customPo, setCustomPo] = useState("");
  const [customPd, setCustomPd] = useState("");
  const effPoSize = customPo !== "" ? parseInt(customPo) || 6 : poSize;
  const effPdSize = customPd !== "" ? parseInt(customPd) || 4 : pdSize;
  function submit() {
    if (!name.trim()) return;
    onCreate(name.trim(), type, effPoSize, effPdSize, phaseFormat);
    setName("");
    setType("standard");
    setPoSize(6);
    setPdSize(4);
    setPhaseFormat("round-robin");
    setCustomPo("");
    setCustomPd("");
    setModal(false);
  }
  return /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "card-grid" }, leagues.map((lg) => /* @__PURE__ */ React.createElement("div", { key: lg.id, className: "card", onClick: () => onOpen(lg.id) }, /* @__PURE__ */ React.createElement("button", { className: "card-del", onClick: (e) => {
    e.stopPropagation();
    onDelete(lg.id);
  } }, "✕"), /* @__PURE__ */ React.createElement("div", { className: "card-badge " + (lg.type === "playoff" ? "badge-po" : "badge-std") }, lg.type === "playoff" ? "Play-off League" : "Standard League"), /* @__PURE__ */ React.createElement("div", { className: "card-name" }, lg.name), /* @__PURE__ */ React.createElement("div", { className: "card-meta" }, (lg.teams || []).length, " teams · ", (lg.fixtures || []).filter((f) => !f.played).length, " pending · ", (lg.fixtures || []).filter((f) => f.played).length, " played", lg.type === "playoff" && (() => {
    var _a, _b, _c, _d;
    const poPlayed = (((_a = lg.playoffs) == null ? void 0 : _a.fixtures) || []).filter((f) => f.played).length;
    const poPending = (((_b = lg.playoffs) == null ? void 0 : _b.fixtures) || []).filter((f) => !f.played).length;
    const pdPlayed = (((_c = lg.playdowns) == null ? void 0 : _c.fixtures) || []).filter((f) => f.played).length;
    const pdPending = (((_d = lg.playdowns) == null ? void 0 : _d.fixtures) || []).filter((f) => !f.played).length;
    const poNotGen = !lg.playoffs;
    const pdNotGen = !lg.playdowns;
    return /* @__PURE__ */ React.createElement("span", null, " · ", /* @__PURE__ */ React.createElement("span", { style: { color: poNotGen ? "#f87171" : poPending > 0 ? "#facc15" : "#4ade80" } }, "PO: ", poNotGen ? "not generated" : poPending > 0 ? poPending + " pending" : "done"), " · ", /* @__PURE__ */ React.createElement("span", { style: { color: pdNotGen ? "#f87171" : pdPending > 0 ? "#facc15" : "#4ade80" } }, "PD: ", pdNotGen ? "not generated" : pdPending > 0 ? pdPending + " pending" : "done"));
  })()))), /* @__PURE__ */ React.createElement("div", { className: "card card-new", onClick: () => setModal(true) }, "+ New League")), modal && /* @__PURE__ */ React.createElement("div", { className: "overlay-c", onClick: () => setModal(false) }, /* @__PURE__ */ React.createElement("div", { className: "modal", onClick: (e) => e.stopPropagation() }, /* @__PURE__ */ React.createElement("h3", null, "New League"), /* @__PURE__ */ React.createElement("input", { className: "inp", autoFocus: true, value: name, onChange: (e) => setName(e.target.value), onKeyDown: (e) => e.key === "Enter" && submit(), placeholder: "League name", style: { marginBottom: ".85rem" } }), /* @__PURE__ */ React.createElement("div", { className: "type-cards" }, /* @__PURE__ */ React.createElement("div", { className: "type-card" + (type === "standard" ? " sel" : ""), onClick: () => setType("standard") }, /* @__PURE__ */ React.createElement("div", { className: "type-card-title" }, "Standard"), /* @__PURE__ */ React.createElement("div", { className: "type-card-desc" }, "Regular season only. Top 2 promoted, bottom 2 relegated.")), /* @__PURE__ */ React.createElement("div", { className: "type-card" + (type === "playoff" ? " sel po" : ""), onClick: () => setType("playoff") }, /* @__PURE__ */ React.createElement("div", { className: "type-card-title" }, "Play-off"), /* @__PURE__ */ React.createElement("div", { className: "type-card-desc" }, "Regular season with post-season phases."))), type === "playoff" && /* @__PURE__ */ React.createElement("div", { className: "phase-config", style: { marginTop: ".75rem" } }, /* @__PURE__ */ React.createElement("div", { className: "phase-config-title" }, "Phase configuration"), /* @__PURE__ */ React.createElement("div", { className: "config-row" }, /* @__PURE__ */ React.createElement("span", { className: "config-label" }, "Play-off teams:"), /* @__PURE__ */ React.createElement("div", { className: "config-opts" }, [4, 6, 8].map((n) => /* @__PURE__ */ React.createElement("span", { key: n, className: "config-opt" + (poSize === n && customPo === "" ? " sel" : ""), onClick: () => {
    setPoSize(n);
    setCustomPo("");
  } }, n)), /* @__PURE__ */ React.createElement("input", { className: "config-inp", type: "number", min: "2", placeholder: "Other", value: customPo, onChange: (e) => setCustomPo(e.target.value), style: { width: "4.5rem" } }))), /* @__PURE__ */ React.createElement("div", { className: "config-row" }, /* @__PURE__ */ React.createElement("span", { className: "config-label" }, "Play-down teams:"), /* @__PURE__ */ React.createElement("div", { className: "config-opts" }, [2, 4, 6].map((n) => /* @__PURE__ */ React.createElement("span", { key: n, className: "config-opt" + (pdSize === n && customPd === "" ? " sel" : ""), onClick: () => {
    setPdSize(n);
    setCustomPd("");
  } }, n)), /* @__PURE__ */ React.createElement("input", { className: "config-inp", type: "number", min: "2", placeholder: "Other", value: customPd, onChange: (e) => setCustomPd(e.target.value), style: { width: "4.5rem" } }))), /* @__PURE__ */ React.createElement("div", { className: "config-row" }, /* @__PURE__ */ React.createElement("span", { className: "config-label" }, "Format:"), /* @__PURE__ */ React.createElement("div", { className: "config-opts" }, /* @__PURE__ */ React.createElement("span", { className: "config-opt" + (phaseFormat === "round-robin" ? " sel" : ""), onClick: () => setPhaseFormat("round-robin") }, "2-Round Robin"), /* @__PURE__ */ React.createElement("span", { className: "config-opt" + (phaseFormat === "tournament" ? " sel" : ""), onClick: () => setPhaseFormat("tournament") }, "Tournament")))), /* @__PURE__ */ React.createElement("div", { className: "modal-btns" }, /* @__PURE__ */ React.createElement("button", { className: "btn btn-cyan", onClick: submit, disabled: !name.trim() }, "Create"), /* @__PURE__ */ React.createElement("button", { className: "btn btn-ghost", onClick: () => setModal(false) }, "Cancel")))));
}
function TeamDetail({ team, teamIdx, teams, fixtures, onClose }) {
  const mine = fixtures.filter((f) => f.homeIdx === teamIdx || f.awayIdx === teamIdx);
  const sorted = [...mine].sort((a, b) => {
    var _a, _b;
    const wa = (_a = a.week) != null ? _a : 99999, wb = (_b = b.week) != null ? _b : 99999;
    return wa - wb;
  });
  const homePlayed = mine.filter((f) => f.homeIdx === teamIdx && f.played && f.homeScore != null);
  const awayPlayed = mine.filter((f) => f.awayIdx === teamIdx && f.played && f.homeScore != null);
  const homeWins = homePlayed.filter((f) => +f.homeScore > +f.awayScore).length;
  const awayWins = awayPlayed.filter((f) => +f.awayScore > +f.homeScore).length;
  const homeWinPct = homePlayed.length ? Math.round(homeWins / homePlayed.length * 100) : null;
  const awayWinPct = awayPlayed.length ? Math.round(awayWins / awayPlayed.length * 100) : null;
  const avgFmt = (arr, fn) => arr.length ? (arr.reduce((s, f) => s + fn(f), 0) / arr.length).toFixed(1) : null;
  const homeGFavg = avgFmt(homePlayed, (f) => +f.homeScore);
  const homeGAavg = avgFmt(homePlayed, (f) => +f.awayScore);
  const awayGFavg = avgFmt(awayPlayed, (f) => +f.awayScore);
  const awayGAavg = avgFmt(awayPlayed, (f) => +f.homeScore);
  function resColor(f) {
    const home = f.homeIdx === teamIdx;
    const hg = +f.homeScore, ag = +f.awayScore;
    if (hg === ag) return "#facc15";
    return (home ? hg > ag : ag > hg) ? "#4ade80" : "#f87171";
  }
  function HaBadge({ isHome }) {
    const col = isHome ? "#22d3ee" : "#a78bfa";
    const bg = isHome ? "rgba(34,211,238,.1)" : "rgba(167,139,250,.1)";
    return /* @__PURE__ */ React.createElement("span", { className: "ha-badge", style: { color: col, background: bg, border: "1px solid " + col } }, isHome ? "HOME" : "AWAY");
  }
  const hasStats = homePlayed.length > 0 || awayPlayed.length > 0;
  const oppStats = (() => {
    const byOpp = {};
    mine.filter((f) => f.played && f.homeScore != null).forEach((f) => {
      var _a;
      const isHome = f.homeIdx === teamIdx;
      const oppIdx = isHome ? f.awayIdx : f.homeIdx;
      const oppName = ((_a = teams[oppIdx]) == null ? void 0 : _a.name) || "Unknown";
      const gf = isHome ? +f.homeScore : +f.awayScore;
      const ga = isHome ? +f.awayScore : +f.homeScore;
      if (!byOpp[oppName]) byOpp[oppName] = { gf: 0, ga: 0, games: 0 };
      byOpp[oppName].gf += gf;
      byOpp[oppName].ga += ga;
      byOpp[oppName].games++;
    });
    return Object.entries(byOpp).map(([name, s]) => ({ name, gd: s.gf - s.ga, gf: s.gf, ga: s.ga, games: s.games }));
  })();
  const toughest = oppStats.length > 0 ? oppStats.reduce((a, b) => a.gd < b.gd ? a : b) : null;
  const weakest = oppStats.length > 1 ? oppStats.reduce((a, b) => a.gd > b.gd ? a : b) : null;
  const playedWithScore = mine.filter((f) => f.played && f.homeScore != null);
  const fixtureGD = playedWithScore.map((f) => {
    var _a, _b;
    const isHome = f.homeIdx === teamIdx;
    const gf = isHome ? +f.homeScore : +f.awayScore;
    const ga = isHome ? +f.awayScore : +f.homeScore;
    const opp = isHome ? (_a = teams[f.awayIdx]) == null ? void 0 : _a.name : (_b = teams[f.homeIdx]) == null ? void 0 : _b.name;
    return { f, gd: gf - ga, gf, ga, opp, isHome };
  });
  const worstGD = fixtureGD.length > 0 ? Math.min(...fixtureGD.map((x) => x.gd)) : null;
  const worstFixtures = worstGD != null ? fixtureGD.filter((x) => x.gd === worstGD).sort((a, b) => a.gf - b.gf) : [];
  const bestGD = fixtureGD.length > 0 ? Math.max(...fixtureGD.map((x) => x.gd)) : null;
  const bestFixtures = bestGD != null ? fixtureGD.filter((x) => x.gd === bestGD).sort((a, b) => b.gf - a.gf) : [];
  function StatRow({ label, homeVal, awayVal, color }) {
    return /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: ".3rem", padding: ".28rem 0", borderBottom: "1px solid #1c1f27", fontSize: ".78rem", alignItems: "center" } }, /* @__PURE__ */ React.createElement("span", { style: { fontFamily: "DM Mono,monospace", fontSize: ".68rem", color: "#5a6070" } }, label), /* @__PURE__ */ React.createElement("span", { style: { textAlign: "center", fontFamily: "DM Mono,monospace", fontWeight: 600, color: homeVal != null ? color : "#3a3f50" } }, homeVal != null ? homeVal : "—"), /* @__PURE__ */ React.createElement("span", { style: { textAlign: "center", fontFamily: "DM Mono,monospace", fontWeight: 600, color: awayVal != null ? color : "#3a3f50" } }, awayVal != null ? awayVal : "—"));
  }
  return /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("div", { className: "detail-overlay", onClick: onClose }), /* @__PURE__ */ React.createElement("div", { className: "detail-panel", style: { width: "600px" } }, /* @__PURE__ */ React.createElement("div", { className: "detail-h" }, /* @__PURE__ */ React.createElement("h3", null, team == null ? void 0 : team.name), /* @__PURE__ */ React.createElement("button", { className: "detail-close", onClick: onClose }, "✕")), /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", alignItems: "start" } }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "detail-sec", style: { marginBottom: ".5rem" } }, "Statistics"), !hasStats && /* @__PURE__ */ React.createElement("div", { className: "muted", style: { fontSize: ".8rem" } }, "No played games yet."), hasStats && /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: ".3rem", padding: ".2rem 0", marginBottom: ".15rem" } }, /* @__PURE__ */ React.createElement("span", null), /* @__PURE__ */ React.createElement("span", { style: { textAlign: "center", fontFamily: "DM Mono,monospace", fontSize: ".65rem", color: "#22d3ee", fontWeight: 700 } }, "HOME"), /* @__PURE__ */ React.createElement("span", { style: { textAlign: "center", fontFamily: "DM Mono,monospace", fontSize: ".65rem", color: "#a78bfa", fontWeight: 700 } }, "AWAY")), /* @__PURE__ */ React.createElement(StatRow, { label: "Games", homeVal: homePlayed.length || null, awayVal: awayPlayed.length || null, color: "#d4d8e0" }), /* @__PURE__ */ React.createElement(StatRow, { label: "Win %", homeVal: homeWinPct != null ? homeWinPct + "%" : null, awayVal: awayWinPct != null ? awayWinPct + "%" : null, color: "#4ade80" }), /* @__PURE__ */ React.createElement(StatRow, { label: "Avg GF", homeVal: homeGFavg, awayVal: awayGFavg, color: "#4ade80" }), /* @__PURE__ */ React.createElement(StatRow, { label: "Avg GA", homeVal: homeGAavg, awayVal: awayGAavg, color: "#f87171" }), (toughest || weakest) && /* @__PURE__ */ React.createElement("div", { style: { marginTop: ".6rem", borderTop: "1px solid #1c1f27", paddingTop: ".45rem" } }, oppStats.length > 0 && (() => {
    const [oppOpen, setOppOpen] = useState(false);
    const sorted2 = [...oppStats].sort((a, b) => a.gd - b.gd);
    return /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement(
      "div",
      {
        style: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: ".25rem 0", cursor: "pointer", userSelect: "none" },
        onClick: () => setOppOpen((o) => !o)
      },
      /* @__PURE__ */ React.createElement("span", { style: { fontFamily: "DM Mono,monospace", fontSize: ".68rem", color: "#5a6070" } }, "Opponents ", oppOpen ? "▲" : "▼"),
      !oppOpen && toughest && /* @__PURE__ */ React.createElement("span", { style: { fontSize: ".78rem" } }, /* @__PURE__ */ React.createElement("span", { style: { color: "#f87171", fontWeight: 600 } }, toughest.name), /* @__PURE__ */ React.createElement("span", { style: { fontFamily: "DM Mono,monospace", fontSize: ".7rem", color: "#3a3f50", marginLeft: ".3rem" } }, toughest.gd > 0 ? "+" : "", toughest.gd), weakest && weakest.name !== toughest.name && /* @__PURE__ */ React.createElement("span", { style: { marginLeft: ".5rem" } }, /* @__PURE__ */ React.createElement("span", { style: { color: "#4ade80", fontWeight: 600 } }, weakest.name), /* @__PURE__ */ React.createElement("span", { style: { fontFamily: "DM Mono,monospace", fontSize: ".7rem", color: "#3a3f50", marginLeft: ".3rem" } }, weakest.gd > 0 ? "+" : "", weakest.gd)))
    ), oppOpen && /* @__PURE__ */ React.createElement("div", { style: { borderTop: "1px solid #1c1f27", paddingTop: ".25rem" } }, sorted2.map((o, i) => /* @__PURE__ */ React.createElement("div", { key: o.name, style: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: ".2rem 0", borderBottom: i < sorted2.length - 1 ? "1px solid #1c1f27" : "none" } }, /* @__PURE__ */ React.createElement("span", { style: { fontFamily: "DM Mono,monospace", fontSize: ".65rem", color: "#3a3f50", minWidth: "1.4rem" } }, i + 1, "."), /* @__PURE__ */ React.createElement("span", { style: { flex: 1, fontSize: ".78rem", color: o.gd < 0 ? "#f87171" : o.gd > 0 ? "#4ade80" : "#d4d8e0", fontWeight: 600 } }, o.name), /* @__PURE__ */ React.createElement("span", { style: { fontFamily: "DM Mono,monospace", fontSize: ".72rem", color: "#3a3f50" } }, o.gd > 0 ? "+" : "", o.gd, " GD"), /* @__PURE__ */ React.createElement("span", { style: { fontFamily: "DM Mono,monospace", fontSize: ".68rem", color: "#3a3f50", marginLeft: ".35rem" } }, "(", o.games, "g)")))));
  })()), (bestFixtures.length > 0 || worstFixtures.length > 0) && /* @__PURE__ */ React.createElement("div", { style: { marginTop: ".6rem", borderTop: "1px solid #1c1f27", paddingTop: ".45rem" } }, bestFixtures.map((x, i) => /* @__PURE__ */ React.createElement("div", { key: x.f.id, style: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: ".22rem 0", borderBottom: i < bestFixtures.length - 1 ? "1px solid #1c1f27" : "none" } }, i === 0 && /* @__PURE__ */ React.createElement("span", { style: { fontFamily: "DM Mono,monospace", fontSize: ".68rem", color: "#5a6070", minWidth: "3rem" } }, "Best"), i > 0 && /* @__PURE__ */ React.createElement("span", { style: { minWidth: "3rem" } }), /* @__PURE__ */ React.createElement("span", { style: { flex: 1, fontSize: ".78rem", color: "#4ade80", fontWeight: 600 } }, x.opp), /* @__PURE__ */ React.createElement("span", { style: { fontFamily: "DM Mono,monospace", fontSize: ".75rem", color: "#4ade80" } }, x.gf, "—", x.ga), /* @__PURE__ */ React.createElement("span", { style: { fontFamily: "DM Mono,monospace", fontSize: ".7rem", color: "#3a3f50", marginLeft: ".4rem" } }, x.gd > 0 ? "+" : "", x.gd))), worstFixtures.map((x, i) => /* @__PURE__ */ React.createElement("div", { key: x.f.id, style: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: ".22rem 0", borderBottom: i < worstFixtures.length - 1 ? "1px solid #1c1f27" : "none", marginTop: bestFixtures.length > 0 && i === 0 ? ".35rem" : 0 } }, i === 0 && /* @__PURE__ */ React.createElement("span", { style: { fontFamily: "DM Mono,monospace", fontSize: ".68rem", color: "#5a6070", minWidth: "3rem" } }, "Worst"), i > 0 && /* @__PURE__ */ React.createElement("span", { style: { minWidth: "3rem" } }), /* @__PURE__ */ React.createElement("span", { style: { flex: 1, fontSize: ".78rem", color: "#f87171", fontWeight: 600 } }, x.opp), /* @__PURE__ */ React.createElement("span", { style: { fontFamily: "DM Mono,monospace", fontSize: ".75rem", color: "#f87171" } }, x.gf, "—", x.ga), /* @__PURE__ */ React.createElement("span", { style: { fontFamily: "DM Mono,monospace", fontSize: ".7rem", color: "#3a3f50", marginLeft: ".4rem" } }, x.gd > 0 ? "+" : "", x.gd)))))), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "detail-sec", style: { marginBottom: ".5rem" } }, "Fixtures (", mine.filter((f) => f.played).length, " played, ", mine.filter((f) => !f.played).length, " pending)"), sorted.length === 0 && /* @__PURE__ */ React.createElement("div", { className: "empty", style: { padding: ".5rem" } }, "No fixtures yet."), sorted.map((f) => {
    var _a, _b;
    const isHome = f.homeIdx === teamIdx;
    const opp = isHome ? (_a = teams[f.awayIdx]) == null ? void 0 : _a.name : (_b = teams[f.homeIdx]) == null ? void 0 : _b.name;
    return /* @__PURE__ */ React.createElement("div", { key: f.id, className: "detail-match", style: { opacity: f.played ? 1 : 0.6 } }, f.week != null && /* @__PURE__ */ React.createElement("span", { className: "week-badge", style: { fontSize: ".6rem", padding: ".08rem .3rem" } }, "W", f.week), /* @__PURE__ */ React.createElement(HaBadge, { isHome }), /* @__PURE__ */ React.createElement("span", { className: "detail-opp", style: { color: f.played ? "#d4d8e0" : "#5a6070" } }, opp), f.played && f.homeScore != null ? /* @__PURE__ */ React.createElement("span", { className: "detail-score", style: { color: resColor(f) } }, f.homeScore, "—", f.awayScore) : /* @__PURE__ */ React.createElement("span", { style: { fontFamily: "DM Mono,monospace", fontSize: ".7rem", color: "#3a3f50" } }, "pending"));
  })))));
}
function LeagueTable({ teams, fixtures, onTeamClick, highlightTop, highlightBottom, confirmedTop, confirmedBottom }) {
  const rows = useMemo(() => calcStats(teams, fixtures), [teams, fixtures]);
  const hasPlayed = fixtures.some((f) => f.played && f.homeScore != null);
  const n = rows.length;
  const attackers = useMemo(() => rows.filter((r) => r.P > 0).sort((a, b) => b.GF - a.GF || a.name.localeCompare(b.name)).slice(0, 3), [rows]);
  const defenders = useMemo(() => rows.filter((r) => r.P > 0).sort((a, b) => a.GA - b.GA || a.name.localeCompare(b.name)).slice(0, 3), [rows]);
  const allAttackers = useMemo(() => rows.filter((r) => r.P > 0).sort((a, b) => b.GF - a.GF || a.name.localeCompare(b.name)), [rows]);
  const allDefenders = useMemo(() => rows.filter((r) => r.P > 0).sort((a, b) => a.GA - b.GA || a.name.localeCompare(b.name)), [rows]);
  const [rankingPanel, setRankingPanel] = useState(null);
  const MEDALS = ["🥇", "🥈", "🥉"];
  const toughRanking = useMemo(() => {
    const played = fixtures.filter((f) => f.played && f.homeScore != null && f.awayScore != null);
    const N = teams.length;
    const oppMap = teams.map(() => ({}));
    played.forEach((f) => {
      const hi = f.homeIdx, ai = f.awayIdx;
      if (hi >= N || ai >= N) return;
      const hg = +f.homeScore, ag = +f.awayScore;
      oppMap[hi][ai] = (oppMap[hi][ai] || 0) + (hg - ag);
      oppMap[ai][hi] = (oppMap[ai][hi] || 0) + (ag - hg);
    });
    const toughPts = new Array(N).fill(0);
    teams.forEach((_, ti) => {
      const opps = Object.entries(oppMap[ti]).map(([oi, gd]) => ({ oi: +oi, gd })).sort((a, b) => a.gd - b.gd);
      const nOpps = opps.length;
      opps.forEach(({ oi }, rank0) => {
        toughPts[oi] += Math.max(0, nOpps - rank0 - 1);
      });
    });
    return teams.map((t, i) => ({ id: t.id, name: t.name, pts: toughPts[i] })).sort((a, b) => b.pts - a.pts || a.name.localeCompare(b.name));
  }, [fixtures, teams]);
  const topTough = toughRanking.slice(0, 3);
  const homeGDRanking = useMemo(() => {
    const played = fixtures.filter((f) => f.played && f.homeScore != null && f.awayScore != null);
    const N = teams.length;
    const gd = new Array(N).fill(0);
    played.forEach((f) => {
      if (f.homeIdx < N) gd[f.homeIdx] += +f.homeScore - +f.awayScore;
    });
    return teams.map((t, i) => ({ id: t.id, name: t.name, gd: gd[i] })).sort((a, b) => b.gd - a.gd || a.name.localeCompare(b.name));
  }, [fixtures, teams]);
  const topHome = homeGDRanking.slice(0, 3);
  const awayGDRanking = useMemo(() => {
    const played = fixtures.filter((f) => f.played && f.homeScore != null && f.awayScore != null);
    const N = teams.length;
    const gd = new Array(N).fill(0);
    played.forEach((f) => {
      if (f.awayIdx < N) gd[f.awayIdx] += +f.awayScore - +f.homeScore;
    });
    return teams.map((t, i) => ({ id: t.id, name: t.name, gd: gd[i] })).sort((a, b) => b.gd - a.gd || a.name.localeCompare(b.name));
  }, [fixtures, teams]);
  const topAway = awayGDRanking.slice(0, 3);
  const clutchRanking = useMemo(() => {
    const played = fixtures.filter((f) => f.played && f.homeScore != null && f.awayScore != null);
    const N = teams.length;
    const wins = new Array(N).fill(0);
    played.forEach((f) => {
      const gd = +f.homeScore - +f.awayScore;
      if (gd === 1 || gd === 2) {
        if (f.homeIdx < N) wins[f.homeIdx]++;
      }
      if (gd === -1 || gd === -2) {
        if (f.awayIdx < N) wins[f.awayIdx]++;
      }
    });
    const sorted = teams.map((t, i) => ({ id: t.id, name: t.name, wins: wins[i] })).sort((a, b) => b.wins - a.wins || a.name.localeCompare(b.name));
    return sorted.map((r, i, arr) => __spreadProps(__spreadValues({}, r), {
      tied: i > 0 && arr[i].wins === arr[i - 1].wins && arr[i - 1].wins > 0
    }));
  }, [fixtures, teams]);
  const topClutch = clutchRanking.slice(0, 3);
  const unluckyRanking = useMemo(() => {
    const played = fixtures.filter((f) => f.played && f.homeScore != null && f.awayScore != null);
    const N = teams.length;
    const data = teams.map(() => ({ draws: 0, losses: 0, gdSum: 0 }));
    played.forEach((f) => {
      const gd = +f.homeScore - +f.awayScore;
      const absGd = Math.abs(gd);
      if (gd === 0) {
        if (f.homeIdx < N) {
          data[f.homeIdx].draws++;
          data[f.homeIdx].gdSum += 0;
        }
        if (f.awayIdx < N) {
          data[f.awayIdx].draws++;
          data[f.awayIdx].gdSum += 0;
        }
      } else if (absGd === 1 || absGd === 2) {
        if (gd > 0 && f.awayIdx < N) {
          data[f.awayIdx].losses++;
          data[f.awayIdx].gdSum += absGd;
        }
        if (gd < 0 && f.homeIdx < N) {
          data[f.homeIdx].losses++;
          data[f.homeIdx].gdSum += absGd;
        }
      }
    });
    return teams.map((t, i) => ({
      id: t.id,
      name: t.name,
      draws: data[i].draws,
      losses: data[i].losses,
      gdSum: data[i].gdSum,
      pts: 2 * data[i].draws + data[i].losses
    })).sort(
      (a, b) => b.pts - a.pts || b.draws - a.draws || a.gdSum - b.gdSum || a.name.localeCompare(b.name)
    );
  }, [fixtures, teams]);
  const topUnlucky = unluckyRanking.slice(0, 3);
  function rowBg(i, r) {
    if (confirmedTop && confirmedTop.has(r.id)) return "rgba(22,163,74,.45)";
    if (confirmedBottom && confirmedBottom.has(r.id)) return "rgba(185,28,28,.45)";
    if (highlightTop && i < highlightTop) return "rgba(22,101,52,.3)";
    if (highlightBottom && i >= n - highlightBottom) return "rgba(127,29,29,.3)";
    return "";
  }
  return /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "tbl-wrap" }, /* @__PURE__ */ React.createElement("table", { className: "ltbl" }, /* @__PURE__ */ React.createElement("thead", null, /* @__PURE__ */ React.createElement("tr", null, /* @__PURE__ */ React.createElement("th", { style: { width: "2rem" } }, "#"), /* @__PURE__ */ React.createElement("th", { className: "tl" }, "Team"), /* @__PURE__ */ React.createElement("th", { title: "Played" }, "P"), /* @__PURE__ */ React.createElement("th", { title: "Won" }, "W"), /* @__PURE__ */ React.createElement("th", { title: "Draw" }, "D"), /* @__PURE__ */ React.createElement("th", { title: "Lost" }, "L"), /* @__PURE__ */ React.createElement("th", { title: "Goals For" }, "GF"), /* @__PURE__ */ React.createElement("th", { title: "Goals Against" }, "GA"), /* @__PURE__ */ React.createElement("th", { className: "tgd", title: "Goal Difference" }, "GD"), /* @__PURE__ */ React.createElement("th", { className: "tpts", title: "Points" }, "Pts"))), /* @__PURE__ */ React.createElement("tbody", null, rows.map((r, i) => {
    const ti = teams.findIndex((t) => t.id === r.id);
    const bg = rowBg(i, r);
    const gdc = r.GD > 0 ? "gdp" : r.GD < 0 ? "gdn" : "gd0";
    return /* @__PURE__ */ React.createElement("tr", { key: r.id, style: bg ? { background: bg } : {} }, /* @__PURE__ */ React.createElement("td", { className: "tpos", style: bg ? { color: "rgba(255,255,255,0.85)", fontWeight: 700 } : {} }, i + 1), /* @__PURE__ */ React.createElement("td", { className: "tl" }, /* @__PURE__ */ React.createElement("button", { className: "otbtn", onClick: () => onTeamClick && onTeamClick(ti) }, r.name)), /* @__PURE__ */ React.createElement("td", null, r.P), /* @__PURE__ */ React.createElement("td", { style: { color: "#4ade80" } }, r.W), /* @__PURE__ */ React.createElement("td", { style: { color: "#facc15" } }, r.D), /* @__PURE__ */ React.createElement("td", { style: { color: "#f87171" } }, r.L), /* @__PURE__ */ React.createElement("td", null, r.GF), /* @__PURE__ */ React.createElement("td", null, r.GA), /* @__PURE__ */ React.createElement("td", { className: gdc }, r.GD > 0 ? "+" + r.GD : r.GD), /* @__PURE__ */ React.createElement("td", { className: "tpts" }, r.totalPts));
  })))), /* @__PURE__ */ React.createElement("p", { className: "note" }, "Click a team name for match details"), hasPlayed && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("div", { className: "mini-rankings" }, /* @__PURE__ */ React.createElement("div", { className: "mini-box" }, /* @__PURE__ */ React.createElement(
    "div",
    {
      className: "mini-ttl",
      style: { color: "#f87171", cursor: "pointer", userSelect: "none" },
      onClick: () => setRankingPanel(rankingPanel === "attackers" ? null : "attackers")
    },
    "⚽ Top Attackers ",
    rankingPanel === "attackers" ? "▲" : "▼"
  ), attackers.map((r, i) => /* @__PURE__ */ React.createElement("div", { key: r.id, className: "mini-row" }, /* @__PURE__ */ React.createElement("span", { className: "mini-pos" }, MEDALS[i]), /* @__PURE__ */ React.createElement("span", { className: "mini-name" }, r.name), /* @__PURE__ */ React.createElement("span", { className: "mini-val", style: { color: "#f87171" } }, r.GF, " GF")))), /* @__PURE__ */ React.createElement("div", { className: "mini-box" }, /* @__PURE__ */ React.createElement(
    "div",
    {
      className: "mini-ttl",
      style: { color: "#4ade80", cursor: "pointer", userSelect: "none" },
      onClick: () => setRankingPanel(rankingPanel === "defenders" ? null : "defenders")
    },
    "🛡 Top Defenders ",
    rankingPanel === "defenders" ? "▲" : "▼"
  ), defenders.map((r, i) => /* @__PURE__ */ React.createElement("div", { key: r.id, className: "mini-row" }, /* @__PURE__ */ React.createElement("span", { className: "mini-pos" }, MEDALS[i]), /* @__PURE__ */ React.createElement("span", { className: "mini-name" }, r.name), /* @__PURE__ */ React.createElement("span", { className: "mini-val", style: { color: "#4ade80" } }, r.GA, " GA"))))), hasPlayed && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("div", { className: "mini-rankings", style: { marginTop: "1rem" } }, /* @__PURE__ */ React.createElement("div", { className: "mini-box" }, /* @__PURE__ */ React.createElement(
    "div",
    {
      className: "mini-ttl",
      style: { color: "#f87171", cursor: "pointer", userSelect: "none" },
      onClick: () => setRankingPanel(rankingPanel === "tough" ? null : "tough")
    },
    "💀 Toughest Teams " + (rankingPanel === "tough" ? "▲" : "▼")
  ), topTough.map((r, i) => /* @__PURE__ */ React.createElement("div", { key: r.id, className: "mini-row" }, /* @__PURE__ */ React.createElement("span", { className: "mini-pos" }, i < 3 ? MEDALS[i] : i + 1 + ".", "‎"), /* @__PURE__ */ React.createElement("span", { className: "mini-name" }, r.name), /* @__PURE__ */ React.createElement("span", { className: "mini-val", style: { color: "#f87171" } }, r.pts, " pts")))), /* @__PURE__ */ React.createElement("div", { className: "mini-box" }, /* @__PURE__ */ React.createElement(
    "div",
    {
      className: "mini-ttl",
      style: { color: "#fb923c", cursor: "pointer", userSelect: "none" },
      onClick: () => setRankingPanel(rankingPanel === "home" ? null : "home")
    },
    "🏠 Strongest Home " + (rankingPanel === "home" ? "▲" : "▼")
  ), topHome.map((r, i) => /* @__PURE__ */ React.createElement("div", { key: r.id, className: "mini-row" }, /* @__PURE__ */ React.createElement("span", { className: "mini-pos" }, i < 3 ? MEDALS[i] : i + 1 + ".", "‎"), /* @__PURE__ */ React.createElement("span", { className: "mini-name" }, r.name), /* @__PURE__ */ React.createElement("span", { className: "mini-val", style: { color: "#fb923c" } }, r.gd > 0 ? "+" : "", r.gd, " GD")))), /* @__PURE__ */ React.createElement("div", { className: "mini-box" }, /* @__PURE__ */ React.createElement(
    "div",
    {
      className: "mini-ttl",
      style: { color: "#a78bfa", cursor: "pointer", userSelect: "none" },
      onClick: () => setRankingPanel(rankingPanel === "away" ? null : "away")
    },
    "✈️ Strongest Away " + (rankingPanel === "away" ? "▲" : "▼")
  ), topAway.map((r, i) => /* @__PURE__ */ React.createElement("div", { key: r.id, className: "mini-row" }, /* @__PURE__ */ React.createElement("span", { className: "mini-pos" }, i < 3 ? MEDALS[i] : i + 1 + ".", "‎"), /* @__PURE__ */ React.createElement("span", { className: "mini-name" }, r.name), /* @__PURE__ */ React.createElement("span", { className: "mini-val", style: { color: "#a78bfa" } }, r.gd > 0 ? "+" : "", r.gd, " GD"))))), /* @__PURE__ */ React.createElement("div", { className: "mini-rankings", style: { marginTop: "1rem" } }, /* @__PURE__ */ React.createElement("div", { className: "mini-box" }, /* @__PURE__ */ React.createElement(
    "div",
    {
      className: "mini-ttl",
      style: { color: "#facc15", cursor: "pointer", userSelect: "none" },
      onClick: () => setRankingPanel(rankingPanel === "clutch" ? null : "clutch")
    },
    "🎯 Most Clutch " + (rankingPanel === "clutch" ? "▲" : "▼")
  ), topClutch.map((r, i) => /* @__PURE__ */ React.createElement("div", { key: r.id, className: "mini-row" }, /* @__PURE__ */ React.createElement("span", { className: "mini-pos" }, r.tied ? "—" : i < 3 ? MEDALS[i] : i + 1 + ".", "‎"), /* @__PURE__ */ React.createElement("span", { className: "mini-name" }, r.name), /* @__PURE__ */ React.createElement("span", { className: "mini-val", style: { color: "#facc15" } }, r.wins, "W")))), /* @__PURE__ */ React.createElement("div", { className: "mini-box" }, /* @__PURE__ */ React.createElement(
    "div",
    {
      className: "mini-ttl",
      style: { color: "#94a3b8", cursor: "pointer", userSelect: "none" },
      onClick: () => setRankingPanel(rankingPanel === "unlucky" ? null : "unlucky")
    },
    "😤 Most Unlucky " + (rankingPanel === "unlucky" ? "▲" : "▼")
  ), topUnlucky.map((r, i) => /* @__PURE__ */ React.createElement("div", { key: r.id, className: "mini-row" }, /* @__PURE__ */ React.createElement("span", { className: "mini-pos" }, i < 3 ? MEDALS[i] : i + 1 + ".", "‎"), /* @__PURE__ */ React.createElement("span", { className: "mini-name" }, r.name), /* @__PURE__ */ React.createElement("span", { className: "mini-val", style: { color: "#94a3b8" } }, r.draws, "D ", r.losses, "L")))))), rankingPanel && /* @__PURE__ */ React.createElement("div", { className: "mini-box", style: { marginTop: ".75rem" } }, /* @__PURE__ */ React.createElement("div", { className: "mini-ttl", style: {
    color: rankingPanel === "attackers" ? "#f87171" : rankingPanel === "defenders" ? "#4ade80" : rankingPanel === "tough" ? "#f87171" : rankingPanel === "home" ? "#fb923c" : rankingPanel === "away" ? "#a78bfa" : rankingPanel === "clutch" ? "#facc15" : "#94a3b8",
    marginBottom: ".65rem",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center"
  } }, /* @__PURE__ */ React.createElement("span", null, rankingPanel === "attackers" ? "⚽ Full Attacking Ranking" : rankingPanel === "defenders" ? "🛡 Full Defensive Ranking" : rankingPanel === "tough" ? "💀 Full Toughest Ranking" : rankingPanel === "home" ? "🏠 Full Strongest Home Ranking" : rankingPanel === "away" ? "✈️ Full Strongest Away Ranking" : rankingPanel === "clutch" ? "🎯 Full Most Clutch Ranking" : "😤 Full Most Unlucky Ranking"), /* @__PURE__ */ React.createElement("button", { className: "btn-rm", onClick: () => setRankingPanel(null), style: { fontSize: ".9rem" } }, "✕")), (rankingPanel === "attackers" ? allAttackers : rankingPanel === "defenders" ? allDefenders : rankingPanel === "tough" ? toughRanking : rankingPanel === "home" ? homeGDRanking : rankingPanel === "away" ? awayGDRanking : rankingPanel === "clutch" ? clutchRanking : unluckyRanking).map((r, i, arr) => /* @__PURE__ */ React.createElement("div", { key: r.id, className: "mini-row" }, /* @__PURE__ */ React.createElement("span", { className: "mini-pos", style: { minWidth: "1.8rem", color: i < 3 ? rankingPanel === "defenders" ? "#4ade80" : rankingPanel === "home" ? "#fb923c" : rankingPanel === "away" ? "#a78bfa" : rankingPanel === "clutch" ? "#facc15" : rankingPanel === "unlucky" ? "#94a3b8" : "#f87171" : "#3a3f50" } }, rankingPanel === "clutch" && r.tied ? "—" : i < 3 ? MEDALS[i] : i + 1 + "."), /* @__PURE__ */ React.createElement("span", { className: "mini-name" }, r.name), /* @__PURE__ */ React.createElement("span", { className: "mini-val", style: { color: rankingPanel === "attackers" ? "#f87171" : rankingPanel === "defenders" ? "#4ade80" : rankingPanel === "tough" ? "#f87171" : rankingPanel === "home" ? "#fb923c" : rankingPanel === "away" ? "#a78bfa" : rankingPanel === "clutch" ? "#facc15" : "#94a3b8" } }, rankingPanel === "attackers" ? r.GF + " GF" : rankingPanel === "defenders" ? r.GA + " GA" : rankingPanel === "tough" ? r.pts + " pts" : rankingPanel === "home" ? (r.gd > 0 ? "+" : "") + r.gd + " GD" : rankingPanel === "away" ? (r.gd > 0 ? "+" : "") + r.gd + " GD" : rankingPanel === "clutch" ? r.wins + "W" : r.draws + "D " + r.losses + "L"), (rankingPanel === "attackers" || rankingPanel === "defenders") && /* @__PURE__ */ React.createElement("span", { className: "muted", style: { fontSize: ".72rem", marginLeft: ".25rem" } }, "(" + r.P + " games)"), rankingPanel === "unlucky" && /* @__PURE__ */ React.createElement("span", { className: "muted", style: { fontSize: ".72rem", marginLeft: ".25rem" } }, "(" + r.pts + " pts)"))))));
}
function TeamsStep({ teams, fixtures, setTeams, leagueType, onNext }) {
  function update(id, field, val) {
    setTeams((prev) => prev.map((t) => t.id === id ? __spreadProps(__spreadValues({}, t), { [field]: val }) : t));
  }
  function addTeam() {
    setTeams((prev) => [...prev, makeTeam(prev.length)]);
  }
  function removeTeam(id) {
    const ti = teams.findIndex((t) => t.id === id);
    if (fixtures.some((f) => f.homeIdx === ti || f.awayIdx === ti)) return;
    setTeams((prev) => prev.filter((t) => t.id !== id));
  }
  const minTeams = leagueType === "playoff" ? 10 : 2;
  return /* @__PURE__ */ React.createElement("div", { className: "panel" }, /* @__PURE__ */ React.createElement("div", { className: "ph" }, /* @__PURE__ */ React.createElement("span", { className: "ph-num" }, "01"), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("h2", null, "League Setup"), /* @__PURE__ */ React.createElement("p", null, "Name, starting points, optional home advantage override (H%) per team.", leagueType === "playoff" ? " Min 10 teams." : ""))), teams.map((t, i) => {
    const hasF = fixtures.some((f) => f.homeIdx === i || f.awayIdx === i);
    return /* @__PURE__ */ React.createElement("div", { key: t.id }, /* @__PURE__ */ React.createElement("div", { className: "team-row" }, /* @__PURE__ */ React.createElement("span", { className: "team-num" }, "#", i + 1), /* @__PURE__ */ React.createElement("input", { className: "inp team-name-inp", value: t.name, autoComplete: "off", onChange: (e) => update(t.id, "name", e.target.value), placeholder: "Team " + (i + 1) }), /* @__PURE__ */ React.createElement("div", { className: "team-extras" }, /* @__PURE__ */ React.createElement("input", { className: "inp inp-sm team-pts-inp", type: "number", min: "0", value: t.points, onChange: (e) => update(t.id, "points", parseInt(e.target.value) || 0), placeholder: "0", title: "Starting points" }), /* @__PURE__ */ React.createElement("span", { className: "muted team-pts-lbl", style: { fontSize: ".7rem", whiteSpace: "nowrap" } }, "pts"), /* @__PURE__ */ React.createElement("input", { className: "inp inp-sm team-hbonus-inp", type: "number", min: "0", max: "100", value: t.homeBonus, onChange: (e) => update(t.id, "homeBonus", e.target.value), placeholder: "H%", title: "Home advantage override" }), /* @__PURE__ */ React.createElement("span", { className: "muted team-hbonus-lbl", style: { fontSize: ".7rem" } }, "H%"), /* @__PURE__ */ React.createElement("button", { className: "btn-rm team-del", onClick: () => removeTeam(t.id), style: { color: hasF ? "#3a3f50" : void 0, cursor: hasF ? "not-allowed" : "pointer" } }, "✕"))), hasF && /* @__PURE__ */ React.createElement("div", { className: "warn-txt" }, "This team has fixtures — remove them first to delete this team."));
  }), /* @__PURE__ */ React.createElement("button", { className: "btn-add", style: { marginTop: ".6rem" }, onClick: addTeam }, "+ Add Team"), /* @__PURE__ */ React.createElement("div", { className: "nav-row" }, /* @__PURE__ */ React.createElement("button", { className: "btn btn-cyan", onClick: onNext, disabled: teams.length < minTeams }, "Set Fixtures ", teams.length < minTeams ? "(need " + (minTeams - teams.length) + " more)" : "→")));
}
function FixturesStep({ teams, fixtures, setFixtures, settings, setSettings, onBack, onNext }) {
  var _a, _b;
  const [hi, setHi] = useState(0);
  const [ai, setAi] = useState(Math.min(1, teams.length - 1));
  const [week, setWeek] = useState(1);
  const ok = hi !== ai;
  const preview = useMemo(() => calcProbs(hi, ai, teams, fixtures, settings), [hi, ai, teams, fixtures, settings]);
  const liveProbs = useMemo(() => {
    const m = {};
    fixtures.forEach((f) => {
      m[f.id] = calcProbs(f.homeIdx, f.awayIdx, teams, fixtures, settings);
    });
    return m;
  }, [fixtures, teams, settings]);
  function addOne() {
    if (!ok) return;
    const p = calcProbs(hi, ai, teams, fixtures, settings);
    setFixtures((prev) => [...prev, { id: "f" + Date.now(), homeIdx: hi, awayIdx: ai, homeWin: p.homeWin, draw: p.draw, awayWin: p.awayWin, overrideOn: false, ovHW: "", ovD: "", ovAW: "", played: false, homeScore: null, awayScore: null, week }]);
  }
  function autoGenerate() {
    if (fixtures.length > 0 && !confirm("Replace all current fixtures with an auto-generated 2-round robin?")) return;
    setFixtures(makeFixtures(teams, settings));
  }
  function remove(id) {
    setFixtures((prev) => prev.filter((f) => f.id !== id));
  }
  return /* @__PURE__ */ React.createElement("div", { className: "panel" }, /* @__PURE__ */ React.createElement("div", { className: "ph" }, /* @__PURE__ */ React.createElement("span", { className: "ph-num" }, "02"), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("h2", null, "Fixtures"), /* @__PURE__ */ React.createElement("p", null, "Probabilities are calculated automatically from current standings."))), /* @__PURE__ */ React.createElement(SettingsPanel, { settings, onChange: (k, v) => setSettings((s) => __spreadProps(__spreadValues({}, s), { [k]: v })), showTiebreakers: false }), /* @__PURE__ */ React.createElement("div", { style: { marginBottom: "1.1rem" } }, /* @__PURE__ */ React.createElement("div", { className: "row", style: { marginBottom: ".6rem" } }, /* @__PURE__ */ React.createElement("select", { className: "inp sel", value: hi, onChange: (e) => setHi(+e.target.value) }, teams.map((t, i) => /* @__PURE__ */ React.createElement("option", { key: i, value: i }, t.name))), /* @__PURE__ */ React.createElement("span", { className: "vs" }, "vs"), /* @__PURE__ */ React.createElement("select", { className: "inp sel", value: ai, onChange: (e) => setAi(+e.target.value) }, teams.map((t, i) => /* @__PURE__ */ React.createElement("option", { key: i, value: i }, t.name)))), /* @__PURE__ */ React.createElement("div", { className: "prob-bar" }, /* @__PURE__ */ React.createElement("span", { className: "muted" }, "Auto:"), /* @__PURE__ */ React.createElement("span", { className: "ph-col" }, preview.homeWin, "% ", (_a = teams[hi]) == null ? void 0 : _a.name), /* @__PURE__ */ React.createElement("span", { className: "muted" }, "·"), /* @__PURE__ */ React.createElement("span", { className: "pd-col" }, preview.draw, "% Draw"), /* @__PURE__ */ React.createElement("span", { className: "muted" }, "·"), /* @__PURE__ */ React.createElement("span", { className: "pa-col" }, preview.awayWin, "% ", (_b = teams[ai]) == null ? void 0 : _b.name)), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: ".5rem", marginTop: ".65rem", flexWrap: "wrap", alignItems: "center" } }, /* @__PURE__ */ React.createElement("span", { className: "lbl", style: { marginBottom: 0, whiteSpace: "nowrap" } }, "Week:"), /* @__PURE__ */ React.createElement("input", { className: "inp", type: "number", min: "1", max: "999", value: week, onChange: (e) => setWeek(parseInt(e.target.value) || 1), style: { width: "4rem", textAlign: "center", fontFamily: "DM Mono,monospace" } }), /* @__PURE__ */ React.createElement("button", { className: "btn-add", onClick: addOne, disabled: !ok }, "+ Add Match"), /* @__PURE__ */ React.createElement("button", { className: "btn-add-pu", onClick: autoGenerate, disabled: teams.length < 2 }, "⚡ Auto 2-round robin"))), fixtures.length > 0 && /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "sub-ttl" }, "Scheduled (", fixtures.length, ")"), fixtures.map((f) => {
    var _a2, _b2, _c;
    const p = liveProbs[f.id] || f;
    return /* @__PURE__ */ React.createElement("div", { key: f.id, className: "fix-item" }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "center", gap: ".3rem", flexShrink: 0 } }, /* @__PURE__ */ React.createElement("span", { className: "lbl", style: { marginBottom: 0, fontSize: ".65rem" } }, "W"), /* @__PURE__ */ React.createElement(
      "input",
      {
        type: "number",
        min: "1",
        max: "999",
        value: (_a2 = f.week) != null ? _a2 : "",
        placeholder: "—",
        onChange: (e) => {
          const v = e.target.value === "" ? null : parseInt(e.target.value) || null;
          setFixtures((prev) => prev.map((x) => x.id === f.id ? __spreadProps(__spreadValues({}, x), { week: v }) : x));
        },
        style: { width: "3rem", textAlign: "center", padding: ".22rem .3rem", fontFamily: "DM Mono,monospace", fontSize: ".8rem", background: "#0d1117", border: "1px solid #252830", color: "#22d3ee", borderRadius: "4px", outline: "none" }
      }
    )), /* @__PURE__ */ React.createElement("div", { className: "fix-teams" }, /* @__PURE__ */ React.createElement("b", null, (_b2 = teams[f.homeIdx]) == null ? void 0 : _b2.name), /* @__PURE__ */ React.createElement("span", { className: "vs" }, "vs"), /* @__PURE__ */ React.createElement("b", null, (_c = teams[f.awayIdx]) == null ? void 0 : _c.name)), /* @__PURE__ */ React.createElement("div", { className: "fix-probs" }, /* @__PURE__ */ React.createElement("span", { className: "ph-col" }, p.homeWin, "%"), /* @__PURE__ */ React.createElement("span", { className: "pd-col" }, p.draw, "%"), /* @__PURE__ */ React.createElement("span", { className: "pa-col" }, p.awayWin, "%")), /* @__PURE__ */ React.createElement("button", { className: "btn-rm", onClick: () => remove(f.id) }, "✕"));
  })), /* @__PURE__ */ React.createElement("div", { className: "nav-row" }, /* @__PURE__ */ React.createElement("button", { className: "btn btn-ghost", onClick: onBack }, "← Back"), /* @__PURE__ */ React.createElement("button", { className: "btn btn-cyan", onClick: onNext, disabled: fixtures.length === 0 }, "Continue →")));
}
function ScoreRow({ f, teams, liveP, settings, onConfirm, onUndo, onOverride, onTeamClick, onWeekChange }) {
  var _a, _b, _c, _d;
  const [hg, setHg] = useState("");
  const [ag, setAg] = useState("");
  const hn = ((_a = teams[f.homeIdx]) == null ? void 0 : _a.name) || "?";
  const an = ((_b = teams[f.awayIdx]) == null ? void 0 : _b.name) || "?";
  const ws = (settings == null ? void 0 : settings.winScore) || 30;
  const ls = (settings == null ? void 0 : settings.lossScore) || 25;
  const ds = (settings == null ? void 0 : settings.drawScore) || 25;
  const probs = f.overrideOn && f.ovHW !== "" ? { homeWin: parseFloat(f.ovHW) || 0, draw: parseFloat(f.ovD) || 0, awayWin: parseFloat(f.ovAW) || 0 } : liveP || f;
  if (f.played && f.homeScore != null) {
    const hs = +f.homeScore, as_ = +f.awayScore;
    const res = hs > as_ ? "home" : hs < as_ ? "away" : "draw";
    const lbl = res === "home" ? hn + " Win" : res === "away" ? an + " Win" : "Draw";
    const col = res === "home" ? "#4ade80" : res === "away" ? "#f87171" : "#facc15";
    return /* @__PURE__ */ React.createElement("div", { className: "outcome done" }, f.week != null && /* @__PURE__ */ React.createElement("span", { className: "week-badge", style: { fontSize: ".6rem" } }, "W", f.week), /* @__PURE__ */ React.createElement("div", { className: "oteams" }, /* @__PURE__ */ React.createElement("button", { className: "otbtn", onClick: () => onTeamClick && onTeamClick(f.homeIdx) }, hn), /* @__PURE__ */ React.createElement("span", { className: "vs" }, "vs"), /* @__PURE__ */ React.createElement("button", { className: "otbtn", onClick: () => onTeamClick && onTeamClick(f.awayIdx) }, an)), /* @__PURE__ */ React.createElement("div", { className: "score-done" }, /* @__PURE__ */ React.createElement("span", { style: { color: res === "home" ? "#4ade80" : res === "draw" ? "#facc15" : "#d4d8e0" } }, f.homeScore), /* @__PURE__ */ React.createElement("span", { className: "score-sep" }, "—"), /* @__PURE__ */ React.createElement("span", { style: { color: res === "away" ? "#f87171" : res === "draw" ? "#facc15" : "#d4d8e0" } }, f.awayScore)), /* @__PURE__ */ React.createElement("span", { className: "res-lbl", style: { color: col } }, lbl), onWeekChange && /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "center", gap: ".3rem" } }, /* @__PURE__ */ React.createElement("span", { style: { fontFamily: "DM Mono,monospace", fontSize: ".65rem", color: "#3a3f50" } }, "W"), /* @__PURE__ */ React.createElement(
      "input",
      {
        type: "number",
        min: "1",
        max: "999",
        value: (_c = f.week) != null ? _c : "",
        placeholder: "—",
        onChange: (e) => onWeekChange(f.id, e.target.value === "" ? null : parseInt(e.target.value) || null),
        style: { width: "2.8rem", textAlign: "center", padding: ".2rem .25rem", fontFamily: "DM Mono,monospace", fontSize: ".78rem", background: "#0d1117", border: "1px solid #252830", color: "#22d3ee", borderRadius: "4px", outline: "none" }
      }
    )), /* @__PURE__ */ React.createElement("button", { className: "btn-undo", onClick: () => onUndo(f.id) }, "↩ Undo"));
  }
  const ovrTotal = (parseFloat(f.ovHW) || 0) + (parseFloat(f.ovD) || 0) + (parseFloat(f.ovAW) || 0);
  const ovrOk = !f.overrideOn || Math.abs(ovrTotal - 100) <= 0.5;
  return /* @__PURE__ */ React.createElement("div", { className: "outcome", style: { flexDirection: "column", alignItems: "stretch", gap: ".42rem" } }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "center", gap: ".5rem", flexWrap: "wrap" } }, /* @__PURE__ */ React.createElement("div", { className: "oteams" }, /* @__PURE__ */ React.createElement("button", { className: "otbtn", onClick: () => onTeamClick && onTeamClick(f.homeIdx) }, hn), /* @__PURE__ */ React.createElement("span", { className: "vs" }, "vs"), /* @__PURE__ */ React.createElement("button", { className: "otbtn", onClick: () => onTeamClick && onTeamClick(f.awayIdx) }, an)), /* @__PURE__ */ React.createElement("div", { className: "fix-probs" }, f.overrideOn && f.ovHW !== "" && /* @__PURE__ */ React.createElement("span", { className: "ovr-tag" }, "override"), /* @__PURE__ */ React.createElement("span", { className: "ph-col" }, probs.homeWin, "%"), /* @__PURE__ */ React.createElement("span", { className: "pd-col" }, probs.draw, "%"), /* @__PURE__ */ React.createElement("span", { className: "pa-col" }, probs.awayWin, "%")), /* @__PURE__ */ React.createElement("button", { className: "ovr-btn" + (f.overrideOn ? " active" : ""), onClick: () => onOverride(f.id, "toggle") }, f.overrideOn ? "✓ Override" : "Override %"), onWeekChange && /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "center", gap: ".3rem", marginLeft: "auto" } }, /* @__PURE__ */ React.createElement("span", { style: { fontFamily: "DM Mono,monospace", fontSize: ".65rem", color: "#3a3f50" } }, "W"), /* @__PURE__ */ React.createElement(
    "input",
    {
      type: "number",
      min: "1",
      max: "999",
      value: (_d = f.week) != null ? _d : "",
      placeholder: "—",
      onChange: (e) => onWeekChange(f.id, e.target.value === "" ? null : parseInt(e.target.value) || null),
      style: { width: "2.8rem", textAlign: "center", padding: ".2rem .25rem", fontFamily: "DM Mono,monospace", fontSize: ".78rem", background: "#0d1117", border: "1px solid #252830", color: "#22d3ee", borderRadius: "4px", outline: "none" }
    }
  ))), f.overrideOn && /* @__PURE__ */ React.createElement("div", { className: "ovr-row" }, /* @__PURE__ */ React.createElement("span", { className: "muted", style: { fontSize: ".7rem" } }, hn.split(" ")[0], " W:"), /* @__PURE__ */ React.createElement("input", { className: "ovr-inp", type: "number", min: "0", max: "100", value: f.ovHW, onChange: (e) => onOverride(f.id, "hw", e.target.value), placeholder: "0" }), /* @__PURE__ */ React.createElement("span", { className: "muted" }, "Draw:"), /* @__PURE__ */ React.createElement("input", { className: "ovr-inp", type: "number", min: "0", max: "100", value: f.ovD, onChange: (e) => onOverride(f.id, "d", e.target.value), placeholder: "0" }), /* @__PURE__ */ React.createElement("span", { className: "muted" }, an.split(" ")[0], " W:"), /* @__PURE__ */ React.createElement("input", { className: "ovr-inp", type: "number", min: "0", max: "100", value: f.ovAW, onChange: (e) => onOverride(f.id, "aw", e.target.value), placeholder: "0" }), f.ovHW !== "" && /* @__PURE__ */ React.createElement("span", { style: { fontSize: ".7rem", color: ovrOk ? "#22d3ee" : "#f87171", fontFamily: "DM Mono,monospace" } }, ovrTotal, "% ", ovrOk ? "✓" : "⚠ must = 100")), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "center", gap: ".38rem", flexWrap: "wrap" } }, /* @__PURE__ */ React.createElement("button", { className: "qbtn hw", onClick: () => onConfirm(f.id, ws, ls) }, hn.split(" ")[0], " W"), /* @__PURE__ */ React.createElement("button", { className: "qbtn dr", onClick: () => onConfirm(f.id, ds, ds) }, "Draw"), /* @__PURE__ */ React.createElement("button", { className: "qbtn aw", onClick: () => onConfirm(f.id, ls, ws) }, an.split(" ")[0], " W"), /* @__PURE__ */ React.createElement("input", { className: "score-inp", type: "number", min: "0", value: hg, onChange: (e) => setHg(e.target.value), placeholder: "0" }), /* @__PURE__ */ React.createElement("span", { className: "score-sep" }, "—"), /* @__PURE__ */ React.createElement("input", { className: "score-inp", type: "number", min: "0", value: ag, onChange: (e) => setAg(e.target.value), placeholder: "0" }), /* @__PURE__ */ React.createElement("button", { className: "confirm-btn", disabled: hg === "" || ag === "", onClick: () => {
    if (hg !== "" && ag !== "") onConfirm(f.id, +hg, +ag);
  } }, "Confirm")));
}
function MCTab({ teams, fixtures, settings, highlightTop, highlightBottom, onConfirmed }) {
  const [results, setResults] = useState(null);
  const [running, setRunning] = useState(false);
  const pending = fixtures.filter((f) => !f.played);
  const playedFixtures = fixtures.filter((f) => f.played && f.homeScore != null && f.awayScore != null);
  const pendingRef = useRef([]);
  const teamsRef = useRef([]);
  const playedRef = useRef([]);
  pendingRef.current = pending.map((f) => __spreadValues(__spreadValues({}, f), fixProbs(f, teams, fixtures, settings)));
  teamsRef.current = teams;
  playedRef.current = playedFixtures;
  useEffect(() => {
    if (pendingRef.current.length === 0) {
      setResults(null);
      return;
    }
    setRunning(true);
    const tid = setTimeout(() => {
      const res = runMC(teamsRef.current, pendingRef.current, playedRef.current);
      setResults(res);
      setRunning(false);
      if (onConfirmed) {
        const n2 = teamsRef.current.length;
        const ct = /* @__PURE__ */ new Set(), cb = /* @__PURE__ */ new Set();
        teamsRef.current.forEach((t, i) => {
          if (highlightTop && res[i].slice(0, highlightTop).reduce((a, v) => a + v, 0) > 99.9) ct.add(t.id);
          if (highlightBottom && res[i].slice(n2 - highlightBottom).reduce((a, v) => a + v, 0) > 99.9) cb.add(t.id);
        });
        onConfirmed(ct, cb);
      }
    }, 20);
    return () => clearTimeout(tid);
  }, []);
  const n = teams.length;
  const sorted = useMemo(() => {
    if (!results) return [];
    return teams.map((t, i) => __spreadProps(__spreadValues({}, t), { idx: i, avg: results[i].reduce((s, p, pos) => s + p / 100 * (pos + 1), 0) })).sort((a, b) => a.avg - b.avg);
  }, [results, teams]);
  return /* @__PURE__ */ React.createElement("div", null, running && /* @__PURE__ */ React.createElement("div", { className: "empty" }, "Running 100,000 simulations…"), !running && pending.length === 0 && /* @__PURE__ */ React.createElement("div", { className: "empty" }, "All fixtures played — nothing to simulate."), !running && results && /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "tbl-wrap" }, /* @__PURE__ */ React.createElement("table", { className: "stbl" }, /* @__PURE__ */ React.createElement("thead", null, /* @__PURE__ */ React.createElement("tr", null, /* @__PURE__ */ React.createElement("th", { className: "tl" }, "Team"), /* @__PURE__ */ React.createElement("th", null, "Pts"), Array.from({ length: n }, (_, i) => /* @__PURE__ */ React.createElement("th", { key: i }, "#", i + 1)))), /* @__PURE__ */ React.createElement("tbody", null, sorted.map((t) => /* @__PURE__ */ React.createElement("tr", { key: t.idx }, /* @__PURE__ */ React.createElement("td", { className: "tl" }, t.name), /* @__PURE__ */ React.createElement("td", { className: "dm" }, t.points), results[t.idx].map((p, pos) => /* @__PURE__ */ React.createElement("td", { key: pos, style: { background: heatColor(p) } }, fmtPct(p)))))))), /* @__PURE__ */ React.createElement("div", { className: "legend" }, /* @__PURE__ */ React.createElement("span", { className: "muted", style: { fontSize: ".7rem" } }, "Low"), /* @__PURE__ */ React.createElement("div", { className: "leg-grad" }), /* @__PURE__ */ React.createElement("span", { className: "muted", style: { fontSize: ".7rem" } }, "High"))));
}
function ScoresTab({ teams, fixtures, liveProbs, settings, onConfirm, onUndo, onOverride, onTeamClick, onWeekChange }) {
  const [selectedTeam, setSelectedTeam] = useState("all");
  const [selectedWeek, setSelectedWeek] = useState("all");
  const weeks = useMemo(() => {
    const ws = [...new Set(fixtures.map((f) => f.week).filter((w) => w != null))].sort((a, b) => a - b);
    return ws;
  }, [fixtures]);
  const hasWeeks = weeks.length > 0;
  const filtered = useMemo(() => {
    let fs = fixtures;
    if (selectedTeam !== "all") fs = fs.filter((f) => f.homeIdx === +selectedTeam || f.awayIdx === +selectedTeam);
    if (selectedWeek !== "all") fs = fs.filter((f) => f.week === +selectedWeek);
    return fs;
  }, [fixtures, selectedTeam, selectedWeek]);
  const grouped = useMemo(() => {
    const sorted = [...filtered].sort((a, b) => {
      var _a, _b;
      const wa = (_a = a.week) != null ? _a : 99999, wb = (_b = b.week) != null ? _b : 99999;
      if (wa !== wb) return wa - wb;
      return 0;
    });
    const groups = [];
    let cur = null;
    sorted.forEach((f) => {
      var _a;
      const w = (_a = f.week) != null ? _a : null;
      if (!cur || cur.week !== w) {
        cur = { week: w, fixtures: [] };
        groups.push(cur);
      }
      cur.fixtures.push(f);
    });
    return groups;
  }, [filtered]);
  const pending = filtered.filter((f) => !f.played);
  const played = filtered.filter((f) => f.played);
  return /* @__PURE__ */ React.createElement("div", null, fixtures.length === 0 && /* @__PURE__ */ React.createElement("div", { className: "empty" }, "No fixtures added."), fixtures.length > 0 && /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "center", gap: ".6rem", marginBottom: "1rem", flexWrap: "wrap" } }, /* @__PURE__ */ React.createElement("span", { className: "lbl", style: { marginBottom: 0, whiteSpace: "nowrap" } }, "Team:"), /* @__PURE__ */ React.createElement("select", { className: "inp", style: { maxWidth: "200px", flex: 1 }, value: selectedTeam, onChange: (e) => setSelectedTeam(e.target.value) }, /* @__PURE__ */ React.createElement("option", { value: "all" }, "All teams"), teams.map((t, i) => /* @__PURE__ */ React.createElement("option", { key: i, value: i }, t.name))), hasWeeks && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("span", { className: "lbl", style: { marginBottom: 0, whiteSpace: "nowrap" } }, "Week:"), /* @__PURE__ */ React.createElement("select", { className: "inp", style: { maxWidth: "120px" }, value: selectedWeek, onChange: (e) => setSelectedWeek(e.target.value) }, /* @__PURE__ */ React.createElement("option", { value: "all" }, "All weeks"), weeks.map((w) => /* @__PURE__ */ React.createElement("option", { key: w, value: w }, "Week ", w))))), fixtures.length > 0 && filtered.length === 0 && /* @__PURE__ */ React.createElement("div", { className: "empty" }, "No fixtures for this selection."), (() => {
    if (selectedWeek !== "all" || !hasWeeks) {
      return grouped.map((group) => {
        var _a;
        const gPending = group.fixtures.filter((f) => !f.played);
        const gPlayed = group.fixtures.filter((f) => f.played);
        return /* @__PURE__ */ React.createElement("div", { key: (_a = group.week) != null ? _a : "none" }, group.week != null && /* @__PURE__ */ React.createElement("div", { className: "week-header" }, "Week ", group.week), gPending.map((f) => /* @__PURE__ */ React.createElement(
          ScoreRow,
          {
            key: f.id,
            f,
            teams,
            liveP: liveProbs[f.id],
            settings,
            onConfirm,
            onUndo,
            onOverride,
            onTeamClick,
            onWeekChange
          }
        )), gPlayed.map((f) => /* @__PURE__ */ React.createElement(
          ScoreRow,
          {
            key: f.id,
            f,
            teams,
            liveP: liveProbs[f.id],
            settings,
            onConfirm,
            onUndo,
            onOverride,
            onTeamClick,
            onWeekChange
          }
        )));
      });
    }
    const completedGroups = grouped.filter((g) => g.week != null && g.fixtures.every((f) => f.played));
    const pendingGroups = grouped.filter((g) => g.week == null || !g.fixtures.every((f) => f.played));
    const lastCompleted = completedGroups.length > 0 ? completedGroups[completedGroups.length - 1] : null;
    const olderCompleted = completedGroups.slice(0, -1).reverse();
    function renderGroup(group) {
      var _a;
      const gPending = group.fixtures.filter((f) => !f.played);
      const gPlayed = group.fixtures.filter((f) => f.played);
      const allDone = gPending.length === 0;
      return /* @__PURE__ */ React.createElement("div", { key: (_a = group.week) != null ? _a : "none" }, group.week != null && /* @__PURE__ */ React.createElement("div", { className: "week-header", style: allDone ? { color: "#4ade80" } : {} }, "Week ", group.week, allDone ? " ✓" : ""), gPending.map((f) => /* @__PURE__ */ React.createElement(
        ScoreRow,
        {
          key: f.id,
          f,
          teams,
          liveP: liveProbs[f.id],
          settings,
          onConfirm,
          onUndo,
          onOverride,
          onTeamClick,
          onWeekChange
        }
      )), gPlayed.map((f) => /* @__PURE__ */ React.createElement(
        ScoreRow,
        {
          key: f.id,
          f,
          teams,
          liveP: liveProbs[f.id],
          settings,
          onConfirm,
          onUndo,
          onOverride,
          onTeamClick,
          onWeekChange
        }
      )));
    }
    return /* @__PURE__ */ React.createElement("div", null, lastCompleted && renderGroup(lastCompleted), pendingGroups.map((g) => renderGroup(g)), olderCompleted.length > 0 && /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { style: { borderTop: "1px solid #1c1f27", margin: "1rem 0 .5rem", fontFamily: "DM Mono,monospace", fontSize: ".68rem", color: "#3a3f50", textTransform: "uppercase", letterSpacing: ".08em" } }, "Completed weeks"), olderCompleted.map((g) => renderGroup(g))));
  })());
}
function MatchRow({ match, teams, rounds, liveProbs, settings, onConfirm, onUndo, onOverride, isTwoLeg }) {
  var _a, _b, _c, _d;
  const [hg, setHg] = useState("");
  const [ag, setAg] = useState("");
  const hIdx = resolveRef(match.homeRef, teams, rounds);
  const aIdx = resolveRef(match.awayRef, teams, rounds);
  const hn = hIdx != null ? ((_a = teams[hIdx]) == null ? void 0 : _a.name) || "?" : "TBD";
  const an = aIdx != null ? ((_b = teams[aIdx]) == null ? void 0 : _b.name) || "?" : "TBD";
  const isTbd = hIdx == null || aIdx == null;
  const ws = (settings == null ? void 0 : settings.winScore) || 30;
  const ls = (settings == null ? void 0 : settings.lossScore) || 25;
  const ds = (settings == null ? void 0 : settings.drawScore) || 25;
  const probs = liveProbs && liveProbs[match.id] ? liveProbs[match.id] : null;
  const pairedMatch = match.leg && match.pairedLegId ? rounds.flatMap((r) => r.matches).find((m) => m.id === match.pairedLegId) : null;
  let aggText = null;
  if (isTwoLeg && pairedMatch && (match.played || pairedMatch.played)) {
    const leg1 = match.leg === 1 ? match : pairedMatch;
    const leg2 = match.leg === 2 ? match : pairedMatch;
    const seedAIdx = resolveRef(leg1.homeRef, teams, rounds);
    const seedBIdx = resolveRef(leg1.awayRef, teams, rounds);
    const aggA = (leg1.played ? +leg1.homeScore : 0) + (leg2.played ? +leg2.awayScore : 0);
    const aggB = (leg1.played ? +leg1.awayScore : 0) + (leg2.played ? +leg2.homeScore : 0);
    if (leg1.played || leg2.played) {
      const nameA = ((_c = teams[seedAIdx]) == null ? void 0 : _c.name) || "?";
      const nameB = ((_d = teams[seedBIdx]) == null ? void 0 : _d.name) || "?";
      aggText = nameA + " " + aggA + " — " + aggB + " " + nameB + " (agg)";
    }
  }
  const legLabel = match.leg ? "Leg " + match.leg : null;
  const neutralLabel = match.neutral ? "Neutral" : null;
  if (match.played && match.homeScore != null) {
    const hs = +match.homeScore, as_ = +match.awayScore;
    const res = hs > as_ ? "home" : hs < as_ ? "away" : "draw";
    const col = res === "home" ? "#4ade80" : res === "away" ? "#f87171" : "#facc15";
    return /* @__PURE__ */ React.createElement("div", { className: "bracket-match done" + (match.neutral ? " neutral" : "") + (isTbd ? " tbd" : "") }, /* @__PURE__ */ React.createElement("div", { className: "bm-teams" }, /* @__PURE__ */ React.createElement("span", { style: { color: res === "home" ? "#4ade80" : "#d4d8e0" } }, hn), /* @__PURE__ */ React.createElement("span", { className: "vs" }, "vs"), /* @__PURE__ */ React.createElement("span", { style: { color: res === "away" ? "#f87171" : "#d4d8e0" } }, an)), /* @__PURE__ */ React.createElement("div", { className: "bm-score" }, /* @__PURE__ */ React.createElement("span", { style: { color: res === "home" ? "#4ade80" : res === "draw" ? "#facc15" : "#d4d8e0" } }, match.homeScore), /* @__PURE__ */ React.createElement("span", { className: "score-sep" }, "—"), /* @__PURE__ */ React.createElement("span", { style: { color: res === "away" ? "#f87171" : res === "draw" ? "#facc15" : "#d4d8e0" } }, match.awayScore), aggText && /* @__PURE__ */ React.createElement("span", { className: "bm-agg" }, aggText)), legLabel && /* @__PURE__ */ React.createElement("span", { className: "bm-label" }, legLabel), neutralLabel && /* @__PURE__ */ React.createElement("span", { className: "bm-label", style: { color: "#a78bfa", borderColor: "#a78bfa" } }, neutralLabel), /* @__PURE__ */ React.createElement("button", { className: "btn-undo", onClick: () => onUndo(match.id) }, "↩"));
  }
  if (isTbd) {
    return /* @__PURE__ */ React.createElement("div", { className: "bracket-match tbd" }, /* @__PURE__ */ React.createElement("div", { className: "bm-teams" }, /* @__PURE__ */ React.createElement("span", { className: "muted" }, "TBD"), /* @__PURE__ */ React.createElement("span", { className: "vs" }, "vs"), /* @__PURE__ */ React.createElement("span", { className: "muted" }, "TBD")), legLabel && /* @__PURE__ */ React.createElement("span", { className: "bm-label" }, legLabel), neutralLabel && /* @__PURE__ */ React.createElement("span", { className: "bm-label", style: { color: "#a78bfa", borderColor: "#a78bfa" } }, neutralLabel));
  }
  const ovrTotal = (parseFloat(match.ovHW) || 0) + (parseFloat(match.ovD) || 0) + (parseFloat(match.ovAW) || 0);
  const ovrOk = !match.overrideOn || Math.abs(ovrTotal - 100) <= 0.5;
  const displayProbs = match.overrideOn && match.ovHW !== "" ? { homeWin: parseFloat(match.ovHW) || 0, draw: parseFloat(match.ovD) || 0, awayWin: parseFloat(match.ovAW) || 0 } : probs;
  return /* @__PURE__ */ React.createElement("div", { className: "bracket-match" + (match.neutral ? " neutral" : ""), style: { flexDirection: "column", alignItems: "stretch", gap: ".38rem" } }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "center", gap: ".5rem", flexWrap: "wrap" } }, /* @__PURE__ */ React.createElement("div", { className: "bm-teams" }, /* @__PURE__ */ React.createElement("span", null, hn), /* @__PURE__ */ React.createElement("span", { className: "vs" }, "vs"), /* @__PURE__ */ React.createElement("span", null, an)), displayProbs && /* @__PURE__ */ React.createElement("div", { className: "fix-probs" }, match.overrideOn && match.ovHW !== "" && /* @__PURE__ */ React.createElement("span", { className: "ovr-tag" }, "override"), /* @__PURE__ */ React.createElement("span", { className: "ph-col" }, displayProbs.homeWin, "%"), /* @__PURE__ */ React.createElement("span", { className: "pd-col" }, displayProbs.draw, "%"), /* @__PURE__ */ React.createElement("span", { className: "pa-col" }, displayProbs.awayWin, "%")), legLabel && /* @__PURE__ */ React.createElement("span", { className: "bm-label" }, legLabel), neutralLabel && /* @__PURE__ */ React.createElement("span", { className: "bm-label", style: { color: "#a78bfa", borderColor: "#a78bfa" } }, neutralLabel), /* @__PURE__ */ React.createElement("button", { className: "ovr-btn" + (match.overrideOn ? " active" : ""), onClick: () => onOverride(match.id, "toggle") }, match.overrideOn ? "✓ Ovr" : "Ovr %")), match.overrideOn && /* @__PURE__ */ React.createElement("div", { className: "ovr-row" }, /* @__PURE__ */ React.createElement("span", { className: "muted", style: { fontSize: ".7rem" } }, hn.split(" ")[0], " W:"), /* @__PURE__ */ React.createElement("input", { className: "ovr-inp", type: "number", min: "0", max: "100", value: match.ovHW, onChange: (e) => onOverride(match.id, "hw", e.target.value), placeholder: "0" }), /* @__PURE__ */ React.createElement("span", { className: "muted" }, "D:"), /* @__PURE__ */ React.createElement("input", { className: "ovr-inp", type: "number", min: "0", max: "100", value: match.ovD, onChange: (e) => onOverride(match.id, "d", e.target.value), placeholder: "0" }), /* @__PURE__ */ React.createElement("span", { className: "muted" }, an.split(" ")[0], " W:"), /* @__PURE__ */ React.createElement("input", { className: "ovr-inp", type: "number", min: "0", max: "100", value: match.ovAW, onChange: (e) => onOverride(match.id, "aw", e.target.value), placeholder: "0" }), match.ovHW !== "" && /* @__PURE__ */ React.createElement("span", { style: { fontSize: ".7rem", color: ovrOk ? "#22d3ee" : "#f87171", fontFamily: "DM Mono,monospace" } }, ovrTotal, "% ", ovrOk ? "✓" : "⚠")), aggText && /* @__PURE__ */ React.createElement("div", { style: { fontSize: ".72rem", color: "#a78bfa", fontFamily: "DM Mono,monospace" } }, aggText), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "center", gap: ".35rem", flexWrap: "wrap" } }, /* @__PURE__ */ React.createElement("button", { className: "qbtn hw", onClick: () => onConfirm(match.id, ws, ls) }, hn.split(" ")[0], " W"), /* @__PURE__ */ React.createElement("button", { className: "qbtn dr", onClick: () => onConfirm(match.id, ds, ds) }, "Draw"), /* @__PURE__ */ React.createElement("button", { className: "qbtn aw", onClick: () => onConfirm(match.id, ls, ws) }, an.split(" ")[0], " W"), /* @__PURE__ */ React.createElement("input", { className: "score-inp", type: "number", min: "0", value: hg, onChange: (e) => setHg(e.target.value), placeholder: "0" }), /* @__PURE__ */ React.createElement("span", { className: "score-sep" }, "—"), /* @__PURE__ */ React.createElement("input", { className: "score-inp", type: "number", min: "0", value: ag, onChange: (e) => setAg(e.target.value), placeholder: "0" }), /* @__PURE__ */ React.createElement("button", { className: "confirm-btn", disabled: hg === "" || ag === "", onClick: () => {
    if (hg !== "" && ag !== "") onConfirm(match.id, +hg, +ag);
  } }, "OK")));
}
function TournamentBracket({ rounds, teams, liveProbs, settings, phase, onConfirm, onUndo, onOverride, onTeamClick }) {
  return /* @__PURE__ */ React.createElement("div", { className: "bracket" }, rounds.map((round) => /* @__PURE__ */ React.createElement("div", { key: round.id, className: "bracket-round" }, /* @__PURE__ */ React.createElement("div", { className: "bracket-round-title" + (round.type === "losers" ? " losers" : "") }, round.label), round.matches.map((match, mi) => {
    const isTwoLeg = match.leg != null;
    return /* @__PURE__ */ React.createElement(
      MatchRow,
      {
        key: match.id,
        match,
        teams,
        rounds,
        liveProbs,
        settings,
        isTwoLeg,
        onConfirm,
        onUndo,
        onOverride,
        onTeamClick
      }
    );
  }))));
}
function PhaseView({ phase, phaseData, setPhaseData, settings, sourceStats, phaseFormat, label, color, infoText, onTeamClick }) {
  const [tab, setTab] = useState(phaseFormat === "tournament" ? "bracket" : "table");
  const [confirmedTop, setConfirmedTop] = useState(null);
  const [confirmedBottom, setConfirmedBottom] = useState(null);
  const baseTeams = phaseData ? phaseData.teams : [];
  const isTournament = phaseData ? phaseData.format === "tournament" : phaseFormat === "tournament";
  const fixtures = phaseData ? phaseData.fixtures || [] : [];
  const rounds = phaseData ? phaseData.rounds || [] : [];
  const allMatches = isTournament ? rounds.flatMap((r) => r.matches) : fixtures;
  const pending = allMatches.filter((f) => !f.played);
  const played = allMatches.filter((f) => f.played);
  const teams = useMemo(() => {
    const earned = baseTeams.map(() => 0);
    played.forEach((f) => {
      const hg = +f.homeScore, ag = +f.awayScore;
      if (isNaN(hg) || isNaN(ag)) return;
      if (hg > ag) earned[f.homeIdx] += 2;
      else if (hg < ag) earned[f.awayIdx] += 2;
      else {
        earned[f.homeIdx]++;
        earned[f.awayIdx]++;
      }
    });
    return baseTeams.map((t, i) => __spreadProps(__spreadValues({}, t), { points: t.points + earned[i] }));
  }, [baseTeams, played]);
  const liveProbs = useMemo(() => {
    if (!phaseData) return {};
    const m = {};
    pending.forEach((f) => {
      if (f.tbd) return;
      if (f.neutral) {
        const hIdx = resolveRef(f.homeRef, baseTeams, rounds);
        const aIdx = resolveRef(f.awayRef, baseTeams, rounds);
        if (hIdx != null && aIdx != null) m[f.id] = calcProbsNeutral(hIdx, aIdx, baseTeams, settings);
      } else if (isTournament) {
        const hIdx = resolveRef(f.homeRef, baseTeams, rounds);
        const aIdx = resolveRef(f.awayRef, baseTeams, rounds);
        if (hIdx != null && aIdx != null) m[f.id] = calcProbs(hIdx, aIdx, baseTeams, [], settings);
      } else {
        m[f.id] = calcProbs(f.homeIdx, f.awayIdx, teams, fixtures, settings);
      }
    });
    return m;
  }, [phaseData, settings, teams]);
  function generate() {
    if (phaseFormat === "tournament") {
      const isPlaydown = phase === "playdown";
      const result = generateTournament(sourceStats, settings, isPlaydown);
      setPhaseData({ teams: result.teams, fixtures: [], rounds: result.rounds, format: "tournament" });
    } else {
      const phTeams = sourceStats.map((r) => ({ id: r.id, name: r.name, points: r.startingPts, homeBonus: "" }));
      const phFixtures = makeFixtures(phTeams, settings);
      setPhaseData({ teams: phTeams, fixtures: phFixtures, format: "round-robin" });
    }
  }
  if (!phaseData) {
    return /* @__PURE__ */ React.createElement("div", { className: "panel", style: { borderColor: color, borderWidth: 2 } }, /* @__PURE__ */ React.createElement("div", { style: { textAlign: "center", padding: "2rem" } }, /* @__PURE__ */ React.createElement("div", { style: { fontFamily: "Syne,sans-serif", fontSize: "1.1rem", fontWeight: 700, color: "#fff", marginBottom: ".5rem" } }, label), /* @__PURE__ */ React.createElement("div", { className: "muted", style: { marginBottom: "1.25rem", fontSize: ".85rem" } }, infoText), sourceStats && sourceStats.length > 0 ? /* @__PURE__ */ React.createElement("button", { className: "btn btn-cyan", style: { background: color, borderColor: color }, onClick: generate }, "Generate ", label, " Fixtures") : /* @__PURE__ */ React.createElement("div", { className: "muted" }, "Complete the regular season first.")));
  }
  function updateMatch(id, updater) {
    setPhaseData((prev) => {
      if (prev.format === "tournament") {
        return __spreadProps(__spreadValues({}, prev), { rounds: prev.rounds.map((r) => __spreadProps(__spreadValues({}, r), { matches: r.matches.map((m) => m.id === id ? updater(m) : m) })) });
      }
      return __spreadProps(__spreadValues({}, prev), { fixtures: prev.fixtures.map((f) => f.id === id ? updater(f) : f) });
    });
  }
  function confirmScore(id, hg, ag) {
    updateMatch(id, (m) => __spreadProps(__spreadValues({}, m), { played: true, homeScore: hg, awayScore: ag, tbd: false }));
  }
  function unplay(id) {
    updateMatch(id, (m) => __spreadProps(__spreadValues({}, m), { played: false, homeScore: null, awayScore: null }));
  }
  function handleOverride(id, field, val) {
    updateMatch(id, (m) => {
      if (field === "toggle") return __spreadProps(__spreadValues({}, m), { overrideOn: !m.overrideOn });
      if (field === "hw") return __spreadProps(__spreadValues({}, m), { ovHW: val });
      if (field === "d") return __spreadProps(__spreadValues({}, m), { ovD: val });
      if (field === "aw") return __spreadProps(__spreadValues({}, m), { ovAW: val });
      return m;
    });
  }
  const htop = phase === "playoff" ? 2 : 0;
  const hbot = phase === "playdown" ? 2 : 0;
  return /* @__PURE__ */ React.createElement("div", { className: "panel", style: { borderColor: color, borderWidth: 2 } }, /* @__PURE__ */ React.createElement("div", { className: "ph" }, /* @__PURE__ */ React.createElement("span", { className: "ph-num", style: { color } }, label[0]), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("h2", null, label), /* @__PURE__ */ React.createElement("p", null, "2-round robin · ", teams.length, " teams · Starting points locked at generation")), /* @__PURE__ */ React.createElement("button", { className: "btn btn-ghost", style: { marginLeft: "auto", fontSize: ".72rem" }, onClick: () => {
    if (confirm("Regenerate? This clears all entered results.")) setPhaseData(null);
  } }, "↺ Reset")), /* @__PURE__ */ React.createElement("div", { className: "tabs" }, (isTournament ? ["bracket", "monte"] : ["table", "scores", "monte"]).map((t) => /* @__PURE__ */ React.createElement("button", { key: t, className: "tab" + (tab === t ? " on" : ""), onClick: () => setTab(t) }, t === "bracket" ? "Bracket" : t === "table" ? "Table" : t === "scores" ? "Scores" + (pending.length ? " (" + pending.length + ")" : "") : "Monte Carlo"))), tab === "table" && /* @__PURE__ */ React.createElement(LeagueTable, { teams: baseTeams, fixtures, onTeamClick: (i) => {
    var _a;
    return onTeamClick && onTeamClick((_a = baseTeams[i]) == null ? void 0 : _a.id);
  }, highlightTop: htop, highlightBottom: hbot, confirmedTop, confirmedBottom }), tab === "scores" && /* @__PURE__ */ React.createElement(
    ScoresTab,
    {
      teams,
      fixtures,
      liveProbs,
      settings,
      onConfirm: confirmScore,
      onUndo: unplay,
      onOverride: handleOverride,
      onTeamClick: (i) => {
        var _a;
        return onTeamClick && onTeamClick((_a = teams[i]) == null ? void 0 : _a.id);
      },
      onWeekChange: (id, w) => updateMatch(id, (m) => __spreadProps(__spreadValues({}, m), { week: w }))
    }
  ), tab === "bracket" && /* @__PURE__ */ React.createElement(
    TournamentBracket,
    {
      rounds,
      teams: baseTeams,
      liveProbs,
      settings,
      phase,
      onConfirm: confirmScore,
      onUndo: unplay,
      onOverride: handleOverride,
      onTeamClick: (i) => {
        var _a;
        return onTeamClick && onTeamClick((_a = baseTeams[i]) == null ? void 0 : _a.id);
      }
    }
  ), tab === "monte" && /* @__PURE__ */ React.createElement(
    MCTab,
    {
      key: played.length,
      teams,
      fixtures: isTournament ? allMatches.filter((m) => !m.tbd) : fixtures,
      settings,
      highlightTop: htop,
      highlightBottom: hbot,
      onConfirmed: (ct, cb) => {
        setConfirmedTop(ct);
        setConfirmedBottom(cb);
      }
    }
  ));
}
function SimStep({ league, setLeague, onBack }) {
  const { teams: initTeams, fixtures: initFixtures, settings, type, playoffs, playdowns, poSize: _poSize, pdSize: _pdSize, phaseFormat: _pfmt } = league;
  const [phase, setPhase] = useState("regular");
  const [tab, setTab] = useState("table");
  const [detail, setDetail] = useState(null);
  const [confirmedTop, setConfirmedTop] = useState(null);
  const [confirmedBottom, setConfirmedBottom] = useState(null);
  const teams = useMemo(() => {
    const earned = initTeams.map(() => 0);
    initFixtures.filter((f) => f.played && f.homeScore != null).forEach((f) => {
      const hg = +f.homeScore, ag = +f.awayScore;
      if (isNaN(hg) || isNaN(ag)) return;
      if (hg > ag) earned[f.homeIdx] += 2;
      else if (hg < ag) earned[f.awayIdx] += 2;
      else {
        earned[f.homeIdx]++;
        earned[f.awayIdx]++;
      }
    });
    return initTeams.map((t, i) => __spreadProps(__spreadValues({}, t), { points: t.points + earned[i] }));
  }, [initTeams, initFixtures]);
  const pending = initFixtures.filter((f) => !f.played);
  const played = initFixtures.filter((f) => f.played);
  const liveProbs = useMemo(() => {
    const m = {};
    pending.forEach((f) => {
      m[f.id] = fixProbs(f, teams, initFixtures, settings);
    });
    return m;
  }, [pending, teams, initFixtures, settings]);
  function setFixtures(u) {
    setLeague((lg) => __spreadProps(__spreadValues({}, lg), { fixtures: typeof u === "function" ? u(lg.fixtures) : u }));
  }
  function setSettings(u) {
    setLeague((lg) => __spreadProps(__spreadValues({}, lg), { settings: typeof u === "function" ? u(lg.settings) : u }));
  }
  function setPlayoffs(u) {
    setLeague((lg) => __spreadProps(__spreadValues({}, lg), { playoffs: typeof u === "function" ? u(lg.playoffs) : u }));
  }
  function setPlaydowns(u) {
    setLeague((lg) => __spreadProps(__spreadValues({}, lg), { playdowns: typeof u === "function" ? u(lg.playdowns) : u }));
  }
  function confirmScore(id, hg, ag) {
    setFixtures((prev) => prev.map((f) => f.id === id ? __spreadProps(__spreadValues({}, f), { played: true, homeScore: hg, awayScore: ag }) : f));
  }
  function unplay(id) {
    setFixtures((prev) => prev.map((f) => f.id === id ? __spreadProps(__spreadValues({}, f), { played: false, homeScore: null, awayScore: null }) : f));
  }
  function handleOverride(id, field, val) {
    setFixtures((prev) => prev.map((f) => {
      if (f.id !== id) return f;
      if (field === "toggle") return __spreadProps(__spreadValues({}, f), { overrideOn: !f.overrideOn });
      if (field === "hw") return __spreadProps(__spreadValues({}, f), { ovHW: val });
      if (field === "d") return __spreadProps(__spreadValues({}, f), { ovD: val });
      if (field === "aw") return __spreadProps(__spreadValues({}, f), { ovAW: val });
      return f;
    }));
  }
  const regStats = useMemo(() => calcStats(teams, initFixtures), [teams, initFixtures]);
  const n = teams.length;
  const poSz = _poSize || 6;
  const pdSz = _pdSize || 4;
  const pfmt = _pfmt || "round-robin";
  const playoffSource = useMemo(() => regStats.slice(0, poSz).map((r, i) => __spreadProps(__spreadValues({}, r), { startingPts: poSz - i })), [regStats, poSz]);
  const playdownSource = useMemo(() => regStats.slice(Math.max(0, n - pdSz)).map((r, i) => __spreadProps(__spreadValues({}, r), { startingPts: pdSz - i })), [regStats, n, pdSz]);
  const isPlayoff = type === "playoff";
  const stdPromo = league.promoTop != null ? league.promoTop : 2;
  const stdDemot = league.demotBot != null ? league.demotBot : 2;
  const hlTop = isPlayoff ? poSz : stdPromo;
  const hlBot = isPlayoff ? pdSz : stdDemot;
  function openDetail(idx) {
    setDetail({ source: "regular", idx });
  }
  const detailTeam = detail ? detail.source === "regular" ? teams[detail.idx] : null : null;
  return /* @__PURE__ */ React.createElement("div", null, isPlayoff && /* @__PURE__ */ React.createElement("div", { className: "phase-tabs" }, /* @__PURE__ */ React.createElement("button", { className: "phase-tab" + (phase === "regular" ? " rs-on" : ""), onClick: () => setPhase("regular") }, "Regular Season"), /* @__PURE__ */ React.createElement("button", { className: "phase-tab" + (phase === "playoff" ? " po-on" : ""), onClick: () => setPhase("playoff") }, "Play-offs (Top 6)"), /* @__PURE__ */ React.createElement("button", { className: "phase-tab" + (phase === "playdown" ? " pd-on" : ""), onClick: () => setPhase("playdown") }, "Play-downs (Bottom 4)")), phase === "playoff" && /* @__PURE__ */ React.createElement(
    PhaseView,
    {
      phase: "playoff",
      phaseData: playoffs,
      setPhaseData: setPlayoffs,
      settings,
      sourceStats: playoffSource,
      phaseFormat: pfmt,
      label: "Play-offs",
      color: "#a78bfa",
      infoText: "Top " + poSz + " from regular season. Starting pts: rank 1 = " + poSz + " pts, rank 2 = " + (poSz - 1) + " pts, etc.",
      onTeamClick: (id) => {
        const t = ((playoffs == null ? void 0 : playoffs.teams) || []).find((t2) => t2.id === id);
        const i = ((playoffs == null ? void 0 : playoffs.teams) || []).indexOf(t);
        if (t) setDetail({ source: "playoff", idx: i });
      }
    }
  ), phase === "playdown" && /* @__PURE__ */ React.createElement(
    PhaseView,
    {
      phase: "playdown",
      phaseData: playdowns,
      setPhaseData: setPlaydowns,
      settings,
      sourceStats: playdownSource,
      phaseFormat: pfmt,
      label: "Play-downs",
      color: "#f87171",
      infoText: "Bottom " + pdSz + " from regular season. Starting pts: rank 1 = " + pdSz + " pts, rank 2 = " + (pdSz - 1) + " pts, etc.",
      onTeamClick: (id) => {
        const t = ((playdowns == null ? void 0 : playdowns.teams) || []).find((t2) => t2.id === id);
        const i = ((playdowns == null ? void 0 : playdowns.teams) || []).indexOf(t);
        if (t) setDetail({ source: "playdown", idx: i });
      }
    }
  ), phase === "regular" && /* @__PURE__ */ React.createElement("div", { className: "panel" }, /* @__PURE__ */ React.createElement("div", { className: "ph" }, /* @__PURE__ */ React.createElement("span", { className: "ph-num" }, "03"), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("h2", null, isPlayoff ? "Regular Season" : "Match Day & Results"), /* @__PURE__ */ React.createElement("p", null, "Enter scores — table updates automatically."))), /* @__PURE__ */ React.createElement("div", { className: "tabs" }, ["table", "scores", "monte", "settings"].map((t) => /* @__PURE__ */ React.createElement("button", { key: t, className: "tab" + (tab === t ? " on" : ""), onClick: () => setTab(t) }, t === "table" ? "League Table" : t === "scores" ? "Scores" + (pending.length ? " (" + pending.length + ")" : "") : t === "monte" ? "Monte Carlo" : "Settings"))), tab === "table" && /* @__PURE__ */ React.createElement(
    LeagueTable,
    {
      teams: initTeams,
      fixtures: initFixtures,
      onTeamClick: openDetail,
      highlightTop: hlTop,
      highlightBottom: hlBot,
      confirmedTop,
      confirmedBottom
    }
  ), tab === "scores" && /* @__PURE__ */ React.createElement(
    ScoresTab,
    {
      teams,
      fixtures: initFixtures,
      liveProbs,
      settings,
      onConfirm: confirmScore,
      onUndo: unplay,
      onOverride: handleOverride,
      onTeamClick: openDetail,
      onWeekChange: (id, w) => setFixtures((prev) => prev.map((f) => f.id === id ? __spreadProps(__spreadValues({}, f), { week: w }) : f))
    }
  ), tab === "monte" && /* @__PURE__ */ React.createElement(
    MCTab,
    {
      key: played.length,
      teams,
      fixtures: initFixtures,
      settings,
      highlightTop: hlTop,
      highlightBottom: hlBot,
      onConfirmed: (ct, cb) => {
        setConfirmedTop(ct);
        setConfirmedBottom(cb);
      }
    }
  ), tab === "settings" && /* @__PURE__ */ React.createElement(SettingsPanel, { settings, onChange: (k, v) => setSettings((s) => __spreadProps(__spreadValues({}, s), { [k]: v })), showTiebreakers: true, league, onLeagueChange: setLeague }), /* @__PURE__ */ React.createElement("div", { className: "nav-row" }, /* @__PURE__ */ React.createElement("button", { className: "btn btn-ghost", onClick: onBack }, "← Edit Fixtures"))), detail && (() => {
    let t = null, idx = null, fx = initFixtures, tms = teams;
    if (detail.source === "regular") {
      idx = detail.idx;
      t = teams[idx];
    } else if (detail.source === "playoff" && playoffs) {
      tms = playoffs.teams;
      fx = playoffs.fixtures;
      idx = detail.idx;
      t = playoffs.teams[idx];
    } else if (detail.source === "playdown" && playdowns) {
      tms = playdowns.teams;
      fx = playdowns.fixtures;
      idx = detail.idx;
      t = playdowns.teams[idx];
    }
    if (!t) return null;
    return /* @__PURE__ */ React.createElement(TeamDetail, { team: t, teamIdx: idx, teams: tms, fixtures: fx, onClose: () => setDetail(null) });
  })());
}
function LeagueEditor({ league, onChange }) {
  const [step, setStep] = useState(league.step || 0);
  function set(field) {
    return (u) => onChange((lg) => __spreadProps(__spreadValues({}, lg), { [field]: typeof u === "function" ? u(lg[field]) : u }));
  }
  function setSettings(u) {
    onChange((lg) => __spreadProps(__spreadValues({}, lg), { settings: typeof u === "function" ? u(lg.settings || defaultSettings()) : u }));
  }
  function goStep(s) {
    setStep(s);
    onChange((lg) => __spreadProps(__spreadValues({}, lg), { step: s }));
  }
  const LABELS = ["Teams", "Fixtures", "Simulate"];
  return /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "steps" }, LABELS.map((l, i) => /* @__PURE__ */ React.createElement(
    "div",
    {
      key: i,
      className: "step" + (step === i ? " on" : step > i ? " done" : ""),
      onClick: () => {
        if (i <= step) goStep(i);
      }
    },
    step > i ? "✓ " : "",
    l
  ))), step === 0 && /* @__PURE__ */ React.createElement(TeamsStep, { teams: league.teams, fixtures: league.fixtures, setTeams: set("teams"), leagueType: league.type, onNext: () => goStep(1) }), step === 1 && /* @__PURE__ */ React.createElement(
    FixturesStep,
    {
      teams: league.teams,
      fixtures: league.fixtures,
      setFixtures: set("fixtures"),
      settings: league.settings || defaultSettings(),
      setSettings,
      onBack: () => goStep(0),
      onNext: () => goStep(2)
    }
  ), step === 2 && /* @__PURE__ */ React.createElement(SimStep, { league, setLeague: onChange, onBack: () => goStep(1) }));
}
function App() {
  const [store, setStore] = useState({ leagues: [] });
  const [activeId, setActiveId] = useState(null);
  const [msg, setMsg] = useState("");
  const msgTimer = useRef(null);
  const active = store.leagues.find((lg) => lg.id === activeId) || null;
  function flash(m) {
    setMsg(m);
    clearTimeout(msgTimer.current);
    msgTimer.current = setTimeout(() => setMsg(""), 2500);
  }
  function handleSave() {
    saveData(store);
    flash("Downloading…");
  }
  function handleLoad() {
    loadData().then((data) => {
      if (!data.leagues) throw new Error("Not a LeagueSim file");
      setStore(data);
      setActiveId(null);
      flash("Loaded!");
    }).catch((e) => alert("Could not load: " + e));
  }
  function createLeague(name, type, poSize, pdSize, phaseFormat) {
    const lg = makeLeague(name, type, poSize, pdSize, phaseFormat);
    setStore((s) => __spreadProps(__spreadValues({}, s), { leagues: [...s.leagues, lg] }));
    setActiveId(lg.id);
  }
  function deleteLeague(id) {
    if (!confirm("Delete this league?")) return;
    setStore((s) => __spreadProps(__spreadValues({}, s), { leagues: s.leagues.filter((lg) => lg.id !== id) }));
    if (activeId === id) setActiveId(null);
  }
  function updateLeague(id, u) {
    setStore((s) => __spreadProps(__spreadValues({}, s), { leagues: s.leagues.map((lg) => lg.id === id ? typeof u === "function" ? u(lg) : u : lg) }));
  }
  return /* @__PURE__ */ React.createElement("div", { className: "app" }, /* @__PURE__ */ React.createElement("div", { className: "masthead" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "logo" }, "League", /* @__PURE__ */ React.createElement("span", null, "Sim")), /* @__PURE__ */ React.createElement("div", { className: "sub" }, active ? active.name : store.leagues.length + " league" + (store.leagues.length !== 1 ? "s" : ""))), /* @__PURE__ */ React.createElement("div", { className: "top-btns" }, msg && /* @__PURE__ */ React.createElement("span", { className: "muted" }, msg), /* @__PURE__ */ React.createElement("button", { className: "btn btn-cyan", onClick: handleSave }, "💾 Save"), /* @__PURE__ */ React.createElement("button", { className: "btn btn-ghost", onClick: handleLoad }, "📂 Load"), active && /* @__PURE__ */ React.createElement("button", { className: "btn btn-ghost", onClick: () => setActiveId(null) }, "← All Leagues"))), !active && /* @__PURE__ */ React.createElement(HomeScreen, { leagues: store.leagues, onOpen: setActiveId, onCreate: createLeague, onDelete: deleteLeague }), active && /* @__PURE__ */ React.createElement(LeagueEditor, { key: active.id, league: active, onChange: (u) => updateLeague(active.id, u) }));
}
ReactDOM.createRoot(document.getElementById("root")).render(/* @__PURE__ */ React.createElement(App, null));
