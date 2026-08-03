// .github/scripts/diagnose-vhv.js
// Tests Clubee HTML scraping + dumps raw HTML structure for fixture parser debugging.

const fs   = require("fs");
const path = require("path");
const OUT  = path.join(process.cwd(), "diagnose-output.json");

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


async function fetchHtml(url) {
  // Try 1: plain HTML request
  const r = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
      "Cache-Control": "no-cache",
    },
  });
  console.log(`  [fetch] ${url.slice(0,60)}... → status=${r.status} content-type=${r.headers.get("content-type")}`);
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
      const text = td[1].replace(/<[^>]+>/g," ").replace(/&amp;/g,"&").replace(/&nbsp;/g," ").replace(/&#39;/g,"'").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&#x27;/g,"'").replace(/\s+/g," ").trim();
      cells.push(text);
    }
    if (cells.length >= 9 && /^\d+\.?$/.test(cells[0])) {
      rows.push({ pos: parseInt(cells[0]), name: cells[1].replace(/\(Senior [MFW]\)/g,"").trim(), played: parseInt(cells[2])||0, won: parseInt(cells[3])||0, drawn: parseInt(cells[4])||0, lost: parseInt(cells[5])||0, gf: parseInt(cells[6])||0, ga: parseInt(cells[7])||0, points: parseInt(cells[9])||0 });
    }
  }
  return rows.sort((a,b) => a.pos - b.pos);
}

async function main() {
  console.log("=== DIAGNOSE VHV (Clubee) ===\n");
  const output = {};

  for (const lg of LEAGUES) {
    console.log(`\n--- ${lg.name} (${lg.id}) ---`);
    try {
      const [fixturesHtml, standingsHtml] = await Promise.all([
        fetchHtml(lg.fixturesUrl),
        lg.standingsUrl !== lg.fixturesUrl ? fetchHtml(lg.standingsUrl) : Promise.resolve(null),
      ]);
      const effectiveStandingsHtml = standingsHtml ?? fixturesHtml;
      const ranking = parseStandings(effectiveStandingsHtml);
      console.log(`  Teams: ${ranking.length} — ${ranking.map(r=>r.name).join(", ")}`);

      // Log raw HTML length and first 500 chars to diagnose response type
      console.log(`  Standings HTML length: ${effectiveStandingsHtml.length}`);
      console.log(`  Standings HTML first 300: ${effectiveStandingsHtml.slice(0, 300).replace(/\n/g, " ")}`);
      console.log(`  Has <table>: ${"<table" in effectiveStandingsHtml || effectiveStandingsHtml.includes("<table")}`);
      console.log(`  Has <tr>: ${effectiveStandingsHtml.includes("<tr")}`);
      console.log(`  Has <td>: ${effectiveStandingsHtml.includes("<td")}`);

      // Find first game link and show raw context
      const gameIdx = fixturesHtml.indexOf('/games/');
      if (gameIdx < 0) {
        console.log("  No /games/ links found");
      } else {
        const ctx = fixturesHtml.slice(Math.max(0,gameIdx-200), gameIdx+200);
        console.log("  First /games/ link context:\n" + ctx.replace(/\s+/g," "));
      }

      // Find gameday/round markers
      const markerRe = /class="[^"]*(?:gameday|speeldag|round|ronde|spieltag|match-?day)[^"]*"[^>]*>([^<]*)</gi;
      const markers = [];
      let mm;
      while ((mm = markerRe.exec(fixturesHtml)) !== null) markers.push(mm[1].trim());
      if (markers.length) console.log("  Round markers:", markers.slice(0,5).join(" | "));

      output[lg.id] = {
        teams: ranking.length,
        firstGameContext: gameIdx >= 0 ? fixturesHtml.slice(Math.max(0,gameIdx-200),gameIdx+400) : null,
        fixturesHtmlSample: fixturesHtml.slice(0, 2000),
        ranking,
      };
    } catch(e) {
      console.log(`  ERROR: ${e.message}`);
      output[lg.id] = { error: e.message };
    }
  }

  fs.writeFileSync(OUT, JSON.stringify(output, null, 2));
  console.log(`\n✓ Written to diagnose-output.json`);
}

main().catch(err => { console.error(err); process.exit(1); });
