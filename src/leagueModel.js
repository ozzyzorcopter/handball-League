import { calcProbs } from "./probabilities.js";
export function defaultSettings() {
  return { baseWin: 47, baseDraw: 6, homeBonus: 10, rankBonus: 3, winScore: 30, lossScore: 25, drawScore: 25 };
}

export function makeTeam(index) {
  return { id: "t" + Date.now() + index, name: "Team " + (index + 1), points: 0, homeBonus: "" };
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
