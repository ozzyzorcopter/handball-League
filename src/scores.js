import { cleanTeamName } from "./names.js";
import { useLang } from "./i18n.js";
import { calcStats } from "./standings.js";
import { modelProbs } from "./probabilities.js";
import { runMCAsync } from "./mcRunner.js";
import { fmtPct, heatColor } from "./format.js";
import { resolveRef } from "./tournament.js";
import { ProbBar } from "./ProbBar.js";
const { useState, useMemo, useRef, useEffect } = React;
// ── SCORE ROW ─────────────────────────────────────────────────────────────────
export function ScoreRow({ f, teams, liveP, settings, onConfirm, onUndo, onOverride, onTeamClick, onWeekChange }) {
  const [hg, setHg] = useState("");
  const [ag, setAg] = useState("");
  const hn = cleanTeamName(teams[f.homeIdx]?.name) || "?";
  const an = cleanTeamName(teams[f.awayIdx]?.name) || "?";
  const ws = settings?.winScore || 30;
  const ls = settings?.lossScore || 25;
  const ds = settings?.drawScore || 25;
  const probs = (f.overrideOn && f.ovHW !== "") ? { homeWin: parseFloat(f.ovHW) || 0, draw: parseFloat(f.ovD) || 0, awayWin: parseFloat(f.ovAW) || 0 } : (liveP || f);

  if (f.played && f.homeScore == null) {
    // Game has been played but score not entered in Clubee — show as completed with unknown score
    return (
      <div className="outcome done">
        {f.week != null && <span className="week-badge" style={{ fontSize: ".6rem" }}>W{f.week}</span>}
        <div className="oteams">
          <button className="otbtn" onClick={() => onTeamClick && onTeamClick(f.homeIdx)}>{hn}</button>
          <span className="vs">vs</span>
          <button className="otbtn" onClick={() => onTeamClick && onTeamClick(f.awayIdx)}>{an}</button>
        </div>
        <div className="score-done">
          <span style={{ color: "#5a6070" }}>?</span>
          <span className="score-sep">&mdash;</span>
          <span style={{ color: "#5a6070" }}>?</span>
        </div>
        <span className="res-lbl" style={{ color: "#5a6070" }}>Played</span>
        {onUndo && <button className="btn-undo" onClick={() => onUndo(f.id)}>↩ Undo</button>}
      </div>
    );
  }

  if (f.played && f.homeScore != null) {
    const hs = +f.homeScore, as_ = +f.awayScore;
    const res = hs > as_ ? "home" : hs < as_ ? "away" : "draw";
    const lbl = res === "home" ? hn + " Win" : res === "away" ? an + " Win" : "Draw";
    const col = res === "home" ? "#4ade80" : res === "away" ? "#f87171" : "#facc15";
    return (
      <div className="outcome done">
        {f.week != null && <span className="week-badge" style={{ fontSize: ".6rem" }}>W{f.week}</span>}
        <div className="oteams">
          <button className="otbtn" onClick={() => onTeamClick && onTeamClick(f.homeIdx)}>{hn}</button>
          <span className="vs">vs</span>
          <button className="otbtn" onClick={() => onTeamClick && onTeamClick(f.awayIdx)}>{an}</button>
        </div>
        <div className="score-done">
          <span style={{ color: res === "home" ? "#4ade80" : res === "draw" ? "#facc15" : "#d4d8e0" }}>{f.homeScore}</span>
          <span className="score-sep">&mdash;</span>
          <span style={{ color: res === "away" ? "#f87171" : res === "draw" ? "#facc15" : "#d4d8e0" }}>{f.awayScore}</span>
        </div>
        <span className="res-lbl" style={{ color: col }}>{lbl}</span>
        {onWeekChange && (
          <div style={{ display: "flex", alignItems: "center", gap: ".3rem" }}>
            <span style={{ fontFamily: "DM Mono,monospace", fontSize: ".65rem", color: "#7d8597" }}>W</span>
            <input type="number" min="1" max="999" value={f.week ?? ""} placeholder="—"
              onChange={e => onWeekChange(f.id, e.target.value === "" ? null : parseInt(e.target.value) || null)}
              style={{ width: "2.8rem", textAlign: "center", padding: ".2rem .25rem", fontFamily: "DM Mono,monospace", fontSize: ".78rem", background: "#0d1117", border: "1px solid #252830", color: "#22d3ee", borderRadius: "4px", outline: "none" }} />
          </div>
        )}
        {onUndo && <button className="btn-undo" onClick={() => onUndo(f.id)}>↩ Undo</button>}
      </div>
    );
  }

  const readOnly = !onConfirm;
  const ovrTotal = (parseFloat(f.ovHW) || 0) + (parseFloat(f.ovD) || 0) + (parseFloat(f.ovAW) || 0);
  const ovrOk = !f.overrideOn || Math.abs(ovrTotal - 100) <= 0.5;

  return (
    <div className="outcome" style={{ flexDirection: "column", alignItems: "stretch", gap: ".42rem" }}>
      <div style={{ display: "flex", alignItems: "center", gap: ".5rem", flexWrap: "wrap" }}>
        <div className="oteams">
          <button className="otbtn" onClick={() => onTeamClick && onTeamClick(f.homeIdx)}>{hn}</button>
          <span className="vs">vs</span>
          <button className="otbtn" onClick={() => onTeamClick && onTeamClick(f.awayIdx)}>{an}</button>
        </div>
        {readOnly ? (
          <ProbBar h={probs.homeWin} d={probs.draw} a={probs.awayWin} eh={probs.eh} ea={probs.ea} />
        ) : (
          <div className="fix-probs">
            {f.overrideOn && f.ovHW !== "" && <span className="ovr-tag">override</span>}
            <span className="ph-col">{probs.homeWin}%</span>
            <span className="pd-col">{probs.draw}%</span>
            <span className="pa-col">{probs.awayWin}%</span>
          </div>
        )}
        {onOverride && (
          <button className={"ovr-btn" + (f.overrideOn ? " active" : "")} onClick={() => onOverride(f.id, "toggle")}>
            {f.overrideOn ? "✓ Override" : "Override %"}
          </button>
        )}
        {onWeekChange && (
          <div style={{ display: "flex", alignItems: "center", gap: ".3rem", marginLeft: "auto" }}>
            <span style={{ fontFamily: "DM Mono,monospace", fontSize: ".65rem", color: "#7d8597" }}>W</span>
            <input type="number" min="1" max="999" value={f.week ?? ""} placeholder="—"
              onChange={e => onWeekChange(f.id, e.target.value === "" ? null : parseInt(e.target.value) || null)}
              style={{ width: "2.8rem", textAlign: "center", padding: ".2rem .25rem", fontFamily: "DM Mono,monospace", fontSize: ".78rem", background: "#0d1117", border: "1px solid #252830", color: "#22d3ee", borderRadius: "4px", outline: "none" }} />
          </div>
        )}
      </div>
      {onOverride && f.overrideOn && (
        <div className="ovr-row">
          <span className="muted" style={{ fontSize: ".7rem" }}>{hn.split(" ")[0]} W:</span>
          <input className="ovr-inp" type="number" min="0" max="100" value={f.ovHW} onChange={e => onOverride(f.id, "hw", e.target.value)} placeholder="0" />
          <span className="muted">Draw:</span>
          <input className="ovr-inp" type="number" min="0" max="100" value={f.ovD} onChange={e => onOverride(f.id, "d", e.target.value)} placeholder="0" />
          <span className="muted">{an.split(" ")[0]} W:</span>
          <input className="ovr-inp" type="number" min="0" max="100" value={f.ovAW} onChange={e => onOverride(f.id, "aw", e.target.value)} placeholder="0" />
          {f.ovHW !== "" && (
            <span style={{ fontSize: ".7rem", color: ovrOk ? "#22d3ee" : "#f87171", fontFamily: "DM Mono,monospace" }}>
              {ovrTotal}% {ovrOk ? "✓" : "⚠ must = 100"}
            </span>
          )}
        </div>
      )}
      {onConfirm && <div style={{ display: "flex", alignItems: "center", gap: ".38rem", flexWrap: "wrap" }}>
        <button className="qbtn hw" onClick={() => onConfirm(f.id, ws, ls)}>{hn.split(" ")[0]} W</button>
        <button className="qbtn dr" onClick={() => onConfirm(f.id, ds, ds)}>Draw</button>
        <button className="qbtn aw" onClick={() => onConfirm(f.id, ls, ws)}>{an.split(" ")[0]} W</button>
        <input className="score-inp" type="number" min="0" value={hg} onChange={e => setHg(e.target.value)} placeholder="0" />
        <span className="score-sep">&mdash;</span>
        <input className="score-inp" type="number" min="0" value={ag} onChange={e => setAg(e.target.value)} placeholder="0" />
        <button className="confirm-btn" disabled={hg === "" || ag === ""} onClick={() => { if (hg !== "" && ag !== "") onConfirm(f.id, +hg, +ag); }}>Confirm</button>
      </div>}
    </div>
  );
}

// ── MONTE CARLO TAB ───────────────────────────────────────────────────────────
export function MCTab({ teams, fixtures, settings, highlightTop, highlightBottom, onConfirmed, ranking, model = "rank" }) {
  const { t: tr } = useLang();
  const [results, setResults] = useState(null);
  const [running, setRunning] = useState(false);
  const pending = fixtures.filter(f => !f.played);

  // The League Table tab shows points recomputed from actual played-game
  // results (via calcStats) rather than each team's raw `.points` field —
  // those two can genuinely disagree (e.g. if points were seeded from a
  // ranking scrape that doesn't match the games actually recorded). The
  // League Table's number is the one that matches real standings, so use
  // the SAME recomputed points here — both for display and, more
  // importantly, as the baseline the simulation itself starts from
  // (runMC below adds simulated results on top of teams[].points).
  const teams_ = useMemo(() => {
    const rows = calcStats(teams, fixtures, ranking);
    const ptsById = Object.fromEntries(rows.map(r => [r.id, r.totalPts]));
    return teams.map(t => (t.id in ptsById ? { ...t, points: ptsById[t.id] } : t));
  }, [teams, fixtures, ranking]);

  // Use a ref so the effect closure always reads the latest value
  // without needing it as a dependency (which would cause infinite re-runs).
  const playedFixtures = fixtures.filter(f => f.played && f.homeScore != null && f.awayScore != null);
  const pendingRef = useRef([]);
  const teamsRef = useRef([]);
  const playedRef = useRef([]);
  pendingRef.current = pending.map(f => ({ ...f, ...modelProbs(f, teams_, fixtures, settings, model) }));
  teamsRef.current = teams_;
  playedRef.current = playedFixtures;

  useEffect(() => {
    if (pendingRef.current.length === 0) { setResults(null); return; }
    setRunning(true);
    // Runs in a Web Worker so the page stays responsive while 100,000 seasons are simulated.
    const run = runMCAsync(teamsRef.current, pendingRef.current, playedRef.current);
    run.promise.then(res => {
      setResults(res);
      setRunning(false);
      if (onConfirmed) {
        const n = teamsRef.current.length;
        const ct = new Set(), cb = new Set();
        teamsRef.current.forEach((t, i) => {
          if (highlightTop && res[i].slice(0, highlightTop).reduce((a, v) => a + v, 0) > 99.9) ct.add(t.id);
          if (highlightBottom && res[i].slice(n - highlightBottom).reduce((a, v) => a + v, 0) > 99.9) cb.add(t.id);
        });
        onConfirmed(ct, cb);
      }
    }).catch(() => setRunning(false));
    return () => run.cancel();
  }, []); // runs once on mount — parent re-mounts this via key= when fixtures change

  const n = teams_.length;
  const sorted = useMemo(() => {
    if (!results) return [];
    return teams_.map((t, i) => ({ ...t, idx: i, avg: results[i].reduce((s, p, pos) => s + (p / 100) * (pos + 1), 0) })).sort((a, b) => a.avg - b.avg);
  }, [results, teams_]);

  return (
    <div>
      {running && <div className="empty">{tr("Running 100,000 simulations…")}</div>}
      {!running && pending.length === 0 && <div className="empty">{tr("All fixtures played — nothing to simulate.")}</div>}
      {!running && results && (
        <div>
          <div className="tbl-wrap">
            <table className="stbl">
              <thead>
                <tr>
                  <th className="tl">{tr("Team")}</th>
                  <th>{tr("Pts")}</th>
                  {Array.from({ length: n }, (_, i) => <th key={i}>#{i + 1}</th>)}
                </tr>
              </thead>
              <tbody>
                {sorted.map(t => (
                  <tr key={t.idx}>
                    <td className="tl">{cleanTeamName(t.name)}</td>
                    <td className="dm">{t.points}</td>
                    {results[t.idx].map((p, pos) => (
                      <td key={pos} style={{ background: heatColor(p) }}>{fmtPct(p)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="legend">
            <span className="muted" style={{ fontSize: ".7rem" }}>{tr("Low")}</span>
            <div className="leg-grad" />
            <span className="muted" style={{ fontSize: ".7rem" }}>{tr("High")}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ── SCORES TAB ───────────────────────────────────────────────────────────────
export function ScoresTab({ teams, fixtures, liveProbs, settings, onConfirm, onUndo, onOverride, onTeamClick, onWeekChange }) {
  const { t: tr } = useLang();
  const [selectedTeam, setSelectedTeam] = useState("all");
  const [selectedWeek, setSelectedWeek] = useState("all");

  // All unique weeks, sorted numerically
  const weeks = useMemo(() => {
    const ws = [...new Set(fixtures.map(f => f.week).filter(w => w != null))].sort((a, b) => a - b);
    return ws;
  }, [fixtures]);

  const hasWeeks = weeks.length > 0;

  const filtered = useMemo(() => {
    let fs = fixtures;
    if (selectedTeam !== "all") fs = fs.filter(f => f.homeIdx === +selectedTeam || f.awayIdx === +selectedTeam);
    if (selectedWeek !== "all") fs = fs.filter(f => f.week === +selectedWeek);
    return fs;
  }, [fixtures, selectedTeam, selectedWeek]);

  // Group by week, sorted chronologically; fixtures without week go to a separate group
  const grouped = useMemo(() => {
    const sorted = [...filtered].sort((a, b) => {
      const wa = a.week ?? 99999, wb = b.week ?? 99999;
      if (wa !== wb) return wa - wb;
      return 0;
    });
    const groups = [];
    let cur = null;
    sorted.forEach(f => {
      const w = f.week ?? null;
      if (!cur || cur.week !== w) { cur = { week: w, fixtures: [] }; groups.push(cur); }
      cur.fixtures.push(f);
    });
    return groups;
  }, [filtered]);


  return (
    <div>
      {fixtures.length === 0 && <div className="empty">{tr("No fixtures added.")}</div>}
      {fixtures.length > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: ".6rem", marginBottom: "1rem", flexWrap: "wrap" }}>
          <span className="lbl" style={{ marginBottom: 0, whiteSpace: "nowrap" }}>{tr("Team:")}</span>
          <select className="inp" style={{ maxWidth: "200px", flex: 1 }} value={selectedTeam} onChange={e => setSelectedTeam(e.target.value)}>
            <option value="all">{tr("All teams")}</option>
            {teams.map((t, i) => <option key={i} value={i}>{cleanTeamName(t.name)}</option>)}
          </select>
          {hasWeeks && (
            <>
              <span className="lbl" style={{ marginBottom: 0, whiteSpace: "nowrap" }}>{tr("Week:")}</span>
              <select className="inp" style={{ maxWidth: "120px" }} value={selectedWeek} onChange={e => setSelectedWeek(e.target.value)}>
                <option value="all">{tr("All weeks")}</option>
                {weeks.map(w => <option key={w} value={w}>{tr("Week")} {w}</option>)}
              </select>
            </>
          )}
        </div>
      )}
      {fixtures.length > 0 && filtered.length === 0 && <div className="empty">{tr("No fixtures for this selection.")}</div>}
      {(() => {
        if (selectedWeek !== "all" || !hasWeeks) {
          // Specific week selected or no weeks assigned — show all grouped normally
          return grouped.map(group => {
            const gPending = group.fixtures.filter(f => !f.played);
            const gPlayed  = group.fixtures.filter(f =>  f.played);
            return (
              <div key={group.week ?? "none"}>
                {group.week != null && <div className="week-header">{tr("Week")} {group.week}</div>}
                {gPending.map(f => (
                  <ScoreRow key={f.id} f={f} teams={teams} liveP={liveProbs[f.id]} settings={settings}
                    onConfirm={onConfirm} onUndo={onUndo} onOverride={onOverride} onTeamClick={onTeamClick} onWeekChange={onWeekChange} />
                ))}
                {gPlayed.map(f => (
                  <ScoreRow key={f.id} f={f} teams={teams} liveP={liveProbs[f.id]} settings={settings}
                    onConfirm={onConfirm} onUndo={onUndo} onOverride={onOverride} onTeamClick={onTeamClick} onWeekChange={onWeekChange} />
                ))}
              </div>
            );
          });
        }

        // "All weeks" selected with weeks assigned:
        // Split groups into: completed vs pending
        const completedGroups = grouped.filter(g => g.week != null && g.fixtures.every(f => f.played));
        const pendingGroups   = grouped.filter(g => g.week == null || !g.fixtures.every(f => f.played));
        // Last completed = highest week number that is fully done
        const lastCompleted   = completedGroups.length > 0
          ? completedGroups[completedGroups.length - 1]
          : null;
        const olderCompleted  = completedGroups.slice(0, -1).reverse(); // rest, newest first

        function renderGroup(group) {
          const gPending = group.fixtures.filter(f => !f.played);
          const gPlayed  = group.fixtures.filter(f =>  f.played);
          const allDone  = gPending.length === 0;
          return (
            <div key={group.week ?? "none"}>
              {group.week != null && (
                <div className="week-header" style={allDone ? { color: "#4ade80" } : {}}>
                  {tr("Week")} {group.week}{allDone ? " ✓" : ""}
                </div>
              )}
              {gPending.map(f => (
                <ScoreRow key={f.id} f={f} teams={teams} liveP={liveProbs[f.id]} settings={settings}
                  onConfirm={onConfirm} onUndo={onUndo} onOverride={onOverride} onTeamClick={onTeamClick} onWeekChange={onWeekChange} />
              ))}
              {gPlayed.map(f => (
                <ScoreRow key={f.id} f={f} teams={teams} liveP={liveProbs[f.id]} settings={settings}
                  onConfirm={onConfirm} onUndo={onUndo} onOverride={onOverride} onTeamClick={onTeamClick} onWeekChange={onWeekChange} />
              ))}
            </div>
          );
        }

        return (
          <div>
            {lastCompleted && renderGroup(lastCompleted)}
            {pendingGroups.map(g => renderGroup(g))}
            {olderCompleted.length > 0 && (
              <div>
                <div style={{ borderTop: "1px solid #1c1f27", margin: "1rem 0 .5rem", fontFamily: "DM Mono,monospace", fontSize: ".68rem", color: "#7d8597", textTransform: "uppercase", letterSpacing: ".08em" }}>
                  Completed weeks
                </div>
                {olderCompleted.map(g => renderGroup(g))}
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}


// ── TOURNAMENT BRACKET COMPONENT ──────────────────────────────────────────────
export function MatchRow({ match, teams, rounds, liveProbs, settings, onConfirm, onUndo, onOverride, isTwoLeg }) {
  const { t: tr } = useLang();
  const [hg, setHg] = useState("");
  const [ag, setAg] = useState("");

  const hIdx = resolveRef(match.homeRef, teams, rounds);
  const aIdx = resolveRef(match.awayRef, teams, rounds);
  const hn = hIdx != null ? (cleanTeamName(teams[hIdx]?.name) || "?") : "TBD";
  const an = aIdx != null ? (cleanTeamName(teams[aIdx]?.name) || "?") : "TBD";
  const isTbd = hIdx == null || aIdx == null;
  const ws = settings?.winScore || 30;
  const ls = settings?.lossScore || 25;
  const ds = settings?.drawScore || 25;
  const probs = liveProbs && liveProbs[match.id] ? liveProbs[match.id] : null;

  // For two-leg duels, find the paired leg to show aggregate
  const pairedMatch = match.leg && match.pairedLegId
    ? rounds.flatMap(r => r.matches).find(m => m.id === match.pairedLegId)
    : null;

  let aggText = null;
  if (isTwoLeg && pairedMatch && (match.played || pairedMatch.played)) {
    // Calculate aggregate goals for "seedA" (the team that was home in leg 1)
    const leg1 = match.leg === 1 ? match : pairedMatch;
    const leg2 = match.leg === 2 ? match : pairedMatch;
    const seedAIdx = resolveRef(leg1.homeRef, teams, rounds);
    const seedBIdx = resolveRef(leg1.awayRef, teams, rounds);
    const aggA = (leg1.played ? +leg1.homeScore : 0) + (leg2.played ? +leg2.awayScore : 0);
    const aggB = (leg1.played ? +leg1.awayScore : 0) + (leg2.played ? +leg2.homeScore : 0);
    if (leg1.played || leg2.played) {
      const nameA = teams[seedAIdx]?.name || "?";
      const nameB = teams[seedBIdx]?.name || "?";
      aggText = nameA + " " + aggA + " — " + aggB + " " + nameB + " (agg)";
    }
  }

  const legLabel = match.leg ? "Leg " + match.leg : null;
  const neutralLabel = match.neutral ? "Neutral" : null;

  if (match.played && match.homeScore != null) {
    const hs = +match.homeScore, as_ = +match.awayScore;
    const res = hs > as_ ? "home" : hs < as_ ? "away" : "draw";
    return (
      <div className={"bracket-match done" + (match.neutral ? " neutral" : "") + (isTbd ? " tbd" : "")}>
        <div className="bm-teams">
          <span style={{ color: res === "home" ? "#4ade80" : "#d4d8e0" }}>{hn}</span>
          <span className="vs">vs</span>
          <span style={{ color: res === "away" ? "#f87171" : "#d4d8e0" }}>{an}</span>
        </div>
        <div className="bm-score">
          <span style={{ color: res === "home" ? "#4ade80" : res === "draw" ? "#facc15" : "#d4d8e0" }}>{match.homeScore}</span>
          <span className="score-sep">&mdash;</span>
          <span style={{ color: res === "away" ? "#f87171" : res === "draw" ? "#facc15" : "#d4d8e0" }}>{match.awayScore}</span>
          {aggText && <span className="bm-agg">{aggText}</span>}
        </div>
        {legLabel && <span className="bm-label">{legLabel}</span>}
        {neutralLabel && <span className="bm-label" style={{ color: "#a78bfa", borderColor: "#a78bfa" }}>{neutralLabel}</span>}
        <button className="btn-undo" onClick={() => onUndo(match.id)}>↩</button>
      </div>
    );
  }

  if (isTbd) {
    return (
      <div className="bracket-match tbd">
        <div className="bm-teams"><span className="muted">TBD</span><span className="vs">{tr("vs")}</span><span className="muted">TBD</span></div>
        {legLabel && <span className="bm-label">{legLabel}</span>}
        {neutralLabel && <span className="bm-label" style={{ color: "#a78bfa", borderColor: "#a78bfa" }}>{neutralLabel}</span>}
      </div>
    );
  }

  const ovrTotal = (parseFloat(match.ovHW) || 0) + (parseFloat(match.ovD) || 0) + (parseFloat(match.ovAW) || 0);
  const ovrOk = !match.overrideOn || Math.abs(ovrTotal - 100) <= 0.5;
  const displayProbs = (match.overrideOn && match.ovHW !== "") ? { homeWin: parseFloat(match.ovHW) || 0, draw: parseFloat(match.ovD) || 0, awayWin: parseFloat(match.ovAW) || 0 } : probs;

  return (
    <div className={"bracket-match" + (match.neutral ? " neutral" : "")} style={{ flexDirection: "column", alignItems: "stretch", gap: ".38rem" }}>
      <div style={{ display: "flex", alignItems: "center", gap: ".5rem", flexWrap: "wrap" }}>
        <div className="bm-teams"><span>{hn}</span><span className="vs">vs</span><span>{an}</span></div>
        {displayProbs && (
          <div className="fix-probs">
            {match.overrideOn && match.ovHW !== "" && <span className="ovr-tag">{tr("override")}</span>}
            <span className="ph-col">{displayProbs.homeWin}%</span>
            <span className="pd-col">{displayProbs.draw}%</span>
            <span className="pa-col">{displayProbs.awayWin}%</span>
          </div>
        )}
        {legLabel && <span className="bm-label">{legLabel}</span>}
        {neutralLabel && <span className="bm-label" style={{ color: "#a78bfa", borderColor: "#a78bfa" }}>{neutralLabel}</span>}
        <button className={"ovr-btn" + (match.overrideOn ? " active" : "")} onClick={() => onOverride(match.id, "toggle")}>
          {match.overrideOn ? "✓ Ovr" : "Ovr %"}
        </button>
      </div>
      {match.overrideOn && (
        <div className="ovr-row">
          <span className="muted" style={{ fontSize: ".7rem" }}>{hn.split(" ")[0]} W:</span>
          <input className="ovr-inp" type="number" min="0" max="100" value={match.ovHW} onChange={e => onOverride(match.id, "hw", e.target.value)} placeholder="0" />
          <span className="muted">D:</span>
          <input className="ovr-inp" type="number" min="0" max="100" value={match.ovD} onChange={e => onOverride(match.id, "d", e.target.value)} placeholder="0" />
          <span className="muted">{an.split(" ")[0]} W:</span>
          <input className="ovr-inp" type="number" min="0" max="100" value={match.ovAW} onChange={e => onOverride(match.id, "aw", e.target.value)} placeholder="0" />
          {match.ovHW !== "" && <span style={{ fontSize: ".7rem", color: ovrOk ? "#22d3ee" : "#f87171", fontFamily: "DM Mono,monospace" }}>{ovrTotal}% {ovrOk ? "✓" : "⚠"}</span>}
        </div>
      )}
      {aggText && <div style={{ fontSize: ".72rem", color: "#a78bfa", fontFamily: "DM Mono,monospace" }}>{aggText}</div>}
      <div style={{ display: "flex", alignItems: "center", gap: ".35rem", flexWrap: "wrap" }}>
        <button className="qbtn hw" onClick={() => onConfirm(match.id, ws, ls)}>{hn.split(" ")[0]} W</button>
        <button className="qbtn dr" onClick={() => onConfirm(match.id, ds, ds)}>{tr("Draw")}</button>
        <button className="qbtn aw" onClick={() => onConfirm(match.id, ls, ws)}>{an.split(" ")[0]} W</button>
        <input className="score-inp" type="number" min="0" value={hg} onChange={e => setHg(e.target.value)} placeholder="0" />
        <span className="score-sep">&mdash;</span>
        <input className="score-inp" type="number" min="0" value={ag} onChange={e => setAg(e.target.value)} placeholder="0" />
        <button className="confirm-btn" disabled={hg === "" || ag === ""} onClick={() => { if (hg !== "" && ag !== "") onConfirm(match.id, +hg, +ag); }}>OK</button>
      </div>
    </div>
  );
}
