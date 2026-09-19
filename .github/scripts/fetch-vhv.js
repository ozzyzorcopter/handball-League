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

// Navigate to URL and return raw HTML, waiting for table content
async function fetchHtml(page, url) {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
  try {
    await page.waitForFunction(() => {
      const hasTr  = document.querySelector("table tr td") !== null;
      const noData = document.body.innerText.includes("No information added yet");
      return hasTr || noData;
    }, { timeout: 8000 });
  } catch { /* timeout — return what we have */ }
  return page.content();
}

// ── STANDINGS: parse from rendered HTML table ──────────────────────────────────
// Columns: # | Club (with img) | MP | W | D | L | GS | GA | GD | Pts | (empty)
function parseStandingsHtml(html) {
  const rows = [];
  const chunks = html.split(/<tr[\s>]/i);
  for (const chunk of chunks) {
    const rowContent = chunk.split(/<\/tr>/i)[0];
    const cells = [];
    const tdRe = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    let td;
    while ((td = tdRe.exec(rowContent)) !== null) {
      const text = td[1]
        .replace(/<[^>]+>/g, " ")
        .replace(/&amp;/g, "&").replace(/&nbsp;/g, " ")
        .replace(/&#39;/g, "'").replace(/&#x27;/g, "'")
        .replace(/&[a-z0-9#]+;/gi, " ")
        .replace(/\s+/g, " ").trim();
      cells.push(text);
    }
    // Expect at least 10 cells; first cell is position number
    if (cells.length >= 10 && /^\d+$/.test(cells[0]) && cells[1]) {
      rows.push({
        pos:    parseInt(cells[0]),
        name:   cells[1].trim(),
        played: parseInt(cells[2])  || 0,
        won:    parseInt(cells[3])  || 0,
        drawn:  parseInt(cells[4])  || 0,
        lost:   parseInt(cells[5])  || 0,
        gf:     parseInt(cells[6])  || 0,
        ga:     parseInt(cells[7])  || 0,
        points: parseInt(cells[9])  || 0,
      });
    }
  }
  return rows.sort((a, b) => a.pos - b.pos);
}

// ── GAMES: parse from rendered HTML page ──────────────────────────────────────
// Games page shows: home team | score (e.g. "26 - 25") | date | away team
// Played games have a score; scheduled ones show a date/time only.
function parseGamesHtml(html, ranking) {
  const teamNames = ranking.map(r => r.name);
  const nameIdx   = new Map(teamNames.map((n, i) => [n.toLowerCase(), i]));

  function coreClubName(name) {
    return name
      .replace(/\([^)]*\)/g, "")  // strip parentheticals like (Senior M)
      .replace(/\b(handbalclub|handbal|hbc|hv|hc|khc|hvh|hbv)\b/gi, "")
      .replace(/\s+/g, " ").trim().toLowerCase();
  }
  const coreIdx = new Map(teamNames.map((n, i) => [coreClubName(n), i]));

  function resolveTeam(raw) {
    const lower = raw.toLowerCase().trim();
    if (nameIdx.has(lower)) return nameIdx.get(lower);
    const core = coreClubName(raw);
    if (core && coreIdx.has(core)) return coreIdx.get(core);
    for (const [sc, idx] of coreIdx) {
      if (core && sc && (sc.startsWith(core) || core.startsWith(sc))) return idx;
    }
    return -1;
  }

  const fixtures = [];
  let counter = 0;

  // Each game row in the HTML table: cells contain home team, score/date, away team
  const chunks = html.split(/<tr[\s>]/i);
  for (const chunk of chunks) {
    const rowContent = chunk.split(/<\/tr>/i)[0];
    const cells = [];
    const tdRe = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    let td;
    while ((td = tdRe.exec(rowContent)) !== null) {
      const text = td[1]
        .replace(/<[^>]+>/g, " ")
        .replace(/&amp;/g, "&").replace(/&nbsp;/g, " ")
        .replace(/&#39;/g, "'").replace(/&[a-z0-9#]+;/gi, " ")
        .replace(/\s+/g, " ").trim();
      cells.push(text);
    }

    // Need at least 3 cells: home, score-or-date, away
    if (cells.length < 3) continue;

    // Find the score cell — matches "N - N" pattern
    let scoreCell = -1;
    let scoreMatch = null;
    for (let i = 0; i < cells.length; i++) {
      const m = cells[i].match(/^(\d{1,3})\s*-\s*(\d{1,3})$/);
      if (m) { scoreCell = i; scoreMatch = m; break; }
    }

    let homeName, awayName, played, homeScore, awayScore, date;

    if (scoreCell >= 1) {
      // Played game: cells before score = home team info, after = away team info
      homeName  = cells.slice(0, scoreCell).join(" ").trim();
      awayName  = cells.slice(scoreCell + 1).join(" ").trim();
      played    = true;
      homeScore = parseInt(scoreMatch[1]);
      awayScore = parseInt(scoreMatch[2]);
      date      = null;
    } else {
      // Scheduled game: try to find date pattern DD.MM.YYYY
      const dateCell = cells.findIndex(c => /\d{2}\.\d{2}\.\d{4}/.test(c));
      if (dateCell < 1) continue;
      const dateStr = cells[dateCell].match(/(\d{2})\.(\d{2})\.(\d{4})/);
      date     = dateStr ? `${dateStr[3]}-${dateStr[2]}-${dateStr[1]}` : null;
      homeName = cells.slice(0, dateCell).join(" ").trim();
      awayName = cells.slice(dateCell + 1).join(" ").trim();
      played   = false; homeScore = null; awayScore = null;
    }

    // Strip division suffixes like "(Senior M)" from team names
    homeName = homeName.replace(/\([^)]*\)/g, "").trim();
    awayName = awayName.replace(/\([^)]*\)/g, "").trim();

    if (!homeName || !awayName) continue;
    const homeIdx = resolveTeam(homeName);
    const awayIdx = resolveTeam(awayName);
    if (homeIdx < 0 || awayIdx < 0 || homeIdx === awayIdx) continue;

    fixtures.push({
      id: `f${counter++}`, gameId: "",
      homeIdx, awayIdx,
      homeWin: 50, draw: 6, awayWin: 44,
      overrideOn: false, ovHW: "", ovD: "", ovAW: "",
      played, homeScore, awayScore,
      week: 0, date,
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

  const CONCURRENCY = 4; // parallel browser pages
  const browser = await chromium.launch({ headless: true });

  // Shared context — one context for all leagues (shared cookies after warm-up)
  const context = await browser.newContext({
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
    locale: "nl-BE",
  });

  // Warm-up: one page visits the main site to seed cookies for the whole context
  log(`Warming up session…`);
  const warmPage = await context.newPage();
  try {
    await warmPage.goto("https://www.clubee.com/handballbelgium/", { waitUntil: "domcontentloaded", timeout: 30000 });
    await warmPage.waitForTimeout(2000);
  } catch (e) { warn(`Warm-up failed: ${e.message}`); }
  await warmPage.close();

  // Process one league — each call gets its own page from the shared context
  async function processLeague(cfg) {
    const page = await context.newPage();
    try {
      log(`\n  ${cfg.name} (${cfg.id})`);

      log(`    Fetching standings…`);
      const standingsHtml = await fetchHtml(page, cfg.standingsUrl);
      log(`    Fetching games…`);
      const gamesHtml     = await fetchHtml(page, cfg.gamesUrl);

      const ranking      = parseStandingsHtml(standingsHtml);
      const { fixtures } = parseGamesHtml(gamesHtml, ranking);

      let scorers = [];
      log(`    Fetching stats…`);
      try { scorers = await parseStatsAllPages(page, cfg.id); } catch {}

      const teams = ranking.map(r => ({
        id: `t_${r.name.replace(/\W+/g,"_").toLowerCase()}`,
        name: r.name, points: 0, homeBonus: "",
      }));

      const played  = fixtures.filter(f => f.played).length;
      const pending = fixtures.filter(f => !f.played).length;
      log(`    ✓ ${cfg.name}: ${teams.length}t ${fixtures.length}fx (${played}✓ ${pending}⏳) ${scorers.length}sc`);
      if (teams.length > 0) log(`      ${teams.slice(0,4).map(t=>t.name).join(", ")}…`);

      if (teams.length === 0 && fixtures.length === 0) {
        throw new Error("No data parsed — league may not have started yet");
      }

      return { cfg, ok: true, ranking, fixtures, teams, scorers, played, pending };
    } catch (err) {
      console.error(`    ✗ ${cfg.name}: ${err.message}`);
      return { cfg, ok: false, error: err.message };
    } finally {
      await page.close();
    }
  }

  // Run with limited concurrency
  async function runPool(items, concurrency, fn) {
    const results = [];
    let i = 0;
    async function worker() {
      while (i < items.length) {
        const item = items[i++];
        results.push(await fn(item));
      }
    }
    await Promise.all(Array.from({ length: concurrency }, worker));
    return results;
  }

  const allResults = await runPool(LEAGUES, CONCURRENCY, processLeague);

  // Write results to fresh data structure
  for (const r of allResults) {
    if (!r.ok) {
      results.push({ id: r.cfg.id, name: r.cfg.name, ok: false, error: r.error });
      continue;
    }
    const { cfg, ranking, fixtures, teams, scorers, played, pending } = r;
    if (!fresh.federations[cfg.federation]) fresh.federations[cfg.federation] = {};
    fresh.federations[cfg.federation][cfg.id] = {
      serieId: cfg.id, name: cfg.name, federation: cfg.federation,
      division: cfg.division, updatedAt: new Date().toISOString(),
      live: pending > 0, teams, fixtures, ranking, scorers,
    };
    results.push({ id: cfg.id, name: cfg.name, ok: true, teams: teams.length, fixtures: fixtures.length, played, pending, scorers: scorers.length });
  }

  await context.close();

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
