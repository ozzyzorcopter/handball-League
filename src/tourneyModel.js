// Custom tournaments ("driehoekstoernooi", group phase + knock-out, ...). Pure logic, no React.
// A tournament is plain JSON so it can be saved on the device and edited freely:
//   { id, name, pts:{win,draw}, teams:[{id,name}], stages:[group | ko] }
//   group stage: { id, type:"group", name, legs, advance, groups:[{id,name,teamIds}], matches:[match] }
//   ko stage:    { id, type:"ko", name, rounds:[{id,name,matches:[match]}] }
//   match:       { id, home:slot, away:slot, hs, as, pen, group?, round?, third? }   (hs/as are numbers or null)
//   slot:        null | {team:id} | {rank:{group:id,pos:1}} | {win:matchId} | {lose:matchId}
let ctr = 0;
export const uid = (p = "x") => p + Date.now().toString(36).slice(-4) + (++ctr).toString(36) + Math.random().toString(36).slice(2, 5);
const clone = o => JSON.parse(JSON.stringify(o));
export const edit = (t, fn) => { const d = clone(t); fn(d); return d; };
export const ordinal = n => n + (n === 1 ? "st" : n === 2 ? "nd" : n === 3 ? "rd" : "th");

// ── Fixtures ─────────────────────────────────────────────────────────────────
// Circle method: every team plays every other once per leg, spread over matchdays.
export function roundRobin(ids, legs = 1) {
  const arr = ids.slice(); if (arr.length % 2) arr.push(null);
  const n = arr.length, rounds = [];
  for (let r = 0; r < n - 1; r++) {
    const m = [];
    for (let i = 0; i < n / 2; i++) {
      const a = arr[i], b = arr[n - 1 - i];
      if (a != null && b != null) m.push(r % 2 ? [b, a] : [a, b]);
    }
    rounds.push(m);
    arr.splice(1, 0, arr.pop());
  }
  if (legs >= 2) { const first = rounds.slice(); first.forEach(rd => rounds.push(rd.map(([a, b]) => [b, a]))); }
  return rounds;
}
const newMatch = (home, away, extra) => ({ id: uid("m"), home, away, hs: null, as: null, pen: null, ...extra });
export function groupMatches(groupId, teamIds, legs) {
  const out = [];
  roundRobin(teamIds, legs).forEach((rd, i) => rd.forEach(([a, b]) => out.push(newMatch({ team: a }, { team: b }, { group: groupId, round: i + 1 }))));
  return out;
}
export function makeGroupStage({ name = "Group stage", groups, legs = 1, advance = 2 }) {
  const gs = groups.map((g, i) => ({ id: uid("g"), name: g.name || "Group " + String.fromCharCode(65 + i), teamIds: g.teamIds.slice() }));
  return { id: uid("s"), type: "group", name, legs, advance, groups: gs, matches: gs.flatMap(g => groupMatches(g.id, g.teamIds, legs)) };
}

// Standard bracket seeding: 1 meets the lowest seed, and the top seeds can only meet late.
export function seedOrder(size) {
  let o = [1];
  while (o.length < size) { const n = o.length * 2; o = o.flatMap(s => [s, n + 1 - s]); }
  return o;
}
export function roundName(count) {
  return count === 1 ? "Final" : count === 2 ? "Semi-finals" : count === 4 ? "Quarter-finals" : "Round of " + count * 2;
}
// entrants: slots in seed order (best first). Missing opponents become byes.
export function makeKnockout({ name = "Knock-out", entrants, third = false }) {
  const n = Math.max(2, entrants.length);
  let size = 2; while (size < n) size *= 2;
  const order = seedOrder(size);
  const seat = s => entrants[s - 1] || null;
  const rounds = [];
  let prev = [];
  for (let i = 0; i < size / 2; i++) prev.push(newMatch(seat(order[2 * i]), seat(order[2 * i + 1])));
  rounds.push({ id: uid("r"), name: roundName(prev.length), matches: prev });
  while (prev.length > 1) {
    const next = [];
    for (let i = 0; i < prev.length; i += 2) next.push(newMatch({ win: prev[i].id }, { win: prev[i + 1].id }));
    rounds.push({ id: uid("r"), name: roundName(next.length), matches: next });
    if (next.length === 1 && third) next.push(newMatch({ lose: prev[0].id }, { lose: prev[1].id }, { third: true }));
    prev = next.filter(m => !m.third);
  }
  return { id: uid("s"), type: "ko", name, rounds };
}
export function knockoutFromGroups(groupStage, { third = false, name = "Knock-out" } = {}) {
  const entrants = [];
  for (let pos = 1; pos <= groupStage.advance; pos++) groupStage.groups.forEach(g => entrants.push({ rank: { group: g.id, pos } }));
  return makeKnockout({ name, entrants, third });
}

// ── Templates ────────────────────────────────────────────────────────────────
function splitEven(ids, k) { const gs = Array.from({ length: k }, () => []); ids.forEach((id, i) => gs[i % k].push(id)); return gs; }
export function buildTournament({ kind, name, teamNames = [], groupCount = 2, advance = 2, legs = 1, third = false }) {
  const teams = teamNames.map(n => ({ id: uid("t"), name: n }));
  const ids = teams.map(t => t.id);
  const t = { id: uid("T"), name: name || "Tournament", pts: { win: 2, draw: 1 }, teams, stages: [] };
  if (kind === "triangle" || kind === "league") {
    t.stages.push(makeGroupStage({ name: kind === "triangle" ? "Triangle" : "Round robin", groups: [{ name: "", teamIds: ids }], legs, advance: 1 }));
    t.stages[0].groups[0].name = kind === "triangle" ? "Triangle" : "League";
  } else if (kind === "groups_ko") {
    const k = Math.max(1, Math.min(groupCount, Math.floor(ids.length / 2)));
    const gs = makeGroupStage({ groups: splitEven(ids, k).map(g => ({ name: "", teamIds: g })), legs, advance });
    t.stages.push(gs, knockoutFromGroups(gs, { third }));
  } else if (kind === "ko") {
    t.stages.push(makeKnockout({ entrants: ids.map(id => ({ team: id })), third }));
  }
  return t;
}

// ── Reading a tournament ─────────────────────────────────────────────────────
export const hasScore = m => m.hs != null && m.as != null;
export function allMatches(t) {
  return t.stages.flatMap(s => s.type === "group" ? s.matches.map(m => ({ m, s })) : s.rounds.flatMap(r => r.matches.map(m => ({ m, s, r }))));
}
export function matchLabel(t, matchId) {
  for (const s of t.stages) {
    if (s.type === "group") { const m = s.matches.find(x => x.id === matchId); if (m) return s.name; continue; }
    for (const r of s.rounds) {
      const i = r.matches.findIndex(x => x.id === matchId);
      if (i >= 0) return r.matches[i].third ? "Third place" : r.name + (r.matches.filter(x => !x.third).length > 1 ? " " + (i + 1) : "");
    }
  }
  return "?";
}
export function groupRows(t, stage, group) {
  const ps = t.pts || { win: 2, draw: 1 };
  const rows = group.teamIds.map((id, i) => ({ teamId: id, order: i, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, gd: 0, pts: 0 }));
  const by = new Map(rows.map(r => [r.teamId, r]));
  stage.matches.filter(m => m.group === group.id && hasScore(m)).forEach(m => {
    const h = by.get(m.home && m.home.team), a = by.get(m.away && m.away.team);
    if (!h || !a) return;
    h.p++; a.p++; h.gf += m.hs; h.ga += m.as; a.gf += m.as; a.ga += m.hs;
    if (m.hs > m.as) { h.w++; a.l++; h.pts += ps.win; a.pts += ps.loss || 0; }
    else if (m.hs < m.as) { a.w++; h.l++; a.pts += ps.win; h.pts += ps.loss || 0; }
    else { h.d++; a.d++; h.pts += ps.draw; a.pts += ps.draw; }
  });
  rows.forEach(r => { r.gd = r.gf - r.ga; });
  return rows.sort((x, y) => y.pts - x.pts || y.gd - x.gd || y.gf - x.gf || x.order - y.order);
}
export function groupComplete(stage, group) {
  const ms = stage.matches.filter(m => m.group === group.id);
  return ms.length > 0 && ms.every(hasScore);
}
// resolver(t).team(slot) → team id or null; .result(matchId) → {winner, loser, played}; .label(slot) → text
export function resolver(t) {
  const matches = new Map(allMatches(t).map(x => [x.m.id, x.m]));
  const groups = new Map();
  t.stages.forEach(s => s.type === "group" && s.groups.forEach(g => groups.set(g.id, { s, g })));
  const names = new Map(t.teams.map(x => [x.id, x.name]));
  const memo = new Map(), busy = new Set();
  function team(slot) {
    if (!slot) return null;
    if (slot.team) return names.has(slot.team) ? slot.team : null;
    if (slot.rank) {
      const e = groups.get(slot.rank.group);
      if (!e || !groupComplete(e.s, e.g)) return null;
      const row = groupRows(t, e.s, e.g)[slot.rank.pos - 1];
      return row ? row.teamId : null;
    }
    if (slot.win) return result(slot.win).winner;
    if (slot.lose) return result(slot.lose).loser;
    return null;
  }
  function result(id) {
    if (memo.has(id)) return memo.get(id);
    const none = { winner: null, loser: null, played: false };
    const m = matches.get(id);
    if (!m || busy.has(id)) return none;
    busy.add(id);
    let r = none;
    const h = team(m.home), a = team(m.away);
    if ((m.home == null) !== (m.away == null)) {            // bye: the one present side goes through
      const w = h || a; r = w ? { winner: w, loser: null, played: true, bye: true } : none;
    } else if (h && a && hasScore(m)) {
      const w = m.hs > m.as ? "h" : m.hs < m.as ? "a" : m.pen === "home" ? "h" : m.pen === "away" ? "a" : null;
      if (w) r = { winner: w === "h" ? h : a, loser: w === "h" ? a : h, played: true };
      else r = { winner: null, loser: null, played: true, draw: true };
    }
    busy.delete(id); memo.set(id, r);
    return r;
  }
  function label(slot) {
    if (!slot) return "Bye";
    if (slot.team) return names.get(slot.team) || "?";
    if (slot.rank) { const e = groups.get(slot.rank.group); return (e ? e.g.name : "?") + " · " + ordinal(slot.rank.pos); }
    if (slot.win) return "Winner " + matchLabel(t, slot.win);
    if (slot.lose) return "Loser " + matchLabel(t, slot.lose);
    return "?";
  }
  const name = slot => { const id = team(slot); return id ? names.get(id) : null; };
  return { team, result, label, name, display: slot => name(slot) || label(slot) };
}
export function champion(t) {
  const ko = [...t.stages].reverse().find(s => s.type === "ko");
  if (ko) {
    const fin = ko.rounds[ko.rounds.length - 1].matches.find(m => !m.third);
    const w = fin && resolver(t).result(fin.id).winner;
    return w ? t.teams.find(x => x.id === w).name : null;
  }
  const gs = [...t.stages].reverse().find(s => s.type === "group");
  if (gs && gs.groups.length === 1 && groupComplete(gs, gs.groups[0])) {
    const r = groupRows(t, gs, gs.groups[0])[0]; return r ? t.teams.find(x => x.id === r.teamId).name : null;
  }
  return null;
}

// ── Editing (each returns a new tournament) ──────────────────────────────────
export const findMatch = (d, id) => { const x = allMatches(d).find(y => y.m.id === id); return x ? x.m : null; };
export function renameTeam(t, id, name) { return edit(t, d => { const x = d.teams.find(y => y.id === id); if (x) x.name = name; }); }
export function addTeam(t, name) {
  return edit(t, d => {
    const team = { id: uid("t"), name: name || "Team " + (d.teams.length + 1) };
    d.teams.push(team);
    const gs = d.stages.find(s => s.type === "group");
    if (gs) {
      const g = gs.groups.slice().sort((a, b) => a.teamIds.length - b.teamIds.length)[0];
      if (g) addToGroup(gs, g, team.id);
    }
  });
}
function addToGroup(stage, group, teamId) {
  const others = group.teamIds.slice();
  group.teamIds.push(teamId);
  let round = Math.max(0, ...stage.matches.filter(m => m.group === group.id).map(m => m.round || 0)) + 1;
  others.forEach(o => {
    stage.matches.push(newMatch({ team: teamId }, { team: o }, { group: group.id, round: round++ }));
    if (stage.legs >= 2) stage.matches.push(newMatch({ team: o }, { team: teamId }, { group: group.id, round: round++ }));
  });
}
function dropFromGroup(stage, group, teamId) {
  group.teamIds = group.teamIds.filter(x => x !== teamId);
  stage.matches = stage.matches.filter(m => !(m.group === group.id && ((m.home && m.home.team) === teamId || (m.away && m.away.team) === teamId)));
}
export function removeTeam(t, id) {
  return edit(t, d => {
    d.teams = d.teams.filter(x => x.id !== id);
    d.stages.forEach(s => {
      if (s.type === "group") s.groups.forEach(g => dropFromGroup(s, g, id));
      else s.rounds.forEach(r => r.matches.forEach(m => {
        if (m.home && m.home.team === id) m.home = null;
        if (m.away && m.away.team === id) m.away = null;
      }));
    });
  });
}
export function moveTeam(t, stageId, teamId, toGroupId) {
  return edit(t, d => {
    const s = d.stages.find(x => x.id === stageId); if (!s || s.type !== "group") return;
    const from = s.groups.find(g => g.teamIds.includes(teamId)), to = s.groups.find(g => g.id === toGroupId);
    if (from === to) return;
    if (from) dropFromGroup(s, from, teamId);
    if (to) addToGroup(s, to, teamId);
  });
}
export function regenerateGroups(t, stageId) {
  return edit(t, d => { const s = d.stages.find(x => x.id === stageId); if (s) s.matches = s.groups.flatMap(g => groupMatches(g.id, g.teamIds, s.legs)); });
}
export function addGroup(t, stageId) {
  return edit(t, d => { const s = d.stages.find(x => x.id === stageId); if (s) s.groups.push({ id: uid("g"), name: "Group " + String.fromCharCode(65 + s.groups.length), teamIds: [] }); });
}
export function removeGroup(t, stageId, groupId) {
  return edit(t, d => {
    const s = d.stages.find(x => x.id === stageId); if (!s) return;
    s.groups = s.groups.filter(g => g.id !== groupId); s.matches = s.matches.filter(m => m.group !== groupId);
    d.stages.forEach(k => k.type === "ko" && k.rounds.forEach(r => r.matches.forEach(m => ["home", "away"].forEach(side => { if (m[side] && m[side].rank && m[side].rank.group === groupId) m[side] = null; }))));
  });
}
export function setSlot(t, matchId, side, slot) { return edit(t, d => { const m = findMatch(d, matchId); if (m) { m[side] = slot; m.pen = null; } }); }
export function setScore(t, matchId, side, v) {
  return edit(t, d => { const m = findMatch(d, matchId); if (!m) return; const n = v === "" || v == null ? null : Math.max(0, Math.floor(+v)); m[side] = Number.isFinite(n) ? n : null; if (m.hs !== m.as) m.pen = null; });
}
export function setPen(t, matchId, v) { return edit(t, d => { const m = findMatch(d, matchId); if (m) m.pen = v; }); }
export function clearScore(t, matchId) { return edit(t, d => { const m = findMatch(d, matchId); if (m) { m.hs = null; m.as = null; m.pen = null; } }); }
export function addMatch(t, stageId, where) {
  return edit(t, d => {
    const s = d.stages.find(x => x.id === stageId); if (!s) return;
    if (s.type === "group") {
      const g = s.groups.find(x => x.id === where) || s.groups[0]; if (!g) return;
      s.matches.push(newMatch(g.teamIds[0] ? { team: g.teamIds[0] } : null, g.teamIds[1] ? { team: g.teamIds[1] } : null, { group: g.id, round: Math.max(0, ...s.matches.filter(m => m.group === g.id).map(m => m.round || 0)) + 1 }));
    } else { const r = s.rounds.find(x => x.id === where) || s.rounds[0]; if (r) r.matches.push(newMatch(null, null)); }
  });
}
export function removeMatch(t, matchId) {
  return edit(t, d => {
    d.stages.forEach(s => {
      if (s.type === "group") s.matches = s.matches.filter(m => m.id !== matchId);
      else s.rounds.forEach(r => { r.matches = r.matches.filter(m => m.id !== matchId); });
    });
    allMatches(d).forEach(({ m }) => ["home", "away"].forEach(side => { const sl = m[side]; if (sl && (sl.win === matchId || sl.lose === matchId)) m[side] = null; }));
  });
}
export function setMeta(t, stageId, patch) { return edit(t, d => { const s = d.stages.find(x => x.id === stageId); if (s) Object.assign(s, patch); }); }
export function renameGroup(t, stageId, groupId, name) { return edit(t, d => { const s = d.stages.find(x => x.id === stageId); const g = s && s.groups.find(x => x.id === groupId); if (g) g.name = name; }); }
export function renameRound(t, stageId, roundId, name) { return edit(t, d => { const s = d.stages.find(x => x.id === stageId); const r = s && s.rounds.find(x => x.id === roundId); if (r) r.name = name; }); }
export function addRound(t, stageId) { return edit(t, d => { const s = d.stages.find(x => x.id === stageId); if (s) s.rounds.push({ id: uid("r"), name: "Round " + (s.rounds.length + 1), matches: [] }); }); }
export function removeRound(t, stageId, roundId) {
  return edit(t, d => {
    const s = d.stages.find(x => x.id === stageId); if (!s) return;
    const r = s.rounds.find(x => x.id === roundId); if (!r) return;
    const ids = r.matches.map(m => m.id);
    s.rounds = s.rounds.filter(x => x.id !== roundId);
    allMatches(d).forEach(({ m }) => ["home", "away"].forEach(side => { const sl = m[side]; if (sl && (ids.includes(sl.win) || ids.includes(sl.lose))) m[side] = null; }));
  });
}
export function removeStage(t, stageId) { return edit(t, d => { d.stages = d.stages.filter(s => s.id !== stageId); }); }
export function addStage(t, kind) {
  return edit(t, d => {
    const ids = d.teams.map(x => x.id);
    if (kind === "group") d.stages.push(makeGroupStage({ name: "Group stage", groups: [{ name: "", teamIds: ids }], legs: 1, advance: 2 }));
    else if (kind === "ko-groups") { const gs = [...d.stages].reverse().find(s => s.type === "group"); if (gs) d.stages.push(knockoutFromGroups(gs)); }
    else d.stages.push(makeKnockout({ entrants: ids.map(id => ({ team: id })) }));
  });
}
// Everything a match slot can be set to, from the point of view of one match.
export function slotOptions(t, matchId) {
  const opts = [{ v: "", label: "— Bye / empty —" }];
  t.teams.forEach(x => opts.push({ v: "t:" + x.id, label: x.name, group: "Teams" }));
  t.stages.forEach(s => s.type === "group" && s.groups.forEach(g => {
    for (let p = 1; p <= Math.max(1, g.teamIds.length); p++) opts.push({ v: "r:" + g.id + ":" + p, label: g.name + " · " + ordinal(p), group: "Group places" });
  }));
  let seen = false;
  for (const s of t.stages) {
    if (s.type === "group") continue;
    for (const r of s.rounds) for (const m of r.matches) {
      if (m.id === matchId) { seen = true; continue; }
      if (seen) continue;
      opts.push({ v: "w:" + m.id, label: "Winner " + matchLabel(t, m.id), group: "Earlier matches" });
      opts.push({ v: "l:" + m.id, label: "Loser " + matchLabel(t, m.id), group: "Earlier matches" });
    }
  }
  return opts;
}
export function slotValue(slot) {
  if (!slot) return ""; if (slot.team) return "t:" + slot.team;
  if (slot.rank) return "r:" + slot.rank.group + ":" + slot.rank.pos;
  if (slot.win) return "w:" + slot.win; if (slot.lose) return "l:" + slot.lose; return "";
}
export function parseSlot(v) {
  if (!v) return null;
  const [k, a, b] = v.split(":");
  return k === "t" ? { team: a } : k === "r" ? { rank: { group: a, pos: +b } } : k === "w" ? { win: a } : { lose: a };
}
