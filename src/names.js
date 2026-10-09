// Team and club name helpers.

// Strip common handball club prefixes to get the meaningful part (usually city name)
const CLUB_PREFIXES = /^(handbalclub|handbal|hbc|hc|khc|ktsv|hv|shc|ehc|kh|hvv|sezoens|besox|derdaele|db|uilenspiegel|olse)\s+/i;

export function stripPrefix(name) {
  return name.replace(CLUB_PREFIXES, "").replace(CLUB_PREFIXES, "").trim().toLowerCase();
}

// ── DISPLAY-ONLY TEAM NAME CLEANUP ─────────────────────────────────────────────
// VHV/LFH import data appends division/gender/federation/region/pool codes to
// team names, e.g. "Sint-Truiden D1 M VHV LIM 2" or "Uilenspiegel D1 M VHV 1".
// Strip those trailing code tokens for DISPLAY ONLY — never for the stored
// `name` used for matching, keys, or editing, since scorer-alias matching and
// the team editor need the exact original string.
//
// A trailing token is treated as a "code" (not part of the real club name) if
// it's made up solely of uppercase letters/digits (optionally with a
// "-X" suffix like "LIM-B"), e.g. "VHV", "D1", "M", "W", "U16", "1", "A" — or
// the literal "Lg" (mixed-case federation abbreviation). Real club-name words
// almost always contain a lowercase letter (Tournai, Overpelt, 't Noorden),
// so they stop the strip as soon as one is reached. We always keep at least
// one token, so a name can never be stripped down to nothing.
const TEAM_CODE_TOKEN = /^[A-Z0-9]+(-[A-Z0-9]+)?$/;

export function cleanTeamName(name) {
  if (!name) return name;
  // Drop a trailing parenthetical annotation entirely, e.g. "(M14-Beker)".
  const noParen = name.trim().replace(/\s*\([^)]*\)\s*$/, "");
  const tokens = (noParen || name.trim()).split(/\s+/);
  let end = tokens.length;
  while (end > 1) {
    const tok = tokens[end - 1];
    if (TEAM_CODE_TOKEN.test(tok) || tok === "Lg") { end--; continue; }
    break;
  }
  const cleaned = tokens.slice(0, end).join(" ").trim();
  return cleaned || name;
}

// Build a lookup from scorer club names indexed by their stripped form
// Called once per scorer list
export function buildClubIndex(scorers) {
  const index = {}; // stripped -> original club name
  for (const s of (scorers || [])) {
    const stripped = stripPrefix(s.club);
    if (!index[stripped]) index[stripped] = s.club;
  }
  return index;
}

export function resolveClubName(leagueSimName, aliases, clubIndex) {
  // 1. Explicit alias takes priority
  if (aliases && aliases[leagueSimName] && aliases[leagueSimName].trim()) return aliases[leagueSimName].trim();
  // 2. Exact match
  if (!clubIndex) return leagueSimName;
  if (clubIndex[leagueSimName]) return leagueSimName; // already exact
  // 3. Fuzzy: strip prefix from leaguesim name, find matching scorer club
  const stripped = stripPrefix(leagueSimName);
  if (clubIndex[stripped]) return clubIndex[stripped];
  // 4. Partial: check if stripped leaguesim name is contained in any scorer club stripped name or vice versa
  for (const [scorerStripped, scorerClub] of Object.entries(clubIndex)) {
    if (scorerStripped.includes(stripped) || stripped.includes(scorerStripped)) {
      return scorerClub;
    }
  }
  return leagueSimName;
}

