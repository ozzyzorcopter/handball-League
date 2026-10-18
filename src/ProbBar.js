// Three-segment win / draw / loss bar. Percentages sit under the bar,
// with the expected score (when given) in the middle.
export function ProbBar({ h, d, a, eh, ea, title }) {
  const hasExp = eh != null && ea != null;
  return (
    <div title={title} style={{ minWidth: "7rem", flex: "0 1 11rem" }}>
      <div className="prob3" role="img" aria-label={`${h}% / ${d}% / ${a}%`}>
        <span className="p-h" style={{ width: h + "%" }} />
        <span className="p-d" style={{ width: d + "%" }} />
        <span className="p-a" style={{ width: a + "%" }} />
      </div>
      <div className="prob3-lbl">
        <span className="ph-col">{h}%</span>
        {hasExp && <span className="muted" style={{ fontSize: ".66rem" }}>{eh}–{ea}</span>}
        <span className="pd-col">{d}%</span>
        <span className="pa-col">{a}%</span>
      </div>
    </div>
  );
}
