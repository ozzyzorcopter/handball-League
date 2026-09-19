// .github/scripts/fetch-vhv.js
// Fetches Belgian handball data from Clubee JSON APIs.
// Standings: /standings-371073v4/leagues/ID/seasons/0  → { elements, total }
// Games:     /games-371075v4/leagues/ID/seasons/0      → { elements, total }
// Stats:     /stats-371072v4/leagues/ID/seasons/0      → HTML page (scraped)
// Writes vhv-data.json grouped by federation/division.

const fs   = require("fs");
const path = require("path");
const root        = process.cwd();
const vhvDataPath = path.join(root, "vhv-data.json");

const LEAGUES = [
  { id: "19333", name: "Supercup Men", federation: "URBH-KBHB", division: "National",
    standingsUrl: "https://www.clubee.com/handballbelgium/standings-371073v4/leagues/19333/seasons/0",
    gamesUrl:     "https://www.clubee.com/handballbelgium/games-371075v4/leagues/19333/seasons/0",
    statsUrl:     "https://www.clubee.com/handballbelgium/stats-371072v4/leagues/19333/seasons/0" },
  { id: "19334", name: "Supercup Women", federation: "URBH-KBHB", division: "National",
    standingsUrl: "https://www.clubee.com/handballbelgium/standings-371073v4/leagues/19334/seasons/0",
    gamesUrl:     "https://www.clubee.com/handballbelgium/games-371075v4/leagues/19334/seasons/0",
    statsUrl:     "https://www.clubee.com/handballbelgium/stats-371072v4/leagues/19334/seasons/0" },
  { id: "18700", name: "Lotto Cup Men", federation: "URBH-KBHB", division: "National",
    standingsUrl: "https://www.clubee.com/handballbelgium/standings-371073v4/leagues/18700/seasons/0",
    gamesUrl:     "https://www.clubee.com/handballbelgium/games-371075v4/leagues/18700/seasons/0",
    statsUrl:     "https://www.clubee.com/handballbelgium/stats-371072v4/leagues/18700/seasons/0" },
  { id: "18701", name: "Lotto Cup Women", federation: "URBH-KBHB", division: "National",
    standingsUrl: "https://www.clubee.com/handballbelgium/standings-371073v4/leagues/18701/seasons/0",
    gamesUrl:     "https://www.clubee.com/handballbelgium/games-371075v4/leagues/18701/seasons/0",
    statsUrl:     "https://www.clubee.com/handballbelgium/stats-371072v4/leagues/18701/seasons/0" },
  { id: "18702", name: "First Division Men", federation: "URBH-KBHB", division: "National",
    standingsUrl: "https://www.clubee.com/handballbelgium/standings-371073v4/leagues/18702/seasons/0",
    gamesUrl:     "https://www.clubee.com/handballbelgium/games-371075v4/leagues/18702/seasons/0",
    statsUrl:     "https://www.clubee.com/handballbelgium/stats-371072v4/leagues/18702/seasons/0" },
  { id: "18703", name: "Second Division Men", federation: "URBH-KBHB", division: "National",
    standingsUrl: "https://www.clubee.com/handballbelgium/standings-371073v4/leagues/18703/seasons/0",
    gamesUrl:     "https://www.clubee.com/handballbelgium/games-371075v4/leagues/18703/seasons/0",
    statsUrl:     "https://www.clubee.com/handballbelgium/stats-371072v4/leagues/18703/seasons/0" },
  { id: "18704", name: "First Division Women", federation: "URBH-KBHB", division: "National",
    standingsUrl: "https://www.clubee.com/handballbelgium/standings-371073v4/leagues/18704/seasons/0",
    gamesUrl:     "https://www.clubee.com/handballbelgium/games-371075v4/leagues/18704/seasons/0",
    statsUrl:     "https://www.clubee.com/handballbelgium/stats-371072v4/leagues/18704/seasons/0" },
  { id: "18705", name: "Division 1 Women Reserves", federation: "URBH-KBHB", division: "National",
    standingsUrl: "https://www.clubee.com/handballbelgium/standings-371073v4/leagues/18705/seasons/0",
    gamesUrl:     "https://www.clubee.com/handballbelgium/games-371075v4/leagues/18705/seasons/0",
    statsUrl:     "https://www.clubee.com/handballbelgium/stats-371072v4/leagues/18705/seasons/0" },
  { id: "18706", name: "Second Division Women", federation: "URBH-KBHB", division: "National",
    standingsUrl: "https://www.clubee.com/handballbelgium/standings-371073v4/leagues/18706/seasons/0",
    gamesUrl:     "https://www.clubee.com/handballbelgium/games-371075v4/leagues/18706/seasons/0",
    statsUrl:     "https://www.clubee.com/handballbelgium/stats-371072v4/leagues/18706/seasons/0" },
  { id: "18743", name: "Friendly Games", federation: "URBH-KBHB", division: "National",
    standingsUrl: "https://www.clubee.com/handballbelgium/standings-371073v4/leagues/18743/seasons/0",
    gamesUrl:     "https://www.clubee.com/handballbelgium/games-371075v4/leagues/18743/seasons/0",
    statsUrl:     "https://www.clubee.com/handballbelgium/stats-371072v4/leagues/18743/seasons/0" },
  { id: "18692", name: "D1 LFH Men", federation: "LFH", division: "Seniors",
    standingsUrl: "https://www.clubee.com/handballbelgium/standings-371073v4/leagues/18692/seasons/0",
    gamesUrl:     "https://www.clubee.com/handballbelgium/games-371075v4/leagues/18692/seasons/0",
    statsUrl:     "https://www.clubee.com/handballbelgium/stats-371072v4/leagues/18692/seasons/0" },
  { id: "18693", name: "D1 LFH Women", federation: "LFH", division: "Seniors",
    standingsUrl: "https://www.clubee.com/handballbelgium/standings-371073v4/leagues/18693/seasons/0",
    gamesUrl:     "https://www.clubee.com/handballbelgium/games-371075v4/leagues/18693/seasons/0",
    statsUrl:     "https://www.clubee.com/handballbelgium/stats-371072v4/leagues/18693/seasons/0" },
  { id: "18698", name: "Promo Liège Men", federation: "LFH", division: "Seniors",
    standingsUrl: "https://www.clubee.com/handballbelgium/standings-371073v4/leagues/18698/seasons/0",
    gamesUrl:     "https://www.clubee.com/handballbelgium/games-371075v4/leagues/18698/seasons/0",
    statsUrl:     "https://www.clubee.com/handballbelgium/stats-371072v4/leagues/18698/seasons/0" },
  { id: "18694", name: "U18 Men", federation: "LFH", division: "Jeunes",
    standingsUrl: "https://www.clubee.com/handballbelgium/standings-371073v4/leagues/18694/seasons/0",
    gamesUrl:     "https://www.clubee.com/handballbelgium/games-371075v4/leagues/18694/seasons/0",
    statsUrl:     "https://www.clubee.com/handballbelgium/stats-371072v4/leagues/18694/seasons/0" },
  { id: "18695", name: "U18 Women", federation: "LFH", division: "Jeunes",
    standingsUrl: "https://www.clubee.com/handballbelgium/standings-371073v4/leagues/18695/seasons/0",
    gamesUrl:     "https://www.clubee.com/handballbelgium/games-371075v4/leagues/18695/seasons/0",
    statsUrl:     "https://www.clubee.com/handballbelgium/stats-371072v4/leagues/18695/seasons/0" },
  { id: "18739", name: "U16 Men", federation: "LFH", division: "Jeunes",
    standingsUrl: "https://www.clubee.com/handballbelgium/standings-371073v4/leagues/18739/seasons/0",
    gamesUrl:     "https://www.clubee.com/handballbelgium/games-371075v4/leagues/18739/seasons/0",
    statsUrl:     "https://www.clubee.com/handballbelgium/stats-371072v4/leagues/18739/seasons/0" },
  { id: "18696", name: "U16 Liège Women", federation: "LFH", division: "Jeunes",
    standingsUrl: "https://www.clubee.com/handballbelgium/standings-371073v4/leagues/18696/seasons/0",
    gamesUrl:     "https://www.clubee.com/handballbelgium/games-371075v4/leagues/18696/seasons/0",
    statsUrl:     "https://www.clubee.com/handballbelgium/stats-371072v4/leagues/18696/seasons/0" },
  { id: "18744", name: "U16 Brabant", federation: "LFH", division: "Jeunes",
    standingsUrl: "https://www.clubee.com/handballbelgium/standings-371073v4/leagues/18744/seasons/0",
    gamesUrl:     "https://www.clubee.com/handballbelgium/games-371075v4/leagues/18744/seasons/0",
    statsUrl:     "https://www.clubee.com/handballbelgium/stats-371072v4/leagues/18744/seasons/0" },
  { id: "18740", name: "U14 Men", federation: "LFH", division: "Jeunes",
    standingsUrl: "https://www.clubee.com/handballbelgium/standings-371073v4/leagues/18740/seasons/0",
    gamesUrl:     "https://www.clubee.com/handballbelgium/games-371075v4/leagues/18740/seasons/0",
    statsUrl:     "https://www.clubee.com/handballbelgium/stats-371072v4/leagues/18740/seasons/0" },
  { id: "18697", name: "U14 Women", federation: "LFH", division: "Jeunes",
    standingsUrl: "https://www.clubee.com/handballbelgium/standings-371073v4/leagues/18697/seasons/0",
    gamesUrl:     "https://www.clubee.com/handballbelgium/games-371075v4/leagues/18697/seasons/0",
    statsUrl:     "https://www.clubee.com/handballbelgium/stats-371072v4/leagues/18697/seasons/0" },
  { id: "18745", name: "U14 Brabant", federation: "LFH", division: "Jeunes",
    standingsUrl: "https://www.clubee.com/handballbelgium/standings-371073v4/leagues/18745/seasons/0",
    gamesUrl:     "https://www.clubee.com/handballbelgium/games-371075v4/leagues/18745/seasons/0",
    statsUrl:     "https://www.clubee.com/handballbelgium/stats-371072v4/leagues/18745/seasons/0" },
  { id: "18746", name: "U12 Brabant", federation: "LFH", division: "Jeunes",
    standingsUrl: "https://www.clubee.com/handballbelgium/standings-371073v4/leagues/18746/seasons/0",
    gamesUrl:     "https://www.clubee.com/handballbelgium/games-371075v4/leagues/18746/seasons/0",
    statsUrl:     "https://www.clubee.com/handballbelgium/stats-371072v4/leagues/18746/seasons/0" },
  { id: "18741", name: "U12 Liège", federation: "LFH", division: "Jeunes",
    standingsUrl: "https://www.clubee.com/handballbelgium/standings-371073v4/leagues/18741/seasons/0",
    gamesUrl:     "https://www.clubee.com/handballbelgium/games-371075v4/leagues/18741/seasons/0",
    statsUrl:     "https://www.clubee.com/handballbelgium/stats-371072v4/leagues/18741/seasons/0" },
  { id: "18742", name: "U10 Liège", federation: "LFH", division: "Jeunes",
    standingsUrl: "https://www.clubee.com/handballbelgium/standings-371073v4/leagues/18742/seasons/0",
    gamesUrl:     "https://www.clubee.com/handballbelgium/games-371075v4/leagues/18742/seasons/0",
    statsUrl:     "https://www.clubee.com/handballbelgium/stats-371072v4/leagues/18742/seasons/0" },
  { id: "18707", name: "Liga Heren 1", federation: "VHV", division: "Senioren",
    standingsUrl: "https://www.clubee.com/handballbelgium/standings-371073v4/leagues/18707/seasons/0",
    gamesUrl:     "https://www.clubee.com/handballbelgium/games-371075v4/leagues/18707/seasons/0",
    statsUrl:     "https://www.clubee.com/handballbelgium/stats-371072v4/leagues/18707/seasons/0" },
  { id: "18708", name: "Liga Heren 2", federation: "VHV", division: "Senioren",
    standingsUrl: "https://www.clubee.com/handballbelgium/standings-371073v4/leagues/18708/seasons/0",
    gamesUrl:     "https://www.clubee.com/handballbelgium/games-371075v4/leagues/18708/seasons/0",
    statsUrl:     "https://www.clubee.com/handballbelgium/stats-371072v4/leagues/18708/seasons/0" },
  { id: "18709", name: "Liga Heren 3", federation: "VHV", division: "Senioren",
    standingsUrl: "https://www.clubee.com/handballbelgium/standings-371073v4/leagues/18709/seasons/0",
    gamesUrl:     "https://www.clubee.com/handballbelgium/games-371075v4/leagues/18709/seasons/0",
    statsUrl:     "https://www.clubee.com/handballbelgium/stats-371072v4/leagues/18709/seasons/0" },
  { id: "18710", name: "Liga Dames", federation: "VHV", division: "Senioren",
    standingsUrl: "https://www.clubee.com/handballbelgium/standings-371073v4/leagues/18710/seasons/0",
    gamesUrl:     "https://www.clubee.com/handballbelgium/games-371075v4/leagues/18710/seasons/0",
    statsUrl:     "https://www.clubee.com/handballbelgium/stats-371072v4/leagues/18710/seasons/0" },
  { id: "18711", name: "Heren Regio AVB", federation: "VHV", division: "Senioren",
    standingsUrl: "https://www.clubee.com/handballbelgium/standings-371073v4/leagues/18711/seasons/0",
    gamesUrl:     "https://www.clubee.com/handballbelgium/games-371075v4/leagues/18711/seasons/0",
    statsUrl:     "https://www.clubee.com/handballbelgium/stats-371072v4/leagues/18711/seasons/0" },
  { id: "18712", name: "Heren Regio Limburg", federation: "VHV", division: "Senioren",
    standingsUrl: "https://www.clubee.com/handballbelgium/standings-371073v4/leagues/18712/seasons/0",
    gamesUrl:     "https://www.clubee.com/handballbelgium/games-371075v4/leagues/18712/seasons/0",
    statsUrl:     "https://www.clubee.com/handballbelgium/stats-371072v4/leagues/18712/seasons/0" },
  { id: "18713", name: "Heren Regio OWv", federation: "VHV", division: "Senioren",
    standingsUrl: "https://www.clubee.com/handballbelgium/standings-371073v4/leagues/18713/seasons/0",
    gamesUrl:     "https://www.clubee.com/handballbelgium/games-371075v4/leagues/18713/seasons/0",
    statsUrl:     "https://www.clubee.com/handballbelgium/stats-371072v4/leagues/18713/seasons/0" },
  { id: "18714", name: "Dames Regio AVB", federation: "VHV", division: "Senioren",
    standingsUrl: "https://www.clubee.com/handballbelgium/standings-371073v4/leagues/18714/seasons/0",
    gamesUrl:     "https://www.clubee.com/handballbelgium/games-371075v4/leagues/18714/seasons/0",
    statsUrl:     "https://www.clubee.com/handballbelgium/stats-371072v4/leagues/18714/seasons/0" },
  { id: "18715", name: "Dames Regio Limburg", federation: "VHV", division: "Senioren",
    standingsUrl: "https://www.clubee.com/handballbelgium/standings-371073v4/leagues/18715/seasons/0",
    gamesUrl:     "https://www.clubee.com/handballbelgium/games-371075v4/leagues/18715/seasons/0",
    statsUrl:     "https://www.clubee.com/handballbelgium/stats-371072v4/leagues/18715/seasons/0" },
  { id: "18716", name: "Dames Regio OWv", federation: "VHV", division: "Senioren",
    standingsUrl: "https://www.clubee.com/handballbelgium/standings-371073v4/leagues/18716/seasons/0",
    gamesUrl:     "https://www.clubee.com/handballbelgium/games-371075v4/leagues/18716/seasons/0",
    statsUrl:     "https://www.clubee.com/handballbelgium/stats-371072v4/leagues/18716/seasons/0" },
  { id: "18718", name: "U18 Jongens", federation: "VHV", division: "Jeugd",
    standingsUrl: "https://www.clubee.com/handballbelgium/standings-371073v4/leagues/18718/seasons/0",
    gamesUrl:     "https://www.clubee.com/handballbelgium/games-371075v4/leagues/18718/seasons/0",
    statsUrl:     "https://www.clubee.com/handballbelgium/stats-371072v4/leagues/18718/seasons/0" },
  { id: "18738", name: "U18 Meisjes", federation: "VHV", division: "Jeugd",
    standingsUrl: "https://www.clubee.com/handballbelgium/standings-371073v4/leagues/18738/seasons/0",
    gamesUrl:     "https://www.clubee.com/handballbelgium/games-371075v4/leagues/18738/seasons/0",
    statsUrl:     "https://www.clubee.com/handballbelgium/stats-371072v4/leagues/18738/seasons/0" },
  { id: "18717", name: "VHV Q-Tornooien J18", federation: "VHV", division: "Jeugd",
    standingsUrl: "https://www.clubee.com/handballbelgium/standings-371073v4/leagues/18717/seasons/0",
    gamesUrl:     "https://www.clubee.com/handballbelgium/games-371075v4/leagues/18717/seasons/0",
    statsUrl:     "https://www.clubee.com/handballbelgium/stats-371072v4/leagues/18717/seasons/0" },
  { id: "18720", name: "U16 Jongens", federation: "VHV", division: "Jeugd",
    standingsUrl: "https://www.clubee.com/handballbelgium/standings-371073v4/leagues/18720/seasons/0",
    gamesUrl:     "https://www.clubee.com/handballbelgium/games-371075v4/leagues/18720/seasons/0",
    statsUrl:     "https://www.clubee.com/handballbelgium/stats-371072v4/leagues/18720/seasons/0" },
  { id: "18723", name: "U16 Meisjes", federation: "VHV", division: "Jeugd",
    standingsUrl: "https://www.clubee.com/handballbelgium/standings-371073v4/leagues/18723/seasons/0",
    gamesUrl:     "https://www.clubee.com/handballbelgium/games-371075v4/leagues/18723/seasons/0",
    statsUrl:     "https://www.clubee.com/handballbelgium/stats-371072v4/leagues/18723/seasons/0" },
  { id: "18719", name: "VHV Q-Tornooien JM16", federation: "VHV", division: "Jeugd",
    standingsUrl: "https://www.clubee.com/handballbelgium/standings-371073v4/leagues/18719/seasons/0",
    gamesUrl:     "https://www.clubee.com/handballbelgium/games-371075v4/leagues/18719/seasons/0",
    statsUrl:     "https://www.clubee.com/handballbelgium/stats-371072v4/leagues/18719/seasons/0" },
  { id: "18722", name: "VHV Q-Tornooien M16", federation: "VHV", division: "Jeugd",
    standingsUrl: "https://www.clubee.com/handballbelgium/standings-371073v4/leagues/18722/seasons/0",
    gamesUrl:     "https://www.clubee.com/handballbelgium/games-371075v4/leagues/18722/seasons/0",
    statsUrl:     "https://www.clubee.com/handballbelgium/stats-371072v4/leagues/18722/seasons/0" },
  { id: "18721", name: "Beker Regio JM16", federation: "VHV", division: "Jeugd",
    standingsUrl: "https://www.clubee.com/handballbelgium/standings-371073v4/leagues/18721/seasons/0",
    gamesUrl:     "https://www.clubee.com/handballbelgium/games-371075v4/leagues/18721/seasons/0",
    statsUrl:     "https://www.clubee.com/handballbelgium/stats-371072v4/leagues/18721/seasons/0" },
  { id: "18724", name: "Beker Regio M16", federation: "VHV", division: "Jeugd",
    standingsUrl: "https://www.clubee.com/handballbelgium/standings-371073v4/leagues/18724/seasons/0",
    gamesUrl:     "https://www.clubee.com/handballbelgium/games-371075v4/leagues/18724/seasons/0",
    statsUrl:     "https://www.clubee.com/handballbelgium/stats-371072v4/leagues/18724/seasons/0" },
  { id: "18726", name: "U14 Jongens", federation: "VHV", division: "Jeugd",
    standingsUrl: "https://www.clubee.com/handballbelgium/standings-371073v4/leagues/18726/seasons/0",
    gamesUrl:     "https://www.clubee.com/handballbelgium/games-371075v4/leagues/18726/seasons/0",
    statsUrl:     "https://www.clubee.com/handballbelgium/stats-371072v4/leagues/18726/seasons/0" },
  { id: "18729", name: "U14 Meisjes", federation: "VHV", division: "Jeugd",
    standingsUrl: "https://www.clubee.com/handballbelgium/standings-371073v4/leagues/18729/seasons/0",
    gamesUrl:     "https://www.clubee.com/handballbelgium/games-371075v4/leagues/18729/seasons/0",
    statsUrl:     "https://www.clubee.com/handballbelgium/stats-371072v4/leagues/18729/seasons/0" },
  { id: "18725", name: "VHV Q-Tornooien JM14", federation: "VHV", division: "Jeugd",
    standingsUrl: "https://www.clubee.com/handballbelgium/standings-371073v4/leagues/18725/seasons/0",
    gamesUrl:     "https://www.clubee.com/handballbelgium/games-371075v4/leagues/18725/seasons/0",
    statsUrl:     "https://www.clubee.com/handballbelgium/stats-371072v4/leagues/18725/seasons/0" },
  { id: "18728", name: "VHV Q-Tornooien M14", federation: "VHV", division: "Jeugd",
    standingsUrl: "https://www.clubee.com/handballbelgium/standings-371073v4/leagues/18728/seasons/0",
    gamesUrl:     "https://www.clubee.com/handballbelgium/games-371075v4/leagues/18728/seasons/0",
    statsUrl:     "https://www.clubee.com/handballbelgium/stats-371072v4/leagues/18728/seasons/0" },
  { id: "18727", name: "Beker Regio JM14", federation: "VHV", division: "Jeugd",
    standingsUrl: "https://www.clubee.com/handballbelgium/standings-371073v4/leagues/18727/seasons/0",
    gamesUrl:     "https://www.clubee.com/handballbelgium/games-371075v4/leagues/18727/seasons/0",
    statsUrl:     "https://www.clubee.com/handballbelgium/stats-371072v4/leagues/18727/seasons/0" },
  { id: "18730", name: "Beker M14", federation: "VHV", division: "Jeugd",
    standingsUrl: "https://www.clubee.com/handballbelgium/standings-371073v4/leagues/18730/seasons/0",
    gamesUrl:     "https://www.clubee.com/handballbelgium/games-371075v4/leagues/18730/seasons/0",
    statsUrl:     "https://www.clubee.com/handballbelgium/stats-371072v4/leagues/18730/seasons/0" },
  { id: "18731", name: "U12 Jongens", federation: "VHV", division: "Jeugd",
    standingsUrl: "https://www.clubee.com/handballbelgium/standings-371073v4/leagues/18731/seasons/0",
    gamesUrl:     "https://www.clubee.com/handballbelgium/games-371075v4/leagues/18731/seasons/0",
    statsUrl:     "https://www.clubee.com/handballbelgium/stats-371072v4/leagues/18731/seasons/0" },
  { id: "18733", name: "U12 Meisjes", federation: "VHV", division: "Jeugd",
    standingsUrl: "https://www.clubee.com/handballbelgium/standings-371073v4/leagues/18733/seasons/0",
    gamesUrl:     "https://www.clubee.com/handballbelgium/games-371075v4/leagues/18733/seasons/0",
    statsUrl:     "https://www.clubee.com/handballbelgium/stats-371072v4/leagues/18733/seasons/0" },
  { id: "18732", name: "Beker Regio JM12", federation: "VHV", division: "Jeugd",
    standingsUrl: "https://www.clubee.com/handballbelgium/standings-371073v4/leagues/18732/seasons/0",
    gamesUrl:     "https://www.clubee.com/handballbelgium/games-371075v4/leagues/18732/seasons/0",
    statsUrl:     "https://www.clubee.com/handballbelgium/stats-371072v4/leagues/18732/seasons/0" },
  { id: "18734", name: "Beker Regio M12", federation: "VHV", division: "Jeugd",
    standingsUrl: "https://www.clubee.com/handballbelgium/standings-371073v4/leagues/18734/seasons/0",
    gamesUrl:     "https://www.clubee.com/handballbelgium/games-371075v4/leagues/18734/seasons/0",
    statsUrl:     "https://www.clubee.com/handballbelgium/stats-371072v4/leagues/18734/seasons/0" },
];


// ── UTILS ─────────────────────────────────────────────────────────────────────
const { chromium } = require("playwright-core");
function log(msg)  { console.log(`[fetch-vhv] ${msg}`); }
function warn(msg) { console.warn(`[fetch-vhv] ⚠ ${msg}`); }

// Fetch JSON from a Clubee API endpoint using Playwright's response interception.
// We intercept the network response directly rather than reading the rendered DOM,
// so we get the raw JSON even if Cloudflare/Clubee returns an HTML shell page.
async function fetchJson(page, url) {
  let capturedBody = null;

  // Intercept the response for this exact URL
  const handler = async (response) => {
    if (response.url() === url || response.url().startsWith(url.split("?")[0])) {
      const ct = response.headers()["content-type"] || "";
      if (ct.includes("json") || ct.includes("javascript") || ct.includes("text")) {
        try { capturedBody = await response.text(); } catch {}
      }
    }
  };
  page.on("response", handler);

  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 25000 });
  } finally {
    page.off("response", handler);
  }

  // If we captured the raw network body, use it
  if (capturedBody) {
    // Strip any HTML wrapper if we got redirected to a shell page
    const trimmed = capturedBody.trim();
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      return JSON.parse(trimmed);
    }
  }

  // Fallback: try reading <pre> content from the rendered DOM
  const text = await page.evaluate(() => {
    const pre = document.querySelector("pre");
    return pre ? pre.textContent : document.body.innerText;
  });
  const trimmed = text.trim();
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) {
    throw new Error(`Expected JSON but got HTML (starts with: "${trimmed.slice(0, 30)}")`);
  }
  return JSON.parse(trimmed);
}

// Navigate to URL and return raw HTML (for stats pages which are rendered HTML)
async function fetchHtml(page, url) {
  const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 25000 });
  if (!response || !response.ok()) throw new Error(`HTTP ${response?.status()} for ${url}`);
  try {
    await page.waitForFunction(() => {
      const hasTr  = document.querySelector("table tr td") !== null;
      const noData = document.body.innerText.includes("No information added yet");
      return hasTr || noData;
    }, { timeout: 8000 });
  } catch { /* timeout — return what we have */ }
  return page.content();
}

// ── STANDINGS: parse JSON from standings API ───────────────────────────────────
// API fields: position, team_name, played, wins, losses, draws,
//             score_for, score_against, points
function parseStandingsJson(data) {
  const elements = (data && data.elements) ? data.elements : [];
  const rows = elements.map(e => ({
    pos:    e.position || 0,
    name:   (e.team_name || "").trim(),
    played: e.played  || 0,
    won:    e.wins    || 0,
    drawn:  e.draws   || 0,
    lost:   e.losses  || 0,
    gf:     e.score_for     || 0,
    ga:     e.score_against || 0,
    points: e.points  || 0,
  })).filter(r => r.name);
  return rows.sort((a, b) => a.pos - b.pos);
}

// ── GAMES: parse JSON from games API ──────────────────────────────────────────
// API fields: id, week, date, time, home_team_name, away_team_name,
//             home_score, away_score, game_status_id (2 = played)
// We match team names against the standings ranking to get indices.
function parseGamesJson(data, ranking) {
  const elements = (data && data.elements) ? data.elements : [];
  if (elements.length === 0) return { fixtures: [] };

  // Build lookup by team name
  const teamNames = ranking.map(r => r.name);
  const nameIdx   = new Map(teamNames.map((n, i) => [n.toLowerCase(), i]));

  // Fuzzy: strip known suffixes/prefixes
  function coreClubName(name) {
    return name
      .replace(/\(Senior [A-Z]\)/gi, "")
      .replace(/\b(handbalclub|handbal|hbc|hv|hc|khc|hvh|hbv)\b/gi, "")
      .replace(/\s+/g, " ").trim().toLowerCase();
  }
  const coreIdx = new Map(teamNames.map((n, i) => [coreClubName(n), i]));

  function resolveTeam(raw) {
    const lower = raw.toLowerCase().trim();
    if (nameIdx.has(lower)) return nameIdx.get(lower);
    const core = coreClubName(raw);
    if (core && coreIdx.has(core)) return coreIdx.get(core);
    // Partial prefix match
    for (const [standingsCore, idx] of coreIdx) {
      if (core && standingsCore && (standingsCore.startsWith(core) || core.startsWith(standingsCore))) {
        return idx;
      }
    }
    return -1;
  }

  const fixtures = [];
  let counter    = 0;

  for (const g of elements) {
    const homeName = (g.home_team_name || "").trim();
    const awayName = (g.away_team_name || "").trim();
    if (!homeName || !awayName) continue;

    const homeIdx = resolveTeam(homeName);
    const awayIdx = resolveTeam(awayName);

    // game_status_id: 1 = scheduled, 2 = played/validated
    const played    = g.game_status_id === 2 && g.home_score !== null && g.away_score !== null;
    const homeScore = played ? g.home_score : null;
    const awayScore = played ? g.away_score : null;

    // Date from API: "YYYY-MM-DD"
    const date = g.date || null;
    const week = g.week || g.round || 0;

    if (homeIdx < 0 || awayIdx < 0 || homeIdx === awayIdx) {
      // Teams not in standings (e.g. cup, friendly with external teams) — skip silently
      continue;
    }

    fixtures.push({
      id: `f${counter++}`, gameId: String(g.id || ""),
      homeIdx, awayIdx,
      homeWin: 50, draw: 6, awayWin: 44,
      overrideOn: false, ovHW: "", ovD: "", ovAW: "",
      played,
      homeScore, awayScore,
      week, date,
    });
  }

  return { fixtures };
}

// ── STATS PARSER (HTML page, top scorers) ─────────────────────────────────────
// Stats page columns: # | Player | MP | Goals | YC | RC | ...
// Club comes from team logo alt text.
// Paginated: ?page=N
async function parseStatsAllPages(page, leagueId) {
  const BASE = "https://www.clubee.com/handballbelgium";
  const scorers = [];
  let pageNum = 1;
  let maxPage = 1;

  while (pageNum <= maxPage) {
    const url = `${BASE}/stats-371072v4/leagues/${leagueId}/seasons/0?page=${pageNum}`;
    let html;
    try { html = await fetchHtml(page, url); }
    catch { break; }

    if (html.includes("No information added yet")) break;

    // Detect max page from pagination links
    if (pageNum === 1) {
      const pageNums = [...html.matchAll(/page=(\d+)/g)].map(m => parseInt(m[1]));
      if (pageNums.length > 0) maxPage = Math.max(...pageNums);
    }

    // Parse rows
    const chunks = html.split(/<tr[\s>]/i);
    for (const chunk of chunks) {
      const rowContent = chunk.split(/<\/tr>/i)[0];

      // Extract club name from team logo alt text
      const altM = rowContent.match(/alt="([^"]+)"/i);
      const club = altM ? altM[1].trim() : "";

      const cells = [];
      const tdRe  = /<td[^>]*>([\s\S]*?)<\/td>/gi;
      let td;
      while ((td = tdRe.exec(rowContent)) !== null) {
        const text = td[1].replace(/<[^>]+>/g," ").replace(/&amp;/g,"&").replace(/&nbsp;/g," ")
          .replace(/&#39;/g,"'").replace(/&#x27;/g,"'").replace(/&[a-z0-9#]+;/gi," ")
          .replace(/\s+/g," ").trim();
        cells.push(text);
      }

      // Row: # (no dot) | Player name | MP | Goals | ...
      if (cells.length >= 4 && /^\d+$/.test(cells[0]) && cells[1] && /^\d+$/.test(cells[3])) {
        const goals = parseInt(cells[3]);
        const mp    = parseInt(cells[2]) || 0;
        if (goals > 0) {
          scorers.push({ player: cells[1], club, goals, matchesPlayed: mp });
        }
      }
    }
    pageNum++;
  }

  return scorers.sort((a, b) => b.goals - a.goals);
}

// ── MAIN ──────────────────────────────────────────────────────────────────────
async function main() {
  log(`Starting at ${new Date().toUTCString()}`);
  log(`${LEAGUES.length} league(s) configured`);

  const fresh = { updatedAt: null, federations: {} };
  const results = [];

  const browser = await chromium.launch({ headless: true });

  // Group by federation — one browser context per federation (shares cookies/session)
  const groups = new Map();
  for (const cfg of LEAGUES) {
    const key = cfg.federation;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(cfg);
  }

  for (const [federation, leagues] of groups) {
    log(`\n── ${federation} (${leagues.length} leagues) ──`);
    const context = await browser.newContext({
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
      locale: "nl-BE",
    });
    const page = await context.newPage();

    // Warm-up: visit the main Clubee site to get session cookies before hitting API endpoints
    log(`  Warming up session for ${federation}…`);
    try {
      await page.goto("https://www.clubee.com/handballbelgium/", { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.waitForTimeout(1500);
    } catch (e) { warn(`Warm-up failed: ${e.message}`); }

    for (const cfg of leagues) {
      log(`\n  ${cfg.name} (${cfg.id})`);
      try {
        log(`    Fetching standings…`);
        const standingsData = await fetchJson(page, cfg.standingsUrl);
        log(`    Fetching games…`);
        const gamesData     = await fetchJson(page, cfg.gamesUrl);

        const ranking          = parseStandingsJson(standingsData);
        const { fixtures }     = parseGamesJson(gamesData, ranking);

        // Fetch stats (HTML page, all pages) — soft fail
        let scorers = [];
        log(`    Fetching stats…`);
        try { scorers = await parseStatsAllPages(page, cfg.id); } catch {}

        const teams = ranking.map(r => ({
          id: `t_${r.name.replace(/\W+/g,"_").toLowerCase()}`,
          name: r.name, points: 0, homeBonus: "",
        }));

        const played  = fixtures.filter(f => f.played).length;
        const pending = fixtures.filter(f => !f.played).length;
        log(`    Teams: ${teams.length} | Fixtures: ${fixtures.length} (${played} played, ${pending} pending) | Scorers: ${scorers.length}`);
        if (teams.length > 0) log(`    ${teams.slice(0,4).map(t=>t.name).join(", ")}…`);

        if (teams.length === 0 && fixtures.length === 0) {
          throw new Error("No data parsed — league may not have started yet");
        }

        if (!fresh.federations[cfg.federation]) fresh.federations[cfg.federation] = {};
        fresh.federations[cfg.federation][cfg.id] = {
          serieId: cfg.id, name: cfg.name, federation: cfg.federation,
          division: cfg.division, updatedAt: new Date().toISOString(),
          live: pending > 0, teams, fixtures, ranking, scorers,
        };

        results.push({ id: cfg.id, name: cfg.name, ok: true, teams: teams.length, fixtures: fixtures.length, played, pending, scorers: scorers.length });

      } catch (err) {
        console.error(`    ✗ FAILED: ${err.message}`);
        results.push({ id: cfg.id, name: cfg.name, ok: false, error: err.message });
      }
    }
    await context.close();
  }

  await browser.close();

  fresh.updatedAt = new Date().toISOString();
  fs.writeFileSync(vhvDataPath, JSON.stringify(fresh, null, 2));

  const ok  = results.filter(r => r.ok).length;
  const bad = results.filter(r => !r.ok).length;
  log(`\nDone — ${ok}/${results.length} succeeded`);
  results.filter(r => r.ok).forEach(r =>
    log(`  ✓ ${r.name}: ${r.teams}t ${r.fixtures}fx (${r.played}/${r.pending}) ${r.scorers}sc`)
  );
  results.filter(r => !r.ok).forEach(r =>
    log(`  ✗ ${r.name}: ${r.error}`)
  );
  if (bad > 0 && bad === results.length) process.exit(1);
}

module.exports = { LEAGUES };
if (require.main === module) {
  main().catch(err => { console.error(err); process.exit(1); });
}
