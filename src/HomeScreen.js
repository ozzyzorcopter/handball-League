import { useLang } from "./i18n.js";

// ── HOME SCREEN ───────────────────────────────────────────────────────────────
export function HomeScreen({ leagues, onOpen, onDelete, onToggleArchivable, onOpenArchive, onOpenBelgian, onOpenTournaments, onArchiveLeague }) {
  const { t } = useLang();
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
        <div className="card card-new" style={{ borderColor: "#60a5fa", color: "#60a5fa" }} onClick={onOpenTournaments}>🏆 {t("Tournaments")}</div>
        <div className="card card-new" style={{ borderColor: "#4ade80", color: "#4ade80" }} onClick={onOpenBelgian}>🇧🇪 Belgian Handball</div>
        <div className="card card-new" style={{ borderColor: "#fbbf24", color: "#fbbf24" }} onClick={onOpenArchive}>📦 Archive</div>
      </div>

    </div>
  );
}
