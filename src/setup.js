import { makeFixtures, makeTeam } from "./leagueModel.js";
import { calcProbs } from "./probabilities.js";
import { IS_SHARE } from "./config.js";
import { cleanTeamName } from "./names.js";
import { SettingsPanel } from "./SettingsPanel.js";
const { useState, useMemo } = React;
// ── STEP 1: TEAMS ─────────────────────────────────────────────────────────────
export function TeamsStep({ teams, fixtures, setTeams, leagueType, onNext }) {
  function update(id, field, val) {
    setTeams(prev => prev.map(t => t.id === id ? { ...t, [field]: val } : t));
  }
  function addTeam() {
    setTeams(prev => [...prev, makeTeam(prev.length)]);
  }
  function removeTeam(id) {
    const ti = teams.findIndex(t => t.id === id);
    if (fixtures.some(f => f.homeIdx === ti || f.awayIdx === ti)) return;
    setTeams(prev => prev.filter(t => t.id !== id));
  }
  const minTeams = leagueType === "playoff" ? 10 : 2;

  return (
    <div className="panel">
      <div className="ph">
        <span className="ph-num">01</span>
        <div>
          <h2>League Setup</h2>
          <p>Name, starting points, optional home advantage override (H%) per team.{leagueType === "playoff" ? " Min 10 teams." : ""}</p>
        </div>
      </div>
      {teams.map((t, i) => {
        const hasF = fixtures.some(f => f.homeIdx === i || f.awayIdx === i);
        return (
          <div key={t.id}>
            <div className="team-row">
              <span className="team-num">#{i + 1}</span>
              <input className="inp team-name-inp" value={t.name} autoComplete="off" onChange={e => update(t.id, "name", e.target.value)} placeholder={"Team " + (i + 1)} />
              <div className="team-extras">
                <input className="inp inp-sm team-pts-inp" type="number" min="0" value={t.points} onChange={e => update(t.id, "points", parseInt(e.target.value) || 0)} placeholder="0" title="Starting points" />
                <span className="muted team-pts-lbl" style={{ fontSize: ".7rem", whiteSpace: "nowrap" }}>pts</span>
                <input className="inp inp-sm team-hbonus-inp" type="number" min="0" max="100" value={t.homeBonus} onChange={e => update(t.id, "homeBonus", e.target.value)} placeholder="H%" title="Home advantage override" />
                <span className="muted team-hbonus-lbl" style={{ fontSize: ".7rem" }}>H%</span>
                <button className="btn-rm team-del" onClick={() => removeTeam(t.id)} style={{ color: hasF ? "#3a3f50" : undefined, cursor: hasF ? "not-allowed" : "pointer" }}>✕</button>
              </div>
            </div>
            {hasF && <div className="warn-txt">This team has fixtures — remove them first to delete this team.</div>}
          </div>
        );
      })}
      <button className="btn-add" style={{ marginTop: ".6rem" }} onClick={addTeam}>+ Add Team</button>
      <div className="nav-row">
        <button className="btn btn-cyan" onClick={onNext} disabled={teams.length < minTeams}>
          Set Fixtures {teams.length < minTeams ? "(need " + (minTeams - teams.length) + " more)" : "→"}
        </button>
      </div>
    </div>
  );
}

// ── STEP 2: FIXTURES ──────────────────────────────────────────────────────────
export function FixturesStep({ teams, fixtures, setFixtures, settings, setSettings, onBack, onNext }) {
  const [hi, setHi] = useState(0);
  const [ai, setAi] = useState(Math.min(1, teams.length - 1));
  const [week, setWeek] = useState(1);
  const ok = hi !== ai;
  const preview = useMemo(() => calcProbs(hi, ai, teams, fixtures, settings), [hi, ai, teams, fixtures, settings]);

  const liveProbs = useMemo(() => {
    const m = {};
    fixtures.forEach(f => { m[f.id] = calcProbs(f.homeIdx, f.awayIdx, teams, fixtures, settings); });
    return m;
  }, [fixtures, teams, settings]);

  function addOne() {
    if (!ok) return;
    const p = calcProbs(hi, ai, teams, fixtures, settings);
    setFixtures(prev => [...prev, { id: "f" + Date.now(), homeIdx: hi, awayIdx: ai, homeWin: p.homeWin, draw: p.draw, awayWin: p.awayWin, overrideOn: false, ovHW: "", ovD: "", ovAW: "", played: false, homeScore: null, awayScore: null, week: week }]);
  }

  function autoGenerate() {
    if (fixtures.length > 0 && !confirm("Replace all current fixtures with an auto-generated 2-round robin?")) return;
    setFixtures(makeFixtures(teams, settings));
  }

  function remove(id) { setFixtures(prev => prev.filter(f => f.id !== id)); }

  return (
    <div className="panel">
      <div className="ph">
        <span className="ph-num">02</span>
        <div><h2>Fixtures</h2><p>Probabilities are calculated automatically from current standings.</p></div>
      </div>
      <SettingsPanel settings={settings} onChange={(k, v) => setSettings(s => ({ ...s, [k]: v }))} showTiebreakers={false} readOnly={IS_SHARE} />
      <div style={{ marginBottom: "1.1rem" }}>
        <div className="row" style={{ marginBottom: ".6rem" }}>
          <select className="inp sel" value={hi} onChange={e => setHi(+e.target.value)}>
            {teams.map((t, i) => <option key={i} value={i}>{cleanTeamName(t.name)}</option>)}
          </select>
          <span className="vs">vs</span>
          <select className="inp sel" value={ai} onChange={e => setAi(+e.target.value)}>
            {teams.map((t, i) => <option key={i} value={i}>{cleanTeamName(t.name)}</option>)}
          </select>
        </div>
        <div className="prob-bar">
          <span className="muted">Auto:</span>
          <span className="ph-col">{preview.homeWin}% {cleanTeamName(teams[hi]?.name)}</span>
          <span className="muted">·</span>
          <span className="pd-col">{preview.draw}% Draw</span>
          <span className="muted">·</span>
          <span className="pa-col">{preview.awayWin}% {cleanTeamName(teams[ai]?.name)}</span>
        </div>
        <div style={{ display: "flex", gap: ".5rem", marginTop: ".65rem", flexWrap: "wrap", alignItems: "center" }}>
          <span className="lbl" style={{ marginBottom: 0, whiteSpace: "nowrap" }}>Week:</span>
          <input className="inp" type="number" min="1" max="999" value={week} onChange={e => setWeek(parseInt(e.target.value) || 1)} style={{ width: "4rem", textAlign: "center", fontFamily: "DM Mono,monospace" }} />
          <button className="btn-add" onClick={addOne} disabled={!ok}>+ Add Match</button>
          <button className="btn-add-pu" onClick={autoGenerate} disabled={teams.length < 2}>⚡ Auto 2-round robin</button>
        </div>
      </div>
      {fixtures.length > 0 && (
        <div>
          <div className="sub-ttl">Scheduled ({fixtures.length})</div>
          {fixtures.map(f => {
            const p = liveProbs[f.id] || f;
            return (
              <div key={f.id} className="fix-item">
                <div style={{ display: "flex", alignItems: "center", gap: ".3rem", flexShrink: 0 }}>
                  <span className="lbl" style={{ marginBottom: 0, fontSize: ".65rem" }}>W</span>
                  <input
                    type="number" min="1" max="999"
                    value={f.week ?? ""}
                    placeholder="—"
                    onChange={e => {
                      const v = e.target.value === "" ? null : parseInt(e.target.value) || null;
                      setFixtures(prev => prev.map(x => x.id === f.id ? { ...x, week: v } : x));
                    }}
                    style={{ width: "3rem", textAlign: "center", padding: ".22rem .3rem", fontFamily: "DM Mono,monospace", fontSize: ".8rem", background: "#0d1117", border: "1px solid #252830", color: "#22d3ee", borderRadius: "4px", outline: "none" }}
                  />
                </div>
                <div className="fix-teams"><b>{cleanTeamName(teams[f.homeIdx]?.name)}</b><span className="vs">vs</span><b>{cleanTeamName(teams[f.awayIdx]?.name)}</b></div>
                <div className="fix-probs">
                  <span className="ph-col">{p.homeWin}%</span>
                  <span className="pd-col">{p.draw}%</span>
                  <span className="pa-col">{p.awayWin}%</span>
                </div>
                <button className="btn-rm" onClick={() => remove(f.id)}>✕</button>
              </div>
            );
          })}
        </div>
      )}
      <div className="nav-row">
        <button className="btn btn-ghost" onClick={onBack}>← Back</button>
        <button className="btn btn-cyan" onClick={onNext} disabled={fixtures.length === 0}>Continue →</button>
      </div>
    </div>
  );
}
