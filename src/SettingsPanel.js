import { GITHUB_PAT_KEY } from "./github.js";
import { useLang } from "./i18n.js";
import { IS_SHARE } from "./config.js";
const { useState } = React;
// ── PAT SETTINGS ─────────────────────────────────────────────────────────────
export function PATSettings() {
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
export function SettingsPanel({ settings, onChange, showTiebreakers, league, onLeagueChange, readOnly, belgian }) {
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
