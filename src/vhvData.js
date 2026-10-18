const { useState, useRef, useEffect, useCallback, useMemo } = React;
// ── BELGIAN HANDBALL SCREEN ───────────────────────────────────────────────────
export const DATA_BASE = "https://raw.githubusercontent.com/ozzyzorcopter/handball-League/refs/heads/main/data/";
export const VHV_INDEX_URL = DATA_BASE + "index.json";

export const FED_META = {
  "VHV":       { label: "VHV",       color: "#fdda24", desc: "Vlaamse Handbalfederatie" },
  "LFH":       { label: "LFH",       color: "#a78bfa", desc: "Ligue Francophone de Handball" },
  "URBH-KBHB": { label: "URBH-KBHB", color: "#fbbf24", desc: "Union Royale Belge de Handball" },
};

// Loads the small league index first; full leagues (fixtures, scorers, ...) are fetched
// on demand with loadLeague(id). In `data.federations`, a league without `fixtures` is a stub.
export function useVhvData() {
  const [index, setIndex] = useState(null);
  const [loaded, setLoaded] = useState({});
  const [failed, setFailed] = useState({});
  const [error, setError] = useState(false);
  const requested = useRef(new Set());

  useEffect(() => {
    let dead = false;
    const json = r => { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); };
    fetch(VHV_INDEX_URL).then(json)
      .then(d => { if (!d || !d.federations) throw new Error("bad index"); return d; })
      .then(d => { if (!dead) setIndex(d); })
      .catch(() => { if (!dead) setError(true); });
    return () => { dead = true; };
  }, []);

  const loadLeague = useCallback(id => {
    id = String(id);
    if (requested.current.has(id)) return;
    requested.current.add(id);
    fetch(DATA_BASE + "leagues/" + encodeURIComponent(id) + ".json")
      .then(r => { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
      .then(lg => setLoaded(m => ({ ...m, [id]: lg })))
      .catch(() => { requested.current.delete(id); setFailed(m => ({ ...m, [id]: true })); });
  }, []);

  const data = useMemo(() => {
    if (!index) return null;
    const federations = {};
    for (const [fed, byId] of Object.entries(index.federations || {})) {
      federations[fed] = {};
      for (const [id, lg] of Object.entries(byId || {})) federations[fed][id] = loaded[String(lg.serieId || id)] || lg;
    }
    return { ...index, federations };
  }, [index, loaded]);

  return { data, error, loadLeague, failed };
}
