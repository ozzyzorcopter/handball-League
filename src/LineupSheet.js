// Line-up of a played game: both teams with shirt numbers, goals, 7m, cards, staff and captain.
// Data comes from data/lineups/<league>.json (written by the fetch workflow from the Clubee line-up page).
import { DATA_BASE } from "./vhvData.js";
import { useLang } from "./i18n.js";
import { cleanTeamName } from "./names.js";
import { matchStamp } from "./weeks.js";
const { useState, useEffect } = React;

const cache = new Map();   // league id -> Promise of { gameId: [homeTeam, awayTeam] } (or null)
function loadLineups(leagueId) {
  const id = String(leagueId);
  if (!cache.has(id)) {
    cache.set(id, fetch(DATA_BASE + "lineups/" + encodeURIComponent(id) + ".json")
      .then(r => { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
      .catch(() => { cache.delete(id); return null; }));
  }
  return cache.get(id);
}

function Cards({ p }) {
  const bits = [];
  if (p.yc) bits.push(<span key="y" className="lu-card lu-y" title="Yellow card">{p.yc > 1 ? p.yc : ""}</span>);
  if (p.m2) bits.push(<span key="m" className="lu-2m" title="2-minute suspension">{p.m2}×2′</span>);
  if (p.bc) bits.push(<span key="b" className="lu-card lu-b" title="Blue card">{p.bc > 1 ? p.bc : ""}</span>);
  if (p.rc) bits.push(<span key="r" className="lu-card lu-r" title="Red card">{p.rc > 1 ? p.rc : ""}</span>);
  return bits.length ? <span className="lu-cards">{bits}</span> : null;
}

function TeamBlock({ team, name, score, win }) {
  const { t } = useLang();
  const total = team.players.reduce((s, p) => s + p.g, 0);
  return (
    <div className="lu-team">
      <div className="lu-team-h">
        <span className="lu-team-name">{name}</span>
        <span className={"lu-team-score" + (win ? " win" : "")}>{score}</span>
      </div>
      <table className="lu-tbl">
        <thead><tr><th>#</th><th className="tl">{t("Player")}</th><th title={t("Goals")}>G</th><th title={t("7m goals / shots")}>7m</th></tr></thead>
        <tbody>
          {[...team.players].sort((a, b) => (a.n ?? 999) - (b.n ?? 999)).map((p, i) => (
            <tr key={i} className={p.g > 0 ? "" : "lu-quiet"}>
              <td className="lu-n">{p.n ?? ""}</td>
              <td className="tl lu-name">{p.name}<Cards p={p} />{team.captain && team.captain === p.name && <span className="lu-cap" title={t("Team captain")}>C</span>}</td>
              <td className="lu-g">{p.g || "–"}</td>
              <td className="lu-7">{p.s7 + p.m7 > 0 ? p.s7 + "/" + (p.s7 + p.m7) : "–"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {total !== +score && <div className="muted lu-note">{t("The line-up lists")} {total} {t("goals")}</div>}
      {(team.staff || []).length > 0 && (
        <div className="lu-staff">
          {team.staff.map((s, i) => <div key={i}><span>{s.name}</span> <span className="muted">· {s.role}</span></div>)}
        </div>
      )}
      {team.captain && <div className="lu-staff"><span className="muted">{t("Team captain")}:</span> {team.captain}</div>}
    </div>
  );
}

export function LineupSheet({ fixture, teams, leagueId, onClose }) {
  const { t } = useLang();
  const [data, setData] = useState(undefined);   // undefined = loading, null = unavailable
  useEffect(() => {
    let dead = false;
    if (!leagueId || !fixture.gameId) { setData(null); return; }
    loadLineups(leagueId).then(d => { if (!dead) setData(d && d[fixture.gameId] ? d[fixture.gameId] : null); });
    return () => { dead = true; };
  }, [leagueId, fixture.gameId]);
  const hn = cleanTeamName(teams[fixture.homeIdx]?.name) || "?";
  const an = cleanTeamName(teams[fixture.awayIdx]?.name) || "?";
  const hs = +fixture.homeScore, as_ = +fixture.awayScore;
  return (
    <>
      <div className="detail-overlay lu-over" onClick={onClose} />
      <div className="detail-panel lu-panel" role="dialog" aria-modal="true" aria-label={t("Line-up")}>
        <div className="sheet-grip"><span /></div>
        <div className="detail-h">
          <h3>{t("Line-up")}</h3>
          <button className="detail-close" aria-label={t("Close")} onClick={onClose}>✕</button>
        </div>
        <div className="lu-head">
          <span className="lu-hn">{hn}</span>
          <span className="lu-hscore">{fixture.homeScore} – {fixture.awayScore}</span>
          <span className="lu-hn">{an}</span>
        </div>
        {matchStamp(fixture) && <div className="muted lu-when">{matchStamp(fixture)}</div>}
        {data === undefined && <div className="muted" style={{ padding: "1rem 0" }}>{t("Loading…")}</div>}
        {data === null && <div className="muted" style={{ padding: "1rem 0" }}>{t("No line-up available for this game yet.")}</div>}
        {data && (
          <div className="lu-cols">
            {data[0] && <TeamBlock team={data[0]} name={hn} score={hs} win={hs > as_} />}
            {data[1] && <TeamBlock team={data[1]} name={an} score={as_} win={as_ > hs} />}
          </div>
        )}
        <div className="muted lu-legend">G {t("goals")} · 7m {t("scored / taken")} · 🟨 {t("yellow")} · 2′ {t("2 minutes")} · 🟦 {t("blue")} · 🟥 {t("red")}</div>
      </div>
    </>
  );
}
