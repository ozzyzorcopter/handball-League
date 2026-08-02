// .github/scripts/diagnose-vhv.js
// Tests the Clubee HTML scraping approach against known URLs.
// Run via: Actions → Diagnose VHV API → Run workflow
// Output artifact: diagnose-output.json

const fs   = require("fs");
const path = require("path");
const OUT  = path.join(process.cwd(), "diagnose-output.json");

const FIXTURES_URL  = "https://www.clubee.com/handballbelgium/liga-heren-3-982067v4";
const STANDINGS_URL = "https://www.clubee.com/handballbelgium/standings-371073v4/leagues/18709/seasons/220";

async function fetchHtml(url) {
  const r = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36",
      "Accept": "text/html",
    },
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.text();
}

function parseStandings(html) {
  const rows = [];
  const trRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let tr;
  while ((tr = trRe.exec(html)) !== null) {
    const cells = [];
    const tdRe = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    let td;
    while ((td = tdRe.exec(tr[1])) !== null) {
      const text = td[1].replace(/<[^>]+>/g, " ").replace(/&amp;/g,"&").replace(/&nbsp;/g," ").replace(/&#39;/g,"'").replace(/\s+/g," ").trim();
      cells.push(text);
    }
    if (cells.length >= 9 && /^\d+\.?$/.test(cells[0])) {
      rows.push({
        pos:    parseInt(cells[0]),
        name:   cells[1].replace(/\(Senior [MFW]\)/g,"").trim(),
        played: parseInt(cells[2])||0,
        won:    parseInt(cells[3])||0,
        drawn:  parseInt(cells[4])||0,
        lost:   parseInt(cells[5])||0,
        gf:     parseInt(cells[6])||0,
        ga:     parseInt(cells[7])||0,
        points: parseInt(cells[9])||0,
      });
    }
  }
  return rows.sort((a,b) => a.pos - b.pos);
}

async function main() {
  console.log("=== DIAGNOSE VHV (Clubee) ===\n");

  console.log("Fetching standings:", STANDINGS_URL);
  const standingsHtml = await fetchHtml(STANDINGS_URL);
  const ranking = parseStandings(standingsHtml);
  console.log(`Parsed ${ranking.length} teams from standings:`);
  ranking.forEach(r => console.log(`  ${r.pos}. ${r.name} — ${r.played}P ${r.won}W ${r.drawn}D ${r.lost}L | ${r.gf}:${r.ga} | ${r.points}pts`));

  console.log("\nFetching fixtures:", FIXTURES_URL);
  const fixturesHtml = await fetchHtml(FIXTURES_URL);

  // Parse fixtures using same logic as fetch-vhv.js
  const teamNames = ranking.map(r => r.name);
  const fixtures = [];
  let fixtureCounter = 0;
  const lines = fixturesHtml.split("\n");
  let currentRound = 0;

  for (const line of lines) {
    const gdMatch = line.match(/###\s+(?:Gameday|Dag|Round|Ronde|Speeldag)\s+(\d+)/i);
    if (gdMatch) { currentRound = parseInt(gdMatch[1]); continue; }

    const lineGameRe = /\[(?:\*\*)?([^\]]+?)(?:\*\*)?\]\(https:\/\/www\.clubee\.com\/handballbelgium\/games\/(\d+)\)\[(?:\*\*)?([^\]]+?)(?:\*\*)?\]/g;
    let m;
    while ((m = lineGameRe.exec(line)) !== null) {
      const homeName = m[1].replace(/\(Senior [MFW]\)/g,"").replace(/\s+/g," ").trim();
      const gameId   = m[2];
      const awayName = m[3].replace(/\(Senior [MFW]\)/g,"").replace(/\s+/g," ").trim();
      if (!homeName || !awayName || homeName === awayName) continue;
      if (!teamNames.includes(homeName) && homeName !== "TBA") teamNames.push(homeName);
      if (!teamNames.includes(awayName) && awayName !== "TBA") teamNames.push(awayName);
      const homeIdx = teamNames.indexOf(homeName);
      const awayIdx = teamNames.indexOf(awayName);
      if (homeIdx < 0 || awayIdx < 0) continue;
      const dateMatch = line.match(/(\d{2})\.(\d{2})\.(\d{4})/);
      const date = dateMatch ? `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}` : null;
      fixtures.push({ id: `f${fixtureCounter++}`, gameId, homeIdx, awayIdx, week: currentRound, date, played: false, homeScore: null, awayScore: null });
    }
  }

  console.log(`\nParsed ${fixtures.length} fixtures across ${Math.max(...fixtures.map(f=>f.week),0)} gamedays`);
  if (fixtures.length > 0) {
    console.log("First 3 fixtures:");
    fixtures.slice(0,3).forEach(f => console.log(`  GD${f.week}: ${teamNames[f.homeIdx]} vs ${teamNames[f.awayIdx]} (${f.date})`));
  }

  const teams = teamNames.map(name => ({ id: `t_${name.replace(/\s+/g,"_").toLowerCase()}`, name, points: 0, homeBonus: "" }));
  console.log(`\nAll teams (${teams.length}):`, teams.map(t=>t.name).join(", "));

  fs.writeFileSync(OUT, JSON.stringify({ ranking, teams, fixtures, fixturesHtmlLength: fixturesHtml.length, standingsHtmlLength: standingsHtml.length }, null, 2));
  console.log(`\n✓ Written to diagnose-output.json`);
}

main().catch(err => { console.error(err); process.exit(1); });
