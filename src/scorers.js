import { useLang } from "./i18n.js";
import { buildClubIndex, cleanTeamName, resolveClubName } from "./names.js";
const { useState, useEffect, useMemo } = React;
// ── SCORER DATA ──────────────────────────────────────────────────────────────
export const SCORER_JSON_URL = "https://ozzyzorcopter.github.io/handball-League/scorer-data.json";

export let scorerDataCache = null;
export let scorerDataPromise = null;

export function fetchScorerData() {
  if (scorerDataCache) return Promise.resolve(scorerDataCache);
  if (scorerDataPromise) return scorerDataPromise;
  scorerDataPromise = fetch(SCORER_JSON_URL)
    .then(r => { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
    .then(data => { scorerDataCache = data; return data; })
    .catch(e => { scorerDataPromise = null; throw e; });
  return scorerDataPromise;
}

export function useScorers(leagueId, phase) {
  const [scorers, setScorers] = useState(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    if (!leagueId) { setScorers([]); return; }
    setScorers(null);
    setError(false);
    fetchScorerData()
      .then(data => {
        const ph = phase || "regular";
        const league = (data.leagues || []).find(l =>
          (l.phase || "regular") === ph &&
          (l.leagueId === leagueId || l.name === leagueId)
        );
        setScorers(league ? league.scorers : []);
      })
      .catch(() => { setError(true); setScorers([]); });
  }, [leagueId, phase]);
  return { scorers, error };
}


export function ScorerPanel({ scorers, error, filterClub, title, maxRows = 10, aliases }) {
  const { t } = useLang();
  const [expanded, setExpanded] = useState(false);
  const loading = scorers === null;

  const clubIndex = useMemo(() => buildClubIndex(scorers), [scorers]);

  const filtered = useMemo(() => {
    if (!scorers) return [];
    if (!filterClub) return scorers;
    const club = resolveClubName(filterClub, aliases, clubIndex);
    return scorers.filter(s => s.club === club);
  }, [scorers, filterClub, aliases, clubIndex]);

  const shown = expanded ? filtered : filtered.slice(0, maxRows);
  const collapsible = !loading && filtered.length > maxRows;
  // Only show stat columns that have data for at least one listed player
  // (e.g. lower divisions have no 7m / card stats).
  const cols = {
    delta: filtered.some(s => s.delta != null),
    mp: filtered.some(s => s.matchesPlayed > 0),
    sevenM: filtered.some(s => s.sevenMScored > 0 || s.sevenMMissed > 0),
    yc: filtered.some(s => s.yellowCards > 0),
    two: filtered.some(s => s.twoMinSuspensions > 0),
    bc: filtered.some(s => s.blueCards > 0),
    rc: filtered.some(s => s.redCards > 0),
  };

  return (
    <div className="mini-box" style={{ marginTop: "1rem" }}>
      <div className="mini-ttl" style={{ color: "#fbbf24", marginBottom: ".6rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span>⚽ {t(title || "Top Scorers")}</span>
        <div style={{ display: "flex", gap: ".4rem", alignItems: "center" }}>
          {loading && <span className="muted" style={{ fontSize: ".7rem", fontWeight: 400 }}>{t("loading…")}</span>}
          {error && <span style={{ color: "#f87171", fontSize: ".7rem", fontWeight: 400 }}>{t("unavailable")}</span>}
          {collapsible && (
            <button className="btn-ghost" style={{ fontSize: ".72rem", padding: ".2rem .6rem" }} onClick={() => setExpanded(e => !e)}>
              {expanded ? "▲" : "▼ " + filtered.length}
            </button>
          )}
        </div>
      </div>
      {!loading && !error && filtered.length === 0 && (
        <div className="muted" style={{ fontSize: ".78rem" }}>{t("No scorer data found.")}</div>
      )}
      {shown.length > 0 && (
        <div className="tbl-wrap">
          <table className="ltbl">
            <thead>
              <tr>
                <th style={{ width: "2rem" }}>#</th>
                <th className="tl">{t("Player")}</th>
                {!filterClub && <th className="tl" style={{ minWidth: 0 }}>{t("Club")}</th>}
                <th className="tpts" title="Goals (goals in last game)">G</th>
                {cols.delta && <th title="Goals since previous update">+/-</th>}
                {cols.mp && <th title="Matches played">MP</th>}
                {cols.mp && <th title="Goals per game">Avg</th>}
                {cols.sevenM && <th title="7m scored / attempted">7m</th>}
                {cols.yc && <th title="Yellow cards">🟨</th>}
                {cols.two && <th title="2-minute suspensions">2'</th>}
                {cols.bc && <th title="Blue cards">🟦</th>}
                {cols.rc && <th title="Red cards">🟥</th>}
              </tr>
            </thead>
            <tbody>
              {shown.map((s, i) => (
                <tr key={i}>
                  <td className="tpos">{i < 3 ? ["🥇","🥈","🥉"][i] : (i + 1)}</td>
                  <td className="tl">{s.player}</td>
                  {!filterClub && <td className="tl" style={{ fontFamily: "DM Sans,sans-serif", fontWeight: 400, color: "#6b7280", fontSize: ".72rem" }}>{cleanTeamName(s.club || "")}</td>}
                  <td className="tpts" style={{ color: "#fbbf24" }}>
                    {s.goals}
                    {s.lastGameGoals != null && (
                      <span style={{ fontSize: ".68rem", marginLeft: ".2rem", color: "#9ca3af", fontWeight: 400 }}>({s.lastGameGoals})</span>
                    )}
                  </td>
                  {cols.delta && <td style={{ color: s.delta > 0 ? "#4ade80" : "#5a6070" }}>{s.delta != null ? (s.delta > 0 ? "+" : "") + s.delta : ""}</td>}
                  {cols.mp && <td>{s.matchesPlayed > 0 ? s.matchesPlayed : ""}</td>}
                  {cols.mp && <td>{s.matchesPlayed > 0 ? (s.goals / s.matchesPlayed).toFixed(2) : ""}</td>}
                  {cols.sevenM && <td>{(s.sevenMScored > 0 || s.sevenMMissed > 0) ? `${s.sevenMScored || 0}/${(s.sevenMScored || 0) + (s.sevenMMissed || 0)}` : ""}</td>}
                  {cols.yc && <td>{s.yellowCards > 0 ? s.yellowCards : ""}</td>}
                  {cols.two && <td>{s.twoMinSuspensions > 0 ? s.twoMinSuspensions : ""}</td>}
                  {cols.bc && <td>{s.blueCards > 0 ? s.blueCards : ""}</td>}
                  {cols.rc && <td>{s.redCards > 0 ? s.redCards : ""}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {collapsible && (
        <div style={{ marginTop: ".4rem", textAlign: "center" }}>
          <button className="btn-ghost" style={{ fontSize: ".72rem", padding: ".2rem .6rem" }} onClick={() => setExpanded(e => !e)}>
            {expanded ? "Show less ▲" : "Show all " + filtered.length + " ▼"}
          </button>
        </div>
      )}
    </div>
  );
}
