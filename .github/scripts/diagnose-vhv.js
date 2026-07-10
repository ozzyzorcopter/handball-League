// .github/scripts/diagnose-vhv.js
// Detects current season_id, probes all serie IDs 640-900 for active data,
// then dumps full ranking+games for the first active serie found.
// Run via: Actions → Diagnose VHV API → Run workflow

const { chromium } = require("playwright-core");
const fs   = require("fs");
const path = require("path");

const BASE_URL = "https://www.handballbelgium.be/index.php/wp-json/bpleagues/v1/proxy";
const PAGE_URL = "https://www.handballbelgium.be/index.php/competition/vhv-competitions/";
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
  await page.goto(PAGE_URL, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(3000);

  let nonce = await extractNonce(page);
  if (!nonce) {
    console.log("Nonce not in DOM — intercepting network...");
    let intercepted = null;
    page.on("request", req => { const h = req.headers(); if (h["x-wp-nonce"]) intercepted = h["x-wp-nonce"]; });
    await page.reload({ waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(3000);
    nonce = intercepted;
  }
  console.log("Nonce:", nonce);

  // Detect season_id
  const seasonId = await page.evaluate(() => {
    const sel = document.querySelector('select[name="season_id"], select#season_id');
    if (sel?.value) return Number(sel.value);
    if (window.bpleagues?.season_id) return Number(window.bpleagues.season_id);
    const m = window.location.search.match(/season_id=(\d+)/);
    if (m) return Number(m[1]);
    for (const s of document.querySelectorAll("script:not([src])")) {
      const m2 = s.textContent.match(/"season_id"\s*:\s*(\d+)/);
      if (m2) return Number(m2[1]);
    }
    return null;
  });
  console.log("Detected season_id:", seasonId ?? "(not detected)");

  const fetchSafe = async (url) => page.evaluate(async ({ url, nonce }) => {
    try {
      const r = await fetch(url, { headers: { Accept: "application/json", "X-WP-Nonce": nonce }, credentials: "include" });
      const body = await r.json().catch(() => null);
      return { status: r.status, body };
    } catch (e) { return { status: 0, body: null, error: e.message }; }
  }, { url, nonce });

  // ── PROBE SERIES 640-900 ──────────────────────────────────────────────────
  console.log("\n=== PROBING ACTIVE SERIES (IDs 640-900) ===");
  const activeSeries = [];
  const allProbeIds = Array.from({ length: 261 }, (_, i) => i + 640);

  for (let i = 0; i < allProbeIds.length; i += 15) {
    const batch = allProbeIds.slice(i, i + 15);
    const batchResults = await Promise.all(batch.map(async id => {
      const url = `${BASE_URL}?serie_id=${id}&_path=ranking/byMyLeague`;
      const r = await fetchSafe(url);
      const count = r.body?.elements?.length ?? r.body?.total ?? 0;
      return { id, status: r.status, count };
    }));
    for (const r of batchResults) {
      if (r.status === 200 && r.count > 0) {
        console.log(`  ✓ serie_id=${r.id} → ${r.count} teams`);
        activeSeries.push(r.id);
      }
    }
  }

  console.log("\nAll active series:", activeSeries.length > 0 ? activeSeries.join(", ") : "NONE FOUND");

  if (activeSeries.length === 0) {
    console.log("\nNo active series found — new season data may not be available yet.");
    fs.writeFileSync(OUT, JSON.stringify({ seasonId, activeSeries: [], note: "No data found for any serie 640-900" }, null, 2));
    await browser.close();
    return;
  }

  // ── FULL DUMP OF FIRST ACTIVE SERIE ──────────────────────────────────────
  const targetSerie = activeSeries[0];
  console.log(`\n=== FULL DATA FOR SERIE ${targetSerie} ===`);

  const rankingUrl = `${BASE_URL}?serie_id=${targetSerie}&_path=ranking/byMyLeague`;
  const gamesUrl   = seasonId
    ? `${BASE_URL}?with_referees=true&no_forfeit=true&season_id=${seasonId}&without_in_preparation=true&sort[0]=date&sort[1]=time&serie_id=${targetSerie}&_path=game/byMyLeague`
    : `${BASE_URL}?with_referees=true&no_forfeit=true&without_in_preparation=true&sort[0]=date&sort[1]=time&serie_id=${targetSerie}&_path=game/byMyLeague`;

  const rankingRaw = (await fetchSafe(rankingUrl)).body;
  const gamesRaw   = (await fetchSafe(gamesUrl)).body;

  const rankArr  = rankingRaw?.elements || [];
  const gamesArr = gamesRaw?.elements  || [];

  console.log(`Teams: ${rankArr.length}, Games: ${gamesArr.length}`);
  if (rankArr[0]) {
    console.log("Serie name:", gamesArr[0]?.serie_name ?? rankArr[0]?.serie_name ?? "?");
    console.log("First team:", rankArr[0].team_short_name ?? rankArr[0].team_name);
    console.log("Season ID in data:", gamesArr[0]?.season_id ?? "?");
  }

  fs.writeFileSync(OUT, JSON.stringify({ seasonId, activeSeries, targetSerie, rankingRaw, gamesRaw }, null, 2));
  await browser.close();
  console.log(`\n✓ Written to diagnose-output.json`);
}

main().catch(err => { console.error(err); process.exit(1); });
