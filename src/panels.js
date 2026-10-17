import { useLang } from "./i18n.js";
import { MEDALS } from "./config.js";
import { buildClubIndex, cleanTeamName, resolveClubName } from "./names.js";
import { ScorerPanel, useScorers } from "./scorers.js";
const { useState, useMemo } = React;
export function ToughPanel({ ranking }) {
  const { t } = useLang();
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? ranking : ranking.slice(0, 5);
  return (
    <div className="mini-box" style={{ marginTop: "1rem" }}>
      <div className="mini-ttl" style={{ color: "#f87171", marginBottom: ".6rem" }}>{t("💀 Toughest Teams")}</div>
      <div style={{ fontSize: ".72rem", color: "#4a5060", marginBottom: ".6rem" }}>{t("How tough a team is to beat.")}</div>
      {shown.map((r, i) => (
        <div key={r.id} className="mini-row">
          <span className="mini-pos" style={{ minWidth: "1.8rem", color: i < 3 ? "#f87171" : "#3a3f50" }}>{i < 3 ? MEDALS[i] : (i+1)+"."}</span>
          <span className="mini-name">{cleanTeamName(r.name)}</span>
          <span className="mini-val" style={{ color: "#f87171" }}>{r.pts} {t("pts")}</span>
        </div>
      ))}
      {ranking.length > 5 && (
        <div style={{ marginTop: ".4rem", textAlign: "center" }}>
          <button className="btn-ghost" style={{ fontSize: ".72rem", padding: ".2rem .6rem" }} onClick={() => setExpanded(e => !e)}>
            {expanded ? t("Show less") + " ▲" : t("Show all") + " " + ranking.length + " ▼"}
          </button>
        </div>
      )}
      <div style={{ fontSize: ".7rem", color: "#4a5060", marginTop: ".75rem", lineHeight: "1.4", borderTop: "1px solid #1c1f27", paddingTop: ".6rem" }}>
        {t("Comparison for teams by other teams. Decided by total GD over Home and Away Fixture.")}
      </div>
    </div>
  );
}

export function LeagueScorers({ leagueId, teams, aliases, archiveScorers, phaseTeams, phase, title, maxRows }) {
  const live = useScorers(archiveScorers !== undefined ? null : leagueId, phase);
  const scorers = archiveScorers !== undefined ? archiveScorers : live.scorers;
  const error = archiveScorers !== undefined ? false : live.error;
  const relevantTeams = phaseTeams || teams;
  const clubIndex = useMemo(() => buildClubIndex(scorers), [scorers]);
  const clubNames = useMemo(() => new Set(relevantTeams.map(t => resolveClubName(t.name, aliases, clubIndex))), [relevantTeams, aliases, clubIndex]);
  const filtered = useMemo(() => scorers ? scorers.filter(s => clubNames.has(s.club)) : null, [scorers, clubNames]);
  return <ScorerPanel scorers={filtered} error={error} title={title || "Top Scorers"} maxRows={maxRows || 10} aliases={aliases} />;
}
