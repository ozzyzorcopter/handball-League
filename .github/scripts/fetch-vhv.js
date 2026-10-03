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
const { chromium } = require("playwright-core");
function log(msg)  { console.log(`[fetch-vhv] ${msg}`); }
function warn(msg) { console.warn(`[fetch-vhv] ⚠ ${msg}`); }

// Navigate to URL and return raw HTML, waiting for content to render
async function fetchHtml(page, url) {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
  try {
    await page.waitForFunction(() => {
      const hasTr    = document.querySelector("table tr td") !== null;
      // Games/stats pages render into divs — GameCard or stats table rows
      const hasCards = document.querySelector("a[href*='/games/']") !== null;
      const hasStats = document.querySelector("a[href*='/members/']") !== null;
      const noData   = document.body.innerText.includes("No information added yet");
      return hasTr || hasCards || hasStats || noData;
    }, { timeout: 15000 });
  } catch { /* timeout — return what we have */ }
  return page.content();
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
      const text = inner
        .replace(/<[^>]+>/g, " ")
        .replace(/&amp;/g, "&").replace(/&nbsp;/g, " ")
        .replace(/&#39;/g, "'").replace(/&#x27;/g, "'")
        .replace(/&[a-z0-9#]+;/gi, " ")
        .replace(/\s+/g, " ").trim();
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
function parseGamesHtml(html, ranking) {
  const teamNames = ranking.map(r => r.name);
  const nameIdx   = new Map(teamNames.map((n, i) => [n.toLowerCase(), i]));

  function stripText(s) {
    return s.replace(/<[^>]+>/g, " ").replace(/&amp;/g,"&").replace(/&nbsp;/g," ")
            .replace(/&#39;/g,"'").replace(/&[a-z0-9#]+;/gi," ")
            .replace(/\s+/g," ").trim();
  }
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
    if (homeIdx < 0 || awayIdx < 0 || homeIdx === awayIdx) continue;

    fixtures.push({
      id: `f${counter++}`, gameId,
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
async function parseStatsAllPages(page, leagueId, ranking = []) {
  const BASE = "https://www.clubee.com/handballbelgium";
  // The scorer table's club logo <img> has no alt text at all (confirmed on
  // real captured markup), so club always came out as "" and the app's
  // per-team "Team Scorers" panel could never match anyone. Build a
  // logo-URL → team-name map from the standings page (which we already
  // parsed) so we can identify a scorer's club from their row's logo image
  // instead, even with no alt text to read.
  const logoMap = new Map();
  for (const r of ranking) {
    if (r.logoKey) logoMap.set(r.logoKey, r.name);
  }
  const scorers = [];
  let pageNum = 1;
  // We no longer trust a regex over the static HTML to find "page=N" links to
  // determine how many pages exist — that only works if pagination is
  // rendered as real <a href> links in the initial markup. If it's
  // client-side buttons instead (no such links ever appear), that regex
  // finds nothing and we'd silently stop after page 1, capping every league
  // at whatever the page size is (seen live: 10 scorers, even when more
  // exist). Instead we just keep fetching subsequent pages until one comes
  // back with zero real player rows, bounded by a safety cap.
  const MAX_PAGES_SAFETY_CAP = 30;
  // Guards against a site that clamps an out-of-range page request back to
  // the last valid page (returning the SAME rows again) instead of an empty
  // page — without this we'd re-add the same scorers on every iteration up
  // to the safety cap instead of stopping.
  let prevPageSignature = null;

  while (pageNum <= MAX_PAGES_SAFETY_CAP) {
    const url = `${BASE}/stats-371072v4/leagues/${leagueId}/seasons/0?page=${pageNum}`;
    let html;
    try { html = await fetchHtml(page, url); }
    catch { break; }

    if (pageNum === 1) {
      // DEBUG: the old version logged html.slice(0,200), which is always just
      // the <!DOCTYPE>/<head> boilerplate and tells us nothing about the table
      // markup. Log structural facts instead, plus a snippet anchored on the
      // "Player" column header (or the first player-like row) so we can see
      // the ACTUAL markup (table/tr/td vs. div-grid vs. something else).
      let structInfo;
      try {
        structInfo = await page.evaluate(() => {
          const tableCount = document.querySelectorAll("table").length;
          const trCount    = document.querySelectorAll("tr").length;
          const tdCount    = document.querySelectorAll("td").length;
          const memberLinkCount = document.querySelectorAll(
            "a[href*='/member'], a[href*='/player'], a[href*='/profile']"
          ).length;
          const roleRowCount = document.querySelectorAll("[role='row']").length;

          // Find the smallest element whose own text is exactly "Player"
          // (the column header), then walk up to something table/grid-like
          // and grab its outerHTML so we can see real markup around the data.
          let headerAnchorHtml = "";
          const all = document.querySelectorAll("body *");
          for (const el of all) {
            if (el.children.length === 0 && el.textContent.trim() === "Player") {
              const container =
                el.closest("table") ||
                el.closest("[role='table']") ||
                el.closest("div[class]") ||
                el.parentElement;
              headerAnchorHtml = (container ? container.outerHTML : el.outerHTML).slice(0, 2000);
              break;
            }
          }

          // Grab the first BODY row (not the header) specifically, since the
          // header-anchored snippet above never reaches into <tbody> before
          // its 2000-char cutoff. Report each of its cells' tag name, class,
          // and text so we can see exactly how data rows differ from the
          // header row we already inspected.
          const bodyRows = Array.from(document.querySelectorAll("table tbody tr"));
          const firstBodyRow = bodyRows[0] || null;
          const firstBodyRowCells = firstBodyRow
            ? Array.from(firstBodyRow.children).map(c => ({
                tag: c.tagName,
                cls: (c.className || "").toString().slice(0, 60),
                text: (c.textContent || "").replace(/\s+/g, " ").trim().slice(0, 60),
              }))
            : [];
          const firstBodyRowHtml = firstBodyRow ? firstBodyRow.outerHTML.slice(0, 2500) : "";
          const bodyRowCount = bodyRows.length;

          return {
            tableCount, trCount, tdCount, memberLinkCount, roleRowCount, headerAnchorHtml,
            bodyRowCount, firstBodyRowCells, firstBodyRowHtml,
          };
        });
      } catch (e) {
        structInfo = { error: String(e) };
      }
      console.log(
        `[DBG stats ${leagueId}] url=${url} html_len=${html.length} ` +
        `tables=${structInfo.tableCount} trs=${structInfo.trCount} tds=${structInfo.tdCount} ` +
        `memberLinks=${structInfo.memberLinkCount} roleRows=${structInfo.roleRowCount} ` +
        `bodyRows=${structInfo.bodyRowCount}`
      );
      console.log(
        `[DBG stats ${leagueId}] firstBodyRowCells=${JSON.stringify(structInfo.firstBodyRowCells || [])}`
      );
      console.log(
        `[DBG stats ${leagueId}] firstBodyRowHtml="${(structInfo.firstBodyRowHtml || "").replace(/\s+/g, " ")}"`
      );
    }
    // NOTE: we intentionally do NOT break here based on a page-wide text
    // search for "No information added yet". That phrase can appear
    // anywhere on the page (an unrelated empty-state widget, a hidden
    // placeholder present in the initial markup, etc.) even when the stats
    // table itself has real rows — this was confirmed to be exactly what
    // was causing every league to report 0 scorers: the debug block above
    // (structInfo, read from the live DOM) showed real row data, but this
    // check fired first and broke out of the loop before the row-gathering
    // code below ever ran. Instead we only decide "no data" from the
    // actual DOM rows we gather further down.

    // Primary strategy: parse via the live DOM (page.evaluate) rather than
    // regex over serialized HTML. This is robust to attribute quoting,
    // nested tags, and whitespace that broke the old regex-based split, and
    // it works whether rows are real <tr>/<td> or ARIA "row"/"cell" divs.
    let domRows = [];
    let headerLabels = [];
    try {
      const evalResult = await page.evaluate(() => {
        function cellsOf(rowEl, cellSelector) {
          return Array.from(rowEl.querySelectorAll(cellSelector)).map(td => {
            // Don't require an alt attribute to exist — the scorer table's
            // club logo <img> has none, so we also grab its src/data-src to
            // match against the standings page's logos instead.
            const img = td.querySelector("img");
            return {
              text: (td.textContent || "").replace(/\s+/g, " ").trim(),
              alt: img ? img.getAttribute("alt") || "" : "",
              src: img ? (img.getAttribute("src") || img.getAttribute("data-src") || "") : "",
            };
          });
        }

        // Read the real header labels instead of assuming a fixed column
        // order — some leagues may not track every stat (e.g. no 7m shots
        // at lower levels), which would shift column positions.
        const headerRow =
          document.querySelector("table thead tr") ||
          document.querySelector("tr[data-is-header='true']");
        const headerLabels = headerRow
          ? Array.from(headerRow.querySelectorAll("th, td")).map(c =>
              (c.textContent || "").replace(/\s+/g, " ").trim().toLowerCase()
            )
          : [];

        // Some leagues render TWO copies of the stats table in the DOM (seen
        // live: tables=2). We don't know in general which one (if either)
        // is a partial/sticky-columns mirror missing the data columns, so
        // rather than guess by table position, gather rows from ALL tables
        // and de-duplicate identical rows below by content instead.
        let rowEls = Array.from(document.querySelectorAll("table tr"));
        let cellSel = "td";
        if (rowEls.length === 0) {
          rowEls = Array.from(document.querySelectorAll("[role='row']"));
          cellSel = "[role='cell'], [role='gridcell']";
        }

        const rows = rowEls.map(row => cellsOf(row, cellSel)).filter(cells => cells.length > 0);
        return { headerLabels, rows };
      });
      domRows = evalResult.rows;
      headerLabels = evalResult.headerLabels;
    } catch { domRows = []; headerLabels = []; }

    // Map header labels to column indices, falling back to the fixed
    // positions confirmed from real captured markup
    // (# | Player | MP | G | 7MS | 7MM | YC | 2MIN | BC | RC) if the header
    // row couldn't be read or doesn't contain a label we recognize.
    function colIdx(labels, fallback) {
      const idx = headerLabels.indexOf(labels);
      return idx !== -1 ? idx : fallback;
    }
    const cMP    = colIdx("mp", 2);
    const cGoals = colIdx("g", 3);
    const c7MS   = colIdx("7ms", 4);
    const c7MM   = colIdx("7mm", 5);
    const cYC    = colIdx("yc", 6);
    const c2MIN  = colIdx("2min", 7);
    const cBC    = colIdx("bc", 8);
    const cRC    = colIdx("rc", 9);

    if (pageNum === 1) {
      console.log(`[DBG stats ${leagueId}] headerLabels=${JSON.stringify(headerLabels)}`);
    }
    console.log(`[DBG stats ${leagueId}] page=${pageNum} domRows=${domRows.length} sampleRow0=${JSON.stringify((domRows[0] || []).map(c => c.text))} sampleRow1=${JSON.stringify((domRows[1] || []).map(c => c.text))}`);

    const pageSignature = domRows.map(cells => cells.map(c => c.text).join("\u0001")).join("\u0002");
    if (pageNum > 1 && pageSignature === prevPageSignature) {
      // Site clamped back to the last valid page instead of returning an
      // empty one — same content as the previous page, so stop here.
      break;
    }
    prevPageSignature = pageSignature;

    // Track how many real player rows this page actually had (regardless of
    // the goals>0 filter below) so we know whether to bother fetching the
    // next page — this replaces the old, unreliable "page=N link" detection.
    let realRowsThisPage = 0;

    const seenRowKey = new Set();
    for (const cells of domRows) {
      const texts = cells.map(c => c.text);
      const rowKey = texts.join("\u0001");
      if (seenRowKey.has(rowKey)) continue; // duplicate row (mirrored table) — skip
      let club = cells.find(c => c.alt)?.alt.trim() || "";
      if (!club) {
        const withSrc = cells.find(c => c.src);
        if (withSrc) club = logoMap.get(normalizeLogoSrc(withSrc.src)) || "";
      }
      if (texts.length >= 4 && /^\d+$/.test(texts[0]) && texts[1] && /^\d+$/.test(texts[cGoals])) {
        seenRowKey.add(rowKey);
        realRowsThisPage++;
        const goals = parseInt(texts[cGoals]) || 0;
        if (goals > 0) {
          scorers.push({
            player: texts[1],
            club,
            goals,
            matchesPlayed:     parseInt(texts[cMP])   || 0,
            sevenMScored:       parseInt(texts[c7MS])  || 0,
            sevenMMissed:        parseInt(texts[c7MM])  || 0,
            yellowCards:       parseInt(texts[cYC])   || 0,
            twoMinSuspensions: parseInt(texts[c2MIN]) || 0,
            blueCards:         parseInt(texts[cBC])   || 0,
            redCards:          parseInt(texts[cRC])   || 0,
          });
        }
      }
    }

    // Fallback: old regex-based parser, in case the DOM pass above found
    // nothing (e.g. page.evaluate failed) but the raw HTML still has a
    // parseable <table>. Kept only as a safety net.
    if (domRows.length === 0) {
      const chunks = html.split(/<tr[\s>]/i);
      for (const chunk of chunks) {
        const rowContent = chunk.split(/<\/tr>/i)[0];
        const altM = rowContent.match(/alt="([^"]+)"/i);
        let club = altM ? altM[1].trim() : "";
        if (!club) {
          const srcM = rowContent.match(/<img[^>]*\s(?:data-)?src="([^"]+)"/i);
          if (srcM) club = logoMap.get(normalizeLogoSrc(srcM[1])) || "";
        }
        const cells = [];
        const tdRe  = /<td[^>]*>([\s\S]*?)<\/td>/gi;
        let td;
        while ((td = tdRe.exec(rowContent)) !== null) {
          const text = (td[1] ?? "").replace(/<[^>]+>/g," ").replace(/&amp;/g,"&").replace(/&nbsp;/g," ")
            .replace(/&#39;/g,"'").replace(/&#x27;/g,"'").replace(/&[a-z0-9#]+;/gi," ")
            .replace(/\s+/g," ").trim();
          cells.push(text);
        }
        if (cells.length >= 4 && /^\d+$/.test(cells[0]) && cells[1] && /^\d+$/.test(cells[cGoals])) {
          realRowsThisPage++;
          const goals = parseInt(cells[cGoals]) || 0;
          if (goals > 0) {
            scorers.push({
              player: cells[1],
              club,
              goals,
              matchesPlayed:     parseInt(cells[cMP])   || 0,
              sevenMScored:       parseInt(cells[c7MS])  || 0,
              sevenMMissed:        parseInt(cells[c7MM])  || 0,
              yellowCards:       parseInt(cells[cYC])   || 0,
              twoMinSuspensions: parseInt(cells[c2MIN]) || 0,
              blueCards:         parseInt(cells[cBC])   || 0,
              redCards:          parseInt(cells[cRC])   || 0,
            });
          }
        }
      }
    }

    console.log(`[DBG stats ${leagueId}] page=${pageNum} realRowsThisPage=${realRowsThisPage}`);

    if (realRowsThisPage === 0) break; // no more real player rows — stop paginating

    pageNum++;
  }

  const withClub = scorers.filter(s => s.club).length;
  console.log(`[DBG stats ${leagueId}] clubMatch=${withClub}/${scorers.length} logoMapSize=${logoMap.size}`);

  return scorers.sort((a, b) => b.goals - a.goals);
}

// ── PER-GAME BOXSCORE (lineup page, per-player goals for ONE match) ───────────
// Confirmed live structure (games/{id}/lineup): two separate <table>s, one per
// team, each preceded by a plain-text team-name heading (no logo-matching
// needed here, unlike the season stats page) — same columns as the season
// stats table: # | Player | MP | G | 7MS | 7MM | YC | 2MIN | BC | RC.
// Powers "goals in last game" and the "most goals in a single game" ranking.
async function fetchGameLineup(page, gameId) {
  const url = `https://www.clubee.com/handballbelgium/games/${gameId}/lineup`;
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    try {
      await page.waitForFunction(
        () => document.querySelector("table tr td") !== null,
        { timeout: 15000 }
      );
    } catch { /* timeout — parse whatever's there */ }
  } catch {
    return null; // navigation failed — caller marks this game as failed, retried next run
  }

  let tables;
  try {
    tables = await page.evaluate(() => {
      const out = [];
      for (const table of Array.from(document.querySelectorAll("table"))) {
        // Walk backwards through siblings/ancestors for the nearest bit of
        // real text — that's the team-name heading above this table.
        let teamName = "";
        let el = table.previousElementSibling;
        let hops = 0;
        while (el && hops < 8 && !teamName) {
          const t = (el.textContent || "").replace(/\s+/g, " ").trim();
          if (t && t.length < 80) teamName = t;
          el = el.previousElementSibling;
          hops++;
        }
        if (!teamName) {
          let p = table.parentElement, hops2 = 0;
          while (p && hops2 < 4 && !teamName) {
            const sib = p.previousElementSibling;
            if (sib) {
              const t = (sib.textContent || "").replace(/\s+/g, " ").trim();
              if (t && t.length < 80) teamName = t;
            }
            p = p.parentElement;
            hops2++;
          }
        }
        teamName = teamName.replace(/\s*\([^)]*\)\s*$/, "").trim();

        const headerRow = table.querySelector("thead tr") || table.querySelector("tr[data-is-header='true']");
        const headerLabels = headerRow
          ? Array.from(headerRow.querySelectorAll("th, td")).map(c =>
              (c.textContent || "").replace(/\s+/g, " ").trim().toLowerCase()
            )
          : [];
        // Skip tables that clearly aren't the player-stats table (e.g. a
        // staff/coach list rendered as a <table> too).
        if (!headerLabels.includes("player") && !headerLabels.includes("g")) continue;

        const bodyRows = Array.from(table.querySelectorAll("tbody tr")).map(row =>
          Array.from(row.querySelectorAll("td")).map(td =>
            (td.textContent || "").replace(/\s+/g, " ").trim()
          )
        );
        out.push({ teamName, headerLabels, rows: bodyRows });
      }
      return out;
    });
  } catch {
    return null;
  }

  const players = [];
  for (const t of tables) {
    function colIdx(label, fallback) {
      const idx = t.headerLabels.indexOf(label);
      return idx !== -1 ? idx : fallback;
    }
    const cPlayer = colIdx("player", 1);
    const cMP     = colIdx("mp", 2);
    const cGoals  = colIdx("g", 3);
    const c7MS    = colIdx("7ms", 4);
    const c7MM    = colIdx("7mm", 5);
    const cYC     = colIdx("yc", 6);
    const c2MIN   = colIdx("2min", 7);
    const cBC     = colIdx("bc", 8);
    const cRC     = colIdx("rc", 9);

    for (const cells of t.rows) {
      if (cells.length < 4 || !cells[cPlayer] || !/^\d+$/.test(cells[cGoals] ?? "")) continue;
      const goals = parseInt(cells[cGoals]) || 0;
      players.push({
        player: cells[cPlayer],
        club: t.teamName,
        goals,
        matchesPlayed:     parseInt(cells[cMP])   || 0,
        sevenMScored:       parseInt(cells[c7MS])  || 0,
        sevenMMissed:        parseInt(cells[c7MM])  || 0,
        yellowCards:       parseInt(cells[cYC])   || 0,
        twoMinSuspensions: parseInt(cells[c2MIN]) || 0,
        blueCards:         parseInt(cells[cBC])   || 0,
        redCards:          parseInt(cells[cRC])   || 0,
      });
    }
  }
  return players;
}

// ── VENUE / TRAVEL DISTANCE ─────────────────────────────────────────────────────
// A team's home venue ("sporthal") address is shown on its game pages
// ("Venue" section with a "Show the directions" map link). Both Apple Maps
// and Google Maps directions links use a `daddr=` query param holding the
// plain-text address, regardless of which one the site renders for a given
// browser/locale — matching on that is more robust than trying to pin down
// the exact heading markup, which we can't verify without live access.
async function fetchVenueAddress(page, gameId) {
  const url = `https://www.clubee.com/handballbelgium/games/${gameId}`;
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
  } catch {
    return null;
  }
  let html;
  try { html = await page.content(); } catch { return null; }
  const m = html.match(/daddr=([^"&]+)/i);
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

// ── MAIN ──────────────────────────────────────────────────────────────────────
async function main() {
  log(`Starting at ${new Date().toUTCString()}`);
  log(`${LEAGUES.length} league(s) configured`);

  const fresh = { updatedAt: null, federations: {} };
  const results = [];

  // Boxscore cache: keyed by gameId, persisted to disk and committed
  // alongside vhv-data.json so repeat runs only fetch NEWLY played games
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

      // (debug removed)

      const { fixtures } = parseGamesHtml(gamesHtml, ranking);

      let scorers = [];
      log(`    Fetching stats…`);
      try { scorers = await parseStatsAllPages(page, cfg.id, ranking); } catch {}

      const teams = ranking.map(r => ({
        id: `t_${r.name.replace(/\W+/g,"_").toLowerCase()}`,
        name: r.name, points: 0, homeBonus: "",
      }));

      // Per-game boxscores — only fetch games not already in the cache from
      // a previous run. Powers "goals in last game" on the scorer panel and
      // the "most goals in a single game" player ranking.
      const playedWithGameId = fixtures.filter(f => f.played && f.gameId);
      let newBoxscores = 0, failedBoxscores = 0;
      for (const f of playedWithGameId) {
        if (boxCache.games[f.gameId]) continue;
        const players = await fetchGameLineup(page, f.gameId);
        if (players && players.length > 0) {
          boxCache.games[f.gameId] = { date: f.date, leagueId: cfg.id, players };
          newBoxscores++;
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
          const address = await fetchVenueAddress(page, homeFx.gameId);
          console.log(`[DBG venue] team="${t.name}" gameId=${homeFx.gameId} address=${address ? `"${address}"` : "NOT FOUND"}`);
          if (!address) { venueCache.venues[vk] = { name: t.name, address: null, lat: null, lon: null }; return; }
          const coords = await geocodeAddress(address);
          venueCache.venues[vk] = { name: t.name, address, lat: coords?.lat ?? null, lon: coords?.lon ?? null };
        })();
        inFlightVenueResolutions.set(vk, resolution);
        try { await resolution; } finally { inFlightVenueResolutions.delete(vk); }
      }

      const travelKm = new Array(teams.length).fill(0);
      const playedAway = fixtures.filter(f => f.played && f.homeScore != null && f.awayScore != null);
      for (const f of playedAway) {
        const home = teams[f.homeIdx], away = teams[f.awayIdx];
        if (!home || !away) continue;
        const hv = venueCache.venues[venueKey(home.name)];
        const av = venueCache.venues[venueKey(away.name)];
        if (!hv?.lat || !av?.lat) continue; // venue unresolved for one side — skip this leg
        const pairKey = [venueKey(home.name), venueKey(away.name)].sort().join("|");
        if (venueCache.distances[pairKey] == null) {
          const km = await drivingDistanceKm({ lat: hv.lat, lon: hv.lon }, { lat: av.lat, lon: av.lon });
          console.log(`[DBG travel] ${pairKey} -> ${km != null ? km.toFixed(1) + "km" : "FAILED"}`);
          if (km != null) venueCache.distances[pairKey] = km;
        }
        const dist = venueCache.distances[pairKey];
        if (dist != null) travelKm[f.awayIdx] += dist;
      }
      const travelRanking = teams
        .map((t, i) => ({ id: t.id, name: t.name, km: Math.round(travelKm[i]) }))
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
    const { cfg, ranking, fixtures, teams, scorers, topSingleGamePlayers, travelRanking, played, pending } = r;
    if (!fresh.federations[cfg.federation]) fresh.federations[cfg.federation] = {};
    fresh.federations[cfg.federation][cfg.id] = {
      serieId: cfg.id, name: cfg.name, federation: cfg.federation,
      division: cfg.division, updatedAt: new Date().toISOString(),
      live: pending > 0, teams, fixtures, ranking, scorers,
      topSingleGamePlayers: topSingleGamePlayers || [],
      travelRanking: travelRanking || [],
    };
    results.push({ id: cfg.id, name: cfg.name, ok: true, teams: teams.length, fixtures: fixtures.length, played, pending, scorers: scorers.length });
  }

  await context.close();

  await browser.close();

  fresh.updatedAt = new Date().toISOString();
  fs.writeFileSync(vhvDataPath, JSON.stringify(fresh, null, 2));

  fs.writeFileSync(boxscoreCachePath, JSON.stringify(boxCache, null, 2));
  const totalCached = Object.keys(boxCache.games).length;
  log(`Boxscore cache: ${totalCached} game(s) total (was ${cachedGameCount} before this run)`);

  fs.writeFileSync(venueCachePath, JSON.stringify(venueCache, null, 2));
  const unresolvedVenues = Object.values(venueCache.venues).filter(v => v.lat == null).length;
  log(`Venue cache: ${Object.keys(venueCache.venues).length} venue(s), ${Object.keys(venueCache.distances).length} distance(s) total, ${unresolvedVenues} still unresolved (budget spent this run: ${20 - venueResolutionBudget}/20)`);

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
