import { useLang } from "./i18n.js";

// ── HOME SCREEN ───────────────────────────────────────────────────────────────
export function HomeScreen({ onOpenArchive, onOpenBelgian, onOpenTournaments }) {
  const { t } = useLang();
  return (
    <div>
      <div className="card-grid">
        <div className="card card-new" style={{ borderColor: "#4ade80", color: "#4ade80" }} onClick={onOpenBelgian}>🇧🇪 Belgian Handball</div>
        <div className="card card-new" style={{ borderColor: "#60a5fa", color: "#60a5fa" }} onClick={onOpenTournaments}>🏆 {t("Tournaments")}</div>
        <div className="card card-new" style={{ borderColor: "#fbbf24", color: "#fbbf24" }} onClick={onOpenArchive}>📦 Archive</div>
      </div>
    </div>
  );
}
