import { IS_SHARE } from "./config.js";
const { useState } = React;
// ── HOME SCREEN ───────────────────────────────────────────────────────────────
export function HomeScreen({ leagues, onOpen, onCreate, onDelete, onToggleArchivable, onOpenArchive, onOpenBelgian, onArchiveLeague }) {
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
                    <span style={{ color: poNotGen ? "#f87171" : poPending > 0 ? "#94a3b8" : "#4ade80" }}>
                      PO: {poNotGen ? "not generated" : poPending > 0 ? poPending + " pending" : "done"}
                    </span>
                    {" · "}
                    <span style={{ color: pdNotGen ? "#f87171" : pdPending > 0 ? "#94a3b8" : "#4ade80" }}>
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
