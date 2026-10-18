// Three-segment win / draw / loss bar. Percentages sit under the bar,
// with the expected score (when given) in the middle. The same numbers are
// also kept as plain text for screen readers, in the classic
// "45% · 6% · 49% (28–26)" form.
export function ProbBar({ h, d, a, eh, ea, title }) {
  const hasExp = eh != null && ea != null;
  const plain = `${h}% · ${d}% · ${a}%` + (hasExp ? ` (${eh}–${ea})` : "");
  return (
    <div title={title} style={{ minWidth: "7rem", flex: "0 1 11rem" }}>
      <span className="sr-only">{plain}</span>
      <div aria-hidden="true">
        <div className="prob3">
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
    </div>
  );
}
