// League table: points, wins, goals and the tiebreak order.
import { rankIndices } from "./ranking.js";

// ── STATS ─────────────────────────────────────────────────────────────────────
// Always uses full tiebreaker chain.
// ranking: optional array from API with { name, played, won, drawn, lost, gf, ga, points }
export function calcStats(teams, fixtures, ranking) {
  if (!teams || !fixtures) return [];
  const scoredFixtures = fixtures.filter(f => f.played && f.homeScore != null && f.awayScore != null);
  // Build a name→ranking lookup for seeding P/W/D/L/GF/GA when scores aren't entered
  const rankMap = ranking && ranking.length > 0
    ? new Map(ranking.map(r => [r.name.toLowerCase(), r]))
    : null;
  const s = {};
  teams.forEach(t => {
    const rk = rankMap && rankMap.get(t.name.toLowerCase());
    s[t.id] = {
      id: t.id, name: t.name, basePts: t.points,
      // Seed from API ranking when available; scored fixtures will add on top
      P: rk ? (rk.played || 0) : 0,
      W: rk ? (rk.won   || 0) : 0,
      D: rk ? (rk.drawn || 0) : 0,
      L: rk ? (rk.lost  || 0) : 0,
      GF: rk ? (rk.gf   || 0) : 0,
      GA: rk ? (rk.ga   || 0) : 0,
    };
  });
  // Layer scored fixtures on top (override ranking counts to avoid double-counting)
  // Only add from fixtures if there are scored ones — otherwise trust ranking totals
  if (scoredFixtures.length > 0) {
    // Reset computed fields; re-derive everything from scored fixtures only
    Object.values(s).forEach(r => { r.P = 0; r.W = 0; r.D = 0; r.L = 0; r.GF = 0; r.GA = 0; });
    scoredFixtures.forEach(f => {
      const hg = +f.homeScore, ag = +f.awayScore;
      if (isNaN(hg) || isNaN(ag)) return;
      const h = s[teams[f.homeIdx]?.id], a = s[teams[f.awayIdx]?.id];
      if (!h || !a) return;
      h.P++; a.P++; h.GF += hg; h.GA += ag; a.GF += ag; a.GA += hg;
      if (hg > ag) { h.W++; a.L++; } else if (hg < ag) { a.W++; h.L++; } else { h.D++; a.D++; }
    });
  }
  // Build the numbers the shared ranking needs, per team index.
  const n = teams.length;
  const idxById = new Map(teams.map((t, i) => [t.id, i]));
  const rows = teams.map(t => {
    const r = s[t.id];
    return { ...r, GD: r.GF - r.GA, totalPts: scoredFixtures.length > 0 ? r.W * 2 + r.D : r.basePts };
  });
  const h2hPts = new Int32Array(n * n), h2hGF = new Int32Array(n * n), h2hAwayGF = new Int32Array(n * n), met = new Uint8Array(n * n);
  scoredFixtures.forEach(f => {
    const hg = +f.homeScore, ag = +f.awayScore;
    if (isNaN(hg) || isNaN(ag)) return;
    const hi = idxById.get(teams[f.homeIdx]?.id), ai = idxById.get(teams[f.awayIdx]?.id);
    if (hi == null || ai == null) return;
    met[hi * n + ai] = met[ai * n + hi] = 1;
    h2hGF[hi * n + ai] += hg; h2hGF[ai * n + hi] += ag; h2hAwayGF[ai * n + hi] += ag;
    if (hg > ag) h2hPts[hi * n + ai] += 2;
    else if (hg < ag) h2hPts[ai * n + hi] += 2;
    else { h2hPts[hi * n + ai]++; h2hPts[ai * n + hi]++; }
  });
  const order = rankIndices(n, {
    pts: rows.map(r => r.totalPts), wins: rows.map(r => r.W), gf: rows.map(r => r.GF), ga: rows.map(r => r.GA),
    h2hPts, h2hGF, h2hAwayGF, met,
  }, (a, b) => rows[a].name.localeCompare(rows[b].name));
  return order.map(i => rows[i]);
}
