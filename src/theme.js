// Light / dark theme. "auto" follows the phone's setting. The choice is kept on
// this device; an inline script in index.html applies it before first paint.
const { useState, useEffect } = React;
const KEY = "leaguesim.theme.v1";
const ORDER = ["auto", "light", "dark"];
const ICON = { auto: "◐", light: "☀", dark: "☾" };

function readMode() {
  try { const m = localStorage.getItem(KEY); return ORDER.includes(m) ? m : "auto"; } catch (e) { return "auto"; }
}
export function effectiveTheme(mode) {
  if (mode === "light" || mode === "dark") return mode;
  try { return window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark"; } catch (e) { return "dark"; }
}
export function applyTheme(mode) {
  const eff = effectiveTheme(mode);
  try {
    document.documentElement.dataset.theme = eff;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", eff === "light" ? "#f7f6f3" : "#08090c");
  } catch (e) {}
  return eff;
}

export function ThemeSwitch() {
  const [mode, setMode] = useState(readMode);
  useEffect(() => {
    applyTheme(mode);
    if (mode !== "auto" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-color-scheme: light)");
    const on = () => applyTheme("auto");
    if (mq.addEventListener) { mq.addEventListener("change", on); return () => mq.removeEventListener("change", on); }
  }, [mode]);
  const next = () => {
    const n = ORDER[(ORDER.indexOf(mode) + 1) % ORDER.length];
    try { localStorage.setItem(KEY, n); } catch (e) {}
    setMode(n);
  };
  return (
    <button className="btn btn-ghost theme-btn" onClick={next} aria-label={"Theme: " + mode} title={"Theme: " + mode}
      style={{ fontSize: ".85rem", padding: ".2rem .5rem", minWidth: "2.2rem" }}>{ICON[mode]}</button>
  );
}
