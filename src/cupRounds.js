// Knockout structure of a cup competition, worked out from who played whom.
// Clubee publishes a cup as a flat list of games with no round numbers. The Lotto Handball Cup is
// played in two parts: qualifying rounds with pre-drawn pairings (1/64, 1/32, 1/16 finals, run by the
// regional federations) and, from the 1/8 finals, a federation bracket (8 games, 4, 2, 1).
//  - Games from KBHB_FROM onward (1 November) are the federation rounds. They are split into rounds by
//    gaps of more than 6 days and named from the end by their number of games (1 Final, 2 Semi-finals,
//    4 Quarter-finals, 8 Round of 16).
//  - Every earlier game is staged by walking the bracket backwards: its stage is one further from the
//    final than the next game of whichever team went on (the loser never plays again). Games whose winner
//    has no later game yet are the 1/16 finals. 1/16 -> 1/32 -> 1/64; anything older is a qualifying round.
const DATE = /^\d{4}-\d{2}-\d{2}/;
const WINDOW_GAP = 6;
const LATE_NAMES = { 1: "Final", 2: "Semi-finals", 4: "Quarter-finals", 8: "Round of 16" };
const EARLY_NAMES = { 1: "1/16 finals", 2: "1/32 finals", 3: "1/64 finals" };

function dayNum(d) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d || "");
  return m ? Math.floor(Date.UTC(+m[1], +m[2] - 1, +m[3]) / 86400000) : null;
}

// 1 November of the season the games belong to (Aug-Dec of year Y -> 1 Nov Y).
function kbhbCutoff(dated) {
  const first = dated[0] && DATE.exec(dated[0].date);
  if (!first) return null;
  const y = +first[0].slice(0, 4), mo = +first[0].slice(5, 7);
  return `${mo >= 7 ? y : y - 1}-11-01`;
}

export function isCupLeague(league) {
  const name = String((league && league.name) || "");
  return /\bcup\b/i.test(name) && !/super\s*cup/i.test(name);   // "Lotto Cup Men/Women"; the youth "Beker" leagues are real groups
}

export function winnerIdx(f) {
  if (!f.played || f.homeScore == null || f.awayScore == null) return null;
  const h = +f.homeScore, a = +f.awayScore;
  if (isNaN(h) || isNaN(a) || h === a) return null;
  return h > a ? f.homeIdx : f.awayIdx;
}

// → [{ n, count, fixtures, played, from, to, label: {key} }] in play order
export function buildCupRounds(fixtures) {
  const fx = (fixtures || []).filter(f => f.homeIdx != null && f.awayIdx != null);
  const dated = fx.filter(f => DATE.test(f.date || "")).sort((a, b) => ((a.date || "") + (a.time || "")).localeCompare((b.date || "") + (b.time || "")));
  const undated = fx.filter(f => !DATE.test(f.date || ""));
  const order = [...dated, ...undated];
  const cutoff = kbhbCutoff(dated);
  const isLate = f => cutoff && DATE.test(f.date || "") && f.date >= cutoff;

  // Federation rounds
  const late = order.filter(isLate);
  const windows = [];
  let prev = null;
  for (const f of late) {
    const d = dayNum(f.date);
    if (!windows.length || d - prev > WINDOW_GAP) windows.push([]);
    windows[windows.length - 1].push(f);
    prev = d;
  }
  const lateRounds = windows.map(list => ({ list, key: null }));
  let k = lateRounds.length - 1;
  if (k >= 0 && LATE_NAMES[lateRounds[k].list.length]) {
    lateRounds[k].key = LATE_NAMES[lateRounds[k].list.length];
    for (let j = k - 1; j >= 0; j--) {
      if (LATE_NAMES[lateRounds[j].list.length] && lateRounds[j].list.length === lateRounds[j + 1].list.length * 2) lateRounds[j].key = LATE_NAMES[lateRounds[j].list.length];
      else break;
    }
  }
  if (lateRounds[0] && !lateRounds[0].key && lateRounds[0].list.length === 8) lateRounds[0].key = "Round of 16";
  lateRounds.forEach((r, i) => { if (!r.key) r.key = "Round " + (i + 1); });

  // Qualifying rounds: stage counted backwards from the federation rounds
  const early = order.filter(f => !isLate(f));
  const nextOf = new Map();    // fixture -> the next game of either team
  const pos = new Map(order.map((f, i) => [f, i]));
  const byTeam = new Map();
  order.forEach(f => [f.homeIdx, f.awayIdx].forEach(t => { if (!byTeam.has(t)) byTeam.set(t, []); byTeam.get(t).push(f); }));
  for (const f of early) {
    let nx = null;
    for (const t of [f.homeIdx, f.awayIdx]) {
      const list = byTeam.get(t);
      const n = list[list.indexOf(f) + 1];
      if (n && (!nx || pos.get(n) < pos.get(nx))) nx = n;
    }
    nextOf.set(f, nx);
  }
  const rank = new Map();
  const rankOf = f => {
    if (rank.has(f)) return rank.get(f);
    const nx = nextOf.get(f);
    const r = !nx ? 1 : isLate(nx) ? 1 : rankOf(nx) + 1;
    rank.set(f, r);
    return r;
  };
  const byRank = new Map();
  for (const f of [...early].reverse()) rankOf(f);   // resolve latest games first (no deep recursion)
  for (const f of early) {
    const r = rankOf(f);
    if (!byRank.has(r)) byRank.set(r, []);
    byRank.get(r).push(f);
  }
  const groups = [...byRank.keys()].sort((a, b) => b - a).map(r => ({ list: byRank.get(r), key: EARLY_NAMES[r] || "Qualifying round" }));
  // several ranks beyond 1/64 collapse into one qualifying round
  const merged = [];
  for (const g of groups) {
    const last = merged[merged.length - 1];
    if (last && last.key === "Qualifying round" && g.key === "Qualifying round") last.list.push(...g.list);
    else merged.push({ ...g });
  }

  return [...merged, ...lateRounds].map((r, i) => {
    const ds = r.list.map(f => f.date).filter(Boolean).sort();
    return {
      n: i + 1, count: r.list.length, fixtures: r.list.slice().sort((a, b) => ((a.date || "~") + (a.time || "")).localeCompare((b.date || "~") + (b.time || ""))),
      played: r.list.filter(f => f.played).length,
      from: ds[0] || null, to: ds[ds.length - 1] || null,
      label: /^Round \d+$/.test(r.key) ? { key: "Round", n: +r.key.slice(6) } : { key: r.key },
    };
  });
}

// Teams still alive: winners of their latest decided game, plus teams whose latest game is not played yet.
export function aliveTeams(rounds) {
  const lastGame = new Map();
  rounds.forEach(r => r.fixtures.forEach(f => { lastGame.set(f.homeIdx, f); lastGame.set(f.awayIdx, f); }));
  const alive = [];
  lastGame.forEach((f, idx) => {
    if (!f.played) { alive.push(idx); return; }
    const w = winnerIdx(f);
    if (w != null) { if (w === idx) alive.push(idx); return; }
    // played but no (usable) score: the team that went on to another game won it
    const opp = f.homeIdx === idx ? f.awayIdx : f.homeIdx;
    if (lastGame.get(opp) !== f) return;    // opponent continued, so this team is out
    alive.push(idx);
  });
  return alive;
}
