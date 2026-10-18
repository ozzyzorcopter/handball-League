// Match probabilities: the settings-driven rank model used by the simulator, and the goal model used for predictions.
import { calcStats } from "./standings.js";

// ── PROB CALC ─────────────────────────────────────────────────────────────────
export function calcProbs(homeIdx, awayIdx, teams, fixtures, settings) {
  const { baseWin, baseDraw, rankBonus } = settings;
  const ht = teams[homeIdx], at = teams[awayIdx];
  const hBonus = (ht && ht.homeBonus !== "" && ht.homeBonus != null) ? parseFloat(ht.homeBonus) || 0 : settings.homeBonus;
  const table = calcStats(teams, fixtures);
  const homeRow = table.find(r => r.id === ht?.id);
  const awayRow = table.find(r => r.id === at?.id);
  const hp = table.indexOf(homeRow);
  const ap = table.indexOf(awayRow);
  let gap = 0;
  if (homeRow && awayRow && homeRow.totalPts !== awayRow.totalPts) {
    const hGrp = table.map((r, i) => r.totalPts === homeRow.totalPts ? i : -1).filter(i => i >= 0);
    const aGrp = table.map((r, i) => r.totalPts === awayRow.totalPts ? i : -1).filter(i => i >= 0);
    gap = hp < ap ? Math.min(...aGrp) - Math.max(...hGrp) : Math.max(...aGrp) - Math.min(...hGrp);
  }
  const shift = gap * rankBonus;
  let hw = Math.max(0, Math.min(100 - baseDraw, baseWin + hBonus + shift));
  let aw = 100 - baseDraw - hw;
  if (aw < 0) { hw += aw; aw = 0; }
  return { homeWin: Math.round(hw), draw: Math.round(baseDraw), awayWin: Math.max(0, Math.round(aw)) };
}

// calcProbsNeutral: like calcProbs but homeBonus = 0 (neutral ground)
export function calcProbsNeutral(homeIdx, awayIdx, teams, settings) {
  const neutralSettings = { ...settings, homeBonus: 0 };
  // Also override per-team homeBonus
  const neutralTeams = teams.map(t => ({ ...t, homeBonus: "" }));
  return calcProbs(homeIdx, awayIdx, neutralTeams, [], neutralSettings);
}

export function fixProbs(f, teams, fixtures, settings) {
  if (f.overrideOn && f.ovHW !== "") return { homeWin: parseFloat(f.ovHW) || 0, draw: parseFloat(f.ovD) || 0, awayWin: parseFloat(f.ovAW) || 0 };
  return calcProbs(f.homeIdx, f.awayIdx, teams, fixtures, settings);
}

// ── GOAL MODEL (match predictions) ──────────────────────────────────────────────
// Expected goals from each side's attack/defence relative to the league average
// (shrunk towards average while a team has few games), then a normal model on
// the goal difference gives win / draw / loss chances. Used for every Belgian
// league (predictions and Monte Carlo); the rank model with its settings is
// kept for self-made leagues.
function normCdf(x) {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989423 * Math.exp(-x * x / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return x > 0 ? 1 - p : p;
}
export function predictMatch(homeIdx, awayIdx, teams, fixtures) {
  const played = fixtures.filter(f => f.played && f.homeScore != null && f.awayScore != null && !isNaN(+f.homeScore) && !isNaN(+f.awayScore));
  if (played.length < 6 || !teams[homeIdx] || !teams[awayIdx]) return null;
  const lgH = played.reduce((a, f) => a + +f.homeScore, 0) / played.length;
  const lgA = played.reduce((a, f) => a + +f.awayScore, 0) / played.length;
  const lg = (lgH + lgA) / 2;
  const gds = played.map(f => +f.homeScore - +f.awayScore);
  const mean = gds.reduce((a, b) => a + b, 0) / gds.length;
  const sd = Math.max(5, Math.sqrt(gds.reduce((a, b) => a + (b - mean) * (b - mean), 0) / gds.length));
  // How strongly a team's attack/defence is pulled towards its starting point while it has few games.
  // Without a prior the starting point is the league average (K = 1: backtested on played games with
  // tools/backtest.mjs, 1 predicts clearly better than 4). With last season's strength (team.prior,
  // added by .github/scripts/priors.js, carried over at 70%) a longer pull is better (K = 3).
  const K = 1, K_PRIOR = 3, CARRY = 0.7;
  const rate = idx => {
    let gf = 0, ga = 0, n = 0;
    played.forEach(f => {
      if (f.homeIdx === idx) { gf += +f.homeScore; ga += +f.awayScore; n++; }
      else if (f.awayIdx === idx) { gf += +f.awayScore; ga += +f.homeScore; n++; }
    });
    const pr = teams[idx] && teams[idx].prior;
    const start = pr && isFinite(pr.att) && isFinite(pr.def)
      ? { att: 1 + (pr.att - 1) * CARRY, def: 1 + (pr.def - 1) * CARRY } : { att: 1, def: 1 };
    const w = n / (n + (pr ? K_PRIOR : K));
    return {
      att: start.att + ((n ? gf / n / lg : start.att) - start.att) * w,
      def: start.def + ((n ? ga / n / lg : start.def) - start.def) * w,
    };
  };
  const h = rate(homeIdx), a = rate(awayIdx);
  const eh = lgH * h.att * a.def, ea = lgA * a.att * h.def;
  const mu = eh - ea;
  const draw = normCdf((0.5 - mu) / sd) - normCdf((-0.5 - mu) / sd);
  const homeWin = 1 - normCdf((0.5 - mu) / sd);
  const pct = v => Math.round(v * 100);
  const hw = pct(homeWin), dr = pct(draw);
  return { homeWin: hw, draw: dr, awayWin: Math.max(0, 100 - hw - dr), eh: Math.round(eh), ea: Math.round(ea) };
}
// What the goal model would have predicted for a game that has been played, using
// only games played on earlier dates (so the result itself never leaks in).
export function predictPlayed(f, teams, fixtures) {
  if (!f.date) return null;
  const before = fixtures.filter(g => g.date && g.date < f.date);
  return predictMatch(f.homeIdx, f.awayIdx, teams, before);
}
// Win / draw / loss chances for a pending fixture. model "goal" (Belgian leagues) uses the goal model and
// falls back to the settings-driven rank model while a league has too few played games; model "rank"
// (self-made leagues) always uses the rank model and its settings.
export function modelProbs(f, teams, fixtures, settings, model = "rank") {
  if (f.overrideOn && f.ovHW !== "") return fixProbs(f, teams, fixtures, settings);
  if (model === "goal") {
    const g = predictMatch(f.homeIdx, f.awayIdx, teams, fixtures);
    if (g) return { homeWin: g.homeWin, draw: g.draw, awayWin: g.awayWin };
  }
  return calcProbs(f.homeIdx, f.awayIdx, teams, fixtures, settings);
}

export function weekBounds() {
  const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const now = new Date();
  const mon = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7));
  const next = new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + 7);
  return { cur: iso(mon), next: iso(next) };
}

