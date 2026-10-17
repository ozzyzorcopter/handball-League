import { cleanTeamName, buildClubIndex, resolveClubName } from "./src/names.js";
import { LANG_LOCALE, useLang, LangSwitch } from "./src/i18n.js";
import { teamKey, useFollow, teamSnapshot } from "./src/follow.js";
import { calcProbs, calcProbsNeutral, fixProbs, predictMatch, weekBounds } from "./src/probabilities.js";
import { calcStats } from "./src/standings.js";
import { runMCAsync } from "./src/mcRunner.js";
import { GITHUB_PAT_KEY, githubDispatch } from "./src/github.js";
import { ScorerPanel, useScorers } from "./src/scorers.js";
import { generateTournament, resolveRef } from "./src/tournament.js";
import { FED_META, useVhvData } from "./src/vhvData.js";
import { ClubPicker, PICKER_DISMISS_KEY } from "./src/ClubPicker.js";
import { useArchiveFile, useArchiveIndex, useArchiveSeason, useStandaloneLeagues } from "./src/archiveData.js";
import { ErrorBoundary } from "./src/ErrorBoundary.js";
import { PlayersTab } from "./src/PlayersTab.js";

const { useState, useMemo, useRef, useEffect } = React;
const MEDALS = ["🥇", "🥈", "🥉"];
const IS_SHARE = __SHARE__; // injected at build time by build.mjs (esbuild --define); true only for the share page

// ── SAVE / LOAD ──────────────────────────────────────────────────────────────
function saveData(data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement("a"), { href: url, download: "leaguesim-data.json" });
  a.click();
  URL.revokeObjectURL(url);
}

function loadData() {
  return new Promise((resolve, reject) => {
    const input = Object.assign(document.createElement("input"), { type: "file", accept: ".json" });
    input.onchange = () => {
      const reader = new FileReader();
      reader.onload = e => {
        try { resolve(JSON.parse(e.target.result)); }
        catch { reject("Invalid file"); }
      };
      reader.readAsText(input.files[0]);
    };
    input.click();
  });
}

function defaultSettings() {
  return { baseWin: 47, baseDraw: 6, homeBonus: 10, rankBonus: 3, winScore: 30, lossScore: 25, drawScore: 25 };
}

function makeTeam(index) {
  return { id: "t" + Date.now() + index, name: "Team " + (index + 1), points: 0, homeBonus: "" };
}

function makeLeague(name, type, poSize, pdSize, phaseFormat, archivable = false) {
  return {
    id: String(Date.now()), name, type: type || "standard",
    teams: [makeTeam(0)], fixtures: [], step: 0,
    settings: defaultSettings(),
    playoffs: null, playdowns: null,
    poSize: poSize || 6,
    pdSize: pdSize || 4,
    phaseFormat: phaseFormat || "round-robin",
    promoTop: 2,
    demotBot: 2,
    archivable,
    scorerUrl: "",
    playoffScorerUrl: "",
    playdownScorerUrl: "",
    scorerAliases: {},
  };
}

// ── FIXTURE GENERATOR ────────────────────────────────────────────────────────
// Generates a 2-round robin: each pair plays twice (A hosts B, B hosts A).
// n teams → n*(n-1) fixtures total.
function makeFixtures(teams, settings) {
  const n = teams.length;
  let counter = 0;
  const id = () => "f" + (counter++);
  const fixtures = [];
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const p1 = calcProbs(i, j, teams, [], settings);
      const p2 = calcProbs(j, i, teams, [], settings);
      fixtures.push({ id: id(), homeIdx: i, awayIdx: j, homeWin: p1.homeWin, draw: p1.draw, awayWin: p1.awayWin, overrideOn: false, ovHW: "", ovD: "", ovAW: "", played: false, homeScore: null, awayScore: null, week: null });
      fixtures.push({ id: id(), homeIdx: j, awayIdx: i, homeWin: p2.homeWin, draw: p2.draw, awayWin: p2.awayWin, overrideOn: false, ovHW: "", ovD: "", ovAW: "", played: false, homeScore: null, awayScore: null, week: null });
    }
  }
  return fixtures;
}

// ── HELPERS ───────────────────────────────────────────────────────────────────
function heatColor(v) {
  if (v < 0.01) return "transparent";
  const t = Math.min(v / 55, 1);
  return "rgba(" + Math.round(30 + t * 220) + "," + Math.round(180 - t * 120) + "," + Math.round(120 - t * 70) + "," + (0.12 + t * 0.78) + ")";
}

function fmtPct(v) {
  if (v < 0.001) return "";
  if (v < 0.1) return "<0.1%";
  return v.toFixed(1) + "%";
}

// ── PAT SETTINGS ─────────────────────────────────────────────────────────────
function PATSettings() {
  const [pat, setPat] = useState(() => localStorage.getItem(GITHUB_PAT_KEY) || "");
  const [saved, setSaved] = useState(false);

  function save() {
    if (pat.trim()) {
      localStorage.setItem(GITHUB_PAT_KEY, pat.trim());
    } else {
      localStorage.removeItem(GITHUB_PAT_KEY);
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div style={{ display: "flex", gap: ".5rem", alignItems: "center", flexWrap: "wrap" }}>
      <input
        className="inp"
        type="password"
        value={pat}
        onChange={e => { setPat(e.target.value); setSaved(false); }}
        placeholder="github_pat_..."
        style={{ flex: 1, minWidth: "200px", fontSize: ".78rem", padding: ".4rem .6rem", fontFamily: "var(--font-mono)" }}
      />
      <button className="btn btn-ghost" onClick={save} style={{ whiteSpace: "nowrap" }}>
        {saved ? "✓ Saved" : "Save PAT"}
      </button>
      {pat && (
        <button className="btn-rm" onClick={() => { setPat(""); localStorage.removeItem(GITHUB_PAT_KEY); }}>✕</button>
      )}
    </div>
  );
}

// ── SETTINGS PANEL ────────────────────────────────────────────────────────────
function SettingsPanel({ settings, onChange, showTiebreakers, league, onLeagueChange, readOnly, belgian }) {
  const { t: tr } = useLang();
  const pf = [
    { k: "baseWin",   l: "Base Win %",      n: "Starting win % per side" },
    { k: "baseDraw",  l: "Base Draw %",      n: "Fixed, never adjusted" },
    { k: "homeBonus", l: "Global Home %",    n: "Used if no team override" },
    { k: "rankBonus", l: "Rank Gap % / pos", n: "Per effective position gap" },
  ];
  const sf = [
    { k: "winScore",  l: "Win score",  n: "Goals for winner" },
    { k: "lossScore", l: "Loss score", n: "Goals for loser" },
    { k: "drawScore", l: "Draw score", n: "Goals each side" },
  ];
  return (
    <div>
      <div className="sbox">
        <div className="sub-ttl">{tr("Probability settings")}</div>
        <div className="sgrid" style={{ gridTemplateColumns: "1fr 1fr 1fr 1fr" }}>
          {pf.map(({ k, l, n }) => (
            <div key={k} className="sfield">
              <span className="lbl">{tr(l)}</span>
              <input className="sinp" type="number" min="0" max="100" value={settings[k] || 0} onChange={e => onChange(k, parseFloat(e.target.value) || 0)} />
              <span className="snote">{tr(n)}</span>
            </div>
          ))}
        </div>
        <hr className="sdivider" />
        <div className="sub-ttl">{tr("Quick result scores")}</div>
        <div className="sgrid" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
          {sf.map(({ k, l, n }) => (
            <div key={k} className="sfield">
              <span className="lbl">{tr(l)}</span>
              <input className="sinp" type="number" min="0" value={settings[k] || 0} onChange={e => onChange(k, parseFloat(e.target.value) || 0)} />
              <span className="snote">{tr(n)}</span>
            </div>
          ))}
        </div>
      </div>
      {league && league.type !== "playoff" && onLeagueChange && (
        <div className="sbox">
          <div className="sub-ttl">{tr("Highlight zones")}</div>
          <div className="config-row" style={{ marginBottom: ".6rem" }}>
            <span style={{ fontSize: ".82rem", color: "#4ade80", minWidth: "140px" }}>{tr("Promotion (top):")}</span>
            <div className="config-opts">
              {[0,1,2,3,4].map(n => (
                <span key={n} className={"config-opt" + ((league.promoTop ?? 2) === n ? " sel" : "")}
                  style={(league.promoTop ?? 2) === n ? { borderColor: "#4ade80", background: "rgba(74,222,128,.1)", color: "#4ade80" } : {}}
                  onClick={() => onLeagueChange(lg => ({ ...lg, promoTop: n }))}>{n}</span>
              ))}
            </div>
          </div>
          <div className="config-row">
            <span style={{ fontSize: ".82rem", color: "#f87171", minWidth: "140px" }}>{tr("Relegation (bottom):")}</span>
            <div className="config-opts">
              {[0,1,2,3,4].map(n => (
                <span key={n} className={"config-opt" + ((league.demotBot ?? 2) === n ? " sel" : "")}
                  style={(league.demotBot ?? 2) === n ? { borderColor: "#f87171", background: "rgba(248,113,113,.1)", color: "#f87171" } : {}}
                  onClick={() => onLeagueChange(lg => ({ ...lg, demotBot: n }))}>{n}</span>
              ))}
            </div>
          </div>
        </div>
      )}
      {showTiebreakers && !belgian && league && onLeagueChange && !readOnly && (
        <div className="sbox">
          <div className="sub-ttl">Scorer data</div>
          <div style={{ marginBottom: ".75rem" }}>
            <div style={{ fontSize: ".78rem", color: "#5a6070", marginBottom: ".35rem" }}>Regular season scorer URL</div>
            <input
              className="inp"
              value={league.scorerUrl || ""}
              onChange={e => onLeagueChange(lg => ({ ...lg, scorerUrl: e.target.value.trim() }))}
              placeholder="https://admin.handballbelgium.be/...?organization=VHV&serie=655"
              style={{ fontSize: ".78rem", padding: ".4rem .6rem" }}
            />
          </div>
          {league.type === "playoff" && (
            <>
              <div style={{ marginBottom: ".75rem" }}>
                <div style={{ fontSize: ".78rem", color: "#5a6070", marginBottom: ".35rem" }}>Play-off scorer URL</div>
                <input
                  className="inp"
                  value={league.playoffScorerUrl || ""}
                  onChange={e => onLeagueChange(lg => ({ ...lg, playoffScorerUrl: e.target.value.trim() }))}
                  placeholder="https://admin.handballbelgium.be/...?organization=VHV&serie=869"
                  style={{ fontSize: ".78rem", padding: ".4rem .6rem" }}
                />
              </div>
              <div style={{ marginBottom: ".75rem" }}>
                <div style={{ fontSize: ".78rem", color: "#5a6070", marginBottom: ".35rem" }}>Play-down scorer URL</div>
                <input
                  className="inp"
                  value={league.playdownScorerUrl || ""}
                  onChange={e => onLeagueChange(lg => ({ ...lg, playdownScorerUrl: e.target.value.trim() }))}
                  placeholder="https://admin.handballbelgium.be/...?organization=VHV&serie=870"
                  style={{ fontSize: ".78rem", padding: ".4rem .6rem" }}
                />
              </div>
            </>
          )}
          <div>
            <div style={{ fontSize: ".78rem", color: "#5a6070", marginBottom: ".35rem" }}>Team name aliases (leaguesim name → scorer club name)</div>
            {(league.teams || []).map(t => (
              <div key={t.id} className="config-row" style={{ marginBottom: ".4rem", alignItems: "center" }}>
                <span style={{ fontSize: ".75rem", color: "#cdd6f4", minWidth: "140px", flexShrink: 0 }}>{t.name}</span>
                <span style={{ fontSize: ".75rem", color: "#5a6070", margin: "0 .4rem" }}>→</span>
                <input
                  className="sinp"
                  value={(league.scorerAliases || {})[t.name] || ""}
                  onChange={e => onLeagueChange(lg => ({ ...lg, scorerAliases: { ...(lg.scorerAliases || {}), [t.name]: e.target.value } }))}
                  placeholder={t.name}
                  style={{ flex: 1, fontSize: ".75rem" }}
                />
              </div>
            ))}
            <div style={{ fontSize: ".7rem", color: "#3a3f50", marginTop: ".4rem" }}>Leave blank if the name already matches the scorer data exactly.</div>
          </div>
        </div>
      )}
      {showTiebreakers && (
        <div className="sbox">
          <div className="sub-ttl">{tr("End-of-season tiebreakers (always applied)")}</div>
          <ul className="tb-list">
            {[
              "Most wins overall",
              "Most points in head-to-head matches among tied teams",
              "Best goal difference in those head-to-head matches",
              "Most goals scored as away team in tied opponents home fixtures",
              "Best overall goal difference",
              "Alphabetical (final fallback)",
            ].map((tb, i) => (
              <li key={i}><span className="tb-num">{i + 1}.</span>{tr(tb)}</li>
            ))}
          </ul>
        </div>
      )}
      {!IS_SHARE && !belgian && (
        <div className="sbox">
          <div className="sub-ttl">GitHub PAT <span style={{ fontSize: ".72rem", fontWeight: 400, color: "#5a6070" }}>— required for archiving leagues</span></div>
          <div style={{ fontSize: ".78rem", color: "#5a6070", marginBottom: ".6rem" }}>
            Create a Personal Access Token with <strong>repo</strong> scope at github.com/settings/tokens and paste it here. Stored locally in your browser only.
          </div>
          <PATSettings />
        </div>
      )}
    </div>
  );
}

// ── HOME SCREEN ───────────────────────────────────────────────────────────────
function HomeScreen({ leagues, onOpen, onCreate, onDelete, onToggleArchivable, onOpenArchive, onOpenBelgian, onArchiveLeague }) {
  const [modal, setModal] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState("standard");
  const [poSize, setPoSize] = useState(6);
  const [pdSize, setPdSize] = useState(4);
  const [phaseFormat, setPhaseFormat] = useState("round-robin");
  const [customPo, setCustomPo] = useState("");
  const [customPd, setCustomPd] = useState("");
  const [archivable, setArchivable] = useState(false);
  const effPoSize = customPo !== "" ? (parseInt(customPo) || 6) : poSize;
  const effPdSize = customPd !== "" ? (parseInt(customPd) || 4) : pdSize;

  function submit() {
    if (!name.trim()) return;
    onCreate(name.trim(), type, effPoSize, effPdSize, phaseFormat, archivable);
    setName(""); setType("standard"); setPoSize(6); setPdSize(4);
    setPhaseFormat("round-robin"); setCustomPo(""); setCustomPd(""); setArchivable(false);
    setModal(false);
  }

  return (
    <div>
      <div className="card-grid">
        {leagues.map(lg => (
          <div key={lg.id} className="card" style={{ position: "relative" }} onClick={() => onOpen(lg.id)}>
            <button className="card-del" onClick={e => { e.stopPropagation(); onDelete(lg.id); }}>✕</button>
            <div className={"card-badge " + (lg.type === "playoff" ? "badge-po" : "badge-std")}>
              {lg.type === "playoff" ? "Play-off League" : "Standard League"}
            </div>
            <div className="card-name">{lg.name}</div>
            <div className="card-meta">
              {(lg.teams || []).length} teams · {(lg.fixtures || []).filter(f => !f.played).length} pending · {(lg.fixtures || []).filter(f => f.played).length} played
              {lg.vhvLive && (
                <span style={{ display: "inline-block", marginLeft: ".4rem", fontSize: ".65rem", fontWeight: 700, color: "#4ade80", border: "1px solid #4ade80", borderRadius: "3px", padding: ".05rem .3rem", letterSpacing: ".04em" }}>● LIVE</span>
              )}
              {lg.type === "playoff" && (() => {
                const poPending = (lg.playoffs?.fixtures || []).filter(f => !f.played).length;
                const pdPending = (lg.playdowns?.fixtures || []).filter(f => !f.played).length;
                const poNotGen = !lg.playoffs;
                const pdNotGen = !lg.playdowns;
                return (
                  <span>
                    {" · "}
                    <span style={{ color: poNotGen ? "#f87171" : poPending > 0 ? "#facc15" : "#4ade80" }}>
                      PO: {poNotGen ? "not generated" : poPending > 0 ? poPending + " pending" : "done"}
                    </span>
                    {" · "}
                    <span style={{ color: pdNotGen ? "#f87171" : pdPending > 0 ? "#facc15" : "#4ade80" }}>
                      PD: {pdNotGen ? "not generated" : pdPending > 0 ? pdPending + " pending" : "done"}
                    </span>
                  </span>
                );
              })()}
            </div>
            <button
              className="card-archive-btn"
              title="Archive this league"
              onClick={e => { e.stopPropagation(); onArchiveLeague(lg); }}>
              📦
            </button>
          </div>
        ))}
        {!IS_SHARE && <div className="card card-new" onClick={() => setModal(true)}>+ New League</div>}
        <div className="card card-new" style={{ borderColor: "#4ade80", color: "#4ade80" }} onClick={onOpenBelgian}>🇧🇪 Belgian Handball</div>
        <div className="card card-new" style={{ borderColor: "#fbbf24", color: "#fbbf24" }} onClick={onOpenArchive}>📦 Archive</div>
      </div>

      {modal && (
        <div className="overlay-c" onClick={() => setModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>New League</h3>
            <input className="inp" autoFocus value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.key === "Enter" && submit()} placeholder="League name" style={{ marginBottom: ".85rem" }} />
            <div className="type-cards">
              <div className={"type-card" + (type === "standard" ? " sel" : "")} onClick={() => setType("standard")}>
                <div className="type-card-title">Standard</div>
                <div className="type-card-desc">Regular season only. Top 2 promoted, bottom 2 relegated.</div>
              </div>
              <div className={"type-card" + (type === "playoff" ? " sel po" : "")} onClick={() => setType("playoff")}>
                <div className="type-card-title">Play-off</div>
                <div className="type-card-desc">Regular season with post-season phases.</div>
              </div>
            </div>
            {type === "playoff" && (
              <div className="phase-config" style={{ marginTop: ".75rem" }}>
                <div className="phase-config-title">Phase configuration</div>
                <div className="config-row">
                  <span className="config-label">Play-off teams:</span>
                  <div className="config-opts">
                    {[4, 6, 8].map(n => <span key={n} className={"config-opt" + (poSize === n && customPo === "" ? " sel" : "")} onClick={() => { setPoSize(n); setCustomPo(""); }}>{n}</span>)}
                    <input className="config-inp" type="number" min="2" placeholder="Other" value={customPo} onChange={e => setCustomPo(e.target.value)} style={{ width: "4.5rem" }} />
                  </div>
                </div>
                <div className="config-row">
                  <span className="config-label">Play-down teams:</span>
                  <div className="config-opts">
                    {[2, 4, 6].map(n => <span key={n} className={"config-opt" + (pdSize === n && customPd === "" ? " sel" : "")} onClick={() => { setPdSize(n); setCustomPd(""); }}>{n}</span>)}
                    <input className="config-inp" type="number" min="2" placeholder="Other" value={customPd} onChange={e => setCustomPd(e.target.value)} style={{ width: "4.5rem" }} />
                  </div>
                </div>
                <div className="config-row">
                  <span className="config-label">Format:</span>
                  <div className="config-opts">
                    <span className={"config-opt" + (phaseFormat === "round-robin" ? " sel" : "")} onClick={() => setPhaseFormat("round-robin")}>2-Round Robin</span>
                    <span className={"config-opt" + (phaseFormat === "tournament" ? " sel" : "")} onClick={() => setPhaseFormat("tournament")}>Tournament</span>
                  </div>
                </div>
              </div>
            )}
            <div className="config-row" style={{ marginTop: ".85rem" }}>
              <span className="config-label">Include in archive:</span>
              <div className="config-opts">
                <span className={"config-opt" + (archivable ? " active" : "")}
                  style={archivable ? { borderColor: "#fbbf24", background: "rgba(251,191,36,.1)", color: "#fbbf24" } : {}}
                  onClick={() => setArchivable(a => !a)}>
                  📦 {archivable ? "Yes" : "No"}
                </span>
              </div>
            </div>
            <div className="modal-btns">
              <button className="btn btn-cyan" onClick={submit} disabled={!name.trim()}>Create</button>
              <button className="btn btn-ghost" onClick={() => setModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── TEAM DETAIL PANEL ─────────────────────────────────────────────────────────
function TeamDetail({ team, teamIdx, teams, fixtures, onClose, leagueId, aliases, archiveScorers, phase }) {
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

function TeamScorers({ leagueId, teamName, aliases, archiveScorers, phase }) {
  const live = useScorers(archiveScorers !== undefined ? null : leagueId, phase);
  const scorers = archiveScorers !== undefined ? archiveScorers : live.scorers;
  const error = archiveScorers !== undefined ? false : live.error;
  return <ScorerPanel scorers={scorers} error={error} filterClub={teamName} title={cleanTeamName(teamName) + " Scorers"} maxRows={5} aliases={aliases} />;
}

function ToughPanel({ ranking }) {
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

function LeagueScorers({ leagueId, teams, aliases, archiveScorers, phaseTeams, phase, title, maxRows }) {
  const live = useScorers(archiveScorers !== undefined ? null : leagueId, phase);
  const scorers = archiveScorers !== undefined ? archiveScorers : live.scorers;
  const error = archiveScorers !== undefined ? false : live.error;
  const relevantTeams = phaseTeams || teams;
  const clubIndex = useMemo(() => buildClubIndex(scorers), [scorers]);
  const clubNames = useMemo(() => new Set(relevantTeams.map(t => resolveClubName(t.name, aliases, clubIndex))), [relevantTeams, aliases, clubIndex]);
  const filtered = useMemo(() => scorers ? scorers.filter(s => clubNames.has(s.club)) : null, [scorers, clubNames]);
  return <ScorerPanel scorers={filtered} error={error} title={title || "Top Scorers"} maxRows={maxRows || 10} aliases={aliases} />;
}

// ── LEAGUE TABLE ──────────────────────────────────────────────────────────────
function LeagueTable({ teams, fixtures, ranking, onTeamClick, highlightTop, highlightBottom, confirmedTop, confirmedBottom, leagueId, aliases, archiveScorers, phaseTeams, phase, toughFullWidth, topSingleGamePlayers, travelRanking, followKey, hideScorers }) {
  const rows = useMemo(() => calcStats(teams, fixtures, ranking), [teams, fixtures, ranking]);
  const follow = useFollow();
  const { t } = useLang();
  const isMine = id => !!followKey && follow.isFollowing(teamKey(followKey, id));
  const nm = idx => (teams[idx] && isMine(teams[idx].id) ? "★ " : "") + cleanTeamName(teams[idx].name);

  // Last 5 results per team (oldest → newest). Played fixtures are ordered by
  // date when present (ISO strings sort correctly); fixtures without a date
  // (e.g. results entered manually in the sim) keep their list order.
  const formById = useMemo(() => {
    const played = fixtures
      .map((f, idx) => ({ f, idx }))
      .filter(({ f }) => f.played && f.homeScore != null && f.awayScore != null)
      .sort((a, b) => {
        const da = a.f.date || "", db = b.f.date || "";
        if (da !== db && da && db) return da < db ? -1 : 1;
        return a.idx - b.idx;
      });
    const m = {};
    played.forEach(({ f }) => {
      const hg = +f.homeScore, ag = +f.awayScore;
      if (isNaN(hg) || isNaN(ag)) return;
      const hid = teams[f.homeIdx]?.id, aid = teams[f.awayIdx]?.id;
      if (hid == null || aid == null) return;
      (m[hid] = m[hid] || []).push(hg > ag ? "W" : hg < ag ? "L" : "D");
      (m[aid] = m[aid] || []).push(ag > hg ? "W" : ag < hg ? "L" : "D");
    });
    Object.keys(m).forEach(k => { m[k] = m[k].slice(-5); });
    return m;
  }, [fixtures, teams]);

  // Weekly windows, rolling over every Monday: "last week" = the previous
  // Monday up to (not including) this Monday (played games); "this week" =
  // this Monday up to (not including) next Monday (played AND upcoming — a
  // game stays here once played until the Monday rollover). Computed from the viewer's current date,
  // so the panels roll over on their own each Monday.
  const weekWindow = useMemo(() => {
    const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const now = new Date();
    const thisMon = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7));
    const prevMon = new Date(thisMon.getFullYear(), thisMon.getMonth(), thisMon.getDate() - 7);
    const nextMon = new Date(thisMon.getFullYear(), thisMon.getMonth(), thisMon.getDate() + 7);
    const lastSun = new Date(thisMon.getFullYear(), thisMon.getMonth(), thisMon.getDate() - 1);
    const nextSun = new Date(nextMon.getFullYear(), nextMon.getMonth(), nextMon.getDate() - 1);
    return { prev: iso(prevMon), cur: iso(thisMon), next: iso(nextMon), prevEnd: iso(lastSun), nextEnd: iso(nextSun) };
  }, []);
  const byDate = (a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
  const lastMatches = useMemo(() => fixtures
    .filter(f => f.played && f.homeScore != null && f.awayScore != null && f.date
      && f.date.slice(0, 10) >= weekWindow.prev && f.date.slice(0, 10) < weekWindow.cur
      && teams[f.homeIdx] && teams[f.awayIdx])
    .sort(byDate), [fixtures, teams, weekWindow]);
  const nextMatches = useMemo(() => fixtures
    .filter(f => f.date
      && f.date.slice(0, 10) >= weekWindow.cur && f.date.slice(0, 10) < weekWindow.next
      && teams[f.homeIdx] && teams[f.awayIdx])
    .sort(byDate), [fixtures, teams, weekWindow]);
  const preds = useMemo(() => {
    const m = {};
    nextMatches.forEach(f => { if (!(f.played && f.homeScore != null)) m[f.id] = predictMatch(f.homeIdx, f.awayIdx, teams, fixtures); });
    return m;
  }, [nextMatches, teams, fixtures]);
  const fmtShort = d => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d || ""); return m ? `${m[3]}/${m[2]}` : "—"; };
  const fmtMatchDate = fmtShort;
  const hasPlayed = fixtures.some(f => f.played && f.homeScore != null);
  const n = rows.length;
  const attackers = useMemo(() => rows.filter(r => r.P > 0).sort((a, b) => b.GF - a.GF || a.name.localeCompare(b.name)).slice(0, 3), [rows]);
  const defenders = useMemo(() => rows.filter(r => r.P > 0).sort((a, b) => a.GA - b.GA || a.name.localeCompare(b.name)).slice(0, 3), [rows]);
  const allAttackers = useMemo(() => rows.filter(r => r.P > 0).sort((a, b) => b.GF - a.GF || a.name.localeCompare(b.name)), [rows]);
  const allDefenders = useMemo(() => rows.filter(r => r.P > 0).sort((a, b) => a.GA - b.GA || a.name.localeCompare(b.name)), [rows]);
  const [rankingPanel, setRankingPanel] = useState(null); // null | "attackers" | "defenders" | "tough" | "home" | "away" | "clutch" | "unlucky"

  // Tough team rankings
  // For each team T, build oppGD map: opponent name -> total GD for T vs that opponent
  // Then rank opponents toughest->easiest (lowest GD first)
  // tough-points: for each appearance in another team's opponent list, 
  //   points = max(0, N_opponents - rank)  where rank is 1-based
  const toughRanking = useMemo(() => {
    const played = fixtures.filter(f => f.played && f.homeScore != null && f.awayScore != null);
    const N = teams.length;
    const oppMap = teams.map(() => ({}));
    played.forEach(f => {
      const hi = f.homeIdx, ai = f.awayIdx;
      if (hi >= N || ai >= N) return;
      const hg = +f.homeScore, ag = +f.awayScore;
      oppMap[hi][ai] = (oppMap[hi][ai] || 0) + (hg - ag);
      oppMap[ai][hi] = (oppMap[ai][hi] || 0) + (ag - hg);
    });
    const toughPts = new Array(N).fill(0);
    teams.forEach((_, ti) => {
      const opps = Object.entries(oppMap[ti])
        .map(([oi, gd]) => ({ oi: +oi, gd }))
        .sort((a, b) => a.gd - b.gd); // ascending = toughest first
      const nOpps = opps.length;
      opps.forEach(({ oi }, rank0) => {
        toughPts[oi] += Math.max(0, nOpps - rank0 - 1);
      });
    });
    return teams.map((t, i) => ({ id: t.id, name: t.name, pts: toughPts[i] })).sort((a, b) => b.pts - a.pts || a.name.localeCompare(b.name));
  }, [fixtures, teams]);

  // Top 3 tough for mini card

  // Home GD ranking: sum of (homeScore - awayScore) for every played home fixture per team
  const homeGDRanking = useMemo(() => {
    const played = fixtures.filter(f => f.played && f.homeScore != null && f.awayScore != null);
    const N = teams.length;
    const gd = new Array(N).fill(0);
    const games = new Array(N).fill(0);
    played.forEach(f => {
      if (f.homeIdx < N) { gd[f.homeIdx] += (+f.homeScore - +f.awayScore); games[f.homeIdx]++; }
    });
    return teams.map((t, i) => ({ id: t.id, name: t.name, gd: gd[i], P: games[i] })).sort((a, b) => b.gd - a.gd || a.name.localeCompare(b.name));
  }, [fixtures, teams]);
  const topHome = homeGDRanking.slice(0, 3);

  // Away GD ranking: sum of (awayScore - homeScore) for every played away fixture per team
  const awayGDRanking = useMemo(() => {
    const played = fixtures.filter(f => f.played && f.homeScore != null && f.awayScore != null);
    const N = teams.length;
    const gd = new Array(N).fill(0);
    const games = new Array(N).fill(0);
    played.forEach(f => {
      if (f.awayIdx < N) { gd[f.awayIdx] += (+f.awayScore - +f.homeScore); games[f.awayIdx]++; }
    });
    return teams.map((t, i) => ({ id: t.id, name: t.name, gd: gd[i], P: games[i] })).sort((a, b) => b.gd - a.gd || a.name.localeCompare(b.name));
  }, [fixtures, teams]);
  const topAway = awayGDRanking.slice(0, 3);

  // Highest single-game score ranking: the best score any team put up in
  // one match (home or away), with who they beat/played and the date.
  const highGameRanking = useMemo(() => {
    const played = fixtures.filter(f => f.played && f.homeScore != null && f.awayScore != null);
    const N = teams.length;
    const best = new Array(N).fill(null);
    played.forEach(f => {
      const hi = f.homeIdx, ai = f.awayIdx;
      const hg = +f.homeScore, ag = +f.awayScore;
      if (hi < N && (!best[hi] || hg > best[hi].score)) {
        best[hi] = { score: hg, vs: teams[ai]?.name || "?", date: f.date };
      }
      if (ai < N && (!best[ai] || ag > best[ai].score)) {
        best[ai] = { score: ag, vs: teams[hi]?.name || "?", date: f.date };
      }
    });
    return teams
      .map((t, i) => ({ id: t.id, name: t.name, score: best[i]?.score ?? 0, vs: best[i]?.vs || "", date: best[i]?.date }))
      .filter(r => r.score > 0)
      .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  }, [fixtures, teams]);
  const topHighGame = highGameRanking.slice(0, 3);

  // Player-level highest single-game goal count, from the pre-computed
  // per-league boxscore ranking (topSingleGamePlayers) — empty until the
  // data pipeline has boxscores cached for this league's played games.
  const topHighGamePlayers = (topSingleGamePlayers || []).slice(0, 3);

  // Clutch ranking: games won by exactly 1 or 2 GD
  const clutchRanking = useMemo(() => {
    const played = fixtures.filter(f => f.played && f.homeScore != null && f.awayScore != null);
    const N = teams.length;
    const wins = new Array(N).fill(0);
    played.forEach(f => {
      const gd = +f.homeScore - +f.awayScore;
      if (gd === 1 || gd === 2) { if (f.homeIdx < N) wins[f.homeIdx]++; }
      if (gd === -1 || gd === -2) { if (f.awayIdx < N) wins[f.awayIdx]++; }
    });
    const sorted = teams.map((t, i) => ({ id: t.id, name: t.name, wins: wins[i] }))
      .sort((a, b) => b.wins - a.wins || a.name.localeCompare(b.name));
    // Mark ties: if a team has same wins as the next, flag as tied except the first alphabetically
    return sorted.map((r, i, arr) => ({
      ...r,
      tied: i > 0 && arr[i].wins === arr[i - 1].wins && arr[i - 1].wins > 0
    }));
  }, [fixtures, teams]);
  const topClutch = clutchRanking.slice(0, 3);

  // Unlucky ranking: draws and losses by 1 or 2 GD
  // points: draw = 3, loss by 1GD = 2, loss by 2GD = 1. Tiebreak: more draws first, then least total GD in those games, then alphabetical
  const unluckyRanking = useMemo(() => {
    const played = fixtures.filter(f => f.played && f.homeScore != null && f.awayScore != null);
    const N = teams.length;
    const data = teams.map(() => ({ draws: 0, losses1: 0, losses2: 0, gdSum: 0 }));
    played.forEach(f => {
      const gd = +f.homeScore - +f.awayScore;
      const absGd = Math.abs(gd);
      if (gd === 0) {
        if (f.homeIdx < N) { data[f.homeIdx].draws++; }
        if (f.awayIdx < N) { data[f.awayIdx].draws++; }
      } else if (absGd === 1) {
        if (gd > 0 && f.awayIdx < N) { data[f.awayIdx].losses1++; data[f.awayIdx].gdSum += 1; }
        if (gd < 0 && f.homeIdx < N) { data[f.homeIdx].losses1++; data[f.homeIdx].gdSum += 1; }
      } else if (absGd === 2) {
        if (gd > 0 && f.awayIdx < N) { data[f.awayIdx].losses2++; data[f.awayIdx].gdSum += 2; }
        if (gd < 0 && f.homeIdx < N) { data[f.homeIdx].losses2++; data[f.homeIdx].gdSum += 2; }
      }
    });
    return teams.map((t, i) => ({
      id: t.id, name: t.name,
      draws: data[i].draws,
      losses1: data[i].losses1,
      losses2: data[i].losses2,
      gdSum: data[i].gdSum,
      pts: (3 * data[i].draws) + (2 * data[i].losses1) + data[i].losses2
    })).sort((a, b) =>
      b.pts - a.pts ||
      b.draws - a.draws ||
      a.gdSum - b.gdSum ||
      a.name.localeCompare(b.name)
    );
  }, [fixtures, teams]);
  const topUnlucky = unluckyRanking.slice(0, 3);

  function rowBg(i, r) {
    if (confirmedTop && confirmedTop.has(r.id)) return "rgba(22,163,74,.45)";
    if (confirmedBottom && confirmedBottom.has(r.id)) return "rgba(185,28,28,.45)";
    if (highlightTop && i < highlightTop) return "rgba(22,101,52,.3)";
    if (highlightBottom && i >= n - highlightBottom) return "rgba(127,29,29,.3)";
    return "";
  }

  return (
    <div>
      <div className="tbl-wrap">
        <table className="ltbl">
          <thead>
            <tr>
              <th style={{ width: "2rem" }}>#</th>
              <th className="tl">{t("Team")}</th>
              <th title={t("Played")}>P</th>
              <th title={t("Won")}>W</th>
              <th title={t("Draw")}>D</th>
              <th title={t("Lost")}>L</th>
              <th title={t("Goals For")}>GF</th>
              <th title={t("Goals Against")}>GA</th>
              <th className="tgd" title={t("Goal Difference")}>GD</th>
              <th className="tpts" title={t("Points")}>Pts</th>
              <th title={t("Last 5 games (oldest → newest)")}>{t("Form")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const ti = teams.findIndex(t => t.id === r.id);
              const bg = rowBg(i, r);
              const gdc = r.GD > 0 ? "gdp" : r.GD < 0 ? "gdn" : "gd0";
              return (
                <tr key={r.id} style={{ ...(bg ? { background: bg } : {}), ...(isMine(r.id) ? { boxShadow: "inset 3px 0 0 #fbbf24" } : {}) }}>
                  <td className="tpos" style={bg ? { color: "rgba(255,255,255,0.85)", fontWeight: 700 } : {}}>{i + 1}</td>
                  <td className="tl">
                    {followKey && (
                      <button className="otbtn" style={{ marginRight: ".3rem", color: isMine(r.id) ? "#fbbf24" : "#6b7280", minWidth: "1.6rem" }}
                        aria-label={(isMine(r.id) ? "Unfollow " : "Follow ") + cleanTeamName(r.name)}
                        title={isMine(r.id) ? "Unfollow" : "Follow this team"}
                        onClick={() => follow.toggle(teamKey(followKey, r.id))}>{isMine(r.id) ? "★" : "☆"}</button>
                    )}
                    <button className="otbtn" onClick={() => onTeamClick && onTeamClick(ti)}>{cleanTeamName(r.name)}</button>
                  </td>
                  <td>{r.P}</td>
                  <td style={{ color: "#4ade80" }}>{r.W}</td>
                  <td style={{ color: "#facc15" }}>{r.D}</td>
                  <td style={{ color: "#f87171" }}>{r.L}</td>
                  <td>{r.GF}</td>
                  <td>{r.GA}</td>
                  <td className={gdc}>{r.GD > 0 ? "+" + r.GD : r.GD}</td>
                  <td className="tpts">{r.totalPts}</td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    {(formById[r.id] || []).map((res, k) => (
                      <span key={k} title={res === "W" ? "Win" : res === "D" ? "Draw" : "Loss"}
                        style={{ display: "inline-block", width: "1.1rem", textAlign: "center", fontWeight: 700, fontSize: ".78rem",
                          color: res === "W" ? "#4ade80" : res === "D" ? "#9ca3af" : "#f87171" }}>
                        {res === "W" ? "✓" : res === "D" ? "D" : "–"}
                      </span>
                    ))}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="note">{t("Click a team name for match details")}{followKey ? " · " + t("☆ follows a team (saved on this device)") : ""}</p>
      <div className="mini-box" style={{ marginTop: "1rem" }}>
        <div className="mini-ttl" style={{ color: "#22d3ee", display: "flex", justifyContent: "space-between" }}>
          <span>{t("🗓 Games last week")}</span>
          <span className="muted" style={{ fontWeight: 400, fontSize: ".7rem" }}>{fmtShort(weekWindow.prev)} – {fmtShort(weekWindow.prevEnd)}</span>
        </div>
        {lastMatches.length === 0 && <div className="muted" style={{ fontSize: ".78rem" }}>{t("No games last week.")}</div>}
        {lastMatches.map((f, k) => (
          <div key={f.id || k} className="mini-row" style={{ gap: ".5rem" }}>
            <span className="muted" style={{ fontFamily: "DM Mono,monospace", fontSize: ".7rem", minWidth: f.time ? "4.6rem" : "2.6rem" }}>{fmtMatchDate(f.date)}{f.time ? " " + f.time : ""}</span>
            <span style={{ fontSize: ".78rem" }}>
              <span style={{ fontWeight: +f.homeScore > +f.awayScore ? 700 : 400 }}>{nm(f.homeIdx)}</span>
              <span className="mini-val" style={{ margin: "0 .4rem", color: "#fbbf24" }}>{f.homeScore}–{f.awayScore}</span>
              <span style={{ fontWeight: +f.awayScore > +f.homeScore ? 700 : 400 }}>{nm(f.awayIdx)}</span>
            </span>
          </div>
        ))}
      </div>
      <div className="mini-box" style={{ marginTop: "1rem" }}>
        <div className="mini-ttl" style={{ color: "#a78bfa", display: "flex", justifyContent: "space-between" }}>
          <span>{t("⏭ Games this week")}</span>
          <span className="muted" style={{ fontWeight: 400, fontSize: ".7rem" }}>{fmtShort(weekWindow.cur)} – {fmtShort(weekWindow.nextEnd)}</span>
        </div>
        {nextMatches.length === 0 && <div className="muted" style={{ fontSize: ".78rem" }}>{t("No games this week.")}</div>}
        {nextMatches.map((f, k) => (
          <div key={f.id || k} className="mini-row" style={{ gap: ".5rem" }}>
            <span className="muted" style={{ fontFamily: "DM Mono,monospace", fontSize: ".7rem", minWidth: f.time ? "4.6rem" : "2.6rem" }}>{fmtMatchDate(f.date)}{f.time ? " " + f.time : ""}</span>
            <span style={{ fontSize: ".78rem" }}>
              {(() => {
                const done = f.played && f.homeScore != null && f.awayScore != null;
                return (
                  <>
                    <span style={{ fontWeight: done && +f.homeScore > +f.awayScore ? 700 : 400 }}>{nm(f.homeIdx)}</span>
                    {done
                      ? <span className="mini-val" style={{ margin: "0 .4rem", color: "#fbbf24" }}>{f.homeScore}–{f.awayScore}</span>
                      : <span className="muted" style={{ margin: "0 .4rem" }}>{t("vs")}</span>}
                    <span style={{ fontWeight: done && +f.awayScore > +f.homeScore ? 700 : 400 }}>{nm(f.awayIdx)}</span>
                    {!done && preds[f.id] && (
                      <span className="muted" title={t("Goal model: home win / draw / away win chance, expected score")} style={{ marginLeft: ".6rem", fontFamily: "DM Mono,monospace", fontSize: ".66rem" }}>
                        {preds[f.id].homeWin}% · {preds[f.id].draw}% · {preds[f.id].awayWin}% ({preds[f.id].eh}–{preds[f.id].ea})
                      </span>
                    )}
                  </>
                );
              })()}
            </span>
          </div>
        ))}
      </div>
      {!hideScorers && (leagueId || Array.isArray(archiveScorers)) && <LeagueScorers leagueId={leagueId} teams={teams} aliases={aliases} archiveScorers={archiveScorers} phaseTeams={phaseTeams} phase={phase} />}
      {hasPlayed && (
        <>
          {/* Row 1: Attackers + Defenders */}
          <div className="mini-rankings" style={{ marginTop: "1rem" }}>
            <div>
              <div className="mini-box" style={{ cursor: "pointer" }} onClick={() => setRankingPanel(rankingPanel === "attackers" ? null : "attackers")}>
                <div className="mini-ttl" style={{ color: "#f87171", userSelect: "none", display: "flex", justifyContent: "space-between" }}>
                  <span>{t("⚽ Top Attackers")}</span><span>{rankingPanel === "attackers" ? "▲" : "▼"}</span>
                </div>
                {attackers.map((r, i) => (
                  <div key={r.id} className="mini-row">
                    <span className="mini-pos">{MEDALS[i]}</span>
                    <span className="mini-name">{cleanTeamName(r.name)}</span>
                    <span className="mini-val" style={{ color: "#f87171" }}>{r.GF} GF</span>
                  </div>
                ))}
              </div>
              {rankingPanel === "attackers" && (
                <div className="ranking-expand">
                  <div style={{ fontSize: ".72rem", color: "#4a5060", marginBottom: ".5rem" }}>{t("Total goals scored across all played fixtures.")}</div>
                  {allAttackers.map((r, i) => (
                    <div key={r.id} className="mini-row">
                      <span className="mini-pos" style={{ minWidth: "1.8rem", color: i < 3 ? "#f87171" : "#3a3f50" }}>{i < 3 ? MEDALS[i] : (i+1)+"."}</span>
                      <span className="mini-name">{cleanTeamName(r.name)}</span>
                      <span className="mini-val" style={{ color: "#f87171" }}>{r.GF} GF</span>
                      <span className="muted" style={{ fontSize: ".72rem", marginLeft: ".25rem" }}>({r.P}g)</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div>
              <div className="mini-box" style={{ cursor: "pointer" }} onClick={() => setRankingPanel(rankingPanel === "defenders" ? null : "defenders")}>
                <div className="mini-ttl" style={{ color: "#4ade80", userSelect: "none", display: "flex", justifyContent: "space-between" }}>
                  <span>{t("🛡 Top Defenders")}</span><span>{rankingPanel === "defenders" ? "▲" : "▼"}</span>
                </div>
                {defenders.map((r, i) => (
                  <div key={r.id} className="mini-row">
                    <span className="mini-pos">{MEDALS[i]}</span>
                    <span className="mini-name">{cleanTeamName(r.name)}</span>
                    <span className="mini-val" style={{ color: "#4ade80" }}>{r.GA} GA</span>
                  </div>
                ))}
              </div>
              {rankingPanel === "defenders" && (
                <div className="ranking-expand">
                  <div style={{ fontSize: ".72rem", color: "#4a5060", marginBottom: ".5rem" }}>{t("Fewest goals conceded across all played fixtures.")}</div>
                  {allDefenders.map((r, i) => (
                    <div key={r.id} className="mini-row">
                      <span className="mini-pos" style={{ minWidth: "1.8rem", color: i < 3 ? "#4ade80" : "#3a3f50" }}>{i < 3 ? MEDALS[i] : (i+1)+"."}</span>
                      <span className="mini-name">{cleanTeamName(r.name)}</span>
                      <span className="mini-val" style={{ color: "#4ade80" }}>{r.GA} GA</span>
                      <span className="muted" style={{ fontSize: ".72rem", marginLeft: ".25rem" }}>({r.P}g)</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Row 2: Home + Away */}
          <div className="mini-rankings" style={{ marginTop: ".75rem" }}>
            <div>
              <div className="mini-box" style={{ cursor: "pointer" }} onClick={() => setRankingPanel(rankingPanel === "home" ? null : "home")}>
                <div className="mini-ttl" style={{ color: "#fb923c", userSelect: "none", display: "flex", justifyContent: "space-between" }}>
                  <span>{t("🏠 Strongest Home")}</span><span>{rankingPanel === "home" ? "▲" : "▼"}</span>
                </div>
                {topHome.map((r, i) => (
                  <div key={r.id} className="mini-row">
                    <span className="mini-pos">{i < 3 ? MEDALS[i] : (i+1)+"."}</span>
                    <span className="mini-name">{cleanTeamName(r.name)}</span>
                    <span className="mini-val" style={{ color: "#fb923c" }}>{r.gd > 0 ? "+" : ""}{r.gd} GD</span>
                  </div>
                ))}
              </div>
              {rankingPanel === "home" && (
                <div className="ranking-expand">
                  <div style={{ fontSize: ".72rem", color: "#4a5060", marginBottom: ".5rem" }}>{t("Combined goal difference across all home fixtures.")}</div>
                  {homeGDRanking.map((r, i) => (
                    <div key={r.id} className="mini-row">
                      <span className="mini-pos" style={{ minWidth: "1.8rem", color: i < 3 ? "#fb923c" : "#3a3f50" }}>{i < 3 ? MEDALS[i] : (i+1)+"."}</span>
                      <span className="mini-name">{cleanTeamName(r.name)}</span>
                      <span className="mini-val" style={{ color: "#fb923c" }}>{r.gd > 0 ? "+" : ""}{r.gd} GD</span>
                      <span className="muted" style={{ fontSize: ".72rem", marginLeft: ".25rem" }}>({r.P}g)</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div>
              <div className="mini-box" style={{ cursor: "pointer" }} onClick={() => setRankingPanel(rankingPanel === "away" ? null : "away")}>
                <div className="mini-ttl" style={{ color: "#a78bfa", userSelect: "none", display: "flex", justifyContent: "space-between" }}>
                  <span>{t("✈️ Strongest Away")}</span><span>{rankingPanel === "away" ? "▲" : "▼"}</span>
                </div>
                {topAway.map((r, i) => (
                  <div key={r.id} className="mini-row">
                    <span className="mini-pos">{i < 3 ? MEDALS[i] : (i+1)+"."}</span>
                    <span className="mini-name">{cleanTeamName(r.name)}</span>
                    <span className="mini-val" style={{ color: "#a78bfa" }}>{r.gd > 0 ? "+" : ""}{r.gd} GD</span>
                  </div>
                ))}
              </div>
              {rankingPanel === "away" && (
                <div className="ranking-expand">
                  <div style={{ fontSize: ".72rem", color: "#4a5060", marginBottom: ".5rem" }}>{t("Combined goal difference across all away fixtures.")}</div>
                  {awayGDRanking.map((r, i) => (
                    <div key={r.id} className="mini-row">
                      <span className="mini-pos" style={{ minWidth: "1.8rem", color: i < 3 ? "#a78bfa" : "#3a3f50" }}>{i < 3 ? MEDALS[i] : (i+1)+"."}</span>
                      <span className="mini-name">{cleanTeamName(r.name)}</span>
                      <span className="mini-val" style={{ color: "#a78bfa" }}>{r.gd > 0 ? "+" : ""}{r.gd} GD</span>
                      <span className="muted" style={{ fontSize: ".72rem", marginLeft: ".25rem" }}>({r.P}g)</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Row 2b: Most Goals in a Single Game — team + player */}
          <div className="mini-rankings" style={{ marginTop: ".75rem" }}>
            <div>
              <div className="mini-box" style={{ cursor: "pointer" }} onClick={() => setRankingPanel(rankingPanel === "highgame" ? null : "highgame")}>
                <div className="mini-ttl" style={{ color: "#22d3ee", userSelect: "none", display: "flex", justifyContent: "space-between" }}>
                  <span>{t("🔥 Most Goals (Game)")}</span><span>{rankingPanel === "highgame" ? "▲" : "▼"}</span>
                </div>
                {topHighGame.length === 0 && (
                  <div className="muted" style={{ fontSize: ".78rem" }}>{t("No played games yet.")}</div>
                )}
                {topHighGame.map((r, i) => (
                  <div key={r.id} className="mini-row">
                    <span className="mini-pos">{i < 3 ? MEDALS[i] : (i+1)+"."}</span>
                    <span className="mini-name">{cleanTeamName(r.name)}</span>
                    <span className="mini-val" style={{ color: "#22d3ee" }}>{r.score}</span>
                  </div>
                ))}
              </div>
              {rankingPanel === "highgame" && (
                <div className="ranking-expand">
                  <div style={{ fontSize: ".72rem", color: "#4a5060", marginBottom: ".5rem" }}>{t("Highest score by a team in a single match.")}</div>
                  {highGameRanking.map((r, i) => (
                    <div key={r.id} className="mini-row">
                      <span className="mini-pos" style={{ minWidth: "1.8rem", color: i < 3 ? "#22d3ee" : "#3a3f50" }}>{i < 3 ? MEDALS[i] : (i+1)+"."}</span>
                      <span className="mini-name">{cleanTeamName(r.name)}</span>
                      <span className="mini-val" style={{ color: "#22d3ee" }}>{r.score}</span>
                      <span className="muted" style={{ fontSize: ".72rem", marginLeft: ".25rem" }}>vs {cleanTeamName(r.vs)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div>
              <div className="mini-box" style={{ cursor: "pointer" }} onClick={() => setRankingPanel(rankingPanel === "highgameplayer" ? null : "highgameplayer")}>
                <div className="mini-ttl" style={{ color: "#f472b6", userSelect: "none", display: "flex", justifyContent: "space-between" }}>
                  <span>{t("🎯 Most Goals (Player)")}</span><span>{rankingPanel === "highgameplayer" ? "▲" : "▼"}</span>
                </div>
                {topHighGamePlayers.length === 0 && (
                  <div className="muted" style={{ fontSize: ".78rem" }}>{t("No data yet.")}</div>
                )}
                {topHighGamePlayers.map((r, i) => (
                  <div key={i} className="mini-row">
                    <span className="mini-pos">{i < 3 ? MEDALS[i] : (i+1)+"."}</span>
                    <span className="mini-name">{r.player}</span>
                    <span className="mini-val" style={{ color: "#f472b6" }}>{r.goals}</span>
                  </div>
                ))}
              </div>
              {rankingPanel === "highgameplayer" && (
                <div className="ranking-expand">
                  <div style={{ fontSize: ".72rem", color: "#4a5060", marginBottom: ".5rem" }}>{t("Most goals scored by a player in a single match.")}</div>
                  {(topSingleGamePlayers || []).map((r, i) => (
                    <div key={i} className="mini-row">
                      <span className="mini-pos" style={{ minWidth: "1.8rem", color: i < 3 ? "#f472b6" : "#3a3f50" }}>{i < 3 ? MEDALS[i] : (i+1)+"."}</span>
                      <span className="mini-name">{r.player}</span>
                      <span className="mini-val" style={{ color: "#f472b6" }}>{r.goals}</span>
                      <span className="muted" style={{ fontSize: ".72rem", marginLeft: ".25rem" }}>{r.club}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Row 3: Toughest Teams — full width if toughFullWidth, else paired with Clutch */}
          {toughFullWidth ? (
            <div className="mini-rankings" style={{ marginTop: ".75rem" }}>
              <div style={{ gridColumn: "1 / -1" }}>
                <div className="mini-box" style={{ cursor: "pointer" }} onClick={() => setRankingPanel(rankingPanel === "tough" ? null : "tough")}>
                  <div className="mini-ttl" style={{ color: "#f87171", userSelect: "none", display: "flex", justifyContent: "space-between" }}>
                    <span>{t("💀 Toughest Teams")}</span><span>{rankingPanel === "tough" ? "▲" : "▼"}</span>
                  </div>
                  {toughRanking.slice(0, 3).map((r, i) => (
                    <div key={r.id} className="mini-row">
                      <span className="mini-pos">{MEDALS[i]}</span>
                      <span className="mini-name">{cleanTeamName(r.name)}</span>
                      <span className="mini-val" style={{ color: "#f87171" }}>{r.pts} pts</span>
                    </div>
                  ))}
                </div>
                {rankingPanel === "tough" && (
                  <div className="ranking-expand">
                    <div style={{ fontSize: ".72rem", color: "#4a5060", marginBottom: ".5rem" }}>{t("How tough a team is to beat, scored by total GD opponents face against them.")}</div>
                    {toughRanking.map((r, i) => (
                      <div key={r.id} className="mini-row">
                        <span className="mini-pos" style={{ minWidth: "1.8rem", color: i < 3 ? "#f87171" : "#3a3f50" }}>{i < 3 ? MEDALS[i] : (i+1)+"."}</span>
                        <span className="mini-name">{cleanTeamName(r.name)}</span>
                        <span className="mini-val" style={{ color: "#f87171" }}>{r.pts} pts</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="mini-rankings" style={{ marginTop: ".75rem" }}>
              <div>
                <div className="mini-box" style={{ cursor: "pointer" }} onClick={() => setRankingPanel(rankingPanel === "tough" ? null : "tough")}>
                  <div className="mini-ttl" style={{ color: "#f87171", userSelect: "none", display: "flex", justifyContent: "space-between" }}>
                    <span>{t("💀 Toughest Teams")}</span><span>{rankingPanel === "tough" ? "▲" : "▼"}</span>
                  </div>
                  {toughRanking.slice(0, 3).map((r, i) => (
                    <div key={r.id} className="mini-row">
                      <span className="mini-pos">{MEDALS[i]}</span>
                      <span className="mini-name">{cleanTeamName(r.name)}</span>
                      <span className="mini-val" style={{ color: "#f87171" }}>{r.pts} pts</span>
                    </div>
                  ))}
                </div>
                {rankingPanel === "tough" && (
                  <div className="ranking-expand">
                    <div style={{ fontSize: ".72rem", color: "#4a5060", marginBottom: ".5rem" }}>{t("How tough a team is to beat, scored by total GD opponents face against them.")}</div>
                    {toughRanking.map((r, i) => (
                      <div key={r.id} className="mini-row">
                        <span className="mini-pos" style={{ minWidth: "1.8rem", color: i < 3 ? "#f87171" : "#3a3f50" }}>{i < 3 ? MEDALS[i] : (i+1)+"."}</span>
                        <span className="mini-name">{cleanTeamName(r.name)}</span>
                        <span className="mini-val" style={{ color: "#f87171" }}>{r.pts} pts</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <div className="mini-box" style={{ cursor: "pointer" }} onClick={() => setRankingPanel(rankingPanel === "clutch" ? null : "clutch")}>
                  <div className="mini-ttl" style={{ color: "#facc15", userSelect: "none", display: "flex", justifyContent: "space-between" }}>
                    <span>{t("🎯 Most Clutch")}</span><span>{rankingPanel === "clutch" ? "▲" : "▼"}</span>
                  </div>
                  {topClutch.map((r, i) => (
                    <div key={r.id} className="mini-row">
                      <span className="mini-pos">{r.tied ? "—" : (i < 3 ? MEDALS[i] : (i+1)+".")}</span>
                      <span className="mini-name">{cleanTeamName(r.name)}</span>
                      <span className="mini-val" style={{ color: "#facc15" }}>{r.wins}W</span>
                    </div>
                  ))}
                </div>
                {rankingPanel === "clutch" && (
                  <div className="ranking-expand">
                    <div style={{ fontSize: ".72rem", color: "#4a5060", marginBottom: ".5rem" }}>{t("Number of wins by 1 or 2 goals.")}</div>
                    {clutchRanking.map((r, i) => (
                      <div key={r.id} className="mini-row">
                        <span className="mini-pos" style={{ minWidth: "1.8rem", color: i < 3 ? "#facc15" : "#3a3f50" }}>{r.tied ? "—" : (i < 3 ? MEDALS[i] : (i+1)+".")}</span>
                        <span className="mini-name">{cleanTeamName(r.name)}</span>
                        <span className="mini-val" style={{ color: "#facc15" }}>{r.wins}W</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Row 4: Unlucky (+ Clutch if toughFullWidth) */}
          <div className="mini-rankings" style={{ marginTop: ".75rem" }}>
            {toughFullWidth ? (
              <>
                <div>
                  <div className="mini-box" style={{ cursor: "pointer" }} onClick={() => setRankingPanel(rankingPanel === "unlucky" ? null : "unlucky")}>
                    <div className="mini-ttl" style={{ color: "#94a3b8", userSelect: "none", display: "flex", justifyContent: "space-between" }}>
                      <span>{t("😤 Most Unlucky")}</span><span>{rankingPanel === "unlucky" ? "▲" : "▼"}</span>
                    </div>
                    {topUnlucky.map((r, i) => (
                      <div key={r.id} className="mini-row">
                        <span className="mini-pos">{i < 3 ? MEDALS[i] : (i+1)+"."}</span>
                        <span className="mini-name">{cleanTeamName(r.name)}</span>
                        <span className="mini-val" style={{ color: "#94a3b8" }}>{r.draws}D {r.losses1 + r.losses2}L</span>
                      </div>
                    ))}
                  </div>
                  {rankingPanel === "unlucky" && (
                    <div className="ranking-expand">
                      <div style={{ fontSize: ".72rem", color: "#4a5060", marginBottom: ".5rem" }}>{t("Draw = 3 pts · Loss 1GD = 2 pts · Loss 2GD = 1 pt.")}</div>
                      {unluckyRanking.map((r, i) => (
                        <div key={r.id} className="mini-row">
                          <span className="mini-pos" style={{ minWidth: "1.8rem", color: i < 3 ? "#94a3b8" : "#3a3f50" }}>{i < 3 ? MEDALS[i] : (i+1)+"."}</span>
                          <span className="mini-name">{cleanTeamName(r.name)}</span>
                          <span className="mini-val" style={{ color: "#94a3b8" }}>{r.draws}D {r.losses1 + r.losses2}L</span>
                          <span className="muted" style={{ fontSize: ".72rem", marginLeft: ".25rem" }}>({r.pts} pts)</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <div className="mini-box" style={{ cursor: "pointer" }} onClick={() => setRankingPanel(rankingPanel === "clutch" ? null : "clutch")}>
                    <div className="mini-ttl" style={{ color: "#facc15", userSelect: "none", display: "flex", justifyContent: "space-between" }}>
                      <span>{t("🎯 Most Clutch")}</span><span>{rankingPanel === "clutch" ? "▲" : "▼"}</span>
                    </div>
                    {topClutch.map((r, i) => (
                      <div key={r.id} className="mini-row">
                        <span className="mini-pos">{r.tied ? "—" : (i < 3 ? MEDALS[i] : (i+1)+".")}</span>
                        <span className="mini-name">{cleanTeamName(r.name)}</span>
                        <span className="mini-val" style={{ color: "#facc15" }}>{r.wins}W</span>
                      </div>
                    ))}
                  </div>
                  {rankingPanel === "clutch" && (
                    <div className="ranking-expand">
                      <div style={{ fontSize: ".72rem", color: "#4a5060", marginBottom: ".5rem" }}>{t("Number of wins by 1 or 2 goals.")}</div>
                      {clutchRanking.map((r, i) => (
                        <div key={r.id} className="mini-row">
                          <span className="mini-pos" style={{ minWidth: "1.8rem", color: i < 3 ? "#facc15" : "#3a3f50" }}>{r.tied ? "—" : (i < 3 ? MEDALS[i] : (i+1)+".")}</span>
                          <span className="mini-name">{cleanTeamName(r.name)}</span>
                          <span className="mini-val" style={{ color: "#facc15" }}>{r.wins}W</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div>
                <div className="mini-box" style={{ cursor: "pointer" }} onClick={() => setRankingPanel(rankingPanel === "unlucky" ? null : "unlucky")}>
                  <div className="mini-ttl" style={{ color: "#94a3b8", userSelect: "none", display: "flex", justifyContent: "space-between" }}>
                    <span>{t("😤 Most Unlucky")}</span><span>{rankingPanel === "unlucky" ? "▲" : "▼"}</span>
                  </div>
                  {topUnlucky.map((r, i) => (
                    <div key={r.id} className="mini-row">
                      <span className="mini-pos">{i < 3 ? MEDALS[i] : (i+1)+"."}</span>
                      <span className="mini-name">{cleanTeamName(r.name)}</span>
                      <span className="mini-val" style={{ color: "#94a3b8" }}>{r.draws}D {r.losses1 + r.losses2}L</span>
                    </div>
                  ))}
                </div>
                {rankingPanel === "unlucky" && (
                  <div className="ranking-expand">
                    <div style={{ fontSize: ".72rem", color: "#4a5060", marginBottom: ".5rem" }}>{t("Draw = 3 pts · Loss 1GD = 2 pts · Loss 2GD = 1 pt.")}</div>
                    {unluckyRanking.map((r, i) => (
                      <div key={r.id} className="mini-row">
                        <span className="mini-pos" style={{ minWidth: "1.8rem", color: i < 3 ? "#94a3b8" : "#3a3f50" }}>{i < 3 ? MEDALS[i] : (i+1)+"."}</span>
                        <span className="mini-name">{cleanTeamName(r.name)}</span>
                        <span className="mini-val" style={{ color: "#94a3b8" }}>{r.draws}D {r.losses1 + r.losses2}L</span>
                        <span className="muted" style={{ fontSize: ".72rem", marginLeft: ".25rem" }}>({r.pts} pts)</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            {!toughFullWidth && (travelRanking || []).length > 0 && (
              <div>
                <div className="mini-box" style={{ cursor: "pointer" }} onClick={() => setRankingPanel(rankingPanel === "travel" ? null : "travel")}>
                  <div className="mini-ttl" style={{ color: "#38bdf8", userSelect: "none", display: "flex", justifyContent: "space-between" }}>
                    <span>{t("🚗 Distance Travelled")}</span><span>{rankingPanel === "travel" ? "▲" : "▼"}</span>
                  </div>
                  {travelRanking.slice(0, 3).map((r, i) => (
                    <div key={r.id} className="mini-row">
                      <span className="mini-pos">{MEDALS[i]}</span>
                      <span className="mini-name">{cleanTeamName(r.name)}</span>
                      <span className="mini-val" style={{ color: "#38bdf8" }}>{(r.estimatedLegs || r.missingLegs) ? "~" : ""}{r.km} km</span>
                    </div>
                  ))}
                </div>
                {rankingPanel === "travel" && (
                  <div className="ranking-expand">
                    <div style={{ fontSize: ".72rem", color: "#4a5060", marginBottom: ".5rem" }}>{t("Driving distance from each team's home venue to every away game played this season.")}</div>
                    {travelRanking.map((r, i) => (
                      <div key={r.id} className="mini-row">
                        <span className="mini-pos" style={{ minWidth: "1.8rem", color: i < 3 ? "#38bdf8" : "#3a3f50" }}>{i < 3 ? MEDALS[i] : (i+1)+"."}</span>
                        <span className="mini-name">{cleanTeamName(r.name)}</span>
                        <span className="mini-val" style={{ color: "#38bdf8" }}>{(r.estimatedLegs || r.missingLegs) ? "~" : ""}{r.km} km</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Row 5: Distance Travelled — how far each team has travelled to away games this season */}
          {toughFullWidth && (travelRanking || []).length > 0 && (
            <div className="mini-rankings" style={{ marginTop: ".75rem" }}>
              <div>
                <div className="mini-box" style={{ cursor: "pointer" }} onClick={() => setRankingPanel(rankingPanel === "travel" ? null : "travel")}>
                  <div className="mini-ttl" style={{ color: "#38bdf8", userSelect: "none", display: "flex", justifyContent: "space-between" }}>
                    <span>{t("🚗 Distance Travelled")}</span><span>{rankingPanel === "travel" ? "▲" : "▼"}</span>
                  </div>
                  {travelRanking.slice(0, 3).map((r, i) => (
                    <div key={r.id} className="mini-row">
                      <span className="mini-pos">{MEDALS[i]}</span>
                      <span className="mini-name">{cleanTeamName(r.name)}</span>
                      <span className="mini-val" style={{ color: "#38bdf8" }}>{(r.estimatedLegs || r.missingLegs) ? "~" : ""}{r.km} km</span>
                    </div>
                  ))}
                </div>
                {rankingPanel === "travel" && (
                  <div className="ranking-expand">
                    <div style={{ fontSize: ".72rem", color: "#4a5060", marginBottom: ".5rem" }}>{t("Driving distance from each team's home venue to every away game played this season.")}</div>
                    {travelRanking.map((r, i) => (
                      <div key={r.id} className="mini-row">
                        <span className="mini-pos" style={{ minWidth: "1.8rem", color: i < 3 ? "#38bdf8" : "#3a3f50" }}>{i < 3 ? MEDALS[i] : (i+1)+"."}</span>
                        <span className="mini-name">{cleanTeamName(r.name)}</span>
                        <span className="mini-val" style={{ color: "#38bdf8" }}>{(r.estimatedLegs || r.missingLegs) ? "~" : ""}{r.km} km</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── STEP 1: TEAMS ─────────────────────────────────────────────────────────────
function TeamsStep({ teams, fixtures, setTeams, leagueType, onNext }) {
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
function FixturesStep({ teams, fixtures, setFixtures, settings, setSettings, onBack, onNext }) {
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

// ── SCORE ROW ─────────────────────────────────────────────────────────────────
function ScoreRow({ f, teams, liveP, settings, onConfirm, onUndo, onOverride, onTeamClick, onWeekChange }) {
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
            <span style={{ fontFamily: "DM Mono,monospace", fontSize: ".65rem", color: "#3a3f50" }}>W</span>
            <input type="number" min="1" max="999" value={f.week ?? ""} placeholder="—"
              onChange={e => onWeekChange(f.id, e.target.value === "" ? null : parseInt(e.target.value) || null)}
              style={{ width: "2.8rem", textAlign: "center", padding: ".2rem .25rem", fontFamily: "DM Mono,monospace", fontSize: ".78rem", background: "#0d1117", border: "1px solid #252830", color: "#22d3ee", borderRadius: "4px", outline: "none" }} />
          </div>
        )}
        <button className="btn-undo" onClick={() => onUndo(f.id)}>↩ Undo</button>
      </div>
    );
  }

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
        <div className="fix-probs">
          {f.overrideOn && f.ovHW !== "" && <span className="ovr-tag">override</span>}
          <span className="ph-col">{probs.homeWin}%</span>
          <span className="pd-col">{probs.draw}%</span>
          <span className="pa-col">{probs.awayWin}%</span>
        </div>
        <button className={"ovr-btn" + (f.overrideOn ? " active" : "")} onClick={() => onOverride(f.id, "toggle")}>
          {f.overrideOn ? "✓ Override" : "Override %"}
        </button>
        {onWeekChange && (
          <div style={{ display: "flex", alignItems: "center", gap: ".3rem", marginLeft: "auto" }}>
            <span style={{ fontFamily: "DM Mono,monospace", fontSize: ".65rem", color: "#3a3f50" }}>W</span>
            <input type="number" min="1" max="999" value={f.week ?? ""} placeholder="—"
              onChange={e => onWeekChange(f.id, e.target.value === "" ? null : parseInt(e.target.value) || null)}
              style={{ width: "2.8rem", textAlign: "center", padding: ".2rem .25rem", fontFamily: "DM Mono,monospace", fontSize: ".78rem", background: "#0d1117", border: "1px solid #252830", color: "#22d3ee", borderRadius: "4px", outline: "none" }} />
          </div>
        )}
      </div>
      {f.overrideOn && (
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
      <div style={{ display: "flex", alignItems: "center", gap: ".38rem", flexWrap: "wrap" }}>
        <button className="qbtn hw" onClick={() => onConfirm(f.id, ws, ls)}>{hn.split(" ")[0]} W</button>
        <button className="qbtn dr" onClick={() => onConfirm(f.id, ds, ds)}>Draw</button>
        <button className="qbtn aw" onClick={() => onConfirm(f.id, ls, ws)}>{an.split(" ")[0]} W</button>
        <input className="score-inp" type="number" min="0" value={hg} onChange={e => setHg(e.target.value)} placeholder="0" />
        <span className="score-sep">&mdash;</span>
        <input className="score-inp" type="number" min="0" value={ag} onChange={e => setAg(e.target.value)} placeholder="0" />
        <button className="confirm-btn" disabled={hg === "" || ag === ""} onClick={() => { if (hg !== "" && ag !== "") onConfirm(f.id, +hg, +ag); }}>Confirm</button>
      </div>
    </div>
  );
}

// ── MONTE CARLO TAB ───────────────────────────────────────────────────────────
function MCTab({ teams, fixtures, settings, highlightTop, highlightBottom, onConfirmed, ranking }) {
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
  pendingRef.current = pending.map(f => ({ ...f, ...fixProbs(f, teams_, fixtures, settings) }));
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
function ScoresTab({ teams, fixtures, liveProbs, settings, onConfirm, onUndo, onOverride, onTeamClick, onWeekChange }) {
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
                <div style={{ borderTop: "1px solid #1c1f27", margin: "1rem 0 .5rem", fontFamily: "DM Mono,monospace", fontSize: ".68rem", color: "#3a3f50", textTransform: "uppercase", letterSpacing: ".08em" }}>
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
function MatchRow({ match, teams, rounds, liveProbs, settings, onConfirm, onUndo, onOverride, isTwoLeg }) {
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

function TournamentBracket({ rounds, teams, liveProbs, settings, phase, onConfirm, onUndo, onOverride, onTeamClick }) {
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
function PhaseView({ phase, phaseData, setPhaseData, settings, sourceStats, phaseFormat, label, color, infoText, onTeamClick, leagueId, aliases }) {
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
function SimStep({ league, setLeague, onBack }) {
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
function LeagueEditor({ league, onChange }) {
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

// The top-level Belgian screen — federation picker with division sub-groups
function BelgianScreen({ onBack }) {
  const { data, error, loadLeague, failed } = useVhvData();
  const { lang, t } = useLang();
  const [fed, setFed]       = useState(null);
  const [league, setLeague] = useState(null);

  const follow = useFollow();
  const [pickerForced, setPickerForced] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(() => { try { return !localStorage.getItem(PICKER_DISMISS_KEY); } catch { return true; } });
  const myTeams = useMemo(() => {
    if (!data) return [];
    const byLeague = new Map();
    for (const f of Object.values(data.federations || {})) {
      for (const lg of Object.values(f || {})) byLeague.set(String(lg.serieId || lg.id), lg);
    }
    return follow.ids.map(key => {
      const cut = key.indexOf(":");
      const lg = byLeague.get(key.slice(0, cut));
      if (!lg) return null;
      const teamId = (lg.teams || []).find(t => String(t.id) === key.slice(cut + 1))?.id;
      let snap = null;
      try { snap = teamId != null ? teamSnapshot(lg, teamId) : null; } catch { snap = null; }
      return snap ? { key, lg, snap } : null;
    }).filter(Boolean).sort((a, b) => (b.key === follow.main) - (a.key === follow.main));
  }, [data, follow.ids, follow.main]);
  // Load the full data for every league you follow (the rest stays on the server until opened).
  const ready = !!data;
  useEffect(() => {
    if (!ready) return;
    follow.ids.forEach(k => { const cut = k.indexOf(":"); if (cut > 0) loadLeague(k.slice(0, cut)); });
  }, [ready, follow.ids, loadLeague]);
  // Opening a league from the list: fetch it if only the stub is known.
  useEffect(() => { if (league && !league.fixtures) loadLeague(league.serieId); }, [league, loadLeague]);
  const openLeague = useMemo(() => {
    if (!league) return null;
    if (league.fixtures) return league;
    if (!data) return null;
    for (const f of Object.values(data.federations || {})) {
      const lg = f && f[String(league.serieId)];
      if (lg && lg.fixtures) return lg;
    }
    return null;
  }, [league, data]);

  const weekGames = useMemo(() => {
    if (!data) return [];
    const { cur, next } = weekBounds();
    const byLeague = new Map();
    for (const f of Object.values(data.federations || {})) {
      for (const lg of Object.values(f || {})) byLeague.set(String(lg.serieId || lg.id), lg);
    }
    const mine = {};
    follow.ids.forEach(key => {
      const cut = key.indexOf(":");
      (mine[key.slice(0, cut)] = mine[key.slice(0, cut)] || new Set()).add(key.slice(cut + 1));
    });
    const out = [];
    Object.entries(mine).forEach(([lid, ids]) => {
      const lg = byLeague.get(lid);
      if (!lg) return;
      const teams = lg.teams || [], fixtures = lg.fixtures || [];
      fixtures.forEach(f => {
        const h = teams[f.homeIdx], a = teams[f.awayIdx];
        if (!h || !a || !f.date) return;
        const d = f.date.slice(0, 10);
        const hm = ids.has(String(h.id)), am = ids.has(String(a.id));
        if (d < cur || d >= next || !(hm || am)) return;
        const done = f.played && f.homeScore != null && f.awayScore != null;
        let pred = null;
        try { pred = done ? null : predictMatch(f.homeIdx, f.awayIdx, teams, fixtures); } catch { pred = null; }
        out.push({ id: lid + ":" + f.id, date: f.date, time: f.time || null, home: cleanTeamName(h.name), away: cleanTeamName(a.name), hm, am, done, hs: f.homeScore, as: f.awayScore, pred, lg });
      });
    });
    return out.sort((x, y) => (x.date < y.date ? -1 : x.date > y.date ? 1 : 0));
  }, [data, follow.ids]);

  if (league && openLeague) return <ErrorBoundary onBack={() => setLeague(null)}><BelgianLeagueView league={openLeague} onBack={() => setLeague(null)} /></ErrorBoundary>;
  if (league) return (
    <div className="panel">
      <button className="btn btn-ghost" onClick={() => setLeague(null)}>{t("← Back")}</button>
      {failed[String(league.serieId)]
        ? <div style={{ color: "#f87171", padding: "2rem", textAlign: "center" }}>{t("Could not load data.")}</div>
        : <div className="muted" style={{ padding: "2rem", textAlign: "center" }}>{t("Loading data…")}</div>}
    </div>
  );

  const feds = data ? Object.keys(data.federations || {}) : [];
  return (
    <div className="panel">
      <div className="ph">
        <div>
          <h2>🇧🇪 {t("Belgian Handball")}</h2>
          <p style={{ color: "#5a6070", fontSize: ".82rem" }}>
            {t("Live competition data")}
            {data?.updatedAt && (
              <span> · {t("updated")} {new Date(data.updatedAt).toLocaleString(LANG_LOCALE[lang], { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
            )}
          </p>
        </div>
        <span style={{ marginLeft: "auto", display: "inline-flex", gap: ".6rem", alignItems: "center" }}><LangSwitch /><button className="btn btn-ghost" onClick={onBack}>{t("← Back")}</button></span>
      </div>

      {!data && !error && <div className="muted" style={{ padding: "2rem", textAlign: "center" }}>{t("Loading data…")}</div>}
      {error && <div style={{ color: "#f87171", padding: "2rem", textAlign: "center" }}>{t("Could not load data.")}</div>}

      {data && (
        <>
          {/* First visit / add team */}
          {pickerOpen && (follow.ids.length === 0 || pickerForced) && (
            <ClubPicker data={data} follow={follow} onClose={saved => { setPickerForced(false); if (!saved) setPickerOpen(false); }} />
          )}
          {/* Federation tabs */}
          <div style={{ display: "flex", gap: ".5rem", marginBottom: "1.5rem", flexWrap: "wrap" }}>
            {Object.keys(FED_META).map(f => {
              const available = feds.includes(f);
              const meta = FED_META[f];
              return (
                <button key={f}
                  className={"btn" + (fed === f ? "" : " btn-ghost")}
                  style={fed === f
                    ? { background: meta.color, color: "#08090c", border: "none" }
                    : { opacity: available ? 1 : 0.35 }}
                  disabled={!available}
                  onClick={() => setFed(fed === f ? null : f)}>
                  {meta.label}
                </button>
              );
            })}
          </div>

          {/* Leagues for selected federation, grouped by division */}
          {fed && (() => {
            const allLeagues = Object.values(data.federations[fed] || {});
            const meta = FED_META[fed];
            if (allLeagues.length === 0) return (
              <div className="muted" style={{ padding: "1.5rem", textAlign: "center" }}>{t("No leagues available yet for")} {meta.label}.</div>
            );
            // Group by division, preserving insertion order
            const divisionMap = new Map();
            for (const lg of allLeagues) {
              const div = lg.division || "General";
              if (!divisionMap.has(div)) divisionMap.set(div, []);
              divisionMap.get(div).push(lg);
            }
            return (
              <>
                {[...divisionMap.entries()].map(([division, leagues]) => (
                  <div key={division} style={{ marginBottom: "1.5rem" }}>
                    <div className="sub-ttl" style={{ marginBottom: ".75rem", color: meta.color }}>{division}</div>
                    <div className="card-grid">
                      {leagues.map(lg => {
                        const played  = lg.fixtures ? lg.fixtures.filter(f => f.played).length : (lg.played || 0);
                        const pending = lg.fixtures ? lg.fixtures.filter(f => !f.played).length : (lg.pending || 0);
                        return (
                          <div key={lg.serieId || lg.id} className="card" onClick={() => setLeague(lg)}>
                            <div className="card-badge badge-std" style={{ borderColor: meta.color + "44", color: meta.color, background: meta.color + "18" }}>
                              {meta.label}
                            </div>
                            <div className="card-name">{lg.name}</div>
                            <div className="card-meta">
                              {(lg.teams || []).length} {t("teams")} · {played} {t("played")} · {pending} {t("pending")}
                              {lg.live && (
                                <span style={{ display: "inline-block", marginLeft: ".4rem", fontSize: ".65rem", fontWeight: 700, color: "#4ade80", border: "1px solid #4ade80", borderRadius: "3px", padding: ".05rem .3rem", letterSpacing: ".04em" }}>● LIVE</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </>
            );
          })()}

          {!fed && feds.length === 0 && (
            <div className="muted" style={{ padding: "2rem", textAlign: "center" }}>{t("No competition data fetched yet — run the fetch-vhv workflow first.")}</div>
          )}
          {!fed && feds.length > 0 && (
            <div className="muted" style={{ padding: "1rem", textAlign: "center" }}>{t("Select a federation above to browse leagues.")}</div>
          )}
          {/* My teams */}
          <div className="mini-box" style={{ marginBottom: "1.25rem" }}>
            <div className="mini-ttl" style={{ color: "#fbbf24", marginBottom: ".5rem", display: "flex", justifyContent: "space-between" }}>
              <span>{t("★ My teams")}</span>
              <button className="btn btn-ghost" style={{ fontSize: ".7rem", padding: ".15rem .5rem" }} onClick={() => { setPickerOpen(true); setPickerForced(true); }}>{t("＋ Add club")}</button>
            </div>
            {myTeams.length === 0 && (
              <div className="muted" style={{ fontSize: ".8rem" }}>{t("Open any league and tap ☆ next to a team to follow it. Your teams show up here, with position, form and next match.")}</div>
            )}
            {myTeams.map(({ key, lg, snap }) => (
              <div key={key} className="mini-row" style={{ gap: ".6rem", flexWrap: "wrap", cursor: "pointer", padding: ".45rem 0" }} onClick={() => setLeague(lg)}>
                <span style={{ minWidth: "9rem", fontWeight: 700 }}>
                  {key === follow.main && <span title={t("Main team")} style={{ color: "#fbbf24", marginRight: ".3rem" }}>★</span>}
                  {snap.name}
                  <span className="muted" style={{ display: "block", fontWeight: 400, fontSize: ".68rem" }}>{lg.name}</span>
                </span>
                <span style={{ fontFamily: "DM Mono,monospace", fontSize: ".8rem" }}>{snap.pos}/{snap.of} · {snap.pts} {t("pts")}</span>
                <span style={{ whiteSpace: "nowrap" }}>
                  {snap.form.map((res, k) => (
                    <span key={k} style={{ display: "inline-block", width: "1.1rem", textAlign: "center", fontWeight: 700, fontSize: ".78rem",
                      color: res === "W" ? "#4ade80" : res === "D" ? "#9ca3af" : "#f87171" }}>{res === "W" ? "✓" : res === "D" ? "D" : "–"}</span>
                  ))}
                </span>
                <span className="muted" style={{ fontSize: ".76rem", flex: 1 }}>
                  {snap.next ? t("Next") + ": " + (snap.next.date ? snap.next.date.slice(8, 10) + "/" + snap.next.date.slice(5, 7) + " " + (snap.next.time ? snap.next.time + " " : "") : "") + (snap.next.home ? t("vs") + " " : t("at") + " ") + snap.next.opp : t("No upcoming game")}
                </span>
                {key !== follow.main && (
                  <button className="btn btn-ghost" style={{ fontSize: ".7rem", padding: ".15rem .5rem" }}
                    onClick={e => { e.stopPropagation(); follow.setMain(key); }}>{t("Make main")}</button>
                )}
              </div>
            ))}
            {weekGames.length > 0 && (
              <div style={{ marginTop: ".7rem", borderTop: "1px solid #2a2f3a", paddingTop: ".5rem" }}>
                <div className="muted" style={{ fontSize: ".7rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: ".3rem" }}>{t("This week · all my teams")}</div>
                {weekGames.map(g => (
                  <div key={g.id} className="mini-row" style={{ gap: ".5rem", flexWrap: "wrap", cursor: "pointer" }} onClick={() => setLeague(g.lg)}>
                    <span className="muted" style={{ fontFamily: "DM Mono,monospace", fontSize: ".7rem", minWidth: g.time ? "4.6rem" : "2.6rem" }}>{g.date.slice(8, 10)}/{g.date.slice(5, 7)}{g.time ? " " + g.time : ""}</span>
                    <span style={{ fontSize: ".8rem" }}>
                      <span style={{ fontWeight: g.hm ? 700 : 400 }}>{g.hm ? "★ " : ""}{g.home}</span>
                      {g.done ? <span className="mini-val" style={{ margin: "0 .4rem", color: "#fbbf24" }}>{g.hs}–{g.as}</span> : <span className="muted" style={{ margin: "0 .4rem" }}>{t("vs")}</span>}
                      <span style={{ fontWeight: g.am ? 700 : 400 }}>{g.am ? "★ " : ""}{g.away}</span>
                      <span className="muted" style={{ display: "block", fontSize: ".66rem" }}>{g.lg.name}</span>
                    </span>
                    {g.pred && <span className="muted" title={t("Goal model: home win / draw / away win chance, expected score")} style={{ fontFamily: "DM Mono,monospace", fontSize: ".66rem" }}>{g.pred.homeWin}% · {g.pred.draw}% · {g.pred.awayWin}% ({g.pred.eh}–{g.pred.ea})</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// Read-only league view for Belgian Handball data
function BelgianLeagueView({ league, onBack }) {
  const { teams: initTeams = [], fixtures = [], scorers: leagueScorers = null, ranking = [], topSingleGamePlayers = [], travelRanking = [] } = league;
  const { t: tr } = useLang();
  const [detail, setDetail]           = useState(null);
  const [tab, setTab]                 = useState("table");
  const [settings, setSettings]       = useState({ baseWin: 47, baseDraw: 6, homeBonus: 10, rankBonus: 3, winScore: 30, lossScore: 25, drawScore: 25 });
  const [confirmedTop, setConfirmedTop]       = useState(null);
  const [confirmedBottom, setConfirmedBottom] = useState(null);
  const [leagueState, setLeagueState] = useState({
    type: "standard", promoTop: 2, demotBot: 2,
    scorerUrl: "", playoffScorerUrl: "", playdownScorerUrl: "",
    scorerAliases: {}, teams: initTeams,
  });

  // Build points lookup from API ranking (source of truth)
  // Falls back to computing from played fixtures if ranking is empty
  const teams = useMemo(() => {
    if (ranking.length > 0) {
      // Map ranking positions/points onto teams by name match
      const rankMap = new Map(ranking.map(r => [r.name.toLowerCase(), r]));
      return initTeams.map(t => {
        const r = rankMap.get(t.name.toLowerCase());
        return r ? { ...t, points: r.points || 0 } : t;
      });
    }
    // Fallback: derive from played fixtures
    const earned = initTeams.map(() => 0);
    fixtures.filter(f => f.played && f.homeScore != null).forEach(f => {
      const hg = +f.homeScore, ag = +f.awayScore;
      if (isNaN(hg) || isNaN(ag)) return;
      if (hg > ag) earned[f.homeIdx] += 2;
      else if (hg < ag) earned[f.awayIdx] += 2;
      else { earned[f.homeIdx]++; earned[f.awayIdx]++; }
    });
    return initTeams.map((t, i) => ({ ...t, points: t.points + earned[i] }));
  }, [initTeams, fixtures, ranking]);

  const pending = fixtures.filter(f => !f.played);
  const played  = fixtures.filter(f => f.played);

  const liveProbs = useMemo(() => {
    const m = {};
    pending.forEach(f => { m[f.id] = fixProbs(f, teams, fixtures, settings); });
    return m;
  }, [pending, teams, fixtures, settings]);

  const hlTop = leagueState.promoTop ?? 2;
  const hlBot = leagueState.demotBot ?? 2;

  return (
    <div>
      <div className="masthead" style={{ marginBottom: "1rem" }}>
        <div>
          <div className="logo" style={{ fontSize: "1.1rem" }}>{league.name}</div>
          <div className="sub" style={{ color: "#22d3ee" }}>
            {league.federation}
            {league.live && (
              <span style={{ display: "inline-block", marginLeft: ".5rem", fontSize: ".65rem", fontWeight: 700, color: "#4ade80", border: "1px solid #4ade80", borderRadius: "3px", padding: ".05rem .3rem", letterSpacing: ".04em" }}>● LIVE</span>
            )}
          </div>
        </div>
        <span style={{ display: "inline-flex", gap: ".6rem", alignItems: "center" }}><LangSwitch /><button className="btn btn-ghost" onClick={onBack}>{tr("← All Leagues")}</button></span>
      </div>

      <div className="panel">
        <div className="tabs" style={{ overflowX: "auto", flexWrap: "nowrap", whiteSpace: "nowrap" }}>
          <button className="tab" onClick={onBack} title={tr("Back to My teams and all leagues")}>{tr("⌂ Home")}</button>
          {["table", "scores", "players", "monte", "settings"].map(tabId => (
            <button key={tabId} className={"tab" + (tab === tabId ? " on" : "")} onClick={() => setTab(tabId)}>
              {tr(tabId === "table" ? "Table" : tabId === "scores" ? "Games" : tabId === "players" ? "Players" : tabId === "monte" ? "Simulator" : "Sim settings")}{tabId === "scores" && pending.length ? " (" + pending.length + ")" : ""}
            </button>
          ))}
        </div>

        {tab === "table" && (
          <LeagueTable
            teams={teams}
            fixtures={fixtures}
            ranking={ranking}
            onTeamClick={idx => setDetail({ idx })}
            highlightTop={hlTop}
            highlightBottom={hlBot}
            confirmedTop={confirmedTop}
            confirmedBottom={confirmedBottom}
            leagueId={leagueScorers ? null : null}
            aliases={leagueState.scorerAliases || {}}
            archiveScorers={leagueScorers}
            phaseTeams={null}
            phase="regular"
            toughFullWidth={false}
            topSingleGamePlayers={topSingleGamePlayers}
            travelRanking={travelRanking}
            followKey={String(league.serieId ?? league.id)}
            hideScorers
          />
        )}

        {tab === "scores" && (
          <ScoresTab
            teams={teams}
            fixtures={fixtures}
            liveProbs={liveProbs}
            settings={settings}
            onConfirm={null}
            onUndo={null}
            onOverride={null}
            onTeamClick={idx => setDetail({ idx })}
            onWeekChange={null}
          />
        )}

        {tab === "players" && <PlayersTab scorers={leagueScorers} teams={teams} aliases={leagueState.scorerAliases || {}} />}


        {tab === "monte" && (
          <MCTab
            key={played.length}
            teams={teams}
            fixtures={fixtures}
            settings={settings}
            ranking={ranking}
            highlightTop={hlTop}
            highlightBottom={hlBot}
            onConfirmed={(ct, cb) => { setConfirmedTop(ct); setConfirmedBottom(cb); }}
          />
        )}

        {tab === "settings" && (
          <SettingsPanel
            settings={settings}
            onChange={(k, v) => setSettings(s => ({ ...s, [k]: v }))}
            showTiebreakers={true}
            belgian
            league={leagueState}
            onLeagueChange={u => setLeagueState(s => typeof u === "function" ? u(s) : u)}
            readOnly={false}
          />
        )}
      </div>

      {detail != null && (
        <TeamDetail
          team={teams[detail.idx]}
          teamIdx={detail.idx}
          teams={teams}
          fixtures={fixtures}
          onClose={() => setDetail(null)}
          leagueId={null}
          aliases={leagueState.scorerAliases || {}}
          archiveScorers={leagueScorers}
          phase="regular"
        />
      )}
    </div>
  );
}

// ── ARCHIVE OPTIONS MENU ──────────────────────────────────────────────────────
function ArchiveOptionsMenu({ label, onOpen, onDelete, style }) {
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
const archiveCardHoverStyle = `
.archive-card:hover [data-options-btn] { opacity: 1 !important; }
.archive-card [data-options-btn]:focus { opacity: 1 !important; }
`;

// ── ARCHIVE SCREEN ────────────────────────────────────────────────────────────
function ArchiveScreen({ onBack }) {
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

      {loading && <div className="muted" style={{ padding: "2rem", textAlign: "center" }}>Loading archive…</div>}
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
function ArchiveSeasonView({ filename, onBack }) {
  const { data, error } = useArchiveSeason(filename);
  const [activeLeague, setActiveLeague] = useState(null);

  if (error) return (
    <div className="panel">
      <button className="btn btn-ghost" onClick={onBack}>← Back</button>
      <div style={{ color: "#f87171", padding: "2rem", textAlign: "center" }}>Could not load season data.</div>
    </div>
  );
  if (!data) return <div className="muted" style={{ padding: "3rem", textAlign: "center" }}>Loading season…</div>;

  if (activeLeague !== null) {
    const lg = data.leagues[activeLeague];
    // Plain leagues get the full league view (table, games, players); play-off leagues keep the phase view.
    if (lg.type !== "playoff") {
      const full = { ...lg, federation: "📦 " + data.season + " · read only", live: false, scorers: (data.scorers || {})[lg.name] || null };
      return <ErrorBoundary onBack={() => setActiveLeague(null)}><BelgianLeagueView league={full} onBack={() => setActiveLeague(null)} /></ErrorBoundary>;
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
function ArchiveBelgianSeasonView({ filename, season, onBack }) {
  const { data, error } = useArchiveFile(filename);
  const [league, setLeague] = useState(null);

  if (league) return <ErrorBoundary onBack={() => setLeague(null)}><BelgianLeagueView league={league} onBack={() => setLeague(null)} /></ErrorBoundary>;

  if (error) return (
    <div className="panel">
      <button className="btn btn-ghost" onClick={onBack}>← Back</button>
      <div style={{ color: "#f87171", padding: "2rem", textAlign: "center" }}>Could not load season data.</div>
    </div>
  );
  if (!data) return <div className="muted" style={{ padding: "3rem", textAlign: "center" }}>Loading season…</div>;

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
              <div className="card-badge badge-std" style={{ color: "#22d3ee", borderColor: "#22d3ee44", background: "#22d3ee18" }}>{fed}</div>
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

function ArchiveLeagueView({ league, scorers, season, onBack }) {
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

// ── ROOT APP ──────────────────────────────────────────────────────────────────
const LEAGUESIM_DATA_URL = "https://raw.githubusercontent.com/ozzyzorcopter/handball-League/refs/heads/main/leaguesim-data.json";

function App() {
  const [store, setStore]         = useState({ leagues: [] });
  const [activeId, setActiveId]   = useState(null);
  const [showArchive, setShowArchive] = useState(false);
  const [showBelgian, setShowBelgian] = useState(false);
  const [archiveMsg, setArchiveMsg]   = useState(null); // { text, color }

  // ── Share mode: auto-load from repo ──────────────────────────────────────
  const [loadStatus, setLoadStatus] = useState(IS_SHARE ? "loading" : "ok");
  useEffect(() => {
    if (!IS_SHARE) return;
    fetch(LEAGUESIM_DATA_URL)
      .then(r => { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
      .then(data => {
        if (!data.leagues) throw new Error("Not a LeagueSim file");
        setStore(data);
        setActiveId(data.leagues.length === 1 ? data.leagues[0].id : null);
        setLoadStatus("ok");
      })
      .catch(e => { console.error(e); setLoadStatus("error"); });
  }, []);

  // ── Edit mode: manual save/load ───────────────────────────────────────────
  const [msg, setMsg] = useState("");
  const msgTimer = useRef(null);
  function flash(m) { setMsg(m); clearTimeout(msgTimer.current); msgTimer.current = setTimeout(() => setMsg(""), 2500); }
  function handleSave() { saveData(store); flash("Downloading…"); }
  function handleLoad() {
    loadData().then(data => {
      if (!data.leagues) throw new Error("Not a LeagueSim file");
      setStore(data); setActiveId(null); flash("Loaded!");
    }).catch(e => alert("Could not load: " + e));
  }

  function createLeague(name, type, poSize, pdSize, phaseFormat, archivable) {
    const lg = makeLeague(name, type, poSize, pdSize, phaseFormat, archivable);
    setStore(s => ({ ...s, leagues: [...s.leagues, lg] }));
    setActiveId(lg.id);
  }
  function deleteLeague(id) {
    if (!confirm("Delete this league?")) return;
    setStore(s => ({ ...s, leagues: s.leagues.filter(lg => lg.id !== id) }));
    if (activeId === id) setActiveId(null);
  }
  function updateLeague(id, u) {
    setStore(s => ({ ...s, leagues: s.leagues.map(lg => lg.id === id ? (typeof u === "function" ? u(lg) : u) : lg) }));
  }
  function toggleArchivable(id) { updateLeague(id, lg => ({ ...lg, archivable: !lg.archivable })); }

  async function archiveLeague(lg) {
    if (!confirm(`Are you sure you want to archive "${lg.name}"?\n\nThis will remove it from the home screen and add it to the Archive.`)) return;
    setArchiveMsg({ text: "⏳ Archiving…", color: "#5a6070" });
    try {
      await githubDispatch("archive-league", { leagueId: lg.id });
      // Remove from local state immediately — the Action will also update the JSON on the repo
      setStore(s => ({ ...s, leagues: s.leagues.filter(l => l.id !== lg.id) }));
      if (activeId === lg.id) setActiveId(null);
      setArchiveMsg({ text: "✓ Archived — Action running, changes will appear shortly", color: "#4ade80" });
      setTimeout(() => setArchiveMsg(null), 6000);
    } catch (e) {
      setArchiveMsg({ text: "✗ " + e.message, color: "#f87171" });
      setTimeout(() => setArchiveMsg(null), 8000);
    }
  }

  const active = store.leagues.find(lg => lg.id === activeId) || null;

  if (showBelgian) return <BelgianScreen onBack={() => setShowBelgian(false)} />;
  if (showArchive) return <ArchiveScreen onBack={() => setShowArchive(false)} />;

  return (
    <div className="app">
      <div className="masthead">
        <div>
          <div className="logo">League<span>Sim</span></div>
          <div className="sub">{active ? active.name : store.leagues.length + " league" + (store.leagues.length !== 1 ? "s" : "")}</div>
        </div>
        <div className="top-btns">
          {IS_SHARE ? (
            <>
              {loadStatus === "loading" && <span className="muted">⏳ Loading data…</span>}
              {loadStatus === "error" && <span style={{ color: "#f87171" }}>⚠️ Could not load data</span>}
              {active && <button className="btn btn-ghost" onClick={() => setActiveId(null)}>← All Leagues</button>}
            </>
          ) : (
            <>
              {archiveMsg && <span style={{ fontSize: ".78rem", color: archiveMsg.color }}>{archiveMsg.text}</span>}
              {!archiveMsg && msg && <span className="muted">{msg}</span>}
              <button className="btn btn-cyan" onClick={handleSave}>💾 Save</button>
              <button className="btn btn-ghost" onClick={handleLoad}>📂 Load</button>
              {active && <button className="btn btn-ghost" onClick={() => setActiveId(null)}>← All Leagues</button>}
            </>
          )}
        </div>
      </div>
      {!active && (
        <HomeScreen
          leagues={store.leagues}
          onOpen={setActiveId}
          onCreate={createLeague}
          onDelete={deleteLeague}
          onToggleArchivable={toggleArchivable}
          onOpenArchive={() => setShowArchive(true)}
          onOpenBelgian={() => setShowBelgian(true)}
          onArchiveLeague={archiveLeague}
        />
      )}
      {active && <LeagueEditor key={active.id} league={active} onChange={u => updateLeague(active.id, u)} />}
    </div>
  );
}

// Test hook: lets test/ reach internals without exporting them in production.
if (typeof window !== "undefined" && typeof window.__LEAGUESIM_TEST__ === "function") {
  window.__LEAGUESIM_TEST__({ BelgianScreen, BelgianLeagueView, ArchiveScreen, predictMatch });
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
