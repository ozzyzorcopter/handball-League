// Youth and regional leagues are split in pools. The data carries `group` on every standings row
// (see parseStandingsHtml in the fetch script); this turns such a league into one small league per pool,
// so the table, games, players and simulator each work on a single pool.

// null when the league has one pool, else [{ id, name, teamNames }] in page order.
export function groupsOf(league) {
  const ranking = (league && league.ranking) || [];
  const ids = [...new Set(ranking.map(r => r.group ?? 0))].sort((a, b) => a - b);
  if (ids.length < 2) return null;
  return ids.map((id, i) => {
    const rows = ranking.filter(r => (r.group ?? 0) === id);
    const named = rows.find(r => r.groupName);
    return { id, name: named ? named.groupName : null, letter: String.fromCharCode(65 + (i % 26)), teamNames: rows.map(r => r.name) };
  });
}

// The league as it looks when only one pool is shown: its teams re-indexed, its games, its table.
export function leagueForGroup(league, group) {
  const names = new Set(group.teamNames);
  const oldToNew = new Map();
  const teams = [];
  (league.teams || []).forEach((t, i) => { if (names.has(t.name)) { oldToNew.set(i, teams.length); teams.push(t); } });
  const fixtures = (league.fixtures || [])
    .filter(f => oldToNew.has(f.homeIdx) && oldToNew.has(f.awayIdx))
    .map(f => ({ ...f, homeIdx: oldToNew.get(f.homeIdx), awayIdx: oldToNew.get(f.awayIdx) }));
  const ranking = (league.ranking || []).filter(r => names.has(r.name)).map((r, i) => ({ ...r, pos: i + 1 }));
  const byClub = list => (Array.isArray(list) ? list.filter(x => names.has(x.club)) : list);
  return {
    ...league,
    teams, fixtures, ranking,
    scorers: byClub(league.scorers),
    topSingleGamePlayers: byClub(league.topSingleGamePlayers),
    travelRanking: Array.isArray(league.travelRanking) ? league.travelRanking.filter(x => names.has(x.name)) : league.travelRanking,
  };
}
