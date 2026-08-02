// .github/scripts/fetch-vhv.js
// Fetches Belgian handball data from Clubee (clubee.com/handballbelgium)
// by scraping SSR HTML pages — no Playwright, no auth needed.
// Writes vhv-data.json grouped by federation.
//
// HOW TO FIND LEAGUE URLS:
// 1. Go to clubee.com/handballbelgium
// 2. Navigate to a competition (e.g. Liga Heren 3)
// 3. The URL is the fixturesUrl below (e.g. .../liga-heren-3-982067v4)
// 4. The standings URL follows pattern: .../standings-371073v4/leagues/LEAGUE_ID/seasons/SEASON_ID
//    where LEAGUE_ID and SEASON_ID appear in the nav links on the fixtures page

const fs   = require("fs");
const path = require("path");

const root        = process.cwd();
const vhvDataPath = path.join(root, "vhv-data.json");

// ── LEAGUE CONFIG ─────────────────────────────────────────────────────────────
// For each league, provide:
//   fixturesUrl:  the main competition page (shows all gamedays + team names)
//   standingsUrl: the standings page (shows table with W/D/L/GF/GA/Pts)
//   name:         display name (auto-detected from page if left empty "")
//   federation:   "VHV" | "URBH-KBHB" | "LFH"
//
// Liga Heren 3 confirmed. Add other leagues as you find their URLs on Clubee.
const LEAGUES = [
  {
    id: "19333",
    name: "Supercup Men",
    federation: "URBH-KBHB",
    division: "National",
    fixturesUrl:  "https://www.clubee.com/handballbelgium/supercup-men-983440v4/leagues/19333/seasons/220",
    standingsUrl: "https://www.clubee.com/handballbelgium/supercup-men-983440v4/leagues/19333/seasons/220",
  },
  {
    id: "19334",
    name: "Supercup Women",
    federation: "URBH-KBHB",
    division: "National",
    fixturesUrl:  "https://www.clubee.com/handballbelgium/supercup-women-983441v4/leagues/19334/seasons/220",
    standingsUrl: "https://www.clubee.com/handballbelgium/supercup-women-983441v4/leagues/19334/seasons/220",
  },
  {
    id: "18700",
    name: "Lotto Cup Men",
    federation: "URBH-KBHB",
    division: "National",
    fixturesUrl:  "https://www.clubee.com/handballbelgium/lotto-cup-heren-982091v4/leagues/18700/seasons/220",
    standingsUrl: "https://www.clubee.com/handballbelgium/lotto-cup-heren-982091v4/leagues/18700/seasons/220",
  },
  {
    id: "18701",
    name: "Lotto Cup Women",
    federation: "URBH-KBHB",
    division: "National",
    fixturesUrl:  "https://www.clubee.com/handballbelgium/lotto-cup-women-982092v4/leagues/18701/seasons/220",
    standingsUrl: "https://www.clubee.com/handballbelgium/lotto-cup-women-982092v4/leagues/18701/seasons/220",
  },
  {
    id: "18702",
    name: "First Division Men",
    federation: "URBH-KBHB",
    division: "National",
    fixturesUrl:  "https://www.clubee.com/handballbelgium/first-division-m--982001v4/leagues/18702/seasons/220",
    standingsUrl: "https://www.clubee.com/handballbelgium/first-division-m--982001v4/leagues/18702/seasons/220",
  },
  {
    id: "18703",
    name: "Second Division Men",
    federation: "URBH-KBHB",
    division: "National",
    fixturesUrl:  "https://www.clubee.com/handballbelgium/second-division-m--982003v4/leagues/18703/seasons/220",
    standingsUrl: "https://www.clubee.com/handballbelgium/second-division-m--982003v4/leagues/18703/seasons/220",
  },
  {
    id: "18704",
    name: "First Division Women",
    federation: "URBH-KBHB",
    division: "National",
    fixturesUrl:  "https://www.clubee.com/handballbelgium/first-division-f--982002v4/leagues/18704/seasons/220",
    standingsUrl: "https://www.clubee.com/handballbelgium/first-division-f--982002v4/leagues/18704/seasons/220",
  },
  {
    id: "18705",
    name: "Division 1 Women Reserves",
    federation: "URBH-KBHB",
    division: "National",
    fixturesUrl:  "https://www.clubee.com/handballbelgium/division-1-w-res-982093v4/leagues/18705/seasons/220",
    standingsUrl: "https://www.clubee.com/handballbelgium/division-1-w-res-982093v4/leagues/18705/seasons/220",
  },
  {
    id: "18706",
    name: "Second Division Women",
    federation: "URBH-KBHB",
    division: "National",
    fixturesUrl:  "https://www.clubee.com/handballbelgium/second-division-f--982004v4/leagues/18706/seasons/220",
    standingsUrl: "https://www.clubee.com/handballbelgium/second-division-f--982004v4/leagues/18706/seasons/220",
  },
  {
    id: "18743",
    name: "Friendly Games",
    federation: "URBH-KBHB",
    division: "National",
    fixturesUrl:  "https://www.clubee.com/handballbelgium/friendly-games-982096v4/leagues/18743/seasons/220",
    standingsUrl: "https://www.clubee.com/handballbelgium/friendly-games-982096v4/leagues/18743/seasons/220",
  },
  {
    id: "18692",
    name: "D1 LFH Men",
    federation: "LFH",
    division: "Seniors",
    fixturesUrl:  "https://www.clubee.com/handballbelgium/d1-lfh--men-981986v4/leagues/18692/seasons/220",
    standingsUrl: "https://www.clubee.com/handballbelgium/d1-lfh--men-981986v4/leagues/18692/seasons/220",
  },
  {
    id: "18693",
    name: "D1 LFH Women",
    federation: "LFH",
    division: "Seniors",
    fixturesUrl:  "https://www.clubee.com/handballbelgium/d1-lfh--women-981987v4/leagues/18693/seasons/220",
    standingsUrl: "https://www.clubee.com/handballbelgium/d1-lfh--women-981987v4/leagues/18693/seasons/220",
  },
  {
    id: "18698",
    name: "Promo Liège Men",
    federation: "LFH",
    division: "Seniors",
    fixturesUrl:  "https://www.clubee.com/handballbelgium/promo-liege--men-981988v4/leagues/18698/seasons/220",
    standingsUrl: "https://www.clubee.com/handballbelgium/promo-liege--men-981988v4/leagues/18698/seasons/220",
  },
  {
    id: null,
    name: "Promo Brabant Men",
    federation: "LFH",
    division: "Seniors",
    fixturesUrl:  "https://www.clubee.com/handballbelgium/promo-brabant--men-981989v4",
    standingsUrl: "https://www.clubee.com/handballbelgium/promo-brabant--men-981989v4",
  },
  {
    id: "18694",
    name: "U18 Men",
    federation: "LFH",
    division: "Jeunes",
    fixturesUrl:  "https://www.clubee.com/handballbelgium/u18--men-981990v4/leagues/18694/seasons/220",
    standingsUrl: "https://www.clubee.com/handballbelgium/u18--men-981990v4/leagues/18694/seasons/220",
  },
  {
    id: "18695",
    name: "U18 Women",
    federation: "LFH",
    division: "Jeunes",
    fixturesUrl:  "https://www.clubee.com/handballbelgium/u18--women-981991v4/leagues/18695/seasons/220",
    standingsUrl: "https://www.clubee.com/handballbelgium/u18--women-981991v4/leagues/18695/seasons/220",
  },
  {
    id: "18739",
    name: "U16 Men",
    federation: "LFH",
    division: "Jeunes",
    fixturesUrl:  "https://www.clubee.com/handballbelgium/u16--men-981997v4/leagues/18739/seasons/220",
    standingsUrl: "https://www.clubee.com/handballbelgium/u16--men-981997v4/leagues/18739/seasons/220",
  },
  {
    id: "18696",
    name: "U16 Liège Women",
    federation: "LFH",
    division: "Jeunes",
    fixturesUrl:  "https://www.clubee.com/handballbelgium/u16-liege--women-981992v4/leagues/18696/seasons/220",
    standingsUrl: "https://www.clubee.com/handballbelgium/u16-liege--women-981992v4/leagues/18696/seasons/220",
  },
  {
    id: "18744",
    name: "U16 Brabant",
    federation: "LFH",
    division: "Jeunes",
    fixturesUrl:  "https://www.clubee.com/handballbelgium/u16--brabant-981993v4/leagues/18744/seasons/220",
    standingsUrl: "https://www.clubee.com/handballbelgium/u16--brabant-981993v4/leagues/18744/seasons/220",
  },
  {
    id: "18740",
    name: "U14 Men",
    federation: "LFH",
    division: "Jeunes",
    fixturesUrl:  "https://www.clubee.com/handballbelgium/u14--men-981996v4/leagues/18740/seasons/220",
    standingsUrl: "https://www.clubee.com/handballbelgium/u14--men-981996v4/leagues/18740/seasons/220",
  },
  {
    id: "18697",
    name: "U14 Women",
    federation: "LFH",
    division: "Jeunes",
    fixturesUrl:  "https://www.clubee.com/handballbelgium/u14--women-981994v4/leagues/18697/seasons/220",
    standingsUrl: "https://www.clubee.com/handballbelgium/u14--women-981994v4/leagues/18697/seasons/220",
  },
  {
    id: "18745",
    name: "U14 Brabant",
    federation: "LFH",
    division: "Jeunes",
    fixturesUrl:  "https://www.clubee.com/handballbelgium/u14--brabant-981995v4/leagues/18745/seasons/220",
    standingsUrl: "https://www.clubee.com/handballbelgium/u14--brabant-981995v4/leagues/18745/seasons/220",
  },
  {
    id: "18746",
    name: "U12 Brabant",
    federation: "LFH",
    division: "Jeunes",
    fixturesUrl:  "https://www.clubee.com/handballbelgium/u12--brabant-981998v4/leagues/18746/seasons/220",
    standingsUrl: "https://www.clubee.com/handballbelgium/u12--brabant-981998v4/leagues/18746/seasons/220",
  },
  {
    id: "18741",
    name: "U12 Liège",
    federation: "LFH",
    division: "Jeunes",
    fixturesUrl:  "https://www.clubee.com/handballbelgium/u12--liege-981999v4/leagues/18741/seasons/220",
    standingsUrl: "https://www.clubee.com/handballbelgium/u12--liege-981999v4/leagues/18741/seasons/220",
  },
  {
    id: "18742",
    name: "U10 Liège",
    federation: "LFH",
    division: "Jeunes",
    fixturesUrl:  "https://www.clubee.com/handballbelgium/u10--liege-982000v4/leagues/18742/seasons/220",
    standingsUrl: "https://www.clubee.com/handballbelgium/u10--liege-982000v4/leagues/18742/seasons/220",
  },
  {
    id: "18707",
    name: "Liga Heren 1",
    federation: "VHV",
    division: "Senioren",
    fixturesUrl:  "https://www.clubee.com/handballbelgium/liga-heren-1-982065v4/leagues/18707/seasons/220",
    standingsUrl: "https://www.clubee.com/handballbelgium/liga-heren-1-982065v4/leagues/18707/seasons/220",
  },
  {
    id: "18708",
    name: "Liga Heren 2",
    federation: "VHV",
    division: "Senioren",
    fixturesUrl:  "https://www.clubee.com/handballbelgium/liga-heren-2-982066v4/leagues/18708/seasons/220",
    standingsUrl: "https://www.clubee.com/handballbelgium/liga-heren-2-982066v4/leagues/18708/seasons/220",
  },
  {
    id: "18709",
    name: "Liga Heren 3",
    federation: "VHV",
    division: "Senioren",
    fixturesUrl:  "https://www.clubee.com/handballbelgium/liga-heren-3-982067v4/leagues/18709/seasons/220",
    standingsUrl: "https://www.clubee.com/handballbelgium/liga-heren-3-982067v4/leagues/18709/seasons/220",
  },
  {
    id: "18710",
    name: "Liga Dames",
    federation: "VHV",
    division: "Senioren",
    fixturesUrl:  "https://www.clubee.com/handballbelgium/liga-dames-982068v4/leagues/18710/seasons/220",
    standingsUrl: "https://www.clubee.com/handballbelgium/liga-dames-982068v4/leagues/18710/seasons/220",
  },
  {
    id: "18711",
    name: "Heren Regio AVB",
    federation: "VHV",
    division: "Senioren",
    fixturesUrl:  "https://www.clubee.com/handballbelgium/heren-regio-avb-982097v4/leagues/18711/seasons/220",
    standingsUrl: "https://www.clubee.com/handballbelgium/heren-regio-avb-982097v4/leagues/18711/seasons/220",
  },
  {
    id: "18712",
    name: "Heren Regio Limburg",
    federation: "VHV",
    division: "Senioren",
    fixturesUrl:  "https://www.clubee.com/handballbelgium/heren-regio-limburg-982098v4/leagues/18712/seasons/220",
    standingsUrl: "https://www.clubee.com/handballbelgium/heren-regio-limburg-982098v4/leagues/18712/seasons/220",
  },
  {
    id: "18713",
    name: "Heren Regio OWv",
    federation: "VHV",
    division: "Senioren",
    fixturesUrl:  "https://www.clubee.com/handballbelgium/heren-regio-owv-982099v4/leagues/18713/seasons/220",
    standingsUrl: "https://www.clubee.com/handballbelgium/heren-regio-owv-982099v4/leagues/18713/seasons/220",
  },
  {
    id: "18714",
    name: "Dames Regio AVB",
    federation: "VHV",
    division: "Senioren",
    fixturesUrl:  "https://www.clubee.com/handballbelgium/dames-regio-avb-982101v4/leagues/18714/seasons/220",
    standingsUrl: "https://www.clubee.com/handballbelgium/dames-regio-avb-982101v4/leagues/18714/seasons/220",
  },
  {
    id: "18715",
    name: "Dames Regio Limburg",
    federation: "VHV",
    division: "Senioren",
    fixturesUrl:  "https://www.clubee.com/handballbelgium/dames-regio-limburg-982102v4/leagues/18715/seasons/220",
    standingsUrl: "https://www.clubee.com/handballbelgium/dames-regio-limburg-982102v4/leagues/18715/seasons/220",
  },
  {
    id: "18716",
    name: "Dames Regio OWv",
    federation: "VHV",
    division: "Senioren",
    fixturesUrl:  "https://www.clubee.com/handballbelgium/dames-regio-owv-982103v4/leagues/18716/seasons/220",
    standingsUrl: "https://www.clubee.com/handballbelgium/dames-regio-owv-982103v4/leagues/18716/seasons/220",
  },
  {
    id: "18718",
    name: "U18 Jongens",
    federation: "VHV",
    division: "Jeugd",
    fixturesUrl:  "https://www.clubee.com/handballbelgium/u18-m--982069v4/leagues/18718/seasons/220",
    standingsUrl: "https://www.clubee.com/handballbelgium/u18-m--982069v4/leagues/18718/seasons/220",
  },
  {
    id: "18738",
    name: "U18 Meisjes",
    federation: "VHV",
    division: "Jeugd",
    fixturesUrl:  "https://www.clubee.com/handballbelgium/u18-m--982070v4/leagues/18738/seasons/220",
    standingsUrl: "https://www.clubee.com/handballbelgium/u18-m--982070v4/leagues/18738/seasons/220",
  },
  {
    id: "18717",
    name: "VHV Q-Tornooien J18",
    federation: "VHV",
    division: "Jeugd",
    fixturesUrl:  "https://www.clubee.com/handballbelgium/vhv-q-tornooien-j18-982085v4/leagues/18717/seasons/220",
    standingsUrl: "https://www.clubee.com/handballbelgium/vhv-q-tornooien-j18-982085v4/leagues/18717/seasons/220",
  },
  {
    id: "18720",
    name: "U16 Jongens",
    federation: "VHV",
    division: "Jeugd",
    fixturesUrl:  "https://www.clubee.com/handballbelgium/u16-j--982071v4/leagues/18720/seasons/220",
    standingsUrl: "https://www.clubee.com/handballbelgium/u16-j--982071v4/leagues/18720/seasons/220",
  },
  {
    id: "18723",
    name: "U16 Meisjes",
    federation: "VHV",
    division: "Jeugd",
    fixturesUrl:  "https://www.clubee.com/handballbelgium/u16-m--982072v4/leagues/18723/seasons/220",
    standingsUrl: "https://www.clubee.com/handballbelgium/u16-m--982072v4/leagues/18723/seasons/220",
  },
  {
    id: "18719",
    name: "VHV Q-Tornooien JM16",
    federation: "VHV",
    division: "Jeugd",
    fixturesUrl:  "https://www.clubee.com/handballbelgium/vhv-q-tornooien-jm16-26-27-982087v4/leagues/18719/seasons/220",
    standingsUrl: "https://www.clubee.com/handballbelgium/vhv-q-tornooien-jm16-26-27-982087v4/leagues/18719/seasons/220",
  },
  {
    id: "18722",
    name: "VHV Q-Tornooien M16",
    federation: "VHV",
    division: "Jeugd",
    fixturesUrl:  "https://www.clubee.com/handballbelgium/vhv-q-tornooien-m16-982089v4/leagues/18722/seasons/220",
    standingsUrl: "https://www.clubee.com/handballbelgium/vhv-q-tornooien-m16-982089v4/leagues/18722/seasons/220",
  },
  {
    id: "18721",
    name: "Beker Regio JM16",
    federation: "VHV",
    division: "Jeugd",
    fixturesUrl:  "https://www.clubee.com/handballbelgium/beker-regio-jm16-26-27-982106v4/leagues/18721/seasons/220",
    standingsUrl: "https://www.clubee.com/handballbelgium/beker-regio-jm16-26-27-982106v4/leagues/18721/seasons/220",
  },
  {
    id: "18724",
    name: "Beker Regio M16",
    federation: "VHV",
    division: "Jeugd",
    fixturesUrl:  "https://www.clubee.com/handballbelgium/beker-regio-m16-982107v4/leagues/18724/seasons/220",
    standingsUrl: "https://www.clubee.com/handballbelgium/beker-regio-m16-982107v4/leagues/18724/seasons/220",
  },
  {
    id: "18726",
    name: "U14 Jongens",
    federation: "VHV",
    division: "Jeugd",
    fixturesUrl:  "https://www.clubee.com/handballbelgium/u14-j--982073v4/leagues/18726/seasons/220",
    standingsUrl: "https://www.clubee.com/handballbelgium/u14-j--982073v4/leagues/18726/seasons/220",
  },
  {
    id: "18729",
    name: "U14 Meisjes",
    federation: "VHV",
    division: "Jeugd",
    fixturesUrl:  "https://www.clubee.com/handballbelgium/u14-m--982074v4/leagues/18729/seasons/220",
    standingsUrl: "https://www.clubee.com/handballbelgium/u14-m--982074v4/leagues/18729/seasons/220",
  },
  {
    id: "18725",
    name: "VHV Q-Tornooien JM14",
    federation: "VHV",
    division: "Jeugd",
    fixturesUrl:  "https://www.clubee.com/handballbelgium/vhv-q-tornooien-jm14-26-27-982088v4/leagues/18725/seasons/220",
    standingsUrl: "https://www.clubee.com/handballbelgium/vhv-q-tornooien-jm14-26-27-982088v4/leagues/18725/seasons/220",
  },
  {
    id: "18728",
    name: "VHV Q-Tornooien M14",
    federation: "VHV",
    division: "Jeugd",
    fixturesUrl:  "https://www.clubee.com/handballbelgium/vhv-q-tornooien-m14-982090v4/leagues/18728/seasons/220",
    standingsUrl: "https://www.clubee.com/handballbelgium/vhv-q-tornooien-m14-982090v4/leagues/18728/seasons/220",
  },
  {
    id: "18727",
    name: "Beker Regio JM14",
    federation: "VHV",
    division: "Jeugd",
    fixturesUrl:  "https://www.clubee.com/handballbelgium/beker-regio-jm14-982108v4/leagues/18727/seasons/220",
    standingsUrl: "https://www.clubee.com/handballbelgium/beker-regio-jm14-982108v4/leagues/18727/seasons/220",
  },
  {
    id: "18730",
    name: "Beker M14",
    federation: "VHV",
    division: "Jeugd",
    fixturesUrl:  "https://www.clubee.com/handballbelgium/beker-m14-982109v4/leagues/18730/seasons/220",
    standingsUrl: "https://www.clubee.com/handballbelgium/beker-m14-982109v4/leagues/18730/seasons/220",
  },
  {
    id: "18731",
    name: "U12 Jongens",
    federation: "VHV",
    division: "Jeugd",
    fixturesUrl:  "https://www.clubee.com/handballbelgium/u12-j--982075v4/leagues/18731/seasons/220",
    standingsUrl: "https://www.clubee.com/handballbelgium/u12-j--982075v4/leagues/18731/seasons/220",
  },
  {
    id: "18733",
    name: "U12 Meisjes",
    federation: "VHV",
    division: "Jeugd",
    fixturesUrl:  "https://www.clubee.com/handballbelgium/u12-m--982076v4/leagues/18733/seasons/220",
    standingsUrl: "https://www.clubee.com/handballbelgium/u12-m--982076v4/leagues/18733/seasons/220",
  },
  {
    id: "18732",
    name: "Beker Regio JM12",
    federation: "VHV",
    division: "Jeugd",
    fixturesUrl:  "https://www.clubee.com/handballbelgium/beker-regio-jm12-982110v4/leagues/18732/seasons/220",
    standingsUrl: "https://www.clubee.com/handballbelgium/beker-regio-jm12-982110v4/leagues/18732/seasons/220",
  },
  {
    id: "18734",
    name: "Beker Regio M12",
    federation: "VHV",
    division: "Jeugd",
    fixturesUrl:  "https://www.clubee.com/handballbelgium/beker-regio-m12-982111v4/leagues/18734/seasons/220",
    standingsUrl: "https://www.clubee.com/handballbelgium/beker-regio-m12-982111v4/leagues/18734/seasons/220",
  },
];


// ── UTILS ─────────────────────────────────────────────────────────────────────
function log(msg)  { console.log(`[fetch-vhv] ${msg}`); }
function warn(msg) { console.warn(`[fetch-vhv] ⚠ ${msg}`); }

async function fetchHtml(url) {
  const r = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml",
    },
  });
  if (!r.ok) throw new Error(`HTTP ${r.status} for ${url}`);
  return r.text();
}

// ── PARSE STANDINGS ───────────────────────────────────────────────────────────
// Parse the HTML table from the standings page.
// Returns [{ pos, name, played, won, drawn, lost, gf, ga, points }]
function parseStandings(html) {
  const rows = [];
  // Match <tr> rows inside the table
  const trRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let tr;
  while ((tr = trRe.exec(html)) !== null) {
    const cells = [];
    const tdRe = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    let td;
    while ((td = tdRe.exec(tr[1])) !== null) {
      // Strip all HTML tags and decode common entities
      const text = td[1]
        .replace(/<[^>]+>/g, " ")
        .replace(/&amp;/g, "&").replace(/&nbsp;/g, " ")
        .replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
        .replace(/\s+/g, " ").trim();
      cells.push(text);
    }
    // Valid row: first cell is a position number, has at least 9 cells
    if (cells.length >= 9 && /^\d+\.?$/.test(cells[0])) {
      const pos    = parseInt(cells[0]);
      // Cell 1 is the team name (may include image alt text — take last word group)
      const rawName = cells[1].replace(/\(Senior [MFW]\)/g, "").trim();
      const name   = rawName || `Team ${pos}`;
      const played = parseInt(cells[2]) || 0;
      const won    = parseInt(cells[3]) || 0;
      const drawn  = parseInt(cells[4]) || 0;
      const lost   = parseInt(cells[5]) || 0;
      const gf     = parseInt(cells[6]) || 0;
      const ga     = parseInt(cells[7]) || 0;
      const points = parseInt(cells[9]) || 0; // cell 8 is GD
      rows.push({ pos, name, played, won, drawn, lost, gf, ga, points });
    }
  }
  return rows.sort((a, b) => a.pos - b.pos);
}

// ── PARSE FIXTURES ────────────────────────────────────────────────────────────
// Parse gameday fixtures from the fixtures page HTML.
// Returns { leagueName, teams, fixtures }
function parseFixtures(html, existingStandings) {
  // Extract league/season title from <h1> or <title>
  const h1Match = html.match(/<h1[^>]*>\s*(.*?)\s*<\/h1>/i);
  const leagueName = h1Match
    ? h1Match[1].replace(/<[^>]+>/g, "").replace(/\(Senior [MFW]\)/g, "").trim()
    : "";

  // Build team set from standings (most reliable source for clean names)
  const teamNames = existingStandings.length > 0
    ? existingStandings.map(r => r.name)
    : [];

  // Extract all game links: each game is a <a href=".../games/GAMEID">
  // The page shows: [Home Team][Date/Time][Away Team]
  // Pattern from the fetched page:
  // [**Home Team**](.../games/ID)[**Away Team**]
  const fixtures = [];
  let round = 0;
  let fixtureCounter = 0;

  // Find gameday markers and game entries
  // Gameday headers: "### Gameday N" or "### Dag N"
  const gamedayRe = /###\s+(?:Gameday|Dag|Round|Ronde|Speeldag)\s+(\d+)/gi;
  const gameRe = /\[(?:\*\*)?([^\]]+?)(?:\*\*)?\]\(https:\/\/www\.clubee\.com\/handballbelgium\/games\/(\d+)\)\[(?:\*\*)?([^\]]+?)(?:\*\*)?\]/g;

  // Split by gameday
  const gamedaySections = html.split(/###\s+(?:Gameday|Dag|Round|Ronde|Speeldag)\s+\d+/i);
  let gamedayNum = 0;

  // Process each section
  const fullText = html;
  let lastIdx = 0;

  // Reset and use a line-by-line approach on the markdown-like content
  const lines = html.split("\n");
  let currentRound = 0;

  for (const line of lines) {
    // Check for gameday header
    const gdMatch = line.match(/###\s+(?:Gameday|Dag|Round|Ronde|Speeldag)\s+(\d+)/i);
    if (gdMatch) { currentRound = parseInt(gdMatch[1]); continue; }

    // Check for game link pairs on the same line
    // Format: [**Home**](url/games/ID)[**Away**]
    // Or: [Home](url)[Score][Away]
    // The markdown rendered version shows: [**Team**](link)[**Team**]
    const lineGameRe = /\[(?:\*\*)?([^\]]+?)(?:\*\*)?\]\(https:\/\/www\.clubee\.com\/handballbelgium\/games\/(\d+)\)\[(?:\*\*)?([^\]]+?)(?:\*\*)?\]/g;
    let m;
    while ((m = lineGameRe.exec(line)) !== null) {
      const homeName = m[1].replace(/\(Senior [MFW]\)/g, "").replace(/\s+/g, " ").trim();
      const gameId   = m[2];
      const awayName = m[3].replace(/\(Senior [MFW]\)/g, "").replace(/\s+/g, " ").trim();

      if (!homeName || !awayName || homeName === awayName) continue;

      // Extract date from line (format: DD.MM.YYYY or similar)
      const dateMatch = line.match(/(\d{2})\.(\d{2})\.(\d{4})/);
      const date = dateMatch ? `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}` : null;

      // Add teams if not seen
      if (!teamNames.includes(homeName) && homeName !== "TBA") teamNames.push(homeName);
      if (!teamNames.includes(awayName) && awayName !== "TBA") teamNames.push(awayName);

      const homeIdx = teamNames.indexOf(homeName);
      const awayIdx = teamNames.indexOf(awayName);

      if (homeIdx < 0 || awayIdx < 0) continue;

      fixtures.push({
        id:        `f${fixtureCounter++}`,
        gameId,
        homeIdx,
        awayIdx,
        homeWin:   50, draw: 6, awayWin: 44,
        overrideOn: false, ovHW: "", ovD: "", ovAW: "",
        played:    false,
        homeScore: null,
        awayScore: null,
        week:      currentRound,
        date,
      });
    }
  }

  // Build team objects
  const teams = teamNames.map((name, i) => ({
    id:        `t_${name.replace(/\s+/g, "_").toLowerCase()}`,
    name,
    points:    0,
    homeBonus: "",
  }));

  return { leagueName, teams, fixtures };
}

// ── MAIN ──────────────────────────────────────────────────────────────────────
async function main() {
  log(`Starting at ${new Date().toUTCString()}`);
  log(`${LEAGUES.length} league(s) configured`);

  // Start fresh each run — no stale data kept
  const fresh = { updatedAt: null, federations: {} };
  const results = [];

  for (const cfg of LEAGUES) {
    log(`\n${cfg.federation} · ${cfg.name} (league ${cfg.id})`);
    try {
      // Fetch both pages in parallel
      log(`  Fetching fixtures + standings…`);
      const [fixturesHtml, standingsHtml] = await Promise.all([
        fetchHtml(cfg.fixturesUrl),
        fetchHtml(cfg.standingsUrl),
      ]);

      // Parse standings first (gives us clean team names)
      const ranking = parseStandings(standingsHtml);
      log(`  Standings: ${ranking.length} teams`);
      if (ranking.length > 0) {
        log(`  Teams: ${ranking.map(r => r.name).join(", ")}`);
      }

      // Parse fixtures (uses standings team names for matching)
      const { leagueName, teams, fixtures } = parseFixtures(fixturesHtml, ranking);
      const serieName = cfg.name || leagueName || `League ${cfg.id}`;

      const played  = fixtures.filter(f => f.played).length;
      const pending = fixtures.filter(f => !f.played).length;
      log(`  Fixtures: ${fixtures.length} (${played} played, ${pending} pending)`);
      log(`  Name: "${serieName}"`);

      if (teams.length === 0 && fixtures.length === 0) {
        throw new Error("No teams or fixtures parsed — check URL or page structure");
      }

      if (!fresh.federations[cfg.federation]) fresh.federations[cfg.federation] = {};
      fresh.federations[cfg.federation][cfg.id] = {
        serieId:    cfg.id,
        name:       serieName,
        federation: cfg.federation,
        updatedAt:  new Date().toISOString(),
        live:       pending > 0,
        teams,
        fixtures,
        ranking,
      };

      results.push({ id: cfg.id, name: serieName, ok: true, teams: teams.length, fixtures: fixtures.length, played, pending });

    } catch (err) {
      console.error(`  ✗ FAILED: ${err.message}`);
      results.push({ id: cfg.id, name: cfg.name, ok: false, error: err.message });
    }
  }

  fresh.updatedAt = new Date().toISOString();
  fs.writeFileSync(vhvDataPath, JSON.stringify(fresh, null, 2));

  const ok  = results.filter(r => r.ok).length;
  const bad = results.filter(r => !r.ok).length;
  log(`\nDone — ${ok}/${results.length} succeeded`);
  results.filter(r => r.ok).forEach(r =>
    log(`  ✓ ${r.name}: ${r.teams} teams, ${r.fixtures} fixtures (${r.played} played, ${r.pending} pending)`)
  );
  results.filter(r => !r.ok).forEach(r =>
    log(`  ✗ ${r.name}: ${r.error}`)
  );
  if (bad > 0 && bad === results.length) process.exit(1);
}

// Export config so fetch-scorers.js can read scorerUrls
module.exports = { LEAGUES };

if (require.main === module) {
  main().catch(err => { console.error(err); process.exit(1); });
}
