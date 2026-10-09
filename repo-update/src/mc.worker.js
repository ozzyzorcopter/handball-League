// Runs the Monte Carlo simulation off the main thread so the page stays responsive.
import { runMC } from "./montecarlo.js";

self.onmessage = (e) => {
  const { teams, pending, played, sims } = e.data;
  try {
    self.postMessage({ result: runMC(teams, pending, played, sims) });
  } catch (err) {
    self.postMessage({ error: String((err && err.message) || err) });
  }
};
