// Grey shimmering placeholder rows shown while data loads. The plain loading
// text stays in the page for screen readers.
export function Skeleton({ rows = 6, label }) {
  return (
    <div className="skel-wrap" role="status" aria-live="polite">
      <span className="sr-only">{label || "Loading…"}</span>
      <div aria-hidden="true">
        <div className="skel" style={{ height: "1.1rem", width: "40%", marginBottom: "1rem" }} />
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="skel" style={{ height: "2.1rem", marginBottom: ".45rem", opacity: 1 - i * 0.1 }} />
        ))}
      </div>
    </div>
  );
}
