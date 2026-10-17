import { calcProbs } from "./probabilities.js";
// ── SAVE / LOAD ──────────────────────────────────────────────────────────────
export function saveData(data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement("a"), { href: url, download: "leaguesim-data.json" });
  a.click();
  URL.revokeObjectURL(url);
}

export function loadData() {
  return new Promise((resolve, reject) => {
    const input = Object.assign(document.createElement("input"), { type: "file", accept: ".json" });
    input.onchange = () => {
      const reader = new FileReader();
      reader.onload = e => {
        try { resolve(JSON.parse(e.target.result)); }
        catch { reject("Invalid file"); }
      };
      reader.readAsText(input.files[0]);
    };
    input.click();
  });
}

export function defaultSettings() {
  return { baseWin: 47, baseDraw: 6, homeBonus: 10, rankBonus: 3, winScore: 30, lossScore: 25, drawScore: 25 };
}

export function makeTeam(index) {
  return { id: "t" + Date.now() + index, name: "Team " + (index + 1), points: 0, homeBonus: "" };
}

export function makeLeague(name, type, poSize, pdSize, phaseFormat, archivable = false) {
  return {
    id: String(Date.now()), name, type: type || "standard",
    teams: [makeTeam(0)], fixtures: [], step: 0,
    settings: defaultSettings(),
    playoffs: null, playdowns: null,
    poSize: poSize || 6,
    pdSize: pdSize || 4,
    phaseFormat: phaseFormat || "round-robin",
    promoTop: 2,
    demotBot: 2,
    archivable,
    scorerUrl: "",
    playoffScorerUrl: "",
    playdownScorerUrl: "",
    scorerAliases: {},
  };
}

// ── FIXTURE GENERATOR ────────────────────────────────────────────────────────
// Generates a 2-round robin: each pair plays twice (A hosts B, B hosts A).
// n teams → n*(n-1) fixtures total.
export function makeFixtures(teams, settings) {
  const n = teams.length;
  let counter = 0;
  const id = () => "f" + (counter++);
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
