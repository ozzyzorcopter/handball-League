// Starts a Monte Carlo run in a Web Worker (the worker source is embedded at
// build time as __MC_WORKER_SRC__). If workers are unavailable it falls back to
// running on the main thread after a short delay, as before.
import { runMC } from "./montecarlo.js";

// Strip everything the simulation doesn't need so less data is copied to the worker.
const slimTeams = teams => teams.map(t => ({ points: t.points }));
const slimPending = pending => pending.map(f => ({ homeIdx: f.homeIdx, awayIdx: f.awayIdx, homeWin: f.homeWin, draw: f.draw }));
const slimPlayed = played => played.map(f => ({ homeIdx: f.homeIdx, awayIdx: f.awayIdx, homeScore: f.homeScore, awayScore: f.awayScore }));

export function runMCAsync(teams, pending, played, sims = 100000) {
  const args = [slimTeams(teams), slimPending(pending), slimPlayed(played)];
  let cancelled = false;
  let worker = null;
  let timer = null;

  const promise = new Promise((resolve, reject) => {
    const src = typeof __MC_WORKER_SRC__ === "string" ? __MC_WORKER_SRC__ : "";
    if (src && typeof Worker !== "undefined" && typeof Blob !== "undefined" && typeof URL !== "undefined") {
      try {
        const url = URL.createObjectURL(new Blob([src], { type: "text/javascript" }));
        worker = new Worker(url);
        URL.revokeObjectURL(url);
        worker.onmessage = e => {
          worker.terminate();
          if (cancelled) return;
          if (e.data.error) reject(new Error(e.data.error)); else resolve(e.data.result);
        };
        worker.onerror = () => {
          worker.terminate();
          worker = null;
          if (!cancelled) timer = setTimeout(() => { try { resolve(runMC(...args, sims)); } catch (err) { reject(err); } }, 20);
        };
        worker.postMessage({ teams: args[0], pending: args[1], played: args[2], sims });
        return;
      } catch { worker = null; }
    }
    timer = setTimeout(() => { try { resolve(runMC(...args, sims)); } catch (err) { reject(err); } }, 20);
  });

  return {
    promise,
    cancel() {
      cancelled = true;
      if (worker) worker.terminate();
      if (timer) clearTimeout(timer);
    },
  };
}
