// NL / FR / EN support. English text is the key.
const { useState, useEffect } = React;

// ── LANGUAGE (NL / FR / EN) ───────────────────────────────────────────────────
// English text is the key; missing translations fall back to English. Covers the
// Belgian Handball screens (My teams, picker, league tabs, tables, players, cards).
const LANG_KEY = "leaguesim.lang.v1";
export const LANGS = ["nl", "fr", "en"];
export const LANG_LOCALE = { nl: "nl-BE", fr: "fr-BE", en: "en-GB" };
const I18N = {
  nl: {
    "Belgian Handball": "Belgisch handbal", "Live competition data": "Live competitiegegevens", "updated": "bijgewerkt",
    "← Back": "← Terug", "← All Leagues": "← Alle reeksen", "⌂ Home": "⌂ Start", "Back to My teams and all leagues": "Terug naar mijn teams en alle reeksen",
    "Loading data…": "Gegevens laden…", "Could not load data.": "Kon de gegevens niet laden.",
    "★ My teams": "★ Mijn teams", "＋ Add club": "＋ Club toevoegen",
    "Open any league and tap ☆ next to a team to follow it. Your teams show up here, with position, form and next match.": "Open een reeks en tik op ☆ naast een team om het te volgen. Je teams verschijnen hier met positie, vorm en volgende wedstrijd.",
    "Main team": "Hoofdteam", "Make main": "Maak hoofdteam", "Next": "Volgende", "No upcoming game": "Geen volgende wedstrijd", "vs": "tegen", "at": "bij",
    "pts": "ptn", "This week · all my teams": "Deze week · al mijn teams",
    "Select a federation above to browse leagues.": "Kies hierboven een federatie om reeksen te bekijken.",
    "No competition data fetched yet — run the fetch-vhv workflow first.": "Nog geen competitiegegevens opgehaald — voer eerst de fetch-vhv workflow uit.",
    "No leagues available yet for": "Nog geen reeksen beschikbaar voor", "teams": "teams", "team": "team", "played": "gespeeld", "pending": "te spelen",
    "Which club do you follow?": "Welke club volg je?", "Skip": "Overslaan", "Search": "Zoek in", "clubs": "clubs", "No club found.": "Geen club gevonden.",
    "Type to search all clubs.": "Typ om alle clubs te doorzoeken.", "Choose the teams to follow. You can change this any time with ☆ in a table.": "Kies de teams die je wilt volgen. Je kan dit altijd aanpassen met ☆ in een klassement.",
    "Follow selected": "Volg geselecteerde",
    "Table": "Klassement", "Games": "Wedstrijden", "Players": "Spelers", "Cards & suspensions": "Kaarten & schorsingen", "Simulator": "Simulator", "Sim settings": "Sim-instellingen",
    "Team": "Team", "Form": "Vorm", "🗓 Games last week": "🗓 Wedstrijden vorige week", "⏭ Games this week": "⏭ Wedstrijden deze week",
    "No games last week.": "Geen wedstrijden vorige week.", "No games this week.": "Geen wedstrijden deze week.",
    "Click a team name for match details": "Klik op een teamnaam voor details", "☆ follows a team (saved on this device)": "☆ volgt een team (bewaard op dit toestel)",
    "All goals": "Alle doelpunten", "Excl. 7m": "Zonder 7m", "7m only": "Enkel 7m", "Top Scorers": "Topschutters", "Goals excluding 7m": "Doelpunten zonder 7m", "7m goals": "7m-doelpunten",
    "Search player…": "Speler zoeken…", "All clubs": "Alle clubs", "No players match.": "Geen spelers gevonden.", "Show all": "Toon alle", "Show less": "Toon minder", "Player": "Speler", "Club": "Club", "loading…": "laden…", "unavailable": "niet beschikbaar", "No scorer data found.": "Geen schuttersgegevens gevonden.",
    "7m details aren't published for this league, so only total goals are shown.": "Voor deze reeks zijn geen 7m-gegevens beschikbaar, dus enkel het totaal aantal doelpunten wordt getoond.",
    "Teams": "Teams", "Players with most suspensions": "Spelers met de meeste schorsingen",
    "No cards or suspensions published for this league (lower divisions usually don't have this data).": "Voor deze reeks zijn geen kaarten of schorsingen beschikbaar (lagere reeksen hebben deze gegevens meestal niet).",
    "2' = two-minute suspension · a blue card is a red card with a written report": "2' = twee minuten schorsing · een blauwe kaart is een rode kaart met schriftelijk rapport",
    "Goal model: home win / draw / away win chance, expected score": "Doelpuntenmodel: kans op thuiszege / gelijk / uitzege, verwachte score",
  },
  fr: {
    "Belgian Handball": "Handball belge", "Live competition data": "Données de compétition en direct", "updated": "mis à jour",
    "← Back": "← Retour", "← All Leagues": "← Toutes les séries", "⌂ Home": "⌂ Accueil", "Back to My teams and all leagues": "Retour à mes équipes et à toutes les séries",
    "Loading data…": "Chargement des données…", "Could not load data.": "Impossible de charger les données.",
    "★ My teams": "★ Mes équipes", "＋ Add club": "＋ Ajouter un club",
    "Open any league and tap ☆ next to a team to follow it. Your teams show up here, with position, form and next match.": "Ouvrez une série et touchez ☆ à côté d'une équipe pour la suivre. Vos équipes apparaissent ici avec position, forme et prochain match.",
    "Main team": "Équipe principale", "Make main": "Définir comme principale", "Next": "Prochain", "No upcoming game": "Aucun match à venir", "vs": "contre", "at": "à",
    "pts": "pts", "This week · all my teams": "Cette semaine · toutes mes équipes",
    "Select a federation above to browse leagues.": "Choisissez une fédération ci-dessus pour parcourir les séries.",
    "No competition data fetched yet — run the fetch-vhv workflow first.": "Aucune donnée récupérée — lancez d'abord le workflow fetch-vhv.",
    "No leagues available yet for": "Aucune série disponible pour", "teams": "équipes", "team": "équipe", "played": "joués", "pending": "à jouer",
    "Which club do you follow?": "Quel club suivez-vous ?", "Skip": "Passer", "Search": "Rechercher parmi", "clubs": "clubs", "No club found.": "Aucun club trouvé.",
    "Type to search all clubs.": "Tapez pour chercher parmi tous les clubs.", "Choose the teams to follow. You can change this any time with ☆ in a table.": "Choisissez les équipes à suivre. Modifiable à tout moment avec ☆ dans un classement.",
    "Follow selected": "Suivre la sélection",
    "Table": "Classement", "Games": "Matchs", "Players": "Joueurs", "Cards & suspensions": "Cartons & suspensions", "Simulator": "Simulateur", "Sim settings": "Paramètres sim.",
    "Team": "Équipe", "Form": "Forme", "🗓 Games last week": "🗓 Matchs de la semaine dernière", "⏭ Games this week": "⏭ Matchs de cette semaine",
    "No games last week.": "Aucun match la semaine dernière.", "No games this week.": "Aucun match cette semaine.",
    "Click a team name for match details": "Cliquez sur une équipe pour les détails", "☆ follows a team (saved on this device)": "☆ suit une équipe (enregistré sur cet appareil)",
    "All goals": "Tous les buts", "Excl. 7m": "Hors 7m", "7m only": "7m seulement", "Top Scorers": "Meilleurs buteurs", "Goals excluding 7m": "Buts hors 7m", "7m goals": "Buts sur 7m",
    "Search player…": "Rechercher un joueur…", "All clubs": "Tous les clubs", "No players match.": "Aucun joueur trouvé.", "Show all": "Tout afficher", "Show less": "Afficher moins", "Player": "Joueur", "Club": "Club", "loading…": "chargement…", "unavailable": "indisponible", "No scorer data found.": "Aucune donnée de buteurs.",
    "7m details aren't published for this league, so only total goals are shown.": "Les données de 7m ne sont pas publiées pour cette série ; seul le total de buts est affiché.",
    "Teams": "Équipes", "Players with most suspensions": "Joueurs les plus suspendus",
    "No cards or suspensions published for this league (lower divisions usually don't have this data).": "Aucun carton ni suspension publié pour cette série (les séries inférieures n'ont généralement pas ces données).",
    "2' = two-minute suspension · a blue card is a red card with a written report": "2' = suspension de deux minutes · un carton bleu est un carton rouge avec rapport écrit",
    "Goal model: home win / draw / away win chance, expected score": "Modèle de buts : chances de victoire domicile / nul / victoire extérieur, score attendu",
  },
};
function detectLang() {
  try {
    const saved = localStorage.getItem(LANG_KEY);
    if (LANGS.includes(saved)) return saved;
  } catch {}
  const nav = (typeof navigator !== "undefined" && (navigator.language || "") || "").slice(0, 2).toLowerCase();
  return LANGS.includes(nav) ? nav : "en";
}
const langListeners = new Set();
export function useLang() {
  const [lang, setLangState] = useState(detectLang);
  useEffect(() => { langListeners.add(setLangState); return () => { langListeners.delete(setLangState); }; }, []);
  const setLang = l => { try { localStorage.setItem(LANG_KEY, l); } catch {} langListeners.forEach(fn => fn(l)); };
  const t = key => (I18N[lang] && I18N[lang][key]) || key;
  return { lang, setLang, t };
}
export function LangSwitch() {
  const { lang, setLang } = useLang();
  return (
    <div role="group" aria-label="Language" style={{ display: "inline-flex", gap: ".15rem" }}>
      {LANGS.map(l => (
        <button key={l} aria-pressed={lang === l} className={"btn" + (lang === l ? "" : " btn-ghost")}
          style={{ fontSize: ".7rem", padding: ".2rem .5rem", minWidth: "2.2rem" }} onClick={() => setLang(l)}>{l.toUpperCase()}</button>
      ))}
    </div>
  );
}

