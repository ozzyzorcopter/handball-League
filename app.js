import { predictMatch } from "./src/probabilities.js";
import { BelgianLeagueView, BelgianScreen } from "./src/belgian.js";
import { TournamentsScreen } from "./src/tourneyUI.js";
import { ArchiveScreen } from "./src/archive.js";
import { HomeScreen } from "./src/HomeScreen.js";
import { OfflineBanner } from "./src/Offline.js";
import { ThemeSwitch } from "./src/theme.js";
import { useBackLayer } from "./src/backNav.js";

const { useState } = React;
// ── ROOT APP ──────────────────────────────────────────────────────────────────
function App() {
  const [showArchive, setShowArchive] = useState(false);
  const [showBelgian, setShowBelgian] = useState(false);
  const [showTournaments, setShowTournaments] = useState(false);
  useBackLayer(showBelgian, () => setShowBelgian(false));
  useBackLayer(showTournaments, () => setShowTournaments(false));
  useBackLayer(showArchive, () => setShowArchive(false));

  if (showBelgian) return <div className="app"><OfflineBanner /><BelgianScreen onBack={() => setShowBelgian(false)} /></div>;
  if (showTournaments) return <div className="app"><OfflineBanner /><TournamentsScreen onBack={() => setShowTournaments(false)} /></div>;
  if (showArchive) return <div className="app"><OfflineBanner /><ArchiveScreen onBack={() => setShowArchive(false)} /></div>;

  return (
    <div className="app">
      <OfflineBanner />
      <div className="masthead">
        <div>
          <div className="logo">League<span>Sim</span></div>
        </div>
        <div className="top-btns"><ThemeSwitch /></div>
      </div>
      <HomeScreen
        onOpenArchive={() => setShowArchive(true)}
        onOpenBelgian={() => setShowBelgian(true)}
        onOpenTournaments={() => setShowTournaments(true)}
      />
    </div>
  );
}

// Test hook: lets test/ reach internals without exporting them in production.
if (typeof window !== "undefined" && typeof window.__LEAGUESIM_TEST__ === "function") {
  window.__LEAGUESIM_TEST__({ BelgianScreen, BelgianLeagueView, ArchiveScreen, predictMatch });
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
