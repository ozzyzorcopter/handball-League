import { calcStats } from "./standings.js";
import { cleanTeamName } from "./names.js";
import { useLang } from "./i18n.js";
const { useState, useMemo } = React;

// Position of every team after each matchday (a matchday = one numbered week of
// games). All lines start grey; tap a team (line or name) to colour it, and
// teams you follow are coloured from the start. The same numbers sit in a
// table under the chart.
// One colour per team, spread round the colour wheel. Neighbouring teams (by index) get far-apart hues and
// alternating lightness, so lines that run next to each other stay easy to tell apart.
const gcd = (a, b) => (b ? gcd(b, a % b) : a);
function palette(n) {
  let step = Math.max(1, Math.round(n * 0.382)); while (gcd(step, n) !== 1) step++;
  const L = [62, 48, 75];
  return Array.from({ length: n }, (_, i) => { const k = (i * step) % n; return `hsl(${Math.round((360 * k) / n + 8) % 360} 80% ${L[k % 3]}%)`; });
}
const W = 360, ROW = 21, PAD_T = 14, PAD_B = 22, PAD_L = 22, PAD_R = 100;

export function PositionChart({ teams, fixtures, mine }) {
  const { t } = useLang();
  const [picked, setPicked] = useState([]);   // team ids tapped on top of the followed ones

  const data = useMemo(() => {
    const scored = fixtures.filter(f => f.played && f.homeScore != null && f.awayScore != null);
    // Matchday of a game = its numbered week. Games without a week (no date yet) count in the last column,
    // so the chart ends on the real table. Leagues with fewer than two played weeks (a tournament weekend)
    // fall back to "after each team's Nth game".
    let weeks = [...new Set(scored.map(f => f.week))].filter(w => w > 0).sort((a, b) => a - b);
    let round;
    if (weeks.length >= 2) {
      const lastWeek = weeks[weeks.length - 1];
      round = f => (f.week > 0 ? f.week : lastWeek);
    } else {
      const own = new Map(), by = new Map();
      scored.map((f, i) => ({ f, i }))
        .sort((x, y) => (x.f.date && y.f.date ? String(x.f.date).localeCompare(String(y.f.date)) || String(x.f.time || "").localeCompare(String(y.f.time || "")) : 0) || x.i - y.i)
        .forEach(({ f }) => {
          const h = (own.get(f.homeIdx) || 0) + 1, a = (own.get(f.awayIdx) || 0) + 1;
          own.set(f.homeIdx, h); own.set(f.awayIdx, a); by.set(f, Math.max(h, a));
        });
      round = f => by.get(f);
      weeks = [...new Set(scored.map(round))].sort((a, b) => a - b);
    }
    if (weeks.length < 2) return null;
    const pos = {};       // team id -> [position per matchday, or null before its first game]
    teams.forEach(tm => { pos[tm.id] = Array(weeks.length).fill(null); });
    weeks.forEach((w, wi) => {
      const order = calcStats(teams, scored.filter(f => round(f) <= w));
      const played = order.filter(r => r.P > 0), idle = order.filter(r => !(r.P > 0));
      played.forEach((r, i) => { if (pos[r.id]) pos[r.id][wi] = i + 1; });
      if (wi === weeks.length - 1) idle.forEach((r, i) => { if (pos[r.id]) pos[r.id][wi] = played.length + i + 1; });
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
  const colors = palette(teams.length);
  const colorOf = idx => colors[idx];
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
          const pts = p.map((v, i) => (v == null ? null : [i, v])).filter(Boolean);
          if (!pts.length) return null;
          const on = hot(tm.id);
          const col = colorOf(ti);
          const line = pts.map(([i, v]) => `${x(i)},${y(v)}`).join(" ");
          const [li, last] = pts[pts.length - 1];
          const dim = anyHot && !on;
          return (
            <g key={tm.id} opacity={dim ? 0.3 : 1} style={{ cursor: "pointer" }} onClick={() => toggle(tm.id)}>
              <polyline points={line} fill="none" stroke="transparent" strokeWidth="14" strokeLinejoin="round" />
              <polyline points={line} fill="none" stroke={col} strokeWidth={on ? 2.8 : 1.5} strokeLinejoin="round" strokeLinecap="round" />
              {on && pts.map(([i, v]) => (
                <circle key={i} cx={x(i)} cy={y(v)} r="3" fill={col} stroke="#10121a" strokeWidth="1.5"><title>{`${cleanTeamName(tm.name)} · ${t("Matchday")} ${i + 1}: #${v}`}</title></circle>
              ))}
              <circle cx={x(li)} cy={y(last)} r={on ? 3.5 : 2.6} fill={col} stroke="#10121a" strokeWidth="1.5" />
              <rect x={x(weeks.length - 1) + 7} y={y(last) - 3.5} width="7" height="7" rx="2" fill={col} />
              <text x={x(weeks.length - 1) + 17} y={y(last) + 3} fontSize="9" fill={on ? "#f0efec" : "#aeb5c4"} fontWeight={on ? 700 : 400} fontFamily="DM Sans, sans-serif">{short(tm.name)}</text>
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
                <tr key={tm.id}><td className="tl">{cleanTeamName(tm.name)}</td>{(pos[tm.id] || []).map((v, i) => <td key={i}>{v == null ? "–" : v}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
