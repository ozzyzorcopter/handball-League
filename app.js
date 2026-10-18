import { predictMatch } from "./src/probabilities.js";
import { githubDispatch } from "./src/github.js";
import { IS_SHARE } from "./src/config.js";
import { loadData, makeLeague, saveData } from "./src/leagueModel.js";
import { BelgianLeagueView, BelgianScreen } from "./src/belgian.js";
import { ArchiveScreen } from "./src/archive.js";
import { HomeScreen } from "./src/HomeScreen.js";
import { LeagueEditor } from "./src/manualLeague.js";

const { useState, useRef, useEffect } = React;
// ── ROOT APP ──────────────────────────────────────────────────────────────────
const LEAGUESIM_DATA_URL = "https://raw.githubusercontent.com/ozzyzorcopter/handball-League/refs/heads/main/leaguesim-data.json";

function App() {
  const [store, setStore]         = useState({ leagues: [] });
  const [activeId, setActiveId]   = useState(null);
  const [showArchive, setShowArchive] = useState(false);
  const [showBelgian, setShowBelgian] = useState(false);
  const [archiveMsg, setArchiveMsg]   = useState(null); // { text, color }

  // ── Share mode: auto-load from repo ──────────────────────────────────────
  const [loadStatus, setLoadStatus] = useState(IS_SHARE ? "loading" : "ok");
  useEffect(() => {
    if (!IS_SHARE) return;
    fetch(LEAGUESIM_DATA_URL)
      .then(r => { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
      .then(data => {
        if (!data.leagues) throw new Error("Not a LeagueSim file");
        setStore(data);
        setActiveId(data.leagues.length === 1 ? data.leagues[0].id : null);
        setLoadStatus("ok");
      })
      .catch(e => { console.error(e); setLoadStatus("error"); });
  }, []);

  // ── Edit mode: manual save/load ───────────────────────────────────────────
  const [msg, setMsg] = useState("");
  const msgTimer = useRef(null);
  function flash(m) { setMsg(m); clearTimeout(msgTimer.current); msgTimer.current = setTimeout(() => setMsg(""), 2500); }
  function handleSave() { saveData(store); flash("Downloading…"); }
  function handleLoad() {
    loadData().then(data => {
      if (!data.leagues) throw new Error("Not a LeagueSim file");
      setStore(data); setActiveId(null); flash("Loaded!");
    }).catch(e => alert("Could not load: " + e));
  }

  function createLeague(name, type, poSize, pdSize, phaseFormat, archivable) {
    const lg = makeLeague(name, type, poSize, pdSize, phaseFormat, archivable);
    setStore(s => ({ ...s, leagues: [...s.leagues, lg] }));
    setActiveId(lg.id);
  }
  function deleteLeague(id) {
    if (!confirm("Delete this league?")) return;
    setStore(s => ({ ...s, leagues: s.leagues.filter(lg => lg.id !== id) }));
    if (activeId === id) setActiveId(null);
  }
  function updateLeague(id, u) {
    setStore(s => ({ ...s, leagues: s.leagues.map(lg => lg.id === id ? (typeof u === "function" ? u(lg) : u) : lg) }));
  }
  function toggleArchivable(id) { updateLeague(id, lg => ({ ...lg, archivable: !lg.archivable })); }

  async function archiveLeague(lg) {
    if (!confirm(`Are you sure you want to archive "${lg.name}"?\n\nThis will remove it from the home screen and add it to the Archive.`)) return;
    setArchiveMsg({ text: "⏳ Archiving…", color: "#5a6070" });
    try {
      await githubDispatch("archive-league", { leagueId: lg.id });
      // Remove from local state immediately — the Action will also update the JSON on the repo
      setStore(s => ({ ...s, leagues: s.leagues.filter(l => l.id !== lg.id) }));
      if (activeId === lg.id) setActiveId(null);
      setArchiveMsg({ text: "✓ Archived — Action running, changes will appear shortly", color: "#4ade80" });
      setTimeout(() => setArchiveMsg(null), 6000);
    } catch (e) {
      setArchiveMsg({ text: "✗ " + e.message, color: "#f87171" });
      setTimeout(() => setArchiveMsg(null), 8000);
    }
  }

  const active = store.leagues.find(lg => lg.id === activeId) || null;

  if (showBelgian) return <div className="app"><BelgianScreen onBack={() => setShowBelgian(false)} /></div>;
  if (showArchive) return <div className="app"><ArchiveScreen onBack={() => setShowArchive(false)} /></div>;

  return (
    <div className="app">
      <div className="masthead">
        <div>
          <div className="logo">League<span>Sim</span></div>
          <div className="sub">{active ? active.name : store.leagues.length + " league" + (store.leagues.length !== 1 ? "s" : "")}</div>
        </div>
        <div className="top-btns">
          {IS_SHARE ? (
            <>
              {loadStatus === "loading" && <span className="muted">⏳ Loading data…</span>}
              {loadStatus === "error" && <span style={{ color: "#f87171" }}>⚠️ Could not load data</span>}
              {active && <button className="btn btn-ghost" onClick={() => setActiveId(null)}>← All Leagues</button>}
            </>
          ) : (
            <>
              {archiveMsg && <span style={{ fontSize: ".78rem", color: archiveMsg.color }}>{archiveMsg.text}</span>}
              {!archiveMsg && msg && <span className="muted">{msg}</span>}
              <button className="btn btn-cyan" onClick={handleSave}>💾 Save</button>
              <button className="btn btn-ghost" onClick={handleLoad}>📂 Load</button>
              {active && <button className="btn btn-ghost" onClick={() => setActiveId(null)}>← All Leagues</button>}
            </>
          )}
        </div>
      </div>
      {!active && (
        <HomeScreen
          leagues={store.leagues}
          onOpen={setActiveId}
          onCreate={createLeague}
          onDelete={deleteLeague}
          onToggleArchivable={toggleArchivable}
          onOpenArchive={() => setShowArchive(true)}
          onOpenBelgian={() => setShowBelgian(true)}
          onArchiveLeague={archiveLeague}
        />
      )}
      {active && <LeagueEditor key={active.id} league={active} onChange={u => updateLeague(active.id, u)} />}
    </div>
  );
}

// Test hook: lets test/ reach internals without exporting them in production.
if (typeof window !== "undefined" && typeof window.__LEAGUESIM_TEST__ === "function") {
  window.__LEAGUESIM_TEST__({ BelgianScreen, BelgianLeagueView, ArchiveScreen, predictMatch });
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
