// .github/scripts/diagnose-vhv.js
// Run once: node .github/scripts/diagnose-vhv.js
// Dumps the raw API response for serie 652 so we can see the exact field names.
// Safe to run — writes diagnose-output.json, does NOT touch leaguesim-data.json.

const { chromium } = require("playwright-core");
const fs   = require("fs");
const path = require("path");

const BASE_URL = "https://www.handballbelgium.be/index.php/wp-json/bpleagues/v1/proxy";
const PAGE_URL = "https://www.handballbelgium.be/index.php/competition/vhv-competitions/?season_id=5&organization_id=2&serie_id=652";
const OUT      = path.join(process.cwd(), "diagnose-output.json");

async function extractNonce(page) {
  return page.evaluate(() => {
    if (window.bpleagues?.nonce) return window.bpleagues.nonce;
    if (window.wpApiSettings?.nonce) return window.wpApiSettings.nonce;
    for (const s of document.querySelectorAll("script:not([src])")) {
      const m  = s.textContent.match(/"nonce"\s*:\s*"([a-f0-9]{10,})"/);  if (m)  return m[1];
      const m2 = s.textContent.match(/nonce['":\s]+['"]([a-f0-9]{10,})['"]/); if (m2) return m2[1];
    }
    return null;
  });
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:151.0) Gecko/20100101 Firefox/151.0",
  });
  const page = await context.newPage();

  console.log("Loading page...");
  await page.goto(PAGE_URL, { waitUntil: "networkidle", timeout: 30000 });

  let nonce = await extractNonce(page);
  if (!nonce) {
    console.log("Nonce not in DOM — intercepting network...");
    let intercepted = null;
    page.on("request", req => { const h = req.headers(); if (h["x-wp-nonce"]) intercepted = h["x-wp-nonce"]; });
    await page.reload({ waitUntil: "networkidle", timeout: 30000 });
    nonce = intercepted;
  }
  console.log("Nonce:", nonce);

  const fetchJson = (url) => page.evaluate(async ({ url, nonce }) => {
    const r = await fetch(url, {
      headers: { Accept: "application/json", "X-WP-Nonce": nonce },
      credentials: "include",
    });
    if (!r.ok) throw new Error("HTTP " + r.status);
    return r.json();
  }, { url, nonce });

  const rankingUrl = `${BASE_URL}?serie_id=652&_path=ranking/byMyLeague`;
  const gamesUrl   = `${BASE_URL}?with_referees=true&no_forfeit=true&season_id=5&without_in_preparation=true&sort[0]=date&sort[1]=time&serie_id=652&_path=game/byMyLeague`;

  console.log("Fetching ranking...");
  const rankingRaw = await fetchJson(rankingUrl);

  console.log("Fetching games...");
  const gamesRaw = await fetchJson(gamesUrl);

  // ── ANALYSIS ────────────────────────────────────────────────────────────────
  console.log("\n=== RANKING RAW (top level) ===");
  console.log("Type:", Array.isArray(rankingRaw) ? "array" : typeof rankingRaw);
  if (!Array.isArray(rankingRaw)) {
    console.log("Top-level keys:", Object.keys(rankingRaw));
  }

  // Find the actual array of team entries
  const rankArr = Array.isArray(rankingRaw) ? rankingRaw
    : Object.values(rankingRaw).find(v => Array.isArray(v) && v.length > 0) || [];

  console.log("\n=== FIRST RANKING ENTRY (all fields) ===");
  if (rankArr.length > 0) {
    console.log(JSON.stringify(rankArr[0], null, 2));
    console.log("\nAll ranking keys:", Object.keys(rankArr[0]));
    // Spot-check a few entries for team name field
    console.log("\nTeam name candidates across first 3 entries:");
    rankArr.slice(0, 3).forEach((r, i) => {
      const candidates = {};
      for (const [k, v] of Object.entries(r)) {
        if (typeof v === "string" && v.length > 2 && v.length < 60) candidates[k] = v;
        if (typeof v === "object" && v !== null && !Array.isArray(v)) {
          for (const [k2, v2] of Object.entries(v)) {
            if (typeof v2 === "string" && v2.length > 2 && v2.length < 60) candidates[`${k}.${k2}`] = v2;
          }
        }
      }
      console.log(`  Entry ${i}:`, candidates);
    });
  }

  console.log("\n=== GAMES RAW (top level) ===");
  console.log("Type:", Array.isArray(gamesRaw) ? "array" : typeof gamesRaw);
  if (!Array.isArray(gamesRaw)) {
    console.log("Top-level keys:", Object.keys(gamesRaw));
  }

  const gamesArr = Array.isArray(gamesRaw) ? gamesRaw
    : Object.values(gamesRaw).find(v => Array.isArray(v) && v.length > 0) || [];

  console.log("\n=== FIRST GAME ENTRY (all fields) ===");
  if (gamesArr.length > 0) {
    console.log(JSON.stringify(gamesArr[0], null, 2));
    console.log("\nAll game keys:", Object.keys(gamesArr[0]));

    // Show played vs unplayed example
    const played  = gamesArr.find(g => {
      const sh = g.score_home ?? g.home_score ?? g.scoreHome ?? g.result?.home;
      return sh != null && sh !== "";
    });
    const unplayed = gamesArr.find(g => {
      const sh = g.score_home ?? g.home_score ?? g.scoreHome ?? g.result?.home;
      return sh == null || sh === "";
    });

    if (played) {
      console.log("\n=== PLAYED GAME EXAMPLE ===");
      console.log(JSON.stringify(played, null, 2));
    }
    if (unplayed) {
      console.log("\n=== UNPLAYED GAME EXAMPLE ===");
      console.log(JSON.stringify(unplayed, null, 2));
    }
  }

  // ── SCORESHEET PROBING ────────────────────────────────────────────────────
  console.log("\n=== PROBING SCORESHEET ENDPOINTS ===");
  const sampleGame = gamesArr[0];
  console.log(`Game id: ${sampleGame.id}, scoresheet_summary_id: ${sampleGame.scoresheet_summary_id}`);

  const scoresheetUrl = `${BASE_URL}?game_id=${sampleGame.id}&_path=game/scoresheet`;
  console.log(`\nProbing game/scoresheet for game ${sampleGame.id}...`);
  const scoresheetDetail = await page.evaluate(async ({ url, nonce }) => {
    const r = await fetch(url, {
      headers: { Accept: "application/json", "X-WP-Nonce": nonce },
      credentials: "include",
    });
    return { status: r.status, body: await r.json() };
  }, { url: scoresheetUrl, nonce });

  console.log("Status:", scoresheetDetail.status);
  console.log("Top-level keys:", Object.keys(scoresheetDetail.body));
  console.log("\n--- data ---");
  console.log(JSON.stringify(scoresheetDetail.body.data, null, 2).slice(0, 3000));
  console.log("\n--- structure ---");
  console.log(JSON.stringify(scoresheetDetail.body.structure, null, 2).slice(0, 3000));

  fs.writeFileSync(OUT, JSON.stringify({ rankingRaw, gamesRaw, scoresheet: scoresheetDetail.body }, null, 2));
  await browser.close();
  console.log(`\n✓ Full raw response written to diagnose-output.json`);
  console.log("  Share this file or the console output above so the field names can be mapped correctly.");
}

main().catch(err => { console.error(err); process.exit(1); });
