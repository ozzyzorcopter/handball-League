const { useState, useEffect } = React;
// ── ARCHIVE SCREEN ────────────────────────────────────────────────────────────
// ── ARCHIVE DATA HOOKS ────────────────────────────────────────────────────────
export const ARCHIVE_INDEX_URL = "https://raw.githubusercontent.com/ozzyzorcopter/handball-League/refs/heads/main/archive/index.json";
export const ARCHIVE_BASE_URL  = "https://raw.githubusercontent.com/ozzyzorcopter/handball-League/refs/heads/main/archive/";

export function useArchiveIndex() {
  const [index, setIndex] = useState(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    fetch(ARCHIVE_INDEX_URL)
      .then(r => { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
      .then(data => {
        if (Array.isArray(data)) {
          // Old format: flat array of manual season entries { season, filename, leagueCount, archivedAt }
          // These are manual-league seasons, not Belgian API seasons — treat as "legacySeasons"
          setIndex({ belgianSeasons: [], standaloneLeagues: [], legacySeasons: data });
        } else {
          setIndex({
            belgianSeasons:   data.belgianSeasons   || [],
            standaloneLeagues: data.standaloneLeagues || [],
            legacySeasons:    data.legacySeasons    || [],
          });
        }
      })
      .catch(() => { setError(true); setIndex({ belgianSeasons: [], standaloneLeagues: [], legacySeasons: [] }); });
  }, []);
  return { index, error };
}

export function useArchiveFile(filename) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    if (!filename) return;
    fetch(ARCHIVE_BASE_URL + filename)
      .then(r => { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
      .then(d => setData(d))
      .catch(() => setError(true));
  }, [filename]);
  return { data, error };
}

// Alias for legacy season files (same shape)
export const useArchiveSeason = useArchiveFile;

export function useStandaloneLeagues() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    fetch(ARCHIVE_BASE_URL + "standalone-leagues.json")
      .then(r => { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
      .then(d => setData(d.leagues || []))
      .catch(() => { setError(true); setData([]); });
  }, []);
  return { data, error };
}
