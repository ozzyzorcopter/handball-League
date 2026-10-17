// ── HELPERS ───────────────────────────────────────────────────────────────────
export function heatColor(v) {
  if (v < 0.01) return "transparent";
  const t = Math.min(v / 55, 1);
  return "rgba(" + Math.round(30 + t * 220) + "," + Math.round(180 - t * 120) + "," + Math.round(120 - t * 70) + "," + (0.12 + t * 0.78) + ")";
}

export function fmtPct(v) {
  if (v < 0.001) return "";
  if (v < 0.1) return "<0.1%";
  return v.toFixed(1) + "%";
}
