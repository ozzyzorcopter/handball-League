import { calcStats } from "./standings.js";
import { cleanTeamName } from "./names.js";
import { useLang } from "./i18n.js";
const { useState, useMemo } = React;

// Position of every team after each matchday (a matchday = one numbered week of
// games). All lines start grey; tap a team (line or name) to colour it, and
// teams you follow are coloured from the start. The same numbers sit in a
// table under the chart.
const SERIES = ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#008300", "#9085e9", "#e66767"]; // dark-surface steps, fixed order per team
const W = 360, ROW = 21, PAD_T = 14, PAD_B = 22, PAD_L = 22, PAD_R = 92;

export function PositionChart({ teams, fixtures, mine }) {
  const { t } = useLang();
  const [picked, setPicked] = useState([]);   // team ids tapped on top of the followed ones

  const data = useMemo(() => {
    const scored = fixtures.filter(f => f.played && f.homeScore != null && f.awayScore != null && f.week > 0);
    const weeks = [...new Set(scored.map(f => f.week))].sort((a, b) => a - b);
    if (weeks.length < 2) return null;
    const pos = {};       // team id -> [position per matchday]
    teams.forEach(tm => { pos[tm.id] = []; });
    weeks.forEach(w => {
      const order = calcStats(teams, scored.filter(f => f.week <= w));
      order.forEach((r, i) => { if (pos[r.id]) pos[r.id].push(i + 1); });
    });
    return { weeks, pos };
  }, [teams, fixtures]);

  if (!data) return null;
  const { weeks, pos } = data;
  const n = teams.length;
  const H = PAD_T + (n - 1) * ROW + PAD_B;
  const x = i => PAD_L + (weeks.length === 1 ? 0 : (i * (W - PAD_L - PAD_R)) / (weeks.length - 1));
  const y = p => PAD_T + (p - 1) * ROW;
  const hot = id => (mine && mine.has(id)) || picked.includes(id);
  const anyHot = teams.some(tm => hot(tm.id));
  const colorOf = idx => SERIES[idx % SERIES.length];
  const toggle = id => setPicked(p => (p.includes(id) ? p.filter(v => v !== id) : [...p, id]));
  const step = weeks.length > 14 ? 2 : 1;
  const short = nm => { const s = cleanTeamName(nm); return s.length > 13 ? s.slice(0, 12) + "…" : s; };

  // Draw grey lines first, coloured ones on top.
  const order = [...teams.keys()].sort((a, b) => (hot(teams[a].id) ? 1 : 0) - (hot(teams[b].id) ? 1 : 0));

  return (
    <div className="mini-box" style={{ marginTop: "1rem" }}>
      <div className="mini-ttl" style={{ color: "#fdda24" }}>{"📈 " + t("Position after each matchday")}</div>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={t("Position after each matchday")} style={{ width: "100%", maxWidth: 720, height: "auto", display: "block" }}>
        {Array.from({ length: n }, (_, i) => (
          <g key={i}>
            <line x1={PAD_L} x2={W - PAD_R} y1={y(i + 1)} y2={y(i + 1)} stroke="#1c1f27" strokeWidth="1" />
            <text x={PAD_L - 6} y={y(i + 1) + 3} textAnchor="end" fontSize="8.5" fill="#8b93a5" fontFamily="DM Mono, monospace">{i + 1}</text>
          </g>
        ))}
        {weeks.map((w, i) => (i % step === 0 || i === weeks.length - 1) && (
          <text key={w} x={x(i)} y={H - 6} textAnchor="middle" fontSize="8.5" fill="#8b93a5" fontFamily="DM Mono, monospace">{i + 1}</text>
        ))}
        {order.map(ti => {
          const tm = teams[ti], p = pos[tm.id] || [];
          if (!p.length) return null;
          const on = hot(tm.id);
          const col = on ? colorOf(ti) : "#4a5060";
          const pts = p.map((v, i) => `${x(i)},${y(v)}`).join(" ");
          const last = p[p.length - 1];
          const dim = anyHot && !on;
          return (
            <g key={tm.id} opacity={dim ? 0.55 : 1} style={{ cursor: "pointer" }} onClick={() => toggle(tm.id)}>
              <polyline points={pts} fill="none" stroke="transparent" strokeWidth="14" strokeLinejoin="round" />
              <polyline points={pts} fill="none" stroke={col} strokeWidth={on ? 2.2 : 1.2} strokeLinejoin="round" strokeLinecap="round" />
              {on && p.map((v, i) => (
                <circle key={i} cx={x(i)} cy={y(v)} r="3" fill={col} stroke="#10121a" strokeWidth="1.5"><title>{`${cleanTeamName(tm.name)} · ${t("Matchday")} ${i + 1}: #${v}`}</title></circle>
              ))}
              <circle cx={x(p.length - 1)} cy={y(last)} r={on ? 3.5 : 2.5} fill={col} stroke="#10121a" strokeWidth="1.5" />
              <text x={x(weeks.length - 1) + 8} y={y(last) + 3} fontSize="9" fill={on ? "#f0efec" : "#8b93a5"} fontWeight={on ? 700 : 400} fontFamily="DM Sans, sans-serif">{short(tm.name)}</text>
            </g>
          );
        })}
      </svg>
      <div className="muted" style={{ fontSize: ".68rem", marginTop: ".3rem" }}>{t("Tap a team to highlight it. 1 = top of the table.")}</div>
      <details style={{ marginTop: ".5rem" }}>
        <summary className="muted" style={{ fontSize: ".72rem", cursor: "pointer" }}>{t("Show as table")}</summary>
        <div className="tbl-wrap" style={{ marginTop: ".4rem" }}>
          <table className="ltbl">
            <thead><tr><th className="tl">{t("Team")}</th>{weeks.map((w, i) => <th key={w}>{i + 1}</th>)}</tr></thead>
            <tbody>
              {[...teams].sort((a, b) => ((pos[a.id] || [])[weeks.length - 1] || 99) - ((pos[b.id] || [])[weeks.length - 1] || 99)).map(tm => (
                <tr key={tm.id}><td className="tl">{cleanTeamName(tm.name)}</td>{(pos[tm.id] || []).map((v, i) => <td key={i}>{v}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
