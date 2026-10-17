import { generateTournament, resolveRef } from "./tournament.js";
import { calcProbs, calcProbsNeutral, fixProbs } from "./probabilities.js";
import { defaultSettings, makeFixtures } from "./leagueModel.js";
import { calcStats } from "./standings.js";
import { IS_SHARE } from "./config.js";
import { MCTab, MatchRow, ScoresTab } from "./scores.js";
import { LeagueTable, TeamDetail } from "./LeagueTable.js";
import { SettingsPanel } from "./SettingsPanel.js";
import { FixturesStep, TeamsStep } from "./setup.js";
const { useState, useMemo } = React;
export function TournamentBracket({ rounds, teams, liveProbs, settings, phase, onConfirm, onUndo, onOverride, onTeamClick }) {
  return (
    <div className="bracket">
      {rounds.map(round => (
        <div key={round.id} className="bracket-round">
          <div className={"bracket-round-title" + (round.type === "losers" ? " losers" : "")}>{round.label}</div>
          {round.matches.map((match, mi) => {
            const isTwoLeg = match.leg != null;
            return (
              <MatchRow key={match.id} match={match} teams={teams} rounds={rounds}
                liveProbs={liveProbs} settings={settings} isTwoLeg={isTwoLeg}
                onConfirm={onConfirm} onUndo={onUndo} onOverride={onOverride}
                onTeamClick={onTeamClick} />
            );
          })}
        </div>
      ))}
    </div>
  );
}

// ── PHASE VIEW (playoffs or playdowns) ────────────────────────────────────────
export function PhaseView({ phase, phaseData, setPhaseData, settings, sourceStats, phaseFormat, label, color, infoText, onTeamClick, leagueId, aliases }) {
  const [tab, setTab] = useState(phaseFormat === "tournament" ? "bracket" : "table");
  const [confirmedTop, setConfirmedTop] = useState(null);
  const [confirmedBottom, setConfirmedBottom] = useState(null);

  // All hooks must come before any conditional return (React rules of hooks).
  const baseTeams = phaseData ? phaseData.teams : [];
  const isTournament = phaseData ? phaseData.format === "tournament" : phaseFormat === "tournament";
  const fixtures = phaseData ? (phaseData.fixtures || []) : [];
  const rounds = phaseData ? (phaseData.rounds || []) : [];
  const allMatches = isTournament ? rounds.flatMap(r => r.matches) : fixtures;
  const pending = allMatches.filter(f => !f.played);
  const played = allMatches.filter(f => f.played);

  // Add points earned from played fixtures on top of locked starting points.
  const teams = useMemo(() => {
    const earned = baseTeams.map(() => 0);
    played.forEach(f => {
      const hg = +f.homeScore, ag = +f.awayScore;
      if (isNaN(hg) || isNaN(ag)) return;
      if (hg > ag) earned[f.homeIdx] += 2;
      else if (hg < ag) earned[f.awayIdx] += 2;
      else { earned[f.homeIdx]++; earned[f.awayIdx]++; }
    });
    return baseTeams.map((t, i) => ({ ...t, points: t.points + earned[i] }));
  }, [baseTeams, played]);
  const liveProbs = useMemo(() => {
    if (!phaseData) return {};
    const m = {};
    pending.forEach(f => {
      if (f.tbd) return; // TBD matches — teams not yet known
      if (f.neutral) {
        const hIdx = resolveRef(f.homeRef, baseTeams, rounds);
        const aIdx = resolveRef(f.awayRef, baseTeams, rounds);
        if (hIdx != null && aIdx != null) m[f.id] = calcProbsNeutral(hIdx, aIdx, baseTeams, settings);
      } else if (isTournament) {
        const hIdx = resolveRef(f.homeRef, baseTeams, rounds);
        const aIdx = resolveRef(f.awayRef, baseTeams, rounds);
        if (hIdx != null && aIdx != null) m[f.id] = calcProbs(hIdx, aIdx, baseTeams, [], settings);
      } else {
        m[f.id] = calcProbs(f.homeIdx, f.awayIdx, teams, fixtures, settings);
      }
    });
    return m;
  }, [phaseData, settings, teams]);

  function generate() {
    if (phaseFormat === "tournament") {
      const isPlaydown = phase === "playdown";
      const result = generateTournament(sourceStats, settings, isPlaydown);
      setPhaseData({ teams: result.teams, fixtures: [], rounds: result.rounds, format: "tournament" });
    } else {
      const phTeams = sourceStats.map(r => ({ id: r.id, name: r.name, points: r.startingPts, homeBonus: "" }));
      const phFixtures = makeFixtures(phTeams, settings);
      setPhaseData({ teams: phTeams, fixtures: phFixtures, format: "round-robin" });
    }
  }

  if (!phaseData) {
    return (
      <div className="panel" style={{ borderColor: color, borderWidth: 2 }}>
        <div style={{ textAlign: "center", padding: "2rem" }}>
          <div style={{ fontFamily: "Syne,sans-serif", fontSize: "1.1rem", fontWeight: 700, color: "#fff", marginBottom: ".5rem" }}>{label}</div>
          <div className="muted" style={{ marginBottom: "1.25rem", fontSize: ".85rem" }}>{infoText}</div>
          {sourceStats && sourceStats.length > 0
            ? <button className="btn btn-cyan" style={{ background: color, borderColor: color }} onClick={generate}>Generate {label} Fixtures</button>
            : <div className="muted">Complete the regular season first.</div>
          }
        </div>
      </div>
    );
  }

  function updateMatch(id, updater) {
    setPhaseData(prev => {
      if (prev.format === "tournament") {
        return { ...prev, rounds: prev.rounds.map(r => ({ ...r, matches: r.matches.map(m => m.id === id ? updater(m) : m) })) };
      }
      return { ...prev, fixtures: prev.fixtures.map(f => f.id === id ? updater(f) : f) };
    });
  }
  function confirmScore(id, hg, ag) { updateMatch(id, m => ({ ...m, played: true, homeScore: hg, awayScore: ag, tbd: false })); }
  function unplay(id) { updateMatch(id, m => ({ ...m, played: false, homeScore: null, awayScore: null })); }
  function handleOverride(id, field, val) {
    updateMatch(id, m => {
      if (field === "toggle") return { ...m, overrideOn: !m.overrideOn };
      if (field === "hw") return { ...m, ovHW: val };
      if (field === "d") return { ...m, ovD: val };
      if (field === "aw") return { ...m, ovAW: val };
      return m;
    });
  }

  const htop = phase === "playoff" ? 2 : 0;
  const hbot = phase === "playdown" ? 2 : 0;

  return (
    <div className="panel" style={{ borderColor: color, borderWidth: 2 }}>
      <div className="ph">
        <span className="ph-num" style={{ color }}>{label[0]}</span>
        <div>
          <h2>{label}</h2>
          <p>2-round robin · {teams.length} teams · Starting points locked at generation</p>
        </div>
        <button className="btn btn-ghost" style={{ marginLeft: "auto", fontSize: ".72rem" }} onClick={() => { if (confirm("Regenerate? This clears all entered results.")) setPhaseData(null); }}>↺ Reset</button>
      </div>
      <div className="tabs">
        {(isTournament ? ["bracket", "monte"] : ["table", "scores", "monte"]).map(t => (
          <button key={t} className={"tab" + (tab === t ? " on" : "")} onClick={() => setTab(t)}>
            {t === "bracket" ? "Bracket" : t === "table" ? "Table" : t === "scores" ? "Scores" + (pending.length ? " (" + pending.length + ")" : "") : "Monte Carlo"}
          </button>
        ))}
      </div>
      {tab === "table" && (
        <LeagueTable teams={baseTeams} fixtures={fixtures} onTeamClick={i => onTeamClick && onTeamClick(baseTeams[i]?.id)} highlightTop={htop} highlightBottom={hbot} confirmedTop={confirmedTop} confirmedBottom={confirmedBottom} leagueId={leagueId} aliases={aliases} phaseTeams={baseTeams} phase={phase} />
      )}
      {tab === "scores" && (
        <ScoresTab teams={teams} fixtures={fixtures} liveProbs={liveProbs} settings={settings}
          onConfirm={confirmScore} onUndo={unplay} onOverride={handleOverride}
          onTeamClick={i => onTeamClick && onTeamClick(teams[i]?.id)}
          onWeekChange={(id, w) => updateMatch(id, m => ({ ...m, week: w }))} />
      )}
      {tab === "bracket" && (
        <TournamentBracket rounds={rounds} teams={baseTeams} liveProbs={liveProbs} settings={settings}
          phase={phase} onConfirm={confirmScore} onUndo={unplay} onOverride={handleOverride}
          onTeamClick={i => onTeamClick && onTeamClick(baseTeams[i]?.id)} />
      )}
      {tab === "monte" && (
        <MCTab key={played.length} teams={teams} fixtures={isTournament ? allMatches.filter(m => !m.tbd) : fixtures} settings={settings} highlightTop={htop} highlightBottom={hbot}
          onConfirmed={(ct, cb) => { setConfirmedTop(ct); setConfirmedBottom(cb); }} />
      )}
    </div>
  );
}

// ── STEP 3: SIMULATE ──────────────────────────────────────────────────────────
export function SimStep({ league, setLeague, onBack }) {
  const { teams: initTeams, fixtures: initFixtures, settings, type, playoffs, playdowns, poSize: _poSize, pdSize: _pdSize, phaseFormat: _pfmt } = league;
  const [phase, setPhase] = useState("regular");
  const [tab, setTab] = useState("table");
  const [detail, setDetail] = useState(null);
  const [confirmedTop, setConfirmedTop] = useState(null);
  const [confirmedBottom, setConfirmedBottom] = useState(null);

  // Live points from scores
  const teams = useMemo(() => {
    const earned = initTeams.map(() => 0);
    initFixtures.filter(f => f.played && f.homeScore != null).forEach(f => {
      const hg = +f.homeScore, ag = +f.awayScore;
      if (isNaN(hg) || isNaN(ag)) return;
      if (hg > ag) earned[f.homeIdx] += 2;
      else if (hg < ag) earned[f.awayIdx] += 2;
      else { earned[f.homeIdx]++; earned[f.awayIdx]++; }
    });
    return initTeams.map((t, i) => ({ ...t, points: t.points + earned[i] }));
  }, [initTeams, initFixtures]);

  const pending = initFixtures.filter(f => !f.played);
  const played = initFixtures.filter(f => f.played);

  const liveProbs = useMemo(() => {
    const m = {};
    pending.forEach(f => { m[f.id] = fixProbs(f, teams, initFixtures, settings); });
    return m;
  }, [pending, teams, initFixtures, settings]);

  function setFixtures(u) { setLeague(lg => ({ ...lg, fixtures: typeof u === "function" ? u(lg.fixtures) : u })); }
  function setSettings(u) { setLeague(lg => ({ ...lg, settings: typeof u === "function" ? u(lg.settings) : u })); }
  function setPlayoffs(u) { setLeague(lg => ({ ...lg, playoffs: typeof u === "function" ? u(lg.playoffs) : u })); }
  function setPlaydowns(u) { setLeague(lg => ({ ...lg, playdowns: typeof u === "function" ? u(lg.playdowns) : u })); }

  function confirmScore(id, hg, ag) { setFixtures(prev => prev.map(f => f.id === id ? { ...f, played: true, homeScore: hg, awayScore: ag } : f)); }
  function unplay(id) { setFixtures(prev => prev.map(f => f.id === id ? { ...f, played: false, homeScore: null, awayScore: null } : f)); }
  function handleOverride(id, field, val) {
    setFixtures(prev => prev.map(f => {
      if (f.id !== id) return f;
      if (field === "toggle") return { ...f, overrideOn: !f.overrideOn };
      if (field === "hw") return { ...f, ovHW: val };
      if (field === "d") return { ...f, ovD: val };
      if (field === "aw") return { ...f, ovAW: val };
      return f;
    }));
  }

  const regStats = useMemo(() => calcStats(teams, initFixtures, league.ranking), [teams, initFixtures, league.ranking]);
  const n = teams.length;

  // Playoff source: top 6 with starting pts 6,5,4,3,2,1
  const poSz = _poSize || 6;
  const pdSz = _pdSize || 4;
  const pfmt = _pfmt || "round-robin";
  const playoffSource = useMemo(() => regStats.slice(0, poSz).map((r, i) => ({ ...r, startingPts: poSz - i })), [regStats, poSz]);
  // Playdown source: bottom 4 with starting pts 4,3,2,1
  const playdownSource = useMemo(() => regStats.slice(Math.max(0, n - pdSz)).map((r, i) => ({ ...r, startingPts: pdSz - i })), [regStats, n, pdSz]);

  const isPlayoff = type === "playoff";
  const stdPromo = (league.promoTop != null) ? league.promoTop : 2;
  const stdDemot = (league.demotBot != null) ? league.demotBot : 2;
  const hlTop = isPlayoff ? poSz : stdPromo;
  const hlBot = isPlayoff ? pdSz : stdDemot;

  // Detail lookup
  function openDetail(idx) { setDetail({ source: "regular", idx }); }


  return (
    <div>
      {isPlayoff && (
        <div className="phase-tabs">
          <button className={"phase-tab" + (phase === "regular" ? " rs-on" : "")} onClick={() => setPhase("regular")}>Regular Season</button>
          <button className={"phase-tab" + (phase === "playoff" ? " po-on" : "")} onClick={() => setPhase("playoff")}>Play-offs (Top 6)</button>
          <button className={"phase-tab" + (phase === "playdown" ? " pd-on" : "")} onClick={() => setPhase("playdown")}>Play-downs (Bottom 4)</button>
        </div>
      )}

      {phase === "playoff" && (
        <PhaseView phase="playoff" phaseData={playoffs} setPhaseData={setPlayoffs} settings={settings} sourceStats={playoffSource}
          phaseFormat={pfmt}
          label="Play-offs" color="#a78bfa"
          infoText={"Top " + poSz + " from regular season. Starting pts: rank 1 = " + poSz + " pts, rank 2 = " + (poSz-1) + " pts, etc."}
          leagueId={league.name} aliases={league.scorerAliases || {}}
          onTeamClick={id => { const t = (playoffs?.teams || []).find(t => t.id === id); const i = (playoffs?.teams || []).indexOf(t); if (t) setDetail({ source: "playoff", idx: i }); }} />
      )}
      {phase === "playdown" && (
        <PhaseView phase="playdown" phaseData={playdowns} setPhaseData={setPlaydowns} settings={settings} sourceStats={playdownSource}
          phaseFormat={pfmt}
          label="Play-downs" color="#f87171"
          infoText={"Bottom " + pdSz + " from regular season. Starting pts: rank 1 = " + pdSz + " pts, rank 2 = " + (pdSz-1) + " pts, etc."}
          leagueId={league.name} aliases={league.scorerAliases || {}}
          onTeamClick={id => { const t = (playdowns?.teams || []).find(t => t.id === id); const i = (playdowns?.teams || []).indexOf(t); if (t) setDetail({ source: "playdown", idx: i }); }} />
      )}

      {phase === "regular" && (
        <div className="panel">
          <div className="ph">
            <span className="ph-num">03</span>
            <div>
              <h2>{isPlayoff ? "Regular Season" : "Match Day & Results"}</h2>
              <p>Enter scores — table updates automatically.</p>
            </div>
          </div>
          <div className="tabs">
            {["table", "scores", "monte", "settings"].map(t => (
              <button key={t} className={"tab" + (tab === t ? " on" : "")} onClick={() => setTab(t)}>
                {t === "table" ? "League Table" : t === "scores" ? "Scores" + (pending.length ? " (" + pending.length + ")" : "") : t === "monte" ? "Monte Carlo" : "Settings"}
              </button>
            ))}
          </div>

          {tab === "table" && (
            <LeagueTable teams={initTeams} fixtures={initFixtures} ranking={league.ranking} onTeamClick={openDetail}
              highlightTop={hlTop} highlightBottom={hlBot}
              confirmedTop={confirmedTop} confirmedBottom={confirmedBottom}
              leagueId={league.name} aliases={league.scorerAliases || {}} />
          )}

          {tab === "scores" && (
            <ScoresTab teams={teams} fixtures={initFixtures} liveProbs={liveProbs} settings={settings}
              onConfirm={confirmScore} onUndo={unplay} onOverride={handleOverride} onTeamClick={openDetail}
              onWeekChange={(id, w) => setFixtures(prev => prev.map(f => f.id === id ? { ...f, week: w } : f))} />
          )}

          {tab === "monte" && (
            <MCTab key={played.length} teams={teams} fixtures={initFixtures} settings={settings} ranking={league.ranking}
              highlightTop={hlTop} highlightBottom={hlBot}
              onConfirmed={(ct, cb) => { setConfirmedTop(ct); setConfirmedBottom(cb); }} />
          )}

          {tab === "settings" && (
            <SettingsPanel settings={settings} onChange={(k, v) => setSettings(s => ({ ...s, [k]: v }))} showTiebreakers={true} league={league} onLeagueChange={setLeague} readOnly={IS_SHARE} />
          )}

          <div className="nav-row">
            {onBack && <button className="btn btn-ghost" onClick={onBack}>← Edit Fixtures</button>}
          </div>
        </div>
      )}

      {detail && (() => {
        let t = null, idx = null, fx = initFixtures, tms = teams;
        if (detail.source === "regular") { idx = detail.idx; t = teams[idx]; }
        else if (detail.source === "playoff" && playoffs) { tms = playoffs.teams; fx = playoffs.fixtures; idx = detail.idx; t = playoffs.teams[idx]; }
        else if (detail.source === "playdown" && playdowns) { tms = playdowns.teams; fx = playdowns.fixtures; idx = detail.idx; t = playdowns.teams[idx]; }
        if (!t) return null;
        return <TeamDetail team={t} teamIdx={idx} teams={tms} fixtures={fx} onClose={() => setDetail(null)} leagueId={league.name} aliases={league.scorerAliases || {}} phase={detail.source === "playoff" ? "playoff" : detail.source === "playdown" ? "playdown" : "regular"} />;
      })()}
    </div>
  );
}

// ── LEAGUE EDITOR ─────────────────────────────────────────────────────────────
export function LeagueEditor({ league, onChange }) {
  const isLive = !!league.vhvLive;
  const [step, setStep] = useState(isLive ? 2 : (league.step || 0));

  function set(field) {
    return u => onChange(lg => ({ ...lg, [field]: typeof u === "function" ? u(lg[field]) : u }));
  }
  function setSettings(u) {
    onChange(lg => ({ ...lg, settings: typeof u === "function" ? u(lg.settings || defaultSettings()) : u }));
  }
  function goStep(s) { setStep(s); onChange(lg => ({ ...lg, step: s })); }

  const LABELS = ["Teams", "Fixtures", "Simulate"];

  return (
    <div>
      {!isLive && (
        <div className="steps">
          {LABELS.map((l, i) => (
            <div key={i} className={"step" + (step === i ? " on" : step > i ? " done" : "")}
              onClick={() => { if (i <= step) goStep(i); }}>
              {step > i ? "✓ " : ""}{l}
            </div>
          ))}
        </div>
      )}
      {!isLive && step === 0 && (
        <TeamsStep teams={league.teams} fixtures={league.fixtures} setTeams={set("teams")} leagueType={league.type} onNext={() => goStep(1)} />
      )}
      {!isLive && step === 1 && (
        <FixturesStep teams={league.teams} fixtures={league.fixtures} setFixtures={set("fixtures")}
          settings={league.settings || defaultSettings()} setSettings={setSettings}
          onBack={() => goStep(0)} onNext={() => goStep(2)} />
      )}
      {(isLive || step === 2) && (
        <SimStep league={league} setLeague={onChange} onBack={isLive ? null : () => goStep(1)} />
      )}
    </div>
  );
}
