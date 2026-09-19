// Quick diagnostic: dump raw HTML from one standings and one games page
// Run: node debug-html.js
// It will write standings.html and games.html to the current directory

const { chromium } = require("playwright-core");
const fs = require("fs");

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
    locale: "nl-BE",
  });
  const page = await context.newPage();

  console.log("Warming up...");
  await page.goto("https://www.clubee.com/handballbelgium/", { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(2000);

  console.log("Fetching standings...");
  await page.goto("https://www.clubee.com/handballbelgium/standings-371073v4/leagues/18707/seasons/0", { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(2000);
  const standingsHtml = await page.content();
  fs.writeFileSync("standings.html", standingsHtml);
  console.log(`standings.html: ${standingsHtml.length} bytes`);
  // Print first tr tag and surrounding context
  const trIdx = standingsHtml.indexOf("<tr");
  if (trIdx >= 0) {
    console.log("\n--- First <tr> context (500 chars) ---");
    console.log(standingsHtml.slice(Math.max(0, trIdx - 100), trIdx + 500));
  } else {
    console.log("No <tr> found in standings HTML!");
    // Print first 1000 chars to see what we got
    console.log("\n--- First 1000 chars ---");
    console.log(standingsHtml.slice(0, 1000));
  }

  console.log("\nFetching games...");
  await page.goto("https://www.clubee.com/handballbelgium/games-371075v4/leagues/18707/seasons/0", { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(2000);
  const gamesHtml = await page.content();
  fs.writeFileSync("games.html", gamesHtml);
  console.log(`games.html: ${gamesHtml.length} bytes`);
  const trIdx2 = gamesHtml.indexOf("<tr");
  if (trIdx2 >= 0) {
    console.log("\n--- First <tr> context (500 chars) ---");
    console.log(gamesHtml.slice(Math.max(0, trIdx2 - 100), trIdx2 + 500));
  } else {
    console.log("No <tr> found in games HTML!");
    console.log("\n--- First 1000 chars ---");
    console.log(gamesHtml.slice(0, 1000));
  }

  await browser.close();
}

main().catch(e => { console.error(e); process.exit(1); });
