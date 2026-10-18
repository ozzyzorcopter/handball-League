// .github/scripts/fetch-vhv.js
// Fetches Belgian handball data from Clubee JSON APIs.
// Standings: /standings-371073v4/leagues/ID/seasons/0  → { elements, total }
// Games:     /games-371075v4/leagues/ID/seasons/0      → { elements, total }
// Stats:     /stats-371072v4/leagues/ID/seasons/0      → HTML page (scraped)
// Writes data/index.json + data/leagues/<serieId>.json, grouped by federation.

const fs   = require("fs");
const path = require("path");
const root        = process.cwd();
const boxscoreCachePath = path.join(root, "boxscore-cache.json");
const venueCachePath = path.join(root, "venue-cache.json");

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
function log(msg)  { console.log(`[fetch-vhv] ${msg}`); }
function warn(msg) { console.warn(`[fetch-vhv] ⚠ ${msg}`); }

// Clubee serves every page we read (standings, games, stats, lineups, match pages) fully rendered
// to a plain HTTP request, so no browser is needed. A request is retried a few times; a page that
// still comes back without the expected content is an error for the caller to deal with.
const plainStats = { ok: 0, failed: 0 };
async function fetchPlain(url) {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36", "Accept-Language": "nl-BE,nl;q=0.9" },
      signal: AbortSignal.timeout(30000),
    });
    return res.ok ? await res.text() : null;
  } catch { return null; }
}
async function fetchHtmlSmart(url, looksComplete, attempts = 3) {
  for (let i = 0; i < attempts; i++) {
    if (i > 0) await sleep(1500 * i);
    const text = await fetchPlain(url);
    if (text && (looksComplete(text) || /No information added yet/i.test(text))) { plainStats.ok++; return text; }
  }
  plainStats.failed++;
  warn(`No complete page after ${attempts} tries: ${url}`);
  throw new Error(`No complete page from ${url}`);
}

// HTML text -> plain text. Handles named entities and numeric ones in decimal and hex form
// (React writes an apostrophe as &#x27;, so "HVH 't Noorden" must not turn into "HVH  t Noorden").
function decodeEntities(s) {
  const named = { amp: "&", nbsp: " ", quot: '"', apos: "'", lt: "<", gt: ">" };
  return s.replace(/<[^>]+>/g, " ")
    .replace(/&(?:#x([0-9a-f]+)|#(\d+)|([a-z]+));/gi, (m, hex, dec, name) => {
      if (hex) return String.fromCodePoint(parseInt(hex, 16));
      if (dec) return String.fromCodePoint(parseInt(dec, 10));
      return Object.prototype.hasOwnProperty.call(named, name.toLowerCase()) ? named[name.toLowerCase()] : " ";
    })
    .replace(/\s+/g, " ").trim();
}

// Club logo <img> URLs for the same team can differ between pages (Next.js
// image optimizer query params like width/quality vary by where the logo is
// rendered), even though they point at the same underlying image. This pulls
// out a stable key — the real image path/filename — so a logo captured on
// the standings page can still be matched against one captured on the stats
// page.
function normalizeLogoSrc(src) {
  if (!src) return "";
  try {
    // Next.js image optimizer: /_next/image?url=<encoded-real-path>&w=64&q=75
    const m = src.match(/[?&]url=([^&]+)/i);
    if (m) return decodeURIComponent(m[1]).split("?")[0];
    return src.split("?")[0];
  } catch {
    return src.split("?")[0];
  }
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
      const inner = td[1] ?? "";
      const text = decodeEntities(inner);
      cells.push(text);
    }
    // Expect at least 10 cells; first cell is position number (may have trailing dot: "1.")
    if (cells.length < 10) continue;
    const posStr = (cells[0] ?? "").replace(/\.$/, "");
    if (/^\d+$/.test(posStr) && cells[1]) {
      // Grab the club logo <img> (src or data-src, whichever is set — some
      // lazy-loading setups only populate data-src until the image scrolls
      // into view) so we can later match it against the stats page's logos,
      // which have no usable alt text.
      const imgM = rowContent.match(/<img[^>]*\s(?:data-)?src="([^"]+)"/i);
      rows.push({
        pos:    parseInt(posStr),
        name:   cells[1].replace(/\s*\([^)]*\)\s*$/, "").trim(),
        played: parseInt(cells[2])  || 0,
        won:    parseInt(cells[3])  || 0,
        drawn:  parseInt(cells[4])  || 0,
        lost:   parseInt(cells[5])  || 0,
        gf:     parseInt(cells[6])  || 0,
        ga:     parseInt(cells[7])  || 0,
        points: parseInt(cells[9])  || 0,
        logoKey: imgM ? normalizeLogoSrc(imgM[1]) : "",
      });
    }
  }
  return rows.sort((a, b) => a.pos - b.pos);
}

// ── GAMES: parse from rendered div-based GameCard components ──────────────────
// Each game is an <a href="/handballbelgium/games/ID"> containing:
//   teamInnerParapraph  div → <strong>Home Team (Division)</strong>
//   <h3>               → " - : - " (scheduled) or "26 : 25" (played)
//   <p>                → "22.08.2026" (date)
//   teamInnerParapraphSecond div → <strong>Away Team (Division)</strong>
// ── CLUBEE EMBEDDED GAME DATA ─────────────────────────────────────────────────
// The games page embeds the full game list as JSON (Next.js "flight" payload:
// self.__next_f.push([1,"..."]) script chunks). Each game has the Clubee game id,
// both team ids, scores, start time, cancelled flag and the venue with
// coordinates, which makes the browser visit + geocoding per venue unnecessary.
function decodeFlight(html) {
  let out = "";
  if (!html) return out;
  const re = /self\.__next_f\.push\(\[1,(".*?")\]\)<\/script>/gs;
  let m;
  while ((m = re.exec(html)) !== null) { try { out += JSON.parse(m[1]); } catch { /* skip chunk */ } }
  return out;
}

// End index of the JSON value (object/array) starting at str[start], string-aware.
function sliceBalanced(str, start) {
  let depth = 0, inStr = false, esc = false;
  for (let i = start; i < str.length; i++) {
    const ch = str[i];
    if (inStr) { if (esc) esc = false; else if (ch === "\\") esc = true; else if (ch === '"') inStr = false; continue; }
    if (ch === '"') inStr = true;
    else if (ch === "{" || ch === "[") depth++;
    else if (ch === "}" || ch === "]") { depth--; if (depth === 0) return i; }
  }
  return -1;
}

// Map gameId -> { homeId, awayId, time, date, cancelled, completed, score1, score2, venue }
function extractFlightGames(html) {
  const games = new Map();
  const flight = decodeFlight(html);
  if (!flight) return games;
  let from = 0, at;
  while ((at = flight.indexOf('"games":[', from)) >= 0) {
    const start = at + '"games":'.length;
    const end = sliceBalanced(flight, start);
    from = start + 1;
    if (end < 0) continue;
    let arr;
    try { arr = JSON.parse(flight.slice(start, end + 1)); } catch { continue; }
    if (!Array.isArray(arr)) continue;
    for (const g of arr) {
      if (!g || g.id == null || !g.team1 || !g.team2) continue;
      const m = typeof g.start_date === "string" ? g.start_date.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/) : null;
      const lat = parseFloat(g.venue_lat ?? g.facility?.lat), lon = parseFloat(g.venue_lng ?? g.facility?.lng);
      games.set(String(g.id), {
        homeId: g.team1.id, awayId: g.team2.id,
        date: m ? m[1] : null, time: m && m[2] !== "00:00" ? m[2] : null,
        cancelled: !!g.cancelled, completed: !!g.completed,
        score1: g.score1 ?? null, score2: g.score2 ?? null,
        venue: !isNaN(lat) && !isNaN(lon)
          ? { name: g.venue_name || g.facility?.name || null, address: [g.venue_address, g.venue_zip, g.venue_city].filter(Boolean).join(", ") || null, lat, lon }
          : null,
      });
    }
  }
  return games;
}

// Kick-off times. The games page embeds structured game data (Next.js flight
// payload) with "id" and "start_date" next to each other, e.g.
//   "id":2942786,"start_date":"2026-08-29T20:15:00+00:00"
// Clubee labels local kick-off times with +00:00, so the clock time is used
// as is (no timezone conversion). In raw HTML the quotes are backslash-escaped.
function extractGameTimes(html) {
  const times = new Map();
  if (!html) return times;
  const re = /\\?"id\\?":(\d+),\\?"start_date\\?":\\?"(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/g;
  let m;
  while ((m = re.exec(html)) !== null) times.set(m[1], { date: m[2], time: m[3] });
  return times;
}

function parseGamesHtml(html, ranking, times) {
  const teamNames = ranking.map(r => r.name);
  const nameIdx   = new Map(teamNames.map((n, i) => [n.toLowerCase(), i]));

  const stripText = decodeEntities;
  function coreClubName(name) {
    return name
      .replace(/\([^)]*\)/g, "")
      .replace(/\b(handbalclub|handbal|hbc|hv|hc|khc|hvh|hbv)\b/gi, "")
      .replace(/\s+/g, " ").trim().toLowerCase();
  }
  const coreIdx = new Map(teamNames.map((n, i) => [coreClubName(n), i]));

  function resolveTeam(raw) {
    // Strip division suffix like "(Senior M)" first
    const clean = raw.replace(/\s*\([^)]*\)\s*$/, "").trim();
    const lower = clean.toLowerCase();
    if (nameIdx.has(lower)) return nameIdx.get(lower);
    const flat = x => x.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
    const flatMatch = teamNames.findIndex(n => flat(n) === flat(clean));
    if (flatMatch >= 0) return flatMatch;
    const core = coreClubName(clean);
    if (core && coreIdx.has(core)) return coreIdx.get(core);
    for (const [sc, idx] of coreIdx) {
      if (core && sc && (sc.startsWith(core) || core.startsWith(sc))) return idx;
    }
    return -1;
  }

  const fixtures = [];
  let counter = 0;

  // Split HTML on game-card anchor starts: <a href="...games/ID"
  // Each chunk runs from one anchor to the next, so regexes stay within one card.
  const anchorRe = /<a[^>]+href="[^"]*\/games\/(\d+)"[^>]*>/gi;
  const anchors = [];
  let am;
  while ((am = anchorRe.exec(html)) !== null) {
    anchors.push({ gameId: am[1], start: am.index });
  }

  for (let ai = 0; ai < anchors.length; ai++) {
    const { gameId, start } = anchors[ai];
    const end = ai + 1 < anchors.length ? anchors[ai + 1].start : start + 4000;
    const card = html.slice(start, end);

    // Home team: first <strong> inside teamInnerParapraph (not Second)
    const homeM = card.match(/teamInnerParapraph"[\s\S]*?<strong>([\s\S]*?)<\/strong>/i);
    // Away team: first <strong> inside teamInnerParapraphSecond
    const awayM = card.match(/teamInnerParapraphSecond[\s\S]*?<strong>([\s\S]*?)<\/strong>/i);
    if (!homeM || !awayM) continue;

    const homeName = stripText(homeM[1]);
    const awayName = stripText(awayM[1]);
    if (!homeName || !awayName) continue;
    if (/^bye\b/i.test(homeName) || /^bye\b/i.test(awayName)) continue;

    // Score from <h3>: "26 : 25" = played, " - : - " = scheduled
    const h3M    = card.match(/<h3[^>]*>([\s\S]*?)<\/h3>/i);
    const h3     = h3M ? stripText(h3M[1]) : "";
    const scoreM = h3.match(/(\d+)\s*[-:]\s*(\d+)/);

    // Date from <p>: "22.08.2026"
    const dateM = card.match(/<p[^>]*>(\d{2})\.(\d{2})\.(\d{4})<\/p>/);
    const date  = dateM ? `${dateM[3]}-${dateM[2]}-${dateM[1]}` : null;

    // A game is played if: (a) score entered in h3, OR (b) game date is in the past
    const today = new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
    const pastDate = date && date < today;
    const played    = !!(scoreM || pastDate);
    const homeScore = scoreM ? parseInt(scoreM[1]) : null;
    const awayScore = scoreM ? parseInt(scoreM[2]) : null;

    const homeIdx = resolveTeam(homeName);
    const awayIdx = resolveTeam(awayName);
    if (homeIdx < 0 || awayIdx < 0 || homeIdx === awayIdx) {
      if (homeIdx < 0 || awayIdx < 0) warn(`Game ${gameId}: no team match for ${homeIdx < 0 ? `"${homeName}"` : ""} ${awayIdx < 0 ? `"${awayName}"` : ""} - game skipped`);
      continue;
    }

    fixtures.push({
      id: `f${counter++}`, gameId,
      homeIdx, awayIdx,
      homeWin: 50, draw: 6, awayWin: 44,
      overrideOn: false, ovHW: "", ovD: "", ovAW: "",
      played, homeScore, awayScore,
      week: 0, date,
      ...(times && times.get(gameId) && times.get(gameId).time !== "00:00" ? { time: times.get(gameId).time } : {}),
    });
  }

  return { fixtures };
}

// ── STATS / LINEUP TABLES (plain HTML, no browser) ────────────────────────────
// Clubee serves both the season stats pages and the per-game lineup pages fully rendered to a
// plain request (verified from GitHub Actions with the probe), so these are pure HTML parsers.
// Columns: # | Player | MP | G | 7MS | 7MM | YC | 2MIN | BC | RC. Only the first columns carry a
// header label on the season stats page, so the other positions are the fixed fallbacks.
const STAT_COLS = { player: 1, mp: 2, g: 3, s7: 4, m7: 5, yc: 6, min2: 7, bc: 8, rc: 9 };

function cleanCellText(s) {
  return decodeEntities(s.replace(/<svg[\s\S]*?<\/svg>/gi, ""));
}

// All <table>s in the page: { before: nearest text above, header: labels, rows: [[{text, src}]] }
function parseStatTables(html) {
  const out = [];
  const tableRe = /<table[\s\S]*?<\/table>/gi;
  let tm;
  while ((tm = tableRe.exec(html)) !== null) {
    const tableHtml = tm[0];
    // Nearest text node above the table (the team heading on lineup pages).
    const above = html.slice(Math.max(0, tm.index - 3000), tm.index).replace(/<svg[\s\S]*?<\/svg>/gi, "");
    const texts = above.split(/<[^>]+>/).map(t => t.replace(/&amp;/g, "&").replace(/\s+/g, " ").trim()).filter(Boolean);
    const before = texts.length ? texts[texts.length - 1] : "";
    let header = [];
    const rows = [];
    const rowRe = /<tr[\s>][\s\S]*?<\/tr>/gi;
    let rm;
    while ((rm = rowRe.exec(tableHtml)) !== null) {
      const rowHtml = rm[0];
      const cells = [];
      const tdRe = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
      let cm;
      while ((cm = tdRe.exec(rowHtml)) !== null) {
        const srcM = cm[1].match(/<img[^>]*?\s(?:data-)?src="([^"]+)"/i);
        cells.push({ text: cleanCellText(cm[1]), src: srcM ? srcM[1] : "" });
      }
      if (!cells.length) continue;
      if (/data-is-header="true"/.test(rowHtml) || /^<tr[^>]*>\s*<th/i.test(rowHtml)) header = cells.map(c => c.text.toLowerCase());
      else rows.push(cells);
    }
    out.push({ before, header, rows });
  }
  return out;
}

function statCols(header) {
  const col = (label, fb) => { const i = header.indexOf(label); return i !== -1 ? i : fb; };
  return {
    player: col("player", STAT_COLS.player), mp: col("mp", STAT_COLS.mp), g: col("g", STAT_COLS.g),
    s7: col("7ms", STAT_COLS.s7), m7: col("7mm", STAT_COLS.m7), yc: col("yc", STAT_COLS.yc),
    min2: col("2min", STAT_COLS.min2), bc: col("bc", STAT_COLS.bc), rc: col("rc", STAT_COLS.rc),
  };
}

function statRow(texts, c, club) {
  return {
    player: texts[c.player], club, goals: parseInt(texts[c.g]) || 0,
    matchesPlayed: parseInt(texts[c.mp]) || 0, sevenMScored: parseInt(texts[c.s7]) || 0,
    sevenMMissed: parseInt(texts[c.m7]) || 0, yellowCards: parseInt(texts[c.yc]) || 0,
    twoMinSuspensions: parseInt(texts[c.min2]) || 0, blueCards: parseInt(texts[c.bc]) || 0,
    redCards: parseInt(texts[c.rc]) || 0,
  };
}

// One season-stats page → { scorers (goals > 0), realRows (all player rows), signature }
function parseStatsHtml(html, logoMap = new Map()) {
  const scorers = [];
  let realRows = 0;
  const seen = new Set();
  const sig = [];
  for (const t of parseStatTables(html)) {
    const c = statCols(t.header);
    for (const cells of t.rows) {
      const texts = cells.map(x => x.text);
      const key = texts.join("\u0001");
      if (seen.has(key)) continue;
      if (texts.length >= 4 && /^\d+$/.test(texts[0]) && texts[c.player] && /^\d+$/.test(texts[c.g])) {
        seen.add(key); sig.push(key); realRows++;
        let club = "";
        const withSrc = cells.find(x => x.src);
        if (withSrc) club = logoMap.get(normalizeLogoSrc(withSrc.src)) || "";
        const row = statRow(texts, c, club);
        if (row.goals > 0) scorers.push(row);
      }
    }
  }
  return { scorers, realRows, signature: sig.join("\u0002") };
}

// One lineup page → players of both teams (goals may be 0), club = heading above each table
function parseLineupHtml(html) {
  const players = [];
  for (const t of parseStatTables(html)) {
    if (!t.header.includes("player") && !t.header.includes("g")) continue;
    const c = statCols(t.header);
    const club = t.before.replace(/\s*\([^)]*\)\s*$/, "").trim();
    for (const cells of t.rows) {
      const texts = cells.map(x => x.text);
      if (texts.length < 4 || !texts[c.player] || !/^\d+$/.test(texts[c.g] ?? "")) continue;
      players.push(statRow(texts, c, club));
    }
  }
  return players;
}

const looksLikeStatsTable = h => /<tr[\s>]/i.test(h) && /data-is-header="true"/.test(h);

async function parseStatsAllPages(leagueId, ranking = []) {
  const BASE = "https://www.clubee.com/handballbelgium";
  // The scorer table's club logo has no alt text, so the club is found by matching the logo URL
  // against the logos on the standings page.
  const logoMap = new Map();
  for (const r of ranking) if (r.logoKey) logoMap.set(r.logoKey, r.name);
  const scorers = [];
  let prevSignature = null;
  // Keep going until a page has no player rows (or repeats the previous one: the site clamps an
  // out-of-range page back to the last valid page). Bounded by a safety cap.
  for (let pageNum = 1; pageNum <= 30; pageNum++) {
    const url = `${BASE}/stats-371072v4/leagues/${leagueId}/seasons/0?page=${pageNum}`;
    let html;
    try { html = await fetchHtmlSmart(url, looksLikeStatsTable); } catch { break; }
    const res = parseStatsHtml(html, logoMap);
    if (pageNum === 1) console.log(`[DBG stats ${leagueId}] page 1: ${res.realRows} rows, ${res.scorers.length} with goals`);
    if (res.realRows === 0) break;
    if (pageNum > 1 && res.signature === prevSignature) break;
    prevSignature = res.signature;
    scorers.push(...res.scorers);
  }
  const withClub = scorers.filter(s => s.club).length;
  console.log(`[DBG stats ${leagueId}] clubMatch=${withClub}/${scorers.length} logoMapSize=${logoMap.size}`);
  return scorers.sort((a, b) => b.goals - a.goals);
}

// Per-game boxscore (lineup page): per-player goals for ONE match. Returns null when the page
// can't be fetched (the caller retries next run).
async function fetchGameLineup(gameId) {
  const url = `https://www.clubee.com/handballbelgium/games/${gameId}/lineup`;
  try {
    const html = await fetchHtmlSmart(url, looksLikeStatsTable);
    return parseLineupHtml(html);
  } catch { return null; }
}

// ── VENUE / TRAVEL DISTANCE ─────────────────────────────────────────────────────
// A team's home venue ("sporthal") address is shown on its game pages
// ("Venue" section with a "Show the directions" map link). Both Apple Maps
// and Google Maps directions links use a `daddr=` query param holding the
// plain-text address, regardless of which one the site renders for a given
// browser/locale — matching on that is more robust than trying to pin down
// the exact heading markup, which we can't verify without live access.
async function fetchVenueAddress(gameId) {
  const url = `https://www.clubee.com/handballbelgium/games/${gameId}`;
  let html;
  // A complete match page without a directions link simply has no venue (cups and tournaments),
  // so it counts as complete.
  try { html = await fetchHtmlSmart(url, h => /daddr=/i.test(h) || (/<title>[^<]*- Match - /i.test(h) && /<\/html>/i.test(h))); } catch { return undefined; } // undefined = could not fetch, retry next run
  return parseVenueAddress(html); // null = page fine, no venue
}

function parseVenueAddress(html) {
  const m = (html || "").match(/daddr=([^"&]+)/i);
  if (!m) return null;
  try {
    const addr = decodeURIComponent(m[1].replace(/\+/g, " ")).trim();
    return addr || null;
  } catch {
    return null;
  }
}

// Groups divisions of the same club under one venue-cache key (e.g. "Thor
// D3 M" and "Thor D2 W" almost always share the same sporthal), so we don't
// re-fetch/re-geocode the same address once per division. Deliberately
// duplicated from parseGamesHtml's local coreClubName rather than sharing a
// reference, to avoid touching that already-working function.
function venueKey(teamName) {
  return teamName
    .replace(/\([^)]*\)/g, "")
    .replace(/\b(handbalclub|handbal|hbc|hv|hc|khc|hvh|hbv)\b/gi, "")
    .replace(/\s+/g, " ").trim().toLowerCase();
}

// Geocoding via OpenStreetMap's free Nominatim API. No API key needed, but
// their usage policy requires a descriptive User-Agent and caps requests at
// ~1/sec — we respect that by only calling this for addresses not already
// in the cache, and by throttling new lookups in the caller.
async function geocodeOnce(query) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=be&q=${encodeURIComponent(query)}`;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "handball-League-fetcher/1.0 (https://github.com/ozzyzorcopter/handball-League)" },
    });
    const data = await res.json();
    if (Array.isArray(data) && data.length > 0) {
      return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
    }
  } catch { /* geocoding service unreachable/failed */ }
  return null;
}

async function geocodeAddress(address) {
  if (typeof fetch !== "function") return null; // very old Node — skip gracefully

  // Venue addresses come as "Venue Name, Street Number, City[, Belgium]"
  // (e.g. "Sportcentrum MT De Gryse, Schapenstraat 45a, Oostende"). Try
  // progressively coarser queries until one resolves:
  //   1. the full string (works when there's no venue-name prefix at all)
  //   2. everything after the first comma (drops the venue name — Nominatim
  //      generally can't resolve small sports halls as named POIs)
  //   3. just the last two comma-separated segments (city [, country]) —
  //      loses street-level precision but still gives a usable town-center
  //      fix for the handful of streets Nominatim has no record of at all,
  //      rather than leaving the team fully unresolved (0km).
  // Every call goes through throttledGeocodeCall so the ~1 req/sec limit is
  // respected globally, not just within one league's loop.
  const parts = address.split(",").map(s => s.trim()).filter(Boolean);
  const attempts = [address];
  if (parts.length > 1) attempts.push(parts.slice(1).join(", "));
  if (parts.length > 2) attempts.push(parts.slice(-2).join(", "));

  for (const query of attempts) {
    const result = await throttledGeocodeCall(() => geocodeOnce(query));
    console.log(`[DBG venue] geocode query="${query}" -> ${result ? `${result.lat},${result.lon}` : "FAILED"}`);
    if (result) return result;
  }
  return null;
}

// Actual driving distance via OSRM's free public routing server (no API
// key). Treated as symmetric (A→B ≈ B→A) to halve the number of route
// lookups — real road distance can differ slightly by direction, but not
// enough to matter for a season-long travel-km panel. Routed through
// throttledRouteCall so concurrent leagues don't hammer the free server at
// once.
async function drivingDistanceKm(a, b) {
  if (typeof fetch !== "function") return null;
  return throttledRouteCall(async () => {
    const url = `https://router.project-osrm.org/route/v1/driving/${a.lon},${a.lat};${b.lon},${b.lat}?overview=false`;
    try {
      const res = await fetch(url);
      const data = await res.json();
      if (data && data.code === "Ok" && data.routes && data.routes[0]) {
        return data.routes[0].distance / 1000; // meters → km
      }
    } catch { /* routing service unreachable/failed — caller treats as unresolved */ }
    return null;
  });
}

// Straight-line (great-circle) distance in km. Used as an estimate when the
// routing service is unavailable; roads are typically ~25-30% longer than the
// straight line, so callers scale it by ROAD_FACTOR.
const ROAD_FACTOR = 1.3;
function haversineKm(a, b) {
  const R = 6371, rad = d => d * Math.PI / 180;
  const dLat = rad(b.lat - a.lat), dLon = rad(b.lon - a.lon);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// Leagues are processed with CONCURRENCY parallel workers (see main()), but
// Nominatim's usage policy (~1 req/sec) and OSRM's free demo server are
// shared global resources — a per-league sleep() only throttles calls
// *within* one league's sequential loop, not *across* the several leagues
// running at the same time. With 4 leagues in flight, that let up to 4
// geocode/route requests fire in the same second, well over Nominatim's
// limit, which silently fails (returns no results) far more often than it
// succeeds — the likely cause of widespread 0km results. These two queues
// serialize ALL such calls globally, across every concurrent league.
function makeThrottledQueue(minGapMs) {
  let chain = Promise.resolve();
  return function run(fn) {
    const result = chain.then(fn);
    chain = result.catch(() => {}).then(() => sleep(minGapMs));
    return result;
  };
}
const throttledGeocodeCall = makeThrottledQueue(1100); // Nominatim: ~1 req/sec
const throttledRouteCall   = makeThrottledQueue(300);  // OSRM free demo server: be gentle

// The same club often appears in several leagues (cup editions, reserve
// teams, etc.), which run concurrently — without this, two leagues could
// both notice a venue is unresolved at the same moment and each kick off
// their own fetch+geocode for it, wasting scarce rate-limited calls on an
// exact duplicate. This lets the second (and third, ...) caller just await
// the first one's in-flight resolution instead.
const inFlightVenueResolutions = new Map(); // venueKey -> Promise

// Every still-unresolved venue (address not found, or geocoding failed even
// after the fallback stages) gets retried on EVERY run, since a cached
// failure isn't treated as permanent. As the list of genuinely hard venues
// built up, that retry cost grew every run — likely pushing total run time
// well past 30 minutes and causing GitHub to silently drop some of the
// half-hourly scheduled triggers (it does that under load, with no error or
// notification). This caps how many NEW venue resolutions a single run will
// attempt; the rest just wait for the next run, so the backlog drains
// gradually instead of every run paying for the whole thing every time.
let venueResolutionBudget = 20;

// ── INCREMENTAL UPDATES ─────────────────────────────────────────────────────────
// Most hourly runs have nothing new for most leagues. A league is only
// re-fetched when it could have changed:
//   - no previous data, or FORCE_FULL=1
//   - it has a game dated today or yesterday (live, or the result just landed)
//   - it has an unplayed game dated in the past (result still missing)
//   - its data is older than FULL_REFRESH_HOURS (daily safety net)
// For a refreshed league, the slow parts (top-scorer pages and boxscores) are
// skipped when the number of played games hasn't changed since last time.
const FORCE_FULL = process.env.FORCE_FULL === "1" || process.env.FORCE_FULL === "true";
const FULL_REFRESH_HOURS = 20;
// Bump when the stored league format gains new fields (kick-off times, team ids, ...):
// every league whose saved data has an older version is re-fetched once on the next run,
// even if it is otherwise "quiet".
const DATA_VERSION = 2;
function brusselsDate(d = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Brussels", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}
function refreshReason(prev, now = new Date()) {
  if (FORCE_FULL) return "forced";
  if (!prev || !Array.isArray(prev.fixtures) || !prev.fixtures.length) return "no previous data";
  if (prev.dataVersion !== DATA_VERSION) return "data format updated";
  if (!prev.updatedAt || now - new Date(prev.updatedAt) > FULL_REFRESH_HOURS * 3600e3) return "daily refresh";
  const today = brusselsDate(now);
  const yesterday = brusselsDate(new Date(now.getTime() - 86400e3));
  const inTwoDays = brusselsDate(new Date(now.getTime() + 2 * 86400e3));
  for (const f of prev.fixtures) {
    const d = f.date && f.date.slice(0, 10);
    if (!d) continue;
    if (d === today || d === yesterday) return "game today/yesterday";
    if (!f.played && d > today && d <= inTwoDays) return "game soon (time may change)";
    if (!f.played && d < today) return "result pending";
  }
  return null;
}

// ── MAIN ──────────────────────────────────────────────────────────────────────
async function main() {
  log(`Starting at ${new Date().toUTCString()}`);
  log(`${LEAGUES.length} league(s) configured`);

  const fresh = { updatedAt: null, federations: {} };
  const results = [];

  // Previous run's output, used to skip leagues that can't have changed.
  const prevLeagues = new Map();
  try {
    const prevData = require("./split-data.js").loadLeagueData(root) || { federations: {} };
    for (const fed of Object.values(prevData.federations || {})) for (const lg of Object.values(fed)) prevLeagues.set(String(lg.serieId), lg);
  } catch { /* first run */ }

  // Boxscore cache: keyed by gameId, persisted to disk and committed
  // alongside data/ so repeat runs only fetch NEWLY played games
  // instead of re-fetching a whole season's worth of boxscores every time.
  let boxCache = { games: {} };
  try {
    boxCache = JSON.parse(fs.readFileSync(boxscoreCachePath, "utf8"));
    if (!boxCache.games) boxCache.games = {};
  } catch { boxCache = { games: {} }; }
  const cachedGameCount = Object.keys(boxCache.games).length;
  log(`Loaded boxscore cache: ${cachedGameCount} game(s) already fetched`);

  // Venue cache: each club's home venue (address + geocoded lat/lon), keyed
  // by venueKey(name), plus driving distances between venue pairs — both
  // persisted so we only geocode/route NEW clubs and NEW pairings, never
  // re-doing work for venues we've already resolved. Powers the "Distance
  // Travelled" panel.
  let venueCache = { venues: {}, distances: {} };
  try {
    venueCache = JSON.parse(fs.readFileSync(venueCachePath, "utf8"));
    if (!venueCache.venues) venueCache.venues = {};
    if (!venueCache.distances) venueCache.distances = {};
  } catch { venueCache = { venues: {}, distances: {} }; }
  log(`Loaded venue cache: ${Object.keys(venueCache.venues).length} venue(s), ${Object.keys(venueCache.distances).length} distance(s)`);

  // Each worker does sequential plain HTTP requests; no shared rate-limited resource like
  // Nominatim/OSRM is involved, so this scales with runner CPU/network. The geocoding/routing
  // throttles further down stay global and unaffected by this number.
  const CONCURRENCY = 8;

  // Process one league
  async function processLeague(cfg) {
    const prev = prevLeagues.get(String(cfg.id));
    const reason = refreshReason(prev);
    if (!reason) {
      log(`\n  ${cfg.name} (${cfg.id}) — unchanged, reusing previous data`);
      return { cfg, ok: true, reuse: prev };
    }
    try {
      log(`\n  ${cfg.name} (${cfg.id}) — refreshing (${reason})`);

      log(`    Fetching standings…`);
      const standingsHtml = await fetchHtmlSmart(cfg.standingsUrl, t => parseStandingsHtml(t).length > 0);
      log(`    Fetching games…`);
      const gamesHtml     = await fetchHtmlSmart(cfg.gamesUrl, t => /\/games\/\d+/.test(t));

      const ranking      = parseStandingsHtml(standingsHtml);

      // (debug removed)

      // Kick-off times: from the rendered page if present, else a plain fetch of the same URL.
      let rawGames = gamesHtml;
      let flightGames = extractFlightGames(rawGames);
      if (flightGames.size === 0) {
        try {
          const res = await fetch(cfg.gamesUrl, { headers: { "User-Agent": "Mozilla/5.0 (compatible; LeagueSim/1.0)" } });
          if (res.ok) { rawGames = await res.text(); flightGames = extractFlightGames(rawGames); }
        } catch { /* embedded data is optional */ }
      }
      let times = extractGameTimes(rawGames);
      const { fixtures } = parseGamesHtml(gamesHtml, ranking, times);
      log(`    Embedded game data: ${flightGames.size} game(s) for ${fixtures.length} parsed fixture(s); kick-off time known for ${fixtures.filter(f => f.time).length}`);

      {
        // Diagnose missing kick-off times for upcoming games (next 14 days).
        const today = brusselsDate(new Date()), limit = brusselsDate(new Date(Date.now() + 14 * 864e5));
        const rows = fixtures.filter(f => !f.played && !f.time && f.date && f.date >= today && f.date <= limit);
        for (const f of rows.slice(0, 15)) {
          const g = f.gameId ? flightGames.get(String(f.gameId)) : null;
          const why = !f.gameId ? "no gameId" : !g ? "gameId not in embedded data" : g.cancelled ? "cancelled" : g.date !== f.date ? `date differs (embedded ${g.date})` : "embedded time is 00:00 / missing";
          const h = ranking[f.homeIdx] && ranking[f.homeIdx].name, a = ranking[f.awayIdx] && ranking[f.awayIdx].name;
          log(`    No time: ${f.date} ${h} - ${a} [${f.gameId || "-"}] → ${why}`);
        }
        if (rows.length) log(`    Upcoming games without time: ${rows.length}`);
      }

      // Scorer pages and boxscores only change when a game was played, so skip
      // them when the played count is the same as last time.
      const playedNow = fixtures.filter(f => f.played).length;
      const playedBefore = prev && prev.fixtures ? prev.fixtures.filter(f => f.played).length : -1;
      const reuseStats = !FORCE_FULL && playedNow === playedBefore && Array.isArray(prev.scorers) && prev.scorers.length > 0;

      let scorers = [];
      if (reuseStats) {
        scorers = prev.scorers.map(s => ({ ...s }));
        log(`    Stats unchanged (${playedNow} games played) — reusing scorers`);
      } else {
        log(`    Fetching stats…`);
        try { scorers = await parseStatsAllPages(cfg.id, ranking); } catch {}
      }

      const teams = ranking.map(r => ({
        id: `t_${r.name.replace(/\W+/g,"_").toLowerCase()}`,
        name: r.name, points: 0, homeBonus: "",
      }));

      // Enrich from the embedded data: Clubee team ids (for ID-based matching later),
      // cancelled games, and each team's home venue with coordinates.
      const homeVenueVotes = teams.map(() => new Map());
      for (const f of fixtures) {
        const g = flightGames.get(String(f.gameId));
        if (!g) continue;
        if (g.cancelled) f.cancelled = true;
        if (teams[f.homeIdx] && g.homeId != null && teams[f.homeIdx].clubeeId == null) teams[f.homeIdx].clubeeId = g.homeId;
        if (teams[f.awayIdx] && g.awayId != null && teams[f.awayIdx].clubeeId == null) teams[f.awayIdx].clubeeId = g.awayId;
        if (g.venue && teams[f.homeIdx]) {
          const k = `${g.venue.lat},${g.venue.lon}`;
          const e = homeVenueVotes[f.homeIdx].get(k) || { n: 0, venue: g.venue };
          e.n++; homeVenueVotes[f.homeIdx].set(k, e);
        }
      }
      // Use those coordinates for any venue not already resolved: no browser visit or geocoding needed.
      let venuesFromClubee = 0;
      teams.forEach((t, i) => {
        const best = [...homeVenueVotes[i].values()].sort((a, b) => b.n - a.n)[0];
        const vk = venueKey(t.name);
        if (best && !(venueCache.venues[vk] && venueCache.venues[vk].lat != null)) {
          venueCache.venues[vk] = { name: t.name, address: best.venue.address || best.venue.name, lat: best.venue.lat, lon: best.venue.lon, source: "clubee" };
          venuesFromClubee++;
        }
      });
      if (venuesFromClubee) log(`    Venues taken from game data: ${venuesFromClubee}`);
      log(`    Clubee team ids: ${teams.filter(t => t.clubeeId != null).length}/${teams.length} teams`);
      {
        const noId = teams.filter(t => t.clubeeId == null);
        if (noId.length) {
          const fx = fixtures.filter(f => teams[f.homeIdx] && teams[f.awayIdx]);
          const noGameId = fx.filter(f => !f.gameId).length;
          const noMatch = fx.filter(f => f.gameId && !flightGames.has(String(f.gameId))).length;
          log(`    Teams without Clubee id (${noId.length}): ${noId.map(t => t.name).join(" | ")}`);
          log(`    Fixtures: ${fx.length} total, ${noGameId} without gameId, ${noMatch} gameId not in embedded data`);
        }
      }

      // Per-game boxscores — only fetch games not already in the cache from
      // a previous run. Powers "goals in last game" on the scorer panel and
      // the "most goals in a single game" player ranking.
      const playedWithGameId = fixtures.filter(f => f.played && f.gameId);
      let newBoxscores = 0, failedBoxscores = 0;
      for (const f of playedWithGameId) {
        if (reuseStats || boxCache.games[f.gameId]) continue;
        const players = await fetchGameLineup(f.gameId);
        if (players && players.length > 0) {
          boxCache.games[f.gameId] = { date: f.date, leagueId: cfg.id, players };
          newBoxscores++;
        } else if (players === null) {
          failedBoxscores++; // could not fetch the page: not remembered, so the next run tries again
        } else {
          // Remember the attempt so we don't refetch a broken/empty page
          // every single run — a future run can still retry by manually
          // clearing this entry (or the whole cache file).
          boxCache.games[f.gameId] = { date: f.date, leagueId: cfg.id, players: [], failed: true };
          failedBoxscores++;
        }
      }
      if (newBoxscores > 0 || failedBoxscores > 0) {
        log(`    Boxscores: +${newBoxscores} new, ${failedBoxscores} failed/empty`);
      }

      // Build a per-player game log from every cached boxscore belonging to
      // this league's played fixtures, then use it to backfill each
      // scorer's "goals in their last game" and to rank players by their
      // best single-game output.
      const playerGameLog = new Map(); // "player|||club" -> [{date, goals}]
      for (const f of playedWithGameId) {
        const g = boxCache.games[f.gameId];
        if (!g || !g.players) continue;
        for (const p of g.players) {
          const key = `${p.player}|||${p.club}`;
          if (!playerGameLog.has(key)) playerGameLog.set(key, []);
          playerGameLog.get(key).push({ date: g.date, goals: p.goals });
        }
      }
      for (const s of scorers) {
        const log_ = playerGameLog.get(`${s.player}|||${s.club}`);
        if (log_ && log_.length) {
          const mostRecent = [...log_].sort((a, b) => (b.date || "").localeCompare(a.date || ""))[0];
          s.lastGameGoals = mostRecent.goals;
        }
      }
      const topSingleGamePlayers = Array.from(playerGameLog.entries())
        .map(([key, entries]) => {
          const [player, club] = key.split("|||");
          const best = entries.reduce((a, b) => (b.goals > a.goals ? b : a), entries[0]);
          return { player, club, goals: best.goals, date: best.date };
        })
        .filter(r => r.goals > 0)
        .sort((a, b) => b.goals - a.goals)
        .slice(0, 15);

      // Distance Travelled panel: resolve each team's home venue (their
      // "sporthal") from one of their home fixtures' game page, geocode it,
      // then sum the driving distance from each team's own venue to every
      // opponent's venue across their played away fixtures.
      log(`    Resolving venues…`);
      for (const t of teams) {
        const vk = venueKey(t.name);
        // Skip only venues that actually resolved to coordinates before — a
        // cached entry with lat/lon still null means a previous run failed
        // to find/geocode this venue (very likely due to the rate-limiting
        // bug just fixed above) and should be retried, not treated as a
        // permanent "no venue" result.
        if (venueCache.venues[vk] && venueCache.venues[vk].lat != null) continue;

        // Another league may already be resolving this exact club's venue
        // right now — piggyback on that instead of duplicating the work.
        if (inFlightVenueResolutions.has(vk)) {
          await inFlightVenueResolutions.get(vk);
          continue;
        }

        const homeFx = fixtures.find(f => teams[f.homeIdx]?.name === t.name && f.gameId);
        if (!homeFx) continue; // no home fixture with a gameId yet (e.g. brand-new team)

        // This run has spent its venue-resolution budget — leave the rest
        // for next time rather than letting the retry backlog blow out this
        // run's total time.
        if (venueResolutionBudget <= 0) continue;
        venueResolutionBudget--;

        const resolution = (async () => {
          const address = await fetchVenueAddress(homeFx.gameId);
          if (address === undefined) { console.log(`[DBG venue] team="${t.name}" gameId=${homeFx.gameId} page not fetched, will retry next run`); return; }
          console.log(`[DBG venue] team="${t.name}" gameId=${homeFx.gameId} address=${address ? `"${address}"` : "NOT FOUND"}`);
          if (!address) { venueCache.venues[vk] = { name: t.name, address: null, lat: null, lon: null }; return; }
          const coords = await geocodeAddress(address);
          venueCache.venues[vk] = { name: t.name, address, lat: coords?.lat ?? null, lon: coords?.lon ?? null };
        })();
        inFlightVenueResolutions.set(vk, resolution);
        try { await resolution; } finally { inFlightVenueResolutions.delete(vk); }
      }

      const travelKm = new Array(teams.length).fill(0);
      const travelEstimated = new Array(teams.length).fill(0); // legs using a straight-line estimate
      const travelMissing   = new Array(teams.length).fill(0); // legs skipped: a venue has no coordinates
      const playedAway = fixtures.filter(f => f.played && f.homeScore != null && f.awayScore != null);
      for (const f of playedAway) {
        const home = teams[f.homeIdx], away = teams[f.awayIdx];
        if (!home || !away) continue;
        const hv = venueCache.venues[venueKey(home.name)];
        const av = venueCache.venues[venueKey(away.name)];
        if (!hv?.lat || !av?.lat) { travelMissing[f.awayIdx]++; continue; } // venue unresolved for one side
        const pairKey = [venueKey(home.name), venueKey(away.name)].sort().join("|");
        if (venueCache.distances[pairKey] == null) {
          const km = await drivingDistanceKm({ lat: hv.lat, lon: hv.lon }, { lat: av.lat, lon: av.lon });
          console.log(`[DBG travel] ${pairKey} -> ${km != null ? km.toFixed(1) + "km" : "FAILED (using straight-line estimate)"}`);
          if (km != null) venueCache.distances[pairKey] = km;
        }
        let dist = venueCache.distances[pairKey];
        if (dist == null) {
          // Routing failed: estimate instead of counting 0 km. Not cached, so a later run retries real routing.
          dist = haversineKm(hv, av) * ROAD_FACTOR;
          travelEstimated[f.awayIdx]++;
        }
        travelKm[f.awayIdx] += dist;
      }
      const travelRanking = teams
        .map((t, i) => ({ id: t.id, name: t.name, km: Math.round(travelKm[i]),
          ...(travelEstimated[i] ? { estimatedLegs: travelEstimated[i] } : {}),
          ...(travelMissing[i] ? { missingLegs: travelMissing[i] } : {}) }))
        .sort((a, b) => b.km - a.km || a.name.localeCompare(b.name));

      const played  = fixtures.filter(f => f.played).length;
      const pending = fixtures.filter(f => !f.played).length;
      log(`    ✓ ${cfg.name}: ${teams.length}t ${fixtures.length}fx (${played}✓ ${pending}⏳) ${scorers.length}sc`);
      if (teams.length > 0) log(`      ${teams.slice(0,4).map(t=>t.name).join(", ")}…`);

      if (teams.length === 0 && fixtures.length === 0) {
        throw new Error("No data parsed — league may not have started yet");
      }

      return { cfg, ok: true, ranking, fixtures, teams, scorers, topSingleGamePlayers, travelRanking, played, pending };
    } catch (err) {
      console.error(`    ✗ ${cfg.name}: ${err.message}`);
      return { cfg, ok: false, error: err.message };
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
    if (r.reuse) {
      const lg = r.reuse;
      if (!fresh.federations[r.cfg.federation]) fresh.federations[r.cfg.federation] = {};
      fresh.federations[r.cfg.federation][r.cfg.id] = lg; // untouched: keeps its own updatedAt
      const pl = (lg.fixtures || []).filter(f => f.played).length;
      results.push({ id: r.cfg.id, name: r.cfg.name, ok: true, teams: (lg.teams || []).length, fixtures: (lg.fixtures || []).length, played: pl, pending: (lg.fixtures || []).length - pl, scorers: (lg.scorers || []).length, reused: true });
      continue;
    }
    const { cfg, ranking, fixtures, teams, scorers, topSingleGamePlayers, travelRanking, played, pending } = r;
    if (!fresh.federations[cfg.federation]) fresh.federations[cfg.federation] = {};
    fresh.federations[cfg.federation][cfg.id] = {
      serieId: cfg.id, name: cfg.name, federation: cfg.federation,
      division: cfg.division, updatedAt: new Date().toISOString(), dataVersion: DATA_VERSION,
      live: pending > 0, teams, fixtures, ranking, scorers,
      topSingleGamePlayers: topSingleGamePlayers || [],
      travelRanking: travelRanking || [],
    };
    results.push({ id: cfg.id, name: cfg.name, ok: true, teams: teams.length, fixtures: fixtures.length, played, pending, scorers: scorers.length });
  }

  fresh.updatedAt = new Date().toISOString();
  // Last season's strength for teams that can be matched (see priors.js).
  try {
    const pr = require("./priors.js");
    const r = pr.applyPriors(fresh, pr.latestArchive(path.join(root, "archive")));
    log(`Last-season priors: ${r.matched}/${r.teams} teams in ${r.leagues} league(s)`);
  } catch (e) { warn(`Could not add last-season priors: ${e.message}`); }
  // Publish a small index + one file per league (the app loads leagues on demand).
  try {
    const r = require("./split-data.js").writeSplit(fresh, path.join(root, "data"));
    log(`Wrote data/index.json and ${r.leagues} league file(s)`);
  } catch (e) { warn(`Could not write split data: ${e.message}`); }

  fs.writeFileSync(boxscoreCachePath, JSON.stringify(boxCache, null, 2));
  const totalCached = Object.keys(boxCache.games).length;
  log(`Boxscore cache: ${totalCached} game(s) total (was ${cachedGameCount} before this run)`);

  fs.writeFileSync(venueCachePath, JSON.stringify(venueCache, null, 2));
  const unresolvedVenues = Object.values(venueCache.venues).filter(v => v.lat == null).length;
  log(`Venue cache: ${Object.keys(venueCache.venues).length} venue(s), ${Object.keys(venueCache.distances).length} distance(s) total, ${unresolvedVenues} still unresolved (budget spent this run: ${20 - venueResolutionBudget}/20)`);

  log(`Pages fetched: ${plainStats.ok} ok, ${plainStats.failed} failed after retries`);
  const ok  = results.filter(r => r.ok).length;
  const bad = results.filter(r => !r.ok).length;
  log(`\nDone — ${ok}/${results.length} succeeded`);
  results.filter(r => r.ok).forEach(r =>
    log(`  ✓ ${r.name}: ${r.teams}t ${r.fixtures}fx (${r.played}/${r.pending}) ${r.scorers}sc${r.reused ? " [reused]" : ""}`)
  );
  results.filter(r => !r.ok).forEach(r =>
    log(`  ✗ ${r.name}: ${r.error}`)
  );
  if (bad > 0 && bad === results.length) process.exit(1);
}

module.exports = { parseVenueAddress, parseStatsHtml, parseLineupHtml, LEAGUES, refreshReason, extractGameTimes, extractFlightGames, parseStandingsHtml, parseGamesHtml, decodeFlight, DATA_VERSION };
if (require.main === module) {
  main().catch(err => { console.error(err); process.exit(1); });
}
