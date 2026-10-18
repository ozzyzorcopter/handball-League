import { useLang } from "./i18n.js";
import { buildClubIndex, cleanTeamName, resolveClubName } from "./names.js";
const { useState, useMemo } = React;
// Players tab: opens on ONE overall table with everything we know about each
// player (goals, games, average, 7m, cards and suspensions). Picking a chip
// (all goals / excluding 7m / 7m only / cards & suspensions) drops the other
// stats and shows just that one. The player name is sticky with the club under
// it, so the numbers are always next to the name. Any column header sorts; the
// search box and the club menu filter rows.
export function PlayersTab({ scorers, teams, aliases }) {
  const { t } = useLang();
  const [mode, setMode] = useState("overall");
  const [sort, setSort] = useState(null);       // { key, dir } or null = the chip's default order
  const [q, setQ] = useState("");
  const [club, setClub] = useState("");
  const [expanded, setExpanded] = useState(false);
  const num = v => (v > 0 ? v : 0);

  // Only players of clubs that actually play in this league.
  const list = useMemo(() => {
    if (!Array.isArray(scorers)) return [];
    const idx = buildClubIndex(scorers);
    const names = new Set((teams || []).map(tm => resolveClubName(tm.name, aliases || {}, idx)));
    return scorers.filter(s => names.has(s.club));
  }, [scorers, teams, aliases]);

  const hasSeven = list.some(s => s.sevenMScored > 0 || s.sevenMMissed > 0);
  const hasCards = list.some(s => s.yellowCards > 0 || s.twoMinSuspensions > 0 || s.blueCards > 0 || s.redCards > 0);
  const cols = {
    mp: list.some(s => s.matchesPlayed > 0),
    seven: hasSeven,
    yc: list.some(s => s.yellowCards > 0),
    two: list.some(s => s.twoMinSuspensions > 0),
    bc: list.some(s => s.blueCards > 0),
    rc: list.some(s => s.redCards > 0),
  };

  const clubs = useMemo(() => [...new Set(list.map(s => s.club).filter(Boolean))].sort((x, y) => x.localeCompare(y)), [list]);

  // Rows for the selected chip. `g` is the goal figure that chip is about.
  const rows = useMemo(() => {
    let r = list.map(s => {
      const seven = num(s.sevenMScored);
      const g = mode === "open" ? (s.goals || 0) - seven : mode === "seven" ? seven : (s.goals || 0);
      return { ...s, g, last: (mode === "overall" || mode === "all") ? s.lastGameGoals : null };
    });
    if (mode === "open" || mode === "seven") r = r.filter(s => s.g > 0);
    if (mode === "cards") r = r.filter(s => s.yellowCards > 0 || s.twoMinSuspensions > 0 || s.blueCards > 0 || s.redCards > 0);
    return r;
  }, [list, mode]);

  const get = {
    g: s => s.g, mp: s => num(s.matchesPlayed), avg: s => (s.matchesPlayed > 0 ? s.g / s.matchesPlayed : 0),
    seven: s => num(s.sevenMScored), yc: s => num(s.yellowCards), two: s => num(s.twoMinSuspensions),
    bc: s => num(s.blueCards), rc: s => num(s.redCards),
  };
  const view = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let r = rows.filter(s => (!club || s.club === club) && (!needle || String(s.player).toLowerCase().includes(needle)));
    const byName = (x, y) => String(x.player).localeCompare(String(y.player));
    if (sort) {
      const f = get[sort.key];
      r = [...r].sort((x, y) => (sort.dir === "asc" ? f(x) - f(y) : f(y) - f(x)) || byName(x, y));
    } else if (mode === "cards") {
      r = [...r].sort((x, y) => get.two(y) - get.two(x) || get.yc(y) - get.yc(x) || get.rc(y) - get.rc(x) || get.bc(y) - get.bc(x) || byName(x, y));
    } else {
      r = [...r].sort((x, y) => y.g - x.g || byName(x, y));
    }
    return r;
  }, [rows, q, club, sort, mode]);

  const pick = k => { setMode(k); setSort(null); setExpanded(false); };
  const clickSort = key => setSort(cur => (cur && cur.key === key ? { key, dir: cur.dir === "desc" ? "asc" : "desc" } : { key, dir: "desc" }));
  const arrow = key => (sort && sort.key === key ? (sort.dir === "desc" ? " ▼" : " ▲") : "");
  const Th = ({ k, title, children, cls }) => (
    <th className={cls} title={title} style={{ cursor: "pointer", userSelect: "none" }} onClick={() => clickSort(k)}>{children}{arrow(k)}</th>
  );

  // Which columns the current chip shows: overall = everything, a chip = only its own stat.
  const showAll = mode === "overall";
  const showG = mode !== "cards";
  const showCards = showAll || mode === "cards";
  const sh = {
    mp: cols.mp && showAll, seven: cols.seven && showAll,
    yc: cols.yc && showCards, two: cols.two && showCards, bc: cols.bc && showCards, rc: cols.rc && showCards,
  };
  const chips = [["overall", "Overall"], ["all", "All goals"], ...(hasSeven ? [["open", "Excl. 7m"], ["seven", "7m only"]] : []), ...(hasCards ? [["cards", "Cards & suspensions"]] : [])];
  const MAX = 25;
  const shown = expanded ? view : view.slice(0, MAX);
  const gTitle = mode === "open" ? "Goals excluding 7m" : mode === "seven" ? "7m goals" : "Goals (goals in last game)";

  // Team totals for the cards view
  const teamRows = useMemo(() => {
    if (mode !== "cards") return [];
    const m = new Map();
    list.forEach(s => {
      const k = s.club || "?";
      const r = m.get(k) || { club: k, yc: 0, two: 0, bc: 0, rc: 0 };
      r.yc += num(s.yellowCards); r.two += num(s.twoMinSuspensions); r.bc += num(s.blueCards); r.rc += num(s.redCards);
      m.set(k, r);
    });
    return [...m.values()].sort((a, b) => b.two - a.two || b.yc - a.yc || b.rc - a.rc || a.club.localeCompare(b.club));
  }, [list, mode]);

  if (list.length === 0) return <div className="muted" style={{ padding: "1.5rem", textAlign: "center", fontSize: ".85rem" }}>{t("No scorer data found.")}</div>;

  return (
    <div>
      <div style={{ display: "flex", gap: ".4rem", flexWrap: "wrap", alignItems: "center" }}>
        {chips.map(([k, label]) => (
          <button key={k} className={"btn" + (mode === k ? "" : " btn-ghost")} style={{ fontSize: ".78rem", padding: ".3rem .8rem" }} onClick={() => pick(k)}>{t(label)}</button>
        ))}
      </div>
      <div style={{ display: "flex", gap: ".5rem", flexWrap: "wrap", marginTop: ".6rem" }}>
        <input value={q} onChange={e => { setQ(e.target.value); setExpanded(false); }} placeholder={t("Search player…")} aria-label={t("Search player…")}
          style={{ flex: "1 1 10rem", minWidth: 0, background: "#11141b", color: "inherit", border: "1px solid #2a2f3a", borderRadius: 8, padding: ".4rem .6rem", font: "inherit", fontSize: ".82rem" }} />
        <select value={club} onChange={e => { setClub(e.target.value); setExpanded(false); }} aria-label={t("Club")}
          style={{ flex: "1 1 10rem", minWidth: 0, background: "#11141b", color: "inherit", border: "1px solid #2a2f3a", borderRadius: 8, padding: ".4rem .6rem", font: "inherit", fontSize: ".82rem" }}>
          <option value="">{t("All clubs")}</option>
          {clubs.map(c => <option key={c} value={c}>{cleanTeamName(c)}</option>)}
        </select>
      </div>

      <div className="mini-box" style={{ marginTop: ".8rem" }}>
        <div className="mini-ttl" style={{ color: mode === "cards" ? "#f87171" : "#fbbf24", marginBottom: ".6rem" }}>
          {mode === "cards" ? "🟨 " + t("Cards & suspensions") : "⚽ " + t(mode === "open" ? "Goals excluding 7m" : mode === "seven" ? "7m goals" : "Players")}
          <span className="muted" style={{ fontWeight: 400, fontSize: ".72rem", marginLeft: ".5rem" }}>{view.length}</span>
        </div>
        {view.length === 0 ? (
          <div className="muted" style={{ fontSize: ".8rem" }}>{t("No players match.")}</div>
        ) : (
          <div className="tbl-wrap">
            <table className="ltbl">
              <thead>
                <tr>
                  <th style={{ width: "2rem" }}>#</th>
                  <th className="tl">{t("Player")}</th>
                  {showG && <Th k="g" cls="tpts" title={gTitle}>G</Th>}
                  {sh.mp && <Th k="mp" title="Matches played">MP</Th>}
                  {sh.mp && <Th k="avg" title="Goals per game">Avg</Th>}
                  {sh.seven && <Th k="seven" title="7m scored / attempted">7m</Th>}
                  {sh.yc && <Th k="yc" title="Yellow cards">🟨</Th>}
                  {sh.two && <Th k="two" title="2-minute suspensions">2'</Th>}
                  {sh.bc && <Th k="bc" title="Blue cards">🟦</Th>}
                  {sh.rc && <Th k="rc" title="Red cards">🟥</Th>}
                </tr>
              </thead>
              <tbody>
                {shown.map((s, i) => (
                  <tr key={s.player + "|" + s.club + "|" + i}>
                    <td className="tpos">{!sort && showG && !q && !club && i < 3 ? ["🥇", "🥈", "🥉"][i] : i + 1}</td>
                    <td className="tl pl">
                      <div className="pl-name">{s.player}</div>
                      <div className="pl-club">{cleanTeamName(s.club || "")}</div>
                    </td>
                    {showG && (
                      <td className="tpts" style={{ color: "#fbbf24" }}>
                        {s.g}
                        {s.last != null && <span style={{ fontSize: ".68rem", marginLeft: ".2rem", color: "#9ca3af", fontWeight: 400 }}>({s.last})</span>}
                      </td>
                    )}
                    {sh.mp && <td>{s.matchesPlayed > 0 ? s.matchesPlayed : ""}</td>}
                    {sh.mp && <td>{s.matchesPlayed > 0 ? (s.g / s.matchesPlayed).toFixed(2) : ""}</td>}
                    {sh.seven && <td>{(s.sevenMScored > 0 || s.sevenMMissed > 0) ? `${s.sevenMScored || 0}/${(s.sevenMScored || 0) + (s.sevenMMissed || 0)}` : ""}</td>}
                    {sh.yc && <td>{s.yellowCards > 0 ? s.yellowCards : ""}</td>}
                    {sh.two && <td>{s.twoMinSuspensions > 0 ? s.twoMinSuspensions : ""}</td>}
                    {sh.bc && <td>{s.blueCards > 0 ? s.blueCards : ""}</td>}
                    {sh.rc && <td>{s.redCards > 0 ? s.redCards : ""}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {view.length > MAX && (
          <div style={{ marginTop: ".4rem", textAlign: "center" }}>
            <button className="btn-ghost" style={{ fontSize: ".72rem", padding: ".2rem .6rem" }} onClick={() => setExpanded(e => !e)}>
              {expanded ? t("Show less") + " ▲" : t("Show all") + " " + view.length + " ▼"}
            </button>
          </div>
        )}
      </div>

      {mode === "cards" && teamRows.length > 0 && (
        <div className="mini-box" style={{ marginTop: "1rem" }}>
          <div className="mini-ttl" style={{ color: "#fbbf24", marginBottom: ".6rem" }}>{t("Teams")}</div>
          <div className="tbl-wrap">
            <table className="ltbl">
              <thead><tr><th style={{ width: "2rem" }}>#</th><th className="tl">{t("Team")}</th><th title="Yellow cards">🟨</th><th title="2-minute suspensions">2'</th><th title="Blue cards">🟦</th><th title="Red cards">🟥</th></tr></thead>
              <tbody>
                {teamRows.map((r, i) => (
                  <tr key={r.club}>
                    <td className="tpos">{i + 1}</td>
                    <td className="tl">{cleanTeamName(r.club)}</td>
                    <td>{r.yc || ""}</td><td className="tpts">{r.two || ""}</td><td>{r.bc || ""}</td><td>{r.rc || ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {mode === "cards" && <p className="note">{t("2' = two-minute suspension · a blue card is a red card with a written report")}</p>}
      {mode !== "cards" && !hasSeven && <p className="note">{t("7m details aren't published for this league, so only total goals are shown.")}</p>}
      {!hasCards && <p className="note">{t("No cards or suspensions published for this league (lower divisions usually don't have this data).")}</p>}
    </div>
  );
}
