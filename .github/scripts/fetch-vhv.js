// .github/scripts/fetch-vhv.js
// Fetches Belgian handball data from Clubee (clubee.com/handballbelgium).
// All URLs use seasons/0 = current season (auto-updates each year).
// Standings: /standings-371073v4/leagues/ID/seasons/0
// Games:     /games-371075v4/leagues/ID/seasons/0
// Stats:     /stats-371072v4/leagues/ID/seasons/0
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
  { id: "18744", name: "Promo Brabant Men", federation: "LFH", division: "Seniors",
    standingsUrl: "https://www.clubee.com/handballbelgium/standings-371073v4/leagues/18744/seasons/0",
    gamesUrl:     "https://www.clubee.com/handballbelgium/games-371075v4/leagues/18744/seasons/0",
    statsUrl:     "https://www.clubee.com/handballbelgium/stats-371072v4/leagues/18744/seasons/0" },
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

async function fetchHtml(url) {
  const r = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
    },
  });
  if (!r.ok) throw new Error(`HTTP ${r.status} for ${url}`);
  return r.text();
}

// ── STANDINGS PARSER ──────────────────────────────────────────────────────────
// Split on <tr to handle multiline <tr class="..."\n> tags from Next.js
function parseStandings(html) {
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
        .replace(/&amp;/g,"&").replace(/&nbsp;/g," ")
        .replace(/&#39;/g,"'").replace(/&#x27;/g,"'")
        .replace(/&lt;/g,"<").replace(/&gt;/g,">")
        .replace(/\s+/g," ").trim();
      cells.push(text);
    }
    // Columns: # | Club | MP | W | D | L | GS | GA | GD | Pts | (action)
    if (cells.length >= 9 && /^\d+\.?$/.test(cells[0])) {
      rows.push({
        pos:    parseInt(cells[0]),
        name:   cells[1].replace(/\(Senior [A-Z]\)/g,"").trim(),
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

// ── STATS PARSER (top scorers) ─────────────────────────────────────────────────
// Stats page: /stats-371072v4/leagues/ID/seasons/0
// Table columns: Rank | Player | Club | Goals (+ possibly more)
// Returns [] if page says "No information added yet"
function parseStats(html) {
  if (html.includes("No information added yet")) return [];
  const scorers = [];
  const chunks  = html.split(/<tr[\s>]/i);
  for (const chunk of chunks) {
    const rowContent = chunk.split(/<\/tr>/i)[0];
    const cells = [];
    const tdRe  = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    let td;
    while ((td = tdRe.exec(rowContent)) !== null) {
      const text = td[1]
        .replace(/<[^>]+>/g," ")
        .replace(/&amp;/g,"&").replace(/&nbsp;/g," ")
        .replace(/&#39;/g,"'").replace(/&#x27;/g,"'")
        .replace(/\s+/g," ").trim();
      cells.push(text);
    }
    // Expect: rank | player name | club | goals (at minimum 4 cells)
    if (cells.length >= 4 && /^\d+\.?$/.test(cells[0])) {
      const goals = parseInt(cells[cells.length - 1]);
      if (!isNaN(goals) && cells[1] && cells[2]) {
        scorers.push({ player: cells[1], club: cells[2], goals });
      }
    }
  }
  return scorers;
}

// ── GAMES PARSER ──────────────────────────────────────────────────────────────
function parseGames(html, ranking) {
  const teamNames = ranking.map(r => r.name);
  const fixtures  = [];
  let counter     = 0;

  // Split on <h3> tags (gameday headers: <h3...>Gameday N</h3>)
  const sections = html.split(/<h3[^>]*>/i);

  for (const section of sections) {
    const gdMatch = section.match(/Gameday\s+(\d+)/i);
    const round   = gdMatch ? parseInt(gdMatch[1]) : 0;

    const linkRe = /<a[^>]+href="[^"]*\/games\/(\d+)"[^>]*>([\s\S]*?)<\/a>/gi;
    let m;
    while ((m = linkRe.exec(section)) !== null) {
      const gameId  = m[1];
      const content = m[2].replace(/<[^>]+>/g," ").replace(/\s+/g," ").trim();

      const dateMatch  = content.match(/(\d{2})\.(\d{2})\.(\d{4})/);
      const date       = dateMatch ? `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}` : null;
      const scoreMatch = content.match(/\b(\d{1,3})\s*[-–]\s*(\d{1,3})\b/);
      const homeScore  = scoreMatch ? parseInt(scoreMatch[1]) : null;
      const awayScore  = scoreMatch ? parseInt(scoreMatch[2]) : null;
      const played     = homeScore !== null && awayScore !== null;

      let stripped = content
        .replace(/\d{2}\.\d{2}\.\d{4}/,"")
        .replace(/\b\d{1,2}:\d{2}\b/,"")
        .replace(/\b\d{1,3}\s*[-–]\s*\d{1,3}\b/,"")
        .replace(/\(Senior [A-Z]\)/g,"")
        .replace(/\s+/g," ").trim();

      let homeIdx = -1, awayIdx = -1;
      for (let i = 0; i < teamNames.length; i++) {
        if (stripped.toLowerCase().startsWith(teamNames[i].toLowerCase())) {
          const rest = stripped.slice(teamNames[i].length).trim();
          const ai   = teamNames.findIndex(t => rest.toLowerCase() === t.toLowerCase() || rest.toLowerCase().endsWith(t.toLowerCase()));
          if (ai >= 0) { homeIdx = i; awayIdx = ai; break; }
        }
      }
      if ((homeIdx < 0 || awayIdx < 0) && stripped) {
        const parts = stripped.split(/\s{2,}/);
        if (parts.length >= 2) {
          const h = parts[0].trim(), a = parts[parts.length-1].trim();
          if (h && !teamNames.includes(h)) teamNames.push(h);
          if (a && !teamNames.includes(a)) teamNames.push(a);
          homeIdx = teamNames.indexOf(h);
          awayIdx = teamNames.indexOf(a);
        }
      }
      if (homeIdx < 0 || awayIdx < 0 || homeIdx === awayIdx) continue;

      fixtures.push({
        id: `f${counter++}`, gameId, homeIdx, awayIdx,
        homeWin: 50, draw: 6, awayWin: 44,
        overrideOn: false, ovHW: "", ovD: "", ovAW: "",
        played,
        homeScore: played ? homeScore : null,
        awayScore: played ? awayScore : null,
        week: round, date,
      });
    }
  }

  const teams = teamNames.map(name => ({
    id: `t_${name.replace(/\W+/g,"_").toLowerCase()}`,
    name, points: 0, homeBonus: "",
  }));

  return { teams, fixtures };
}

// ── MAIN ──────────────────────────────────────────────────────────────────────
async function main() {
  log(`Starting at ${new Date().toUTCString()}`);
  log(`${LEAGUES.length} league(s) configured`);

  const fresh = { updatedAt: null, federations: {} };
  const results = [];

  for (const cfg of LEAGUES) {
    log(`\n${cfg.federation} · ${cfg.name} (${cfg.id})`);
    try {
      log(`  Fetching standings, games, stats…`);
      const [standingsHtml, gamesHtml, statsHtml] = await Promise.all([
        fetchHtml(cfg.standingsUrl),
        fetchHtml(cfg.gamesUrl),
        fetchHtml(cfg.statsUrl).catch(() => ""),
      ]);

      const ranking             = parseStandings(standingsHtml);
      const { teams, fixtures } = parseGames(gamesHtml, ranking);
      const scorers             = parseStats(statsHtml);

      log(`  Teams: ${ranking.length} | Fixtures: ${fixtures.length} | Scorers: ${scorers.length}`);
      if (ranking.length > 0) log(`  ${ranking.slice(0,3).map(r=>r.name).join(", ")}…`);

      const played  = fixtures.filter(f => f.played).length;
      const pending = fixtures.filter(f => !f.played).length;

      if (ranking.length === 0 && fixtures.length === 0) {
        throw new Error("No data parsed — page may be empty or structure changed");
      }

      if (!fresh.federations[cfg.federation]) fresh.federations[cfg.federation] = {};
      fresh.federations[cfg.federation][cfg.id] = {
        serieId:    cfg.id,
        name:       cfg.name,
        federation: cfg.federation,
        division:   cfg.division,
        updatedAt:  new Date().toISOString(),
        live:       pending > 0,
        teams,
        fixtures,
        ranking,
        scorers,
      };

      results.push({ id: cfg.id, name: cfg.name, ok: true, teams: teams.length, fixtures: fixtures.length, played, pending, scorers: scorers.length });

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
    log(`  ✓ ${r.name}: ${r.teams} teams, ${r.fixtures} fx (${r.played}/${r.pending}), ${r.scorers} scorers`)
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
