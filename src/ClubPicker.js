import { useLang } from "./i18n.js";
import { cleanTeamName } from "./names.js";
import { teamKey } from "./follow.js";
const { useState, useMemo } = React;
// First-visit / "add team" picker: search a club, tick which of its teams to follow.
export const PICKER_DISMISS_KEY = "leaguesim.pickerDismissed.v1";
export function ClubPicker({ data, follow, onClose }) {
  const { t } = useLang();
  const [q, setQ] = useState("");
  const [club, setClub] = useState(null);
  const [picked, setPicked] = useState({});
  const clubs = useMemo(() => {
    const m = new Map();
    for (const f of Object.values(data.federations || {})) {
      for (const lg of Object.values(f || {})) {
        const lid = String(lg.serieId || lg.id);
        for (const t of (lg.teams || [])) {
          const name = cleanTeamName(t.name);
          const k = name.toLowerCase();
          const c = m.get(k) || { name, teams: [] };
          c.teams.push({ key: teamKey(lid, t.id), league: lg.name, full: t.name });
          m.set(k, c);
        }
      }
    }
    return [...m.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [data]);
  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (t ? clubs.filter(c => c.name.toLowerCase().includes(t)) : clubs).slice(0, 12);
  }, [clubs, q]);
  const choose = c => { setClub(c); setPicked(Object.fromEntries(c.teams.map(t => [t.key, true]))); };
  const save = () => {
    const keys = club.teams.map(t => t.key).filter(k => picked[k]);
    keys.forEach(k => { if (!follow.isFollowing(k)) follow.toggle(k); });
    if (keys.length && !follow.main) follow.setMain(keys[0]);
    onClose(true);
  };
  const dismiss = () => { try { localStorage.setItem(PICKER_DISMISS_KEY, "1"); } catch {} onClose(false); };
  return (
    <div className="mini-box" style={{ marginBottom: "1.25rem" }}>
      <div className="mini-ttl" style={{ color: "#fbbf24", display: "flex", justifyContent: "space-between", marginBottom: ".5rem" }}>
        <span>{club ? club.name : t("Which club do you follow?")}</span>
        <button className="btn btn-ghost" style={{ fontSize: ".7rem", padding: ".15rem .5rem" }} onClick={club ? () => setClub(null) : dismiss}>{club ? t("← Back") : t("Skip")}</button>
      </div>
      {!club && (
        <>
          <label htmlFor="club-q" style={{ position: "absolute", left: "-9999px" }}>Search clubs</label>
          <input id="club-q" value={q} onChange={e => setQ(e.target.value)} placeholder={t("Search") + " " + clubs.length + " " + t("clubs") + "…"}
            style={{ width: "100%", boxSizing: "border-box", padding: ".55rem .7rem", borderRadius: "6px", border: "1px solid #2a2f3a", background: "#0f1218", color: "inherit", fontSize: ".9rem" }} />
          <div style={{ marginTop: ".5rem" }}>
            {shown.map(c => (
              <div key={c.name} className="mini-row" style={{ cursor: "pointer", padding: ".5rem 0" }} onClick={() => choose(c)}>
                <span style={{ fontWeight: 600 }}>{c.name}</span>
                <span className="muted" style={{ marginLeft: "auto", fontSize: ".72rem" }}>{c.teams.length} {c.teams.length === 1 ? t("team") : t("teams")}</span>
              </div>
            ))}
            {shown.length === 0 && <div className="muted" style={{ fontSize: ".8rem", padding: ".5rem 0" }}>{t("No club found.")}</div>}
            {!q && <div className="muted" style={{ fontSize: ".72rem", marginTop: ".3rem" }}>{t("Type to search all clubs.")}</div>}
          </div>
        </>
      )}
      {club && (
        <>
          <div className="muted" style={{ fontSize: ".78rem", marginBottom: ".4rem" }}>{t("Choose the teams to follow. You can change this any time with ☆ in a table.")}</div>
          {club.teams.map(t => (
            <label key={t.key} className="mini-row" style={{ gap: ".6rem", padding: ".5rem 0", cursor: "pointer" }}>
              <input type="checkbox" checked={!!picked[t.key]} onChange={() => setPicked(p => ({ ...p, [t.key]: !p[t.key] }))} />
              <span>{cleanTeamName(t.full)}</span>
              <span className="muted" style={{ marginLeft: "auto", fontSize: ".72rem" }}>{t.league}</span>
            </label>
          ))}
          <button className="btn" style={{ marginTop: ".6rem" }} onClick={save} disabled={!club.teams.some(t => picked[t.key])}>{t("Follow selected")}</button>
        </>
      )}
    </div>
  );
}
