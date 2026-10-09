// Followed teams (saved in this browser) and the per-team snapshot shown on Home.
const { useState, useEffect } = React;
import { calcStats } from "./standings.js";
import { cleanTeamName } from "./names.js";

// ── FOLLOWED TEAMS ────────────────────────────────────────────────────────────
// Stored in this browser only (no account). A team is identified by
// "<leagueSerieId>:<teamId>"; following a whole club = following each of its teams.
const FOLLOW_KEY = "leaguesim.follow.v1";
const followListeners = new Set();
function readFollow() {
  try {
    const v = JSON.parse(localStorage.getItem(FOLLOW_KEY));
    return { main: v && v.main ? v.main : null, ids: v && Array.isArray(v.ids) ? v.ids : [] };
  } catch { return { main: null, ids: [] }; }
}
function writeFollow(next) {
  try { localStorage.setItem(FOLLOW_KEY, JSON.stringify(next)); } catch {}
  followListeners.forEach(fn => fn(next));
}
export function teamKey(leagueId, teamId) { return leagueId + ":" + teamId; }
export function useFollow() {
  const [state, setState] = useState(readFollow);
  useEffect(() => {
    followListeners.add(setState);
    const onStorage = e => { if (e.key === FOLLOW_KEY) setState(readFollow()); };
    window.addEventListener("storage", onStorage);
    return () => { followListeners.delete(setState); window.removeEventListener("storage", onStorage); };
  }, []);
  const toggle = key => {
    const cur = readFollow();
    const ids = cur.ids.includes(key) ? cur.ids.filter(k => k !== key) : [...cur.ids, key];
    const main = ids.includes(cur.main) ? cur.main : (ids[0] || null);
    writeFollow({ main, ids });
  };
  const setMain = key => {
    const cur = readFollow();
    writeFollow({ main: key, ids: cur.ids.includes(key) ? cur.ids : [...cur.ids, key] });
  };
  return { main: state.main, ids: state.ids, isFollowing: key => state.ids.includes(key), toggle, setMain };
}

// Position, points, last-5 form and next match for one team of a Belgian league.
export function teamSnapshot(league, teamId) {
  const teams = league.teams || [], fixtures = league.fixtures || [];
  const rows = calcStats(teams, fixtures, league.ranking || []);
  const pos = rows.findIndex(r => r.id === teamId);
  if (pos < 0) return null;
  const idx = teams.findIndex(t => t.id === teamId);
  const byDate = (a, b) => ((a.date || "") < (b.date || "") ? -1 : (a.date || "") > (b.date || "") ? 1 : 0);
  const mine = fixtures.filter(f => f.homeIdx === idx || f.awayIdx === idx);
  const form = mine
    .filter(f => f.played && f.homeScore != null && f.awayScore != null)
    .sort(byDate)
    .map(f => {
      const home = f.homeIdx === idx;
      const gf = +(home ? f.homeScore : f.awayScore), ga = +(home ? f.awayScore : f.homeScore);
      return gf > ga ? "W" : gf < ga ? "L" : "D";
    })
    .slice(-5);
  const today = new Date().toISOString().slice(0, 10);
  const nextFx = mine.filter(f => !f.played && (!f.date || f.date.slice(0, 10) >= today)).sort(byDate)[0];
  let next = null;
  if (nextFx) {
    const home = nextFx.homeIdx === idx;
    const opp = teams[home ? nextFx.awayIdx : nextFx.homeIdx];
    next = { date: nextFx.date || null, home, opp: opp ? cleanTeamName(opp.name) : "?" };
  }
  return { name: cleanTeamName(rows[pos].name), pos: pos + 1, of: rows.length, pts: rows[pos].totalPts, form, next };
}

