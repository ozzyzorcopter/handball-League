import { useArchiveFile, useArchiveIndex, useArchiveSeason, useStandaloneLeagues } from "./archiveData.js";
import { githubDispatch } from "./github.js";
import { ErrorBoundary } from "./ErrorBoundary.js";
import { Skeleton } from "./Skeleton.js";
import { BelgianLeagueView } from "./belgian.js";
import { LeagueTable } from "./LeagueTable.js";
import { resolveRef } from "./tournament.js";
import { TeamDetail } from "./TeamDetail.js";
const { useState, useRef, useEffect, useMemo } = React;
// ── ARCHIVE OPTIONS MENU ──────────────────────────────────────────────────────
export function ArchiveOptionsMenu({ label, onOpen, onDelete, style }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function handler(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} style={{ position: "relative", ...style }} onClick={e => e.stopPropagation()}>
      <button
        className="btn btn-ghost"
        style={{ fontSize: ".8rem", padding: ".2rem .5rem", opacity: 0, transition: "opacity .15s" }}
        data-options-btn
        onClick={e => { e.stopPropagation(); setOpen(o => !o); }}>
        •••
      </button>
      {open && (
        <div style={{
          position: "absolute", right: 0, top: "calc(100% + 4px)", zIndex: 100,
          background: "#10121a", border: "1px solid #252830", borderRadius: "6px",
          minWidth: "130px", boxShadow: "0 4px 16px rgba(0,0,0,.4)", overflow: "hidden",
        }}>
          <button className="btn-ghost" style={{ display: "block", width: "100%", textAlign: "left", padding: ".55rem .85rem", fontSize: ".82rem", borderRadius: 0 }}
            onClick={() => { setOpen(false); onOpen(); }}>
            📂 Open
          </button>
          <button className="btn-ghost" style={{ display: "block", width: "100%", textAlign: "left", padding: ".55rem .85rem", fontSize: ".82rem", borderRadius: 0, color: "#f87171" }}
            onClick={() => { setOpen(false); onDelete(); }}>
            🗑 Delete
          </button>
        </div>
      )}
    </div>
  );
}

// Make the options button visible on card hover via CSS
export const archiveCardHoverStyle = `
.archive-card:hover [data-options-btn] { opacity: 1 !important; }
.archive-card [data-options-btn]:focus { opacity: 1 !important; }
`;

// ── ARCHIVE SCREEN ────────────────────────────────────────────────────────────
export function ArchiveScreen({ onBack }) {
  const { index, error } = useArchiveIndex();
  const { data: standaloneData } = useStandaloneLeagues();
  const [view, setView] = useState(null);
  // view: { type: "belgian", filename, season }
  //     | { type: "standalone", league, scorers }
  //     | { type: "legacy", filename }
  const [dispatchStatus, setDispatchStatus] = useState(null);

  async function handleDelete(type, identifier, displayName) {
    if (!confirm(`Are you sure you want to delete "${displayName}"?`)) return;
    setDispatchStatus("pending");
    try {
      const payload = type === "belgian"
        ? { type: "belgian", season: identifier }
        : { type: "standalone", id: identifier };
      await githubDispatch("delete-archive-entry", payload);
      setDispatchStatus("done");
      setTimeout(() => setDispatchStatus(null), 4000);
    } catch (e) {
      alert("Could not delete: " + e.message);
      setDispatchStatus("error");
      setTimeout(() => setDispatchStatus(null), 4000);
    }
  }

  if (view?.type === "belgian")    return <ArchiveBelgianSeasonView filename={view.filename} season={view.season} onBack={() => setView(null)} />;
  if (view?.type === "standalone") return <ArchiveLeagueView league={view.league} scorers={view.scorers} season={view.league.name} onBack={() => setView(null)} />;
  if (view?.type === "legacy")     return <ArchiveSeasonView filename={view.filename} onBack={() => setView(null)} />;

  const loading      = index === null;
  const hasStandalone = index?.standaloneLeagues?.length > 0;
  const hasBelgian   = index?.belgianSeasons?.length > 0;
  const hasLegacy    = index?.legacySeasons?.length > 0;
  const hasAny       = hasStandalone || hasBelgian || hasLegacy;

  return (
    <div className="panel">
      <style>{archiveCardHoverStyle}</style>
      <div className="ph">
        <div>
          <h2>📦 Archive</h2>
          <p style={{ color: "#5a6070", fontSize: ".82rem" }}>Archived leagues and seasons — read only</p>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: ".5rem", alignItems: "center" }}>
          {dispatchStatus === "pending" && <span className="muted" style={{ fontSize: ".78rem" }}>⏳ Working…</span>}
          {dispatchStatus === "done"    && <span style={{ color: "#4ade80", fontSize: ".78rem" }}>✓ Done — reload to see changes</span>}
          {dispatchStatus === "error"   && <span style={{ color: "#f87171", fontSize: ".78rem" }}>✗ Error</span>}
          <button className="btn btn-ghost" onClick={onBack}>← Back</button>
        </div>
      </div>

      {loading && <Skeleton label="Loading archive…" />}
      {error   && <div style={{ color: "#f87171", padding: "2rem", textAlign: "center" }}>Could not load archive.</div>}
      {index && !hasAny && (
        <div className="muted" style={{ padding: "2rem", textAlign: "center" }}>No archived leagues or seasons yet.</div>
      )}

      {/* Standalone leagues — shown at top */}
      {hasStandalone && (
        <>
          <div className="sub-ttl" style={{ marginTop: "1.5rem", marginBottom: ".75rem" }}>Standalone Leagues</div>
          <div className="card-grid">
            {index.standaloneLeagues.map(entry => {
              const leagueData = standaloneData?.find(l => l.id === entry.id);
              return (
                <div key={entry.id} className="card archive-card" style={{ position: "relative" }}
                  onClick={() => leagueData && setView({ type: "standalone", league: leagueData.league, scorers: leagueData.scorers })}>
                  <div className="card-badge badge-std">Standalone</div>
                  <div className="card-name">{entry.name}</div>
                  <div className="card-meta">archived {new Date(entry.archivedAt).toLocaleDateString("nl-BE")}</div>
                  <ArchiveOptionsMenu
                    style={{ position: "absolute", top: ".5rem", right: ".5rem" }}
                    onOpen={() => leagueData && setView({ type: "standalone", league: leagueData.league, scorers: leagueData.scorers })}
                    onDelete={() => handleDelete("standalone", entry.id, entry.name)}
                  />
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Belgian API seasons */}
      {hasBelgian && (
        <>
          <div className="sub-ttl" style={{ marginTop: "1.5rem", marginBottom: ".75rem" }}>Belgian Handball Seasons</div>
          <div className="card-grid">
            {index.belgianSeasons.map(s => (
              <div key={s.filename} className="card archive-card season-card" style={{ position: "relative" }}
                onClick={() => setView({ type: "belgian", filename: s.filename, season: s.season })}>
                <div className="season-card-title">{s.season}</div>
                <div className="season-card-meta">{s.leagueCount} leagues · archived {new Date(s.archivedAt).toLocaleDateString("nl-BE")}</div>
                <ArchiveOptionsMenu
                  style={{ position: "absolute", top: ".5rem", right: ".5rem" }}
                  onOpen={() => setView({ type: "belgian", filename: s.filename, season: s.season })}
                  onDelete={() => handleDelete("belgian", s.season, s.season)}
                />
              </div>
            ))}
          </div>
        </>
      )}

      {/* Legacy manual seasons (old archive format) */}
      {hasLegacy && (
        <>
          <div className="sub-ttl" style={{ marginTop: "1.5rem", marginBottom: ".75rem" }}>Previous Seasons</div>
          <div className="card-grid">
            {index.legacySeasons.map(s => (
              <div key={s.filename} className="card archive-card season-card" style={{ position: "relative" }}
                onClick={() => setView({ type: "legacy", filename: s.filename })}>
                <div className="season-card-title">{s.season}</div>
                <div className="season-card-meta">{s.leagueCount} leagues · archived {new Date(s.archivedAt).toLocaleDateString("nl-BE")}</div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// Legacy season view — reads old { season, leagues: [...], scorers: {} } format
export function ArchiveSeasonView({ filename, onBack }) {
  const { data, error } = useArchiveSeason(filename);
  const [activeLeague, setActiveLeague] = useState(null);

  if (error) return (
    <div className="panel">
      <button className="btn btn-ghost" onClick={onBack}>← Back</button>
      <div style={{ color: "#f87171", padding: "2rem", textAlign: "center" }}>Could not load season data.</div>
    </div>
  );
  if (!data) return <Skeleton rows={8} label="Loading season…" />;

  if (activeLeague !== null) {
    const lg = data.leagues[activeLeague];
    // Leagues played as round-robin (plain, or play-off leagues whose phases have fixtures) get the full
    // league view (table, games, players); tournament-style phases keep the older phase view.
    const hasFixtures = ph => ph && (ph.fixtures || []).length > 0;
    const full = (x, label) => ({ ...x, name: lg.name + (label ? " · " + label : ""), federation: "📦 " + data.season + " · read only", live: false,
      scorers: (data.scorers || {})[lg.name] || null });
    if (lg.type !== "playoff") {
      return <ErrorBoundary onBack={() => setActiveLeague(null)}><BelgianLeagueView league={full(lg)} onBack={() => setActiveLeague(null)} /></ErrorBoundary>;
    }
    if (hasFixtures(lg.playoffs) && hasFixtures(lg.playdowns)) {
      return <ArchivePhasedLeague lg={lg} full={full} onBack={() => setActiveLeague(null)} />;
    }
    return <ArchiveLeagueView league={lg} scorers={data.scorers} season={data.season} onBack={() => setActiveLeague(null)} />;
  }

  return (
    <div className="panel">
      <div className="ph">
        <div>
          <h2>📦 {data.season}</h2>
          <p style={{ color: "#5a6070", fontSize: ".82rem" }}>Archived {new Date(data.archivedAt).toLocaleDateString("nl-BE")} · read only</p>
        </div>
        <button className="btn btn-ghost" style={{ marginLeft: "auto" }} onClick={onBack}>← Back</button>
      </div>
      <div className="card-grid" style={{ marginTop: "1rem" }}>
        {(data.leagues || []).map((lg, i) => (
          <div key={lg.id} className="card" onClick={() => setActiveLeague(i)}>
            <div className={"card-badge " + (lg.type === "playoff" ? "badge-po" : "badge-std")}>
              {lg.type === "playoff" ? "Play-off League" : "Standard League"}
            </div>
            <div className="card-name">{lg.name}</div>
            <div className="card-meta">{(lg.teams || []).length} teams · {(lg.fixtures || []).filter(f => f.played).length} played</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Belgian season view — reads new { season, federations: { FED: { serieId: league } } } format
export function ArchiveBelgianSeasonView({ filename, season, onBack }) {
  const { data, error } = useArchiveFile(filename);
  const [league, setLeague] = useState(null);

  if (league) return <ErrorBoundary onBack={() => setLeague(null)}><BelgianLeagueView league={league} onBack={() => setLeague(null)} /></ErrorBoundary>;

  if (error) return (
    <div className="panel">
      <button className="btn btn-ghost" onClick={onBack}>← Back</button>
      <div style={{ color: "#f87171", padding: "2rem", textAlign: "center" }}>Could not load season data.</div>
    </div>
  );
  if (!data) return <Skeleton rows={8} label="Loading season…" />;

  const feds = Object.keys(data.federations || {});
  const allLeagues = feds.flatMap(fed => Object.values(data.federations[fed] || {}));

  return (
    <div className="panel">
      <div className="ph">
        <div>
          <h2>📦 {data.season}</h2>
          <p style={{ color: "#5a6070", fontSize: ".82rem" }}>
            Archived {new Date(data.archivedAt).toLocaleDateString("nl-BE")} · {allLeagues.length} leagues · read only
          </p>
        </div>
        <button className="btn btn-ghost" style={{ marginLeft: "auto" }} onClick={onBack}>← Back</button>
      </div>
      <div className="card-grid" style={{ marginTop: "1rem" }}>
        {feds.flatMap(fed =>
          Object.values(data.federations[fed] || {}).map(lg => (
            <div key={`${fed}-${lg.serieId}`} className="card" onClick={() => setLeague(lg)}>
              <div className="card-badge badge-std" style={{ color: "#fdda24", borderColor: "#fdda2444", background: "#fdda2418" }}>{fed}</div>
              <div className="card-name">{lg.name}</div>
              <div className="card-meta">
                {(lg.teams || []).length} teams · {(lg.fixtures || []).filter(f => f.played).length} played
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// Play-off league with round-robin phases: switch between regular season, play-offs and play-downs,
// each shown in the full league view.
function ArchivePhasedLeague({ lg, full, onBack }) {
  const [phase, setPhase] = useState("regular");
  const label = { regular: "", playoff: "Play-offs", playdown: "Play-downs" }[phase];
  const src = phase === "playoff" ? { ...lg, ...lg.playoffs, type: "standard" } : phase === "playdown" ? { ...lg, ...lg.playdowns, type: "standard" } : { ...lg, type: "standard" };
  return (
    <div>
      <div className="tabs" style={{ marginBottom: ".75rem" }}>
        {["regular", "playoff", "playdown"].map(p => (
          <button key={p} className={"tab" + (phase === p ? " on" : "")} onClick={() => setPhase(p)}>
            {p === "regular" ? "Regular Season" : p === "playoff" ? "Play-offs" : "Play-downs"}
          </button>
        ))}
      </div>
      <ErrorBoundary onBack={onBack}><BelgianLeagueView key={phase} league={full(src, label)} onBack={onBack} /></ErrorBoundary>
    </div>
  );
}

// Read-only knockout rounds of a tournament-style phase: every duel with its leg scores and the winner.
function ArchiveRounds({ rounds, teams }) {
  const name = ref => { const i = resolveRef(ref, teams, rounds); return i != null && teams[i] ? teams[i].name : "TBD"; };
  return (
    <div>
      {rounds.map(r => {
        const duels = [];
        const seen = new Set();
        (r.matches || []).forEach(m => {
          const key = m.duelId || m.id;
          if (seen.has(key)) return;
          seen.add(key);
          duels.push((r.matches || []).filter(x => (x.duelId || x.id) === key).sort((a, b) => (a.leg || 1) - (b.leg || 1)));
        });
        return (
          <div key={r.id} style={{ marginBottom: "1.25rem" }}>
            <div className="sub-ttl" style={{ marginBottom: ".5rem" }}>{r.label}</div>
            {duels.map(legs => {
              const first = legs[0];
              const a = name(first.homeRef), b = name(first.awayRef);
              const done = legs.every(l => l.played);
              let ga = 0, gb = 0;
              legs.forEach((l, i) => {
                const hs = +l.homeScore || 0, as = +l.awayScore || 0;
                if (i === 0) { ga += hs; gb += as; } else { ga += as; gb += hs; }
              });
              return (
                <div key={first.duelId || first.id} className="mini-box" style={{ marginBottom: ".5rem" }}>
                  <div style={{ display: "flex", gap: ".6rem", flexWrap: "wrap", alignItems: "baseline" }}>
                    <span style={{ fontWeight: 700, minWidth: "14rem" }}>
                      <span style={{ color: done && ga > gb ? "#4ade80" : undefined }}>{a}</span>
                      {" – "}
                      <span style={{ color: done && gb > ga ? "#4ade80" : undefined }}>{b}</span>
                    </span>
                    {done && legs.length > 1 && <span className="mini-val" style={{ color: "#fbbf24" }}>{ga}–{gb}</span>}
                    <span className="muted" style={{ fontSize: ".78rem", fontFamily: "DM Mono,monospace" }}>
                      {legs.map(l => l.played ? name(l.homeRef) + " " + l.homeScore + "–" + l.awayScore + " " + name(l.awayRef) : "not played").join("  ·  ")}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

export function ArchiveLeagueView({ league, scorers, season, onBack }) {
  const [detail, setDetail] = useState(null);
  const { teams, fixtures, type, playoffs, playdowns } = league;
  const [phase, setPhase] = useState("regular");

  // Cached scorer data from archive
  const archiveScorers = useMemo(() => {
    if (!scorers) return null;
    const leagueData = scorers[league.name];
    return leagueData || null;
  }, [scorers, league.name]);

  const currentTeams = phase === "playoff" && playoffs ? playoffs.teams
    : phase === "playdown" && playdowns ? playdowns.teams
    : teams;
  const currentFixtures = phase === "playoff" && playoffs ? playoffs.fixtures
    : phase === "playdown" && playdowns ? playdowns.fixtures
    : fixtures;

  function openDetail(idx) {
    if (idx >= 0 && idx < currentTeams.length) setDetail({ idx, phase });
  }

  return (
    <div>
      <div className="masthead" style={{ marginBottom: "1rem" }}>
        <div>
          <div className="logo" style={{ fontSize: "1rem" }}>{league.name}</div>
          <div className="sub" style={{ color: "#fbbf24" }}>📦 {season} — read only</div>
        </div>
        <button className="btn btn-ghost" onClick={onBack}>← Back</button>
      </div>

      <div className="archive-banner">📦 Archive — {season} · Read only</div>

      {type === "playoff" && (
        <div className="tabs" style={{ marginBottom: "1rem" }}>
          {["regular", "playoff", "playdown"].map(p => (
            <button key={p} className={"tab" + (phase === p ? " on" : "")} onClick={() => setPhase(p)}>
              {p === "regular" ? "Regular Season" : p === "playoff" ? "Play-offs" : "Play-downs"}
            </button>
          ))}
        </div>
      )}

      {phase !== "regular" && !(currentFixtures || []).length && ((phase === "playoff" ? playoffs : playdowns)?.rounds || []).length > 0 ? (
        <ArchiveRounds rounds={(phase === "playoff" ? playoffs : playdowns).rounds} teams={currentTeams} />
      ) : (
      <LeagueTable
        teams={currentTeams}
        fixtures={currentFixtures}
        onTeamClick={id => openDetail(id)}
        highlightTop={phase === "playoff" ? 2 : league.promoTop ?? 2}
        highlightBottom={phase === "playdown" ? 2 : league.demotBot ?? 2}
        confirmedTop={null}
        confirmedBottom={null}
        leagueId={null}
        aliases={league.scorerAliases || {}}
        archiveScorers={archiveScorers}
      />
      )}

      {detail && (() => {
        const tms = detail.phase === "playoff" && playoffs ? playoffs.teams
          : detail.phase === "playdown" && playdowns ? playdowns.teams
          : teams;
        const fx = detail.phase === "playoff" && playoffs ? playoffs.fixtures
          : detail.phase === "playdown" && playdowns ? playdowns.fixtures
          : fixtures;
        const t = tms[detail.idx];
        if (!t) return null;
        return <TeamDetail team={t} teamIdx={detail.idx} teams={tms} fixtures={fx} onClose={() => setDetail(null)} leagueId={null} aliases={league.scorerAliases || {}} archiveScorers={archiveScorers} />;
      })()}
    </div>
  );
}
