import { cleanTeamName } from "./names.js";
import { ScorerPanel, useScorers } from "./scorers.js";
const { useState } = React;
// ── TEAM DETAIL PANEL ─────────────────────────────────────────────────────────
export function TeamDetail({ team, teamIdx, teams, fixtures, onClose, leagueId, aliases, archiveScorers, phase }) {
  const mine = fixtures.filter(f => f.homeIdx === teamIdx || f.awayIdx === teamIdx);

  const sorted = [...mine].sort((a, b) => {
    const wa = a.week ?? 99999, wb = b.week ?? 99999;
    return wa - wb;
  });

  // Compute home/away stats from played fixtures
  const homePlayed = mine.filter(f => f.homeIdx === teamIdx && f.played && f.homeScore != null);
  const awayPlayed = mine.filter(f => f.awayIdx === teamIdx && f.played && f.homeScore != null);

  const homeWins  = homePlayed.filter(f => +f.homeScore > +f.awayScore).length;
  const awayWins  = awayPlayed.filter(f => +f.awayScore > +f.homeScore).length;
  const homeWinPct = homePlayed.length ? Math.round(homeWins / homePlayed.length * 100) : null;
  const awayWinPct = awayPlayed.length ? Math.round(awayWins / awayPlayed.length * 100) : null;

  const avgFmt = (arr, fn) => arr.length ? (arr.reduce((s, f) => s + fn(f), 0) / arr.length).toFixed(1) : null;
  const homeGFavg  = avgFmt(homePlayed, f => +f.homeScore);
  const homeGAavg  = avgFmt(homePlayed, f => +f.awayScore);
  const awayGFavg  = avgFmt(awayPlayed, f => +f.awayScore);
  const awayGAavg  = avgFmt(awayPlayed, f => +f.homeScore);

  function resColor(f) {
    const home = f.homeIdx === teamIdx;
    const hg = +f.homeScore, ag = +f.awayScore;
    if (hg === ag) return "#facc15";
    return (home ? hg > ag : ag > hg) ? "#4ade80" : "#f87171";
  }

  function HaBadge({ isHome }) {
    const col = isHome ? "#22d3ee" : "#a78bfa";
    const bg = isHome ? "rgba(34,211,238,.1)" : "rgba(167,139,250,.1)";
    return (
      <span className="ha-badge" style={{ color: col, background: bg, border: "1px solid " + col }}>
        {isHome ? "HOME" : "AWAY"}
      </span>
    );
  }

  const hasStats = homePlayed.length > 0 || awayPlayed.length > 0;

  // Toughest/weakest opponent — GD vs each opponent across all played games
  const oppStats = (() => {
    const byOpp = {};
    mine.filter(f => f.played && f.homeScore != null).forEach(f => {
      const isHome = f.homeIdx === teamIdx;
      const oppIdx = isHome ? f.awayIdx : f.homeIdx;
      const oppName = teams[oppIdx]?.name || "Unknown";
      const gf = isHome ? +f.homeScore : +f.awayScore;
      const ga = isHome ? +f.awayScore : +f.homeScore;
      if (!byOpp[oppName]) byOpp[oppName] = { gf: 0, ga: 0, games: 0 };
      byOpp[oppName].gf += gf;
      byOpp[oppName].ga += ga;
      byOpp[oppName].games++;
    });
    return Object.entries(byOpp).map(([name, s]) => ({ name, gd: s.gf - s.ga, gf: s.gf, ga: s.ga, games: s.games }));
  })();
  const toughest = oppStats.length > 0 ? oppStats.reduce((a, b) => a.gd < b.gd ? a : b) : null;
  const weakest  = oppStats.length > 1 ? oppStats.reduce((a, b) => a.gd > b.gd ? a : b) : null;

  // Best and worst individual fixtures by GD for selected team
  const playedWithScore = mine.filter(f => f.played && f.homeScore != null);
  const fixtureGD = playedWithScore.map(f => {
    const isHome = f.homeIdx === teamIdx;
    const gf = isHome ? +f.homeScore : +f.awayScore;
    const ga = isHome ? +f.awayScore : +f.homeScore;
    const opp = isHome ? teams[f.awayIdx]?.name : teams[f.homeIdx]?.name;
    return { f, gd: gf - ga, gf, ga, opp, isHome };
  });

  // Worst: lowest GD, tie-broken by lowest GF first
  const worstGD = fixtureGD.length > 0 ? Math.min(...fixtureGD.map(x => x.gd)) : null;
  const worstFixtures = worstGD != null
    ? fixtureGD.filter(x => x.gd === worstGD).sort((a, b) => a.gf - b.gf)
    : [];

  // Best: highest GD, tie-broken by highest GF first
  const bestGD = fixtureGD.length > 0 ? Math.max(...fixtureGD.map(x => x.gd)) : null;
  const bestFixtures = bestGD != null
    ? fixtureGD.filter(x => x.gd === bestGD).sort((a, b) => b.gf - a.gf)
    : [];

  function StatRow({ label, homeVal, awayVal, color }) {
    return (
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: ".3rem", padding: ".28rem 0", borderBottom: "1px solid #1c1f27", fontSize: ".78rem", alignItems: "center" }}>
        <span style={{ fontFamily: "DM Mono,monospace", fontSize: ".68rem", color: "#5a6070" }}>{label}</span>
        <span style={{ textAlign: "center", fontFamily: "DM Mono,monospace", fontWeight: 600, color: homeVal != null ? color : "#3a3f50" }}>{homeVal != null ? homeVal : "—"}</span>
        <span style={{ textAlign: "center", fontFamily: "DM Mono,monospace", fontWeight: 600, color: awayVal != null ? color : "#3a3f50" }}>{awayVal != null ? awayVal : "—"}</span>
      </div>
    );
  }

  return (
    <>
      <div className="detail-overlay" onClick={onClose} />
      <div className="detail-panel">
        <div className="detail-h">
          <h3>{cleanTeamName(team?.name)}</h3>
          <button className="detail-close" onClick={onClose}>✕</button>
        </div>

        <div className="detail-cols" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", alignItems: "start" }}>

          {/* Left column: stats */}
          <div>
            <div className="detail-sec" style={{ marginBottom: ".5rem" }}>Statistics</div>
            {!hasStats && <div className="muted" style={{ fontSize: ".8rem" }}>No played games yet.</div>}
            {hasStats && (
              <div>
                {/* Header row */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: ".3rem", padding: ".2rem 0", marginBottom: ".15rem" }}>
                  <span></span>
                  <span style={{ textAlign: "center", fontFamily: "DM Mono,monospace", fontSize: ".65rem", color: "#22d3ee", fontWeight: 700 }}>HOME</span>
                  <span style={{ textAlign: "center", fontFamily: "DM Mono,monospace", fontSize: ".65rem", color: "#a78bfa", fontWeight: 700 }}>AWAY</span>
                </div>
                <StatRow label="Games" homeVal={homePlayed.length || null} awayVal={awayPlayed.length || null} color="#d4d8e0" />
                <StatRow label="Win %" homeVal={homeWinPct != null ? homeWinPct + "%" : null} awayVal={awayWinPct != null ? awayWinPct + "%" : null} color="#4ade80" />
                <StatRow label="Avg GF" homeVal={homeGFavg} awayVal={awayGFavg} color="#4ade80" />
                <StatRow label="Avg GA" homeVal={homeGAavg} awayVal={awayGAavg} color="#f87171" />
                {(toughest || weakest) && (
                  <div style={{ marginTop: ".6rem", borderTop: "1px solid #1c1f27", paddingTop: ".45rem" }}>
                    {oppStats.length > 0 && (() => {
                      const [oppOpen, setOppOpen] = useState(false);
                      const sorted = [...oppStats].sort((a, b) => a.gd - b.gd);
                      return (
                        <div>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: ".25rem 0", cursor: "pointer", userSelect: "none" }}
                            onClick={() => setOppOpen(o => !o)}>
                            <span style={{ fontFamily: "DM Mono,monospace", fontSize: ".68rem", color: "#5a6070" }}>
                              Opponents {oppOpen ? "▲" : "▼"}
                            </span>
                            {!oppOpen && toughest && (
                              <span style={{ fontSize: ".78rem" }}>
                                <span style={{ color: "#f87171", fontWeight: 600 }}>{cleanTeamName(toughest.name)}</span>
                                <span style={{ fontFamily: "DM Mono,monospace", fontSize: ".7rem", color: "#3a3f50", marginLeft: ".3rem" }}>{toughest.gd > 0 ? "+" : ""}{toughest.gd}</span>
                                {weakest && weakest.name !== toughest.name && (
                                  <span style={{ marginLeft: ".5rem" }}>
                                    <span style={{ color: "#4ade80", fontWeight: 600 }}>{cleanTeamName(weakest.name)}</span>
                                    <span style={{ fontFamily: "DM Mono,monospace", fontSize: ".7rem", color: "#3a3f50", marginLeft: ".3rem" }}>{weakest.gd > 0 ? "+" : ""}{weakest.gd}</span>
                                  </span>
                                )}
                              </span>
                            )}
                          </div>
                          {oppOpen && (
                            <div style={{ borderTop: "1px solid #1c1f27", paddingTop: ".25rem" }}>
                              {sorted.map((o, i) => (
                                <div key={o.name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: ".2rem 0", borderBottom: i < sorted.length-1 ? "1px solid #1c1f27" : "none" }}>
                                  <span style={{ fontFamily: "DM Mono,monospace", fontSize: ".65rem", color: "#3a3f50", minWidth: "1.4rem" }}>{i+1}.</span>
                                  <span style={{ flex: 1, fontSize: ".78rem", color: o.gd < 0 ? "#f87171" : o.gd > 0 ? "#4ade80" : "#d4d8e0", fontWeight: 600 }}>{cleanTeamName(o.name)}</span>
                                  <span style={{ fontFamily: "DM Mono,monospace", fontSize: ".72rem", color: "#3a3f50" }}>{o.gd > 0 ? "+" : ""}{o.gd} GD</span>
                                  <span style={{ fontFamily: "DM Mono,monospace", fontSize: ".68rem", color: "#3a3f50", marginLeft: ".35rem" }}>({o.games}g)</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                )}
                {(bestFixtures.length > 0 || worstFixtures.length > 0) && (
                  <div style={{ marginTop: ".6rem", borderTop: "1px solid #1c1f27", paddingTop: ".45rem" }}>
                    {bestFixtures.map((x, i) => (
                      <div key={x.f.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: ".22rem 0", borderBottom: i < bestFixtures.length - 1 ? "1px solid #1c1f27" : "none" }}>
                        {i === 0 && <span style={{ fontFamily: "DM Mono,monospace", fontSize: ".68rem", color: "#5a6070", minWidth: "3rem" }}>Best</span>}
                        {i > 0 && <span style={{ minWidth: "3rem" }} />}
                        <span style={{ flex: 1, fontSize: ".78rem", color: "#4ade80", fontWeight: 600 }}>{x.opp}</span>
                        <span style={{ fontFamily: "DM Mono,monospace", fontSize: ".75rem", color: "#4ade80" }}>{x.gf}—{x.ga}</span>
                        <span style={{ fontFamily: "DM Mono,monospace", fontSize: ".7rem", color: "#3a3f50", marginLeft: ".4rem" }}>{x.gd > 0 ? "+" : ""}{x.gd}</span>
                      </div>
                    ))}
                    {worstFixtures.map((x, i) => (
                      <div key={x.f.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: ".22rem 0", borderBottom: i < worstFixtures.length - 1 ? "1px solid #1c1f27" : "none", marginTop: bestFixtures.length > 0 && i === 0 ? ".35rem" : 0 }}>
                        {i === 0 && <span style={{ fontFamily: "DM Mono,monospace", fontSize: ".68rem", color: "#5a6070", minWidth: "3rem" }}>Worst</span>}
                        {i > 0 && <span style={{ minWidth: "3rem" }} />}
                        <span style={{ flex: 1, fontSize: ".78rem", color: "#f87171", fontWeight: 600 }}>{x.opp}</span>
                        <span style={{ fontFamily: "DM Mono,monospace", fontSize: ".75rem", color: "#f87171" }}>{x.gf}—{x.ga}</span>
                        <span style={{ fontFamily: "DM Mono,monospace", fontSize: ".7rem", color: "#3a3f50", marginLeft: ".4rem" }}>{x.gd > 0 ? "+" : ""}{x.gd}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right column: fixture list */}
          <div>
            <div className="detail-sec" style={{ marginBottom: ".5rem" }}>
              Fixtures ({mine.filter(f => f.played).length} played, {mine.filter(f => !f.played).length} pending)
            </div>
            {sorted.length === 0 && <div className="empty" style={{ padding: ".5rem" }}>No fixtures yet.</div>}
            {sorted.map(f => {
              const isHome = f.homeIdx === teamIdx;
              const opp = isHome ? teams[f.awayIdx]?.name : teams[f.homeIdx]?.name;
              return (
                <div key={f.id} className="detail-match" style={{ opacity: f.played ? 1 : 0.6 }}>
                  {f.week != null && (
                    <span className="week-badge" style={{ fontSize: ".6rem", padding: ".08rem .3rem" }}>W{f.week}</span>
                  )}
                  <HaBadge isHome={isHome} />
                  <span className="detail-opp" style={{ color: f.played ? "#d4d8e0" : "#5a6070" }}>{opp}</span>
                  {f.played && f.homeScore != null
                    ? <span className="detail-score" style={{ color: resColor(f) }}>{f.homeScore}&mdash;{f.awayScore}</span>
                    : f.played
                      ? <span style={{ fontFamily: "DM Mono,monospace", fontSize: ".7rem", color: "#5a6070" }}>?—?</span>
                      : <span style={{ fontFamily: "DM Mono,monospace", fontSize: ".7rem", color: "#3a3f50" }}>pending</span>
                  }
                </div>
              );
            })}
          </div>

        </div>

        {(leagueId || (Array.isArray(archiveScorers) && archiveScorers.length > 0)) && <TeamScorers leagueId={leagueId} teamName={team?.name} aliases={aliases} archiveScorers={archiveScorers} phase={phase} />}

      </div>
    </>
  );
}

export function TeamScorers({ leagueId, teamName, aliases, archiveScorers, phase }) {
  const live = useScorers(archiveScorers !== undefined ? null : leagueId, phase);
  const scorers = archiveScorers !== undefined ? archiveScorers : live.scorers;
  const error = archiveScorers !== undefined ? false : live.error;
  return <ScorerPanel scorers={scorers} error={error} filterClub={teamName} title={cleanTeamName(teamName) + " Scorers"} maxRows={5} aliases={aliases} />;
}
