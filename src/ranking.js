// The ONE place the table ranking rules live. Both the league table
// (standings.js) and the Monte Carlo simulation (montecarlo.js) call this, so
// they can never drift apart again.
//
// Order of criteria:
//   1. points
//   2. wins
//   3. head-to-head among the teams still tied on 1 and 2, but ONLY if every
//      pair in that group has met (a single incidental result must not split
//      teams that never got the chance to play each other):
//        head-to-head points, then head-to-head goal difference,
//        then goals scored away in those head-to-head games
//   4. overall goal difference
//   5. `finalCompare(a, b)` supplied by the caller (the table uses the team
//      name; the simulation uses a random draw)
//
// Teams are indices 0..n-1. `d` describes the season so far:
//   d.pts[i], d.wins[i], d.gf[i], d.ga[i]
//   d.h2hPts[i * n + j]    points i took from its games against j
//   d.h2hGF[i * n + j]     goals i scored against j (all games between them)
//   d.h2hAwayGF[i * n + j] goals i scored away at j
//   d.met[i * n + j]       1 when i and j have met (for a simulation: will have
//                          met by the end of the season)
// Returns the indices ordered best to worst.
export function rankIndices(n, d, finalCompare) {
  const order = Array.from({ length: n }, (_, i) => i);
  order.sort((a, b) => (d.pts[b] - d.pts[a]) || (d.wins[b] - d.wins[a]));

  const out = [];
  let i = 0;
  while (i < n) {
    let j = i + 1;
    while (j < n && d.pts[order[j]] === d.pts[order[i]] && d.wins[order[j]] === d.wins[order[i]]) j++;
    if (j - i === 1) out.push(order[i]);
    else for (const t of breakTie(order.slice(i, j), n, d, finalCompare)) out.push(t);
    i = j;
  }
  return out;
}

function breakTie(group, n, d, finalCompare) {
  let complete = true;
  for (let a = 0; a < group.length && complete; a++) {
    for (let b = a + 1; b < group.length; b++) {
      if (!d.met[group[a] * n + group[b]]) { complete = false; break; }
    }
  }
  const h2h = new Map();
  if (complete) {
    for (const m of group) {
      let pts = 0, gd = 0, away = 0;
      for (const o of group) {
        if (o === m) continue;
        pts += d.h2hPts[m * n + o];
        gd += d.h2hGF[m * n + o] - d.h2hGF[o * n + m];
        away += d.h2hAwayGF[m * n + o];
      }
      h2h.set(m, { pts, gd, away });
    }
  }
  const byGoals = list => list.slice().sort((a, b) => {
    const gdA = d.gf[a] - d.ga[a], gdB = d.gf[b] - d.ga[b];
    if (gdB !== gdA) return gdB - gdA;
    return finalCompare ? finalCompare(a, b) : 0;
  });
  if (!complete) return byGoals(group);
  // Head-to-head points, then head-to-head goal difference. Teams still level while others have
  // been separated are compared again by the games among themselves only (A, B, C tied: C is split
  // off, then A and B are ranked by their own game). If nobody got separated: away goals, then overall.
  const sorted = group.slice().sort((a, b) => {
    const ha = h2h.get(a), hb = h2h.get(b);
    return (hb.pts - ha.pts) || (hb.gd - ha.gd);
  });
  const same = (a, b) => h2h.get(a).pts === h2h.get(b).pts && h2h.get(a).gd === h2h.get(b).gd;
  const out = [];
  let i = 0;
  while (i < sorted.length) {
    let j = i + 1;
    while (j < sorted.length && same(sorted[i], sorted[j])) j++;
    const run = sorted.slice(i, j);
    if (run.length === 1) out.push(run[0]);
    else if (run.length < group.length) out.push(...breakTie(run, n, d, finalCompare));
    else {
      const byAway = run.slice().sort((x, y) => h2h.get(y).away - h2h.get(x).away);
      let k = 0;
      while (k < byAway.length) {
        let m = k + 1;
        while (m < byAway.length && h2h.get(byAway[m]).away === h2h.get(byAway[k]).away) m++;
        out.push(...byGoals(byAway.slice(k, m)));
        k = m;
      }
    }
    i = j;
  }
  return out;
}
