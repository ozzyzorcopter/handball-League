const { useState, useMemo, useRef, useEffect } = React;
const MEDALS = ["🥇", "🥈", "🥉"];
const IS_SHARE = false; // set to true in share version

// ── SAVE / LOAD ──────────────────────────────────────────────────────────────
function saveData(data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement("a"), { href: url, download: "leaguesim-data.json" });
  a.click();
  URL.revokeObjectURL(url);
}

function loadData() {
  return new Promise((resolve, reject) => {
    const input = Object.assign(document.createElement("input"), { type: "file", accept: ".json" });
    input.onchange = () => {
      const reader = new FileReader();
      reader.onload = e => {
        try { resolve(JSON.parse(e.target.result)); }
        catch { reject("Invalid file"); }
      };
      reader.readAsText(input.files[0]);
    };
    input.click();
  });
}

// ── SCORER DATA ──────────────────────────────────────────────────────────────
const SCORER_JSON_URL = "https://ozzyzorcopter.github.io/handball-League/scorer-data.json";

let scorerDataCache = null;
let scorerDataPromise = null;

function fetchScorerData() {
  if (scorerDataCache) return Promise.resolve(scorerDataCache);
  if (scorerDataPromise) return scorerDataPromise;
  scorerDataPromise = fetch(SCORER_JSON_URL)
    .then(r => { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
    .then(data => { scorerDataCache = data; return data; })
    .catch(e => { scorerDataPromise = null; throw e; });
  return scorerDataPromise;
}

// Strip common handball club prefixes to get the meaningful part (usually city name)
const CLUB_PREFIXES = /^(handbalclub|handbal|hbc|hc|khc|ktsv|hv|shc|ehc|kh|hvv|sezoens|besox|derdaele|db|uilenspiegel|olse)\s+/i;

function stripPrefix(name) {
  return name.replace(CLUB_PREFIXES, "").replace(CLUB_PREFIXES, "").trim().toLowerCase();
}

// Build a lookup from scorer club names indexed by their stripped form
// Called once per scorer list
function buildClubIndex(scorers) {
  const index = {}; // stripped -> original club name
  for (const s of (scorers || [])) {
    const stripped = stripPrefix(s.club);
    if (!index[stripped]) index[stripped] = s.club;
  }
  return index;
}

function resolveClubName(leagueSimName, aliases, clubIndex) {
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

function useScorers(leagueId, phase) {
  const [scorers, setScorers] = useState(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    if (!leagueId) { setScorers([]); return; }
    setScorers(null);
    setError(false);
    fetchScorerData()
      .then(data => {
        const ph = phase || "regular";
        const league = (data.leagues || []).find(l =>
          (l.phase || "regular") === ph &&
          (l.leagueId === leagueId || l.name === leagueId)
        );
        setScorers(league ? league.scorers : []);
      })
      .catch(() => { setError(true); setScorers([]); });
  }, [leagueId, phase]);
  return { scorers, error };
}


function ScorerPanel({ scorers, error, filterClub, title, maxRows = 10, aliases }) {
  const [expanded, setExpanded] = useState(false);
  const loading = scorers === null;

  const clubIndex = useMemo(() => buildClubIndex(scorers), [scorers]);

  const filtered = useMemo(() => {
    if (!scorers) return [];
    if (!filterClub) return scorers;
    const club = resolveClubName(filterClub, aliases, clubIndex);
    return scorers.filter(s => s.club === club);
  }, [scorers, filterClub, aliases, clubIndex]);

  const shown = expanded ? filtered : filtered.slice(0, maxRows);
  const collapsible = !loading && filtered.length > maxRows;

  return (
    <div className="mini-box" style={{ marginTop: "1rem" }}>
      <div className="mini-ttl" style={{ color: "#fbbf24", marginBottom: ".6rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span>⚽ {title || "Top Scorers"}</span>
        <div style={{ display: "flex", gap: ".4rem", alignItems: "center" }}>
          {loading && <span className="muted" style={{ fontSize: ".7rem", fontWeight: 400 }}>loading…</span>}
          {error && <span style={{ color: "#f87171", fontSize: ".7rem", fontWeight: 400 }}>unavailable</span>}
          {collapsible && (
            <button className="btn-ghost" style={{ fontSize: ".72rem", padding: ".2rem .6rem" }} onClick={() => setExpanded(e => !e)}>
              {expanded ? "▲" : "▼ " + filtered.length}
            </button>
          )}
        </div>
      </div>
      {!loading && !error && filtered.length === 0 && (
        <div className="muted" style={{ fontSize: ".78rem" }}>No scorer data found.</div>
      )}
      {shown.map((s, i) => (
        <div key={i} className="mini-row">
          <span className="mini-pos" style={{ minWidth: "1.8rem", color: i < 3 ? "#fbbf24" : "#3a3f50" }}>{i < 3 ? ["🥇","🥈","🥉"][i] : (i+1)+"."}</span>
          <span className="mini-name" style={{ flex: 1 }}>{s.player}</span>
          {!filterClub && <span className="muted" style={{ fontSize: ".68rem", marginRight: ".4rem" }}>{s.club}</span>}
          <span className="mini-val" style={{ color: "#fbbf24" }}>{s.goals}</span>
          {s.delta != null && (
            <span style={{ fontSize: ".68rem", marginLeft: ".3rem", color: s.delta > 0 ? "#4ade80" : "#5a6070" }}>
              ({s.delta > 0 ? "+" : ""}{s.delta})
            </span>
          )}
          {s.matchesPlayed > 0 && (
            <span className="muted" style={{ fontSize: ".66rem", marginLeft: ".4rem", whiteSpace: "nowrap" }}>
              {s.matchesPlayed}g · {s.avg != null ? s.avg + "/g" : "—"}
            </span>
          )}
        </div>
      ))}
      {collapsible && (
        <div style={{ marginTop: ".4rem", textAlign: "center" }}>
          <button className="btn-ghost" style={{ fontSize: ".72rem", padding: ".2rem .6rem" }} onClick={() => setExpanded(e => !e)}>
            {expanded ? "Show less ▲" : "Show all " + filtered.length + " ▼"}
          </button>
        </div>
      )}
    </div>
  );
}


function defaultSettings() {
  return { baseWin: 47, baseDraw: 6, homeBonus: 10, rankBonus: 3, winScore: 30, lossScore: 25, drawScore: 25 };
}

function makeTeam(index) {
  return { id: "t" + Date.now() + index, name: "Team " + (index + 1), points: 0, homeBonus: "" };
}

function makeLeague(name, type, poSize, pdSize, phaseFormat, archivable = false) {
  return {
    id: String(Date.now()), name, type: type || "standard",
    teams: [makeTeam(0)], fixtures: [], step: 0,
    settings: defaultSettings(),
    playoffs: null, playdowns: null,
    poSize: poSize || 6,
    pdSize: pdSize || 4,
    phaseFormat: phaseFormat || "round-robin",
    promoTop: 2,
    demotBot: 2,
    archivable,
    scorerUrl: "",
    playoffScorerUrl: "",
    playdownScorerUrl: "",
    scorerAliases: {},
  };
}

// ── TOURNAMENT GENERATOR ──────────────────────────────────────────────────────
// nearestPow2GTE(n): smallest power of 2 >= n
function nearestPow2GTE(n) { let p = 1; while (p < n) p *= 2; return p; }

// Generate tournament bracket data structure.
// Returns { teams, rounds } where rounds is an array of round objects.
// Each round has { label, type:"winners"|"losers"|"final", matches:[...] }
// Each match: { id, leg:1|2|null, homeRef, awayRef, neutral, played, homeScore, awayScore,
//               overrideOn, ovHW, ovD, ovAW }
// homeRef/awayRef: { type:"team"|"winner"|"loser", teamIdx, matchId, legMatchId }
function generateTournament(sourceStats, settings, isPlaydown) {
  let ctr = 0;
  const mid = () => "tm" + (ctr++);

  const n = sourceStats.length;
  // Teams indexed 0..n-1, rank 0 = highest (best in regular season)
  const phTeams = sourceStats.map(r => ({ id: r.id, name: r.name, points: r.startingPts, homeBonus: "" }));

  // Nearest power of 2 >= n, byes go to highest seeds
  const bracketSize = nearestPow2GTE(n);
  const numByes = bracketSize - n;
  // Seeds with bye: indices 0..numByes-1 (top seeds skip round 1)
  // Seeds in round 1: indices numByes..n-1, paired highest vs lowest
  // e.g. n=6, bracketSize=8, numByes=2: teams 2,3,4,5 play R1
  // Pairs: (2 vs 5), (3 vs 4)
  const r1Teams = [];
  for (let i = numByes; i < n; i++) r1Teams.push(i); // [2,3,4,5] for n=6
  // Pair highest vs lowest of r1Teams
  const r1Pairs = [];
  let lo = 0, hi = r1Teams.length - 1;
  while (lo < hi) { r1Pairs.push([r1Teams[lo], r1Teams[hi]]); lo++; hi--; }

  const rounds = [];

  // Round 1: two-legged duels (neutral)
  if (r1Pairs.length > 0) {
    const r1Matches = [];
    r1Pairs.forEach(([seedA, seedB]) => {
      const legAId = mid(), legBId = mid();
      // Leg 1: seedA home (but neutral = no home bonus)
      const p1 = calcProbsNeutral(seedA, seedB, phTeams, settings);
      const p2 = calcProbsNeutral(seedB, seedA, phTeams, settings);
      r1Matches.push({ id: legAId, leg: 1, duelId: legAId, homeRef: { type: "team", teamIdx: seedA }, awayRef: { type: "team", teamIdx: seedB }, neutral: true, played: false, homeScore: null, awayScore: null, homeWin: p1.homeWin, draw: p1.draw, awayWin: p1.awayWin, overrideOn: false, ovHW: "", ovD: "", ovAW: "", pairedLegId: legBId });
      r1Matches.push({ id: legBId, leg: 2, duelId: legAId, homeRef: { type: "team", teamIdx: seedB }, awayRef: { type: "team", teamIdx: seedA }, neutral: true, played: false, homeScore: null, awayScore: null, homeWin: p2.homeWin, draw: p2.draw, awayWin: p2.awayWin, overrideOn: false, ovHW: "", ovD: "", ovAW: "", pairedLegId: legAId });
    });
    rounds.push({ id: mid(), label: "Round 1", type: "r1", matches: r1Matches });
  }

  // Build subsequent rounds
  // After R1: winners of each duel + bye teams all move forward
  // Bye teams: indices 0..numByes-1
  // Winners from R1 duels: referenced as { type:"duel_winner", duelId }
  // Total in next round: numByes + r1Pairs.length = bracketSize/2
  // Continue until 1 match remains (the final)

  let prevRoundRefs = []; // refs to participants in next round, ordered by seed
  // Insert byes (top seeds) interleaved with r1 winners
  // Seeding order: seed0(bye), seed1(bye), ..., winner(pair0), winner(pair1), ...
  for (let i = 0; i < numByes; i++) prevRoundRefs.push({ type: "team", teamIdx: i, seed: i });
  r1Pairs.forEach(([seedA, seedB], pi) => {
    const duelId = rounds[0]?.matches[pi * 2]?.duelId || ("d" + pi);
    prevRoundRefs.push({ type: "duel_winner", duelId, seed: numByes + pi });
  });

  // Winners bracket rounds
  let roundNum = 2;
  while (prevRoundRefs.length > 1) {
    const matches = [];
    const nextRefs = [];
    // Pair: highest seed vs lowest seed of current round
    const refs = [...prevRoundRefs];
    let lo2 = 0, hi2 = refs.length - 1;
    while (lo2 < hi2) {
      const mId = mid();
      const homeRef = refs[lo2]; // higher seed = home
      const awayRef = refs[hi2];
      const p = { homeWin: 50, draw: 0, awayWin: 50 }; // TBD until teams known
      matches.push({ id: mId, leg: null, homeRef, awayRef, neutral: false, played: false, homeScore: null, awayScore: null, homeWin: p.homeWin, draw: p.draw, awayWin: p.awayWin, overrideOn: false, ovHW: "", ovD: "", ovAW: "", tbd: true });
      nextRefs.push({ type: "winner", matchId: mId, seed: lo2 });
      lo2++; hi2--;
    }
    const isFinal = prevRoundRefs.length === 2;
    const label = isFinal ? "Final" : prevRoundRefs.length === 4 ? "Semi-finals" : "Round " + roundNum;
    rounds.push({ id: mid(), label, type: isFinal ? "final" : "winners", matches });
    prevRoundRefs = nextRefs;
    roundNum++;
  }

  if (isPlaydown) {
    // Add losers bracket
    // Losers from R1 duels
    let loserRefs = [];
    r1Pairs.forEach(([seedA, seedB], pi) => {
      const duelId = rounds[0]?.matches[pi * 2]?.duelId || ("d" + pi);
      loserRefs.push({ type: "duel_loser", duelId, seed: numByes + pi });
    });
    // Also losers from winners bracket rounds (except final)
    rounds.filter(r => r.type === "winners").forEach(r => {
      r.matches.forEach(m => { loserRefs.push({ type: "loser", matchId: m.id, seed: loserRefs.length }); });
    });

    // Build loser bracket: highest seeded loser vs lowest
    let lRoundNum = 1;
    let lRefs = loserRefs.slice(0, Math.max(2, r1Pairs.length));
    while (lRefs.length > 1) {
      const lMatches = [];
      const lNext = [];
      let ll = 0, lh = lRefs.length - 1;
      while (ll < lh) {
        const mId = mid();
        lMatches.push({ id: mId, leg: null, homeRef: lRefs[ll], awayRef: lRefs[lh], neutral: false, played: false, homeScore: null, awayScore: null, homeWin: 50, draw: 0, awayWin: 50, overrideOn: false, ovHW: "", ovD: "", ovAW: "", tbd: true, losersBracket: true });
        lNext.push({ type: "winner", matchId: mId, seed: ll });
        ll++; lh--;
      }
      const label = lRefs.length === 2 ? "Losers Final" : "Losers Round " + lRoundNum;
      rounds.push({ id: mid(), label, type: "losers", matches: lMatches });
      lRefs = lNext;
      lRoundNum++;
    }
  }

  return { teams: phTeams, rounds };
}

// calcProbsNeutral: like calcProbs but homeBonus = 0 (neutral ground)
function calcProbsNeutral(homeIdx, awayIdx, teams, settings) {
  const neutralSettings = { ...settings, homeBonus: 0 };
  // Also override per-team homeBonus
  const neutralTeams = teams.map(t => ({ ...t, homeBonus: "" }));
  return calcProbs(homeIdx, awayIdx, neutralTeams, [], neutralSettings);
}

// Resolve a ref to a team index given current match results
// Returns teamIdx or null if not yet known
function resolveRef(ref, teams, rounds) {
  if (!ref) return null;
  if (ref.type === "team") return ref.teamIdx;
  if (ref.type === "duel_winner" || ref.type === "duel_loser") {
    // Find the two legs of this duel
    const leg1 = rounds.flatMap(r => r.matches).find(m => m.duelId === ref.duelId && m.leg === 1);
    const leg2 = rounds.flatMap(r => r.matches).find(m => m.duelId === ref.duelId && m.leg === 2);
    if (!leg1 || !leg2 || !leg1.played || !leg2.played) return null;
    // leg1: homeIdx=seedA vs awayIdx=seedB. Goals for seedA = leg1.homeScore + leg2.awayScore
    const seedA = resolveRef(leg1.homeRef, teams, rounds);
    const seedB = resolveRef(leg1.awayRef, teams, rounds);
    const goalsA = (+leg1.homeScore || 0) + (+leg2.awayScore || 0);
    const goalsB = (+leg1.awayScore || 0) + (+leg2.homeScore || 0);
    if (goalsA > goalsB) return ref.type === "duel_winner" ? seedA : seedB;
    if (goalsB > goalsA) return ref.type === "duel_winner" ? seedB : seedA;
    // Tied: use tiebreaker — higher seed (lower index) wins
    const winner = seedA < seedB ? seedA : seedB;
    const loser  = seedA < seedB ? seedB : seedA;
    return ref.type === "duel_winner" ? winner : loser;
  }
  if (ref.type === "winner" || ref.type === "loser") {
    const match = rounds.flatMap(r => r.matches).find(m => m.id === ref.matchId);
    if (!match || !match.played) return null;
    const hIdx = resolveRef(match.homeRef, teams, rounds);
    const aIdx = resolveRef(match.awayRef, teams, rounds);
    const hg = +match.homeScore, ag = +match.awayScore;
    if (hg > ag) return ref.type === "winner" ? hIdx : aIdx;
    if (ag > hg) return ref.type === "winner" ? aIdx : hIdx;
    const winner = hIdx < aIdx ? hIdx : aIdx;
    const loser  = hIdx < aIdx ? aIdx : hIdx;
    return ref.type === "winner" ? winner : loser;
  }
  return null;
}

// ── FIXTURE GENERATOR ────────────────────────────────────────────────────────
// Generates a 2-round robin: each pair plays twice (A hosts B, B hosts A).
// n teams → n*(n-1) fixtures total.
function makeFixtures(teams, settings) {
  const n = teams.length;
  let counter = 0;
  const id = () => "f" + (counter++);
  const fixtures = [];
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const p1 = calcProbs(i, j, teams, [], settings);
      const p2 = calcProbs(j, i, teams, [], settings);
      fixtures.push({ id: id(), homeIdx: i, awayIdx: j, homeWin: p1.homeWin, draw: p1.draw, awayWin: p1.awayWin, overrideOn: false, ovHW: "", ovD: "", ovAW: "", played: false, homeScore: null, awayScore: null, week: null });
      fixtures.push({ id: id(), homeIdx: j, awayIdx: i, homeWin: p2.homeWin, draw: p2.draw, awayWin: p2.awayWin, overrideOn: false, ovHW: "", ovD: "", ovAW: "", played: false, homeScore: null, awayScore: null, week: null });
    }
  }
  return fixtures;
}

// ── STATS ─────────────────────────────────────────────────────────────────────
// Always uses full tiebreaker chain.
function calcStats(teams, fixtures) {
  const played = fixtures.filter(f => f.played && f.homeScore != null && f.awayScore != null);
  const s = {};
  teams.forEach(t => { s[t.id] = { id: t.id, name: t.name, basePts: t.points, P: 0, W: 0, D: 0, L: 0, GF: 0, GA: 0 }; });
  played.forEach(f => {
    const hg = +f.homeScore, ag = +f.awayScore;
    if (isNaN(hg) || isNaN(ag)) return;
    const h = s[teams[f.homeIdx]?.id], a = s[teams[f.awayIdx]?.id];
    if (!h || !a) return;
    h.P++; a.P++; h.GF += hg; h.GA += ag; a.GF += ag; a.GA += hg;
    if (hg > ag) { h.W++; a.L++; } else if (hg < ag) { a.W++; h.L++; } else { h.D++; a.D++; }
  });
  const rows = Object.values(s).map(r => ({ ...r, GD: r.GF - r.GA, totalPts: r.basePts + r.W * 2 + r.D }));

  function h2h(ids) {
    const h = {};
    ids.forEach(id => { h[id] = { pts: 0, GF: 0, GA: 0, awayGF: 0 }; });
    played.forEach(f => {
      const hid = teams[f.homeIdx]?.id, aid = teams[f.awayIdx]?.id;
      if (!ids.includes(hid) || !ids.includes(aid)) return;
      const hg = +f.homeScore, ag = +f.awayScore;
      if (isNaN(hg) || isNaN(ag)) return;
      if (hg > ag) { h[hid].pts += 2; } else if (hg < ag) { h[aid].pts += 2; } else { h[hid].pts++; h[aid].pts++; }
      h[hid].GF += hg; h[hid].GA += ag; h[aid].GF += ag; h[aid].GA += hg;
      h[aid].awayGF += ag;
    });
    return h;
  }

  return rows.sort((a, b) => {
    if (b.totalPts !== a.totalPts) return b.totalPts - a.totalPts;
    const ids = rows.filter(r => r.totalPts === a.totalPts).map(r => r.id);
    const hh = h2h(ids);
    const ha = hh[a.id], hb = hh[b.id];
    if (b.W !== a.W) return b.W - a.W;
    if (hb.pts !== ha.pts) return hb.pts - ha.pts;
    const gdA = ha.GF - ha.GA, gdB = hb.GF - hb.GA;
    if (gdB !== gdA) return gdB - gdA;
    if (hb.awayGF !== ha.awayGF) return hb.awayGF - ha.awayGF;
    if (b.GD !== a.GD) return b.GD - a.GD;
    return a.name.localeCompare(b.name);
  });
}

// ── PROB CALC ─────────────────────────────────────────────────────────────────
function calcProbs(homeIdx, awayIdx, teams, fixtures, settings) {
  const { baseWin, baseDraw, rankBonus } = settings;
  const ht = teams[homeIdx], at = teams[awayIdx];
  const hBonus = (ht && ht.homeBonus !== "" && ht.homeBonus != null) ? parseFloat(ht.homeBonus) || 0 : settings.homeBonus;
  const table = calcStats(teams, fixtures);
  const homeRow = table.find(r => r.id === ht?.id);
  const awayRow = table.find(r => r.id === at?.id);
  const hp = table.indexOf(homeRow);
  const ap = table.indexOf(awayRow);
  let gap = 0;
  if (homeRow && awayRow && homeRow.totalPts !== awayRow.totalPts) {
    const hGrp = table.map((r, i) => r.totalPts === homeRow.totalPts ? i : -1).filter(i => i >= 0);
    const aGrp = table.map((r, i) => r.totalPts === awayRow.totalPts ? i : -1).filter(i => i >= 0);
    gap = hp < ap ? Math.min(...aGrp) - Math.max(...hGrp) : Math.max(...aGrp) - Math.min(...hGrp);
  }
  const shift = gap * rankBonus;
  let hw = Math.max(0, Math.min(100 - baseDraw, baseWin + hBonus + shift));
  let aw = 100 - baseDraw - hw;
  if (aw < 0) { hw += aw; aw = 0; }
  return { homeWin: Math.round(hw), draw: Math.round(baseDraw), awayWin: Math.max(0, Math.round(aw)) };
}

// ── MONTE CARLO ───────────────────────────────────────────────────────────────
function runMC(teams, pending, played) {
  // played: array of already-confirmed fixtures with homeScore/awayScore
  const n = teams.length, SIMS = 100000;
  const hits = teams.map(() => new Array(n).fill(0));

  // Pre-compute wins and h2h points from already-played fixtures
  const basePts   = teams.map(t => t.points);  // already includes earned pts
  const baseWins  = new Array(n).fill(0);
  const baseH2H   = Array.from({ length: n }, () => new Array(n).fill(0));
  (played || []).forEach(f => {
    const hi = f.homeIdx, ai = f.awayIdx;
    const hg = +f.homeScore, ag = +f.awayScore;
    if (isNaN(hg) || isNaN(ag)) return;
    if (hg > ag) { baseWins[hi]++; baseH2H[hi][ai] += 2; }
    else if (hg < ag) { baseWins[ai]++; baseH2H[ai][hi] += 2; }
    else { baseH2H[hi][ai]++; baseH2H[ai][hi]++; }
  });

  for (let s = 0; s < SIMS; s++) {
    const pts   = basePts.slice();
    const wins  = baseWins.slice();
    const h2h   = baseH2H.map(row => row.slice()); // deep copy per sim

    for (const f of pending) {
      const r = Math.random() * 100;
      const hi = f.homeIdx, ai = f.awayIdx;
      if (r < f.homeWin) {
        pts[hi] += 2; wins[hi]++;
        h2h[hi][ai] += 2;
      } else if (r < f.homeWin + f.draw) {
        pts[hi]++; pts[ai]++;
        h2h[hi][ai]++; h2h[ai][hi]++;
      } else {
        pts[ai] += 2; wins[ai]++;
        h2h[ai][hi] += 2;
      }
    }

    // Sort with tiebreakers: pts → wins → h2h pts among full tied group → random
    const entries = pts.map((p, i) => ({ p, i, w: wins[i], rnd: Math.random() }));
    entries.sort((a, b) => {
      if (b.p !== a.p) return b.p - a.p;
      if (b.w !== a.w) return b.w - a.w;
      // Sum h2h points earned against ALL teams tied on same points
      const tiedIdxs = entries.filter(e => e.p === a.p).map(e => e.i);
      const sumA = tiedIdxs.reduce((s, j) => s + (j !== a.i ? h2h[a.i][j] : 0), 0);
      const sumB = tiedIdxs.reduce((s, j) => s + (j !== b.i ? h2h[b.i][j] : 0), 0);
      if (sumB !== sumA) return sumB - sumA;
      return a.rnd - b.rnd;
    });
    entries.forEach(({ i }, rank) => { hits[i][rank]++; });
  }
  return hits.map(row => row.map(v => (v / SIMS) * 100));
}

// ── HELPERS ───────────────────────────────────────────────────────────────────
function heatColor(v) {
  if (v < 0.01) return "transparent";
  const t = Math.min(v / 55, 1);
  return "rgba(" + Math.round(30 + t * 220) + "," + Math.round(180 - t * 120) + "," + Math.round(120 - t * 70) + "," + (0.12 + t * 0.78) + ")";
}

function fmtPct(v) {
  if (v < 0.001) return "";
  if (v < 0.1) return "<0.1%";
  return v.toFixed(1) + "%";
}

function fixProbs(f, teams, fixtures, settings) {
  if (f.overrideOn && f.ovHW !== "") return { homeWin: parseFloat(f.ovHW) || 0, draw: parseFloat(f.ovD) || 0, awayWin: parseFloat(f.ovAW) || 0 };
  return calcProbs(f.homeIdx, f.awayIdx, teams, fixtures, settings);
}

// ── SETTINGS PANEL ────────────────────────────────────────────────────────────
function SettingsPanel({ settings, onChange, showTiebreakers, league, onLeagueChange, readOnly }) {
  const pf = [
    { k: "baseWin",   l: "Base Win %",      n: "Starting win % per side" },
    { k: "baseDraw",  l: "Base Draw %",      n: "Fixed, never adjusted" },
    { k: "homeBonus", l: "Global Home %",    n: "Used if no team override" },
    { k: "rankBonus", l: "Rank Gap % / pos", n: "Per effective position gap" },
  ];
  const sf = [
    { k: "winScore",  l: "Win score",  n: "Goals for winner" },
    { k: "lossScore", l: "Loss score", n: "Goals for loser" },
    { k: "drawScore", l: "Draw score", n: "Goals each side" },
  ];
  return (
    <div>
      <div className="sbox">
        <div className="sub-ttl">Probability settings</div>
        <div className="sgrid" style={{ gridTemplateColumns: "1fr 1fr 1fr 1fr" }}>
          {pf.map(({ k, l, n }) => (
            <div key={k} className="sfield">
              <span className="lbl">{l}</span>
              <input className="sinp" type="number" min="0" max="100" value={settings[k] || 0} onChange={e => onChange(k, parseFloat(e.target.value) || 0)} />
              <span className="snote">{n}</span>
            </div>
          ))}
        </div>
        <hr className="sdivider" />
        <div className="sub-ttl">Quick result scores</div>
        <div className="sgrid" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
          {sf.map(({ k, l, n }) => (
            <div key={k} className="sfield">
              <span className="lbl">{l}</span>
              <input className="sinp" type="number" min="0" value={settings[k] || 0} onChange={e => onChange(k, parseFloat(e.target.value) || 0)} />
              <span className="snote">{n}</span>
            </div>
          ))}
        </div>
      </div>
      {league && league.type !== "playoff" && onLeagueChange && (
        <div className="sbox">
          <div className="sub-ttl">Highlight zones</div>
          <div className="config-row" style={{ marginBottom: ".6rem" }}>
            <span style={{ fontSize: ".82rem", color: "#4ade80", minWidth: "140px" }}>Promotion (top):</span>
            <div className="config-opts">
              {[0,1,2,3,4].map(n => (
                <span key={n} className={"config-opt" + ((league.promoTop ?? 2) === n ? " sel" : "")}
                  style={(league.promoTop ?? 2) === n ? { borderColor: "#4ade80", background: "rgba(74,222,128,.1)", color: "#4ade80" } : {}}
                  onClick={() => onLeagueChange(lg => ({ ...lg, promoTop: n }))}>{n}</span>
              ))}
            </div>
          </div>
          <div className="config-row">
            <span style={{ fontSize: ".82rem", color: "#f87171", minWidth: "140px" }}>Relegation (bottom):</span>
            <div className="config-opts">
              {[0,1,2,3,4].map(n => (
                <span key={n} className={"config-opt" + ((league.demotBot ?? 2) === n ? " sel" : "")}
                  style={(league.demotBot ?? 2) === n ? { borderColor: "#f87171", background: "rgba(248,113,113,.1)", color: "#f87171" } : {}}
                  onClick={() => onLeagueChange(lg => ({ ...lg, demotBot: n }))}>{n}</span>
              ))}
            </div>
          </div>
        </div>
      )}
      {showTiebreakers && league && onLeagueChange && !readOnly && (
        <div className="sbox">
          <div className="sub-ttl">Scorer data</div>
          <div style={{ marginBottom: ".75rem" }}>
            <div style={{ fontSize: ".78rem", color: "#5a6070", marginBottom: ".35rem" }}>Regular season scorer URL</div>
            <input
              className="inp"
              value={league.scorerUrl || ""}
              onChange={e => onLeagueChange(lg => ({ ...lg, scorerUrl: e.target.value.trim() }))}
              placeholder="https://admin.handballbelgium.be/...?organization=VHV&serie=655"
              style={{ fontSize: ".78rem", padding: ".4rem .6rem" }}
            />
          </div>
          {league.type === "playoff" && (
            <>
              <div style={{ marginBottom: ".75rem" }}>
                <div style={{ fontSize: ".78rem", color: "#5a6070", marginBottom: ".35rem" }}>Play-off scorer URL</div>
                <input
                  className="inp"
                  value={league.playoffScorerUrl || ""}
                  onChange={e => onLeagueChange(lg => ({ ...lg, playoffScorerUrl: e.target.value.trim() }))}
                  placeholder="https://admin.handballbelgium.be/...?organization=VHV&serie=869"
                  style={{ fontSize: ".78rem", padding: ".4rem .6rem" }}
                />
              </div>
              <div style={{ marginBottom: ".75rem" }}>
                <div style={{ fontSize: ".78rem", color: "#5a6070", marginBottom: ".35rem" }}>Play-down scorer URL</div>
                <input
                  className="inp"
                  value={league.playdownScorerUrl || ""}
                  onChange={e => onLeagueChange(lg => ({ ...lg, playdownScorerUrl: e.target.value.trim() }))}
                  placeholder="https://admin.handballbelgium.be/...?organization=VHV&serie=870"
                  style={{ fontSize: ".78rem", padding: ".4rem .6rem" }}
                />
              </div>
            </>
          )}
          <div>
            <div style={{ fontSize: ".78rem", color: "#5a6070", marginBottom: ".35rem" }}>Team name aliases (leaguesim name → scorer club name)</div>
            {(league.teams || []).map(t => (
              <div key={t.id} className="config-row" style={{ marginBottom: ".4rem", alignItems: "center" }}>
                <span style={{ fontSize: ".75rem", color: "#cdd6f4", minWidth: "140px", flexShrink: 0 }}>{t.name}</span>
                <span style={{ fontSize: ".75rem", color: "#5a6070", margin: "0 .4rem" }}>→</span>
                <input
                  className="sinp"
                  value={(league.scorerAliases || {})[t.name] || ""}
                  onChange={e => onLeagueChange(lg => ({ ...lg, scorerAliases: { ...(lg.scorerAliases || {}), [t.name]: e.target.value } }))}
                  placeholder={t.name}
                  style={{ flex: 1, fontSize: ".75rem" }}
                />
              </div>
            ))}
            <div style={{ fontSize: ".7rem", color: "#3a3f50", marginTop: ".4rem" }}>Leave blank if the name already matches the scorer data exactly.</div>
          </div>
        </div>
      )}
      {showTiebreakers && (
        <div className="sbox">
          <div className="sub-ttl">End-of-season tiebreakers (always applied)</div>
          <ul className="tb-list">
            {[
              "Most wins overall",
              "Most points in head-to-head matches among tied teams",
              "Best goal difference in those head-to-head matches",
              "Most goals scored as away team in tied opponents home fixtures",
              "Best overall goal difference",
              "Alphabetical (final fallback)",
            ].map((tb, i) => (
              <li key={i}><span className="tb-num">{i + 1}.</span>{tb}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ── HOME SCREEN ───────────────────────────────────────────────────────────────
function HomeScreen({ leagues, onOpen, onCreate, onDelete, onToggleArchivable, onOpenArchive, onOpenBelgian }) {
  const [modal, setModal] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState("standard");
  const [poSize, setPoSize] = useState(6);
  const [pdSize, setPdSize] = useState(4);
  const [phaseFormat, setPhaseFormat] = useState("round-robin");
  const [customPo, setCustomPo] = useState("");
  const [customPd, setCustomPd] = useState("");
  const [archivable, setArchivable] = useState(false);
  const effPoSize = customPo !== "" ? (parseInt(customPo) || 6) : poSize;
  const effPdSize = customPd !== "" ? (parseInt(customPd) || 4) : pdSize;

  function submit() {
    if (!name.trim()) return;
    onCreate(name.trim(), type, effPoSize, effPdSize, phaseFormat, archivable);
    setName(""); setType("standard"); setPoSize(6); setPdSize(4);
    setPhaseFormat("round-robin"); setCustomPo(""); setCustomPd(""); setArchivable(false);
    setModal(false);
  }

  return (
    <div>
      <div className="card-grid">
        {leagues.map(lg => (
          <div key={lg.id} className="card" style={{ position: "relative" }} onClick={() => onOpen(lg.id)}>
            <button className="card-del" onClick={e => { e.stopPropagation(); onDelete(lg.id); }}>✕</button>
            <div className={"card-badge " + (lg.type === "playoff" ? "badge-po" : "badge-std")}>
              {lg.type === "playoff" ? "Play-off League" : "Standard League"}
            </div>
            <div className="card-name">{lg.name}</div>
            <div className="card-meta">
              {(lg.teams || []).length} teams · {(lg.fixtures || []).filter(f => !f.played).length} pending · {(lg.fixtures || []).filter(f => f.played).length} played
              {lg.vhvLive && (
                <span style={{ display: "inline-block", marginLeft: ".4rem", fontSize: ".65rem", fontWeight: 700, color: "#4ade80", border: "1px solid #4ade80", borderRadius: "3px", padding: ".05rem .3rem", letterSpacing: ".04em" }}>● LIVE</span>
              )}
              {lg.type === "playoff" && (() => {
                const poPlayed = (lg.playoffs?.fixtures || []).filter(f => f.played).length;
                const poPending = (lg.playoffs?.fixtures || []).filter(f => !f.played).length;
                const pdPlayed = (lg.playdowns?.fixtures || []).filter(f => f.played).length;
                const pdPending = (lg.playdowns?.fixtures || []).filter(f => !f.played).length;
                const poNotGen = !lg.playoffs;
                const pdNotGen = !lg.playdowns;
                return (
                  <span>
                    {" · "}
                    <span style={{ color: poNotGen ? "#f87171" : poPending > 0 ? "#facc15" : "#4ade80" }}>
                      PO: {poNotGen ? "not generated" : poPending > 0 ? poPending + " pending" : "done"}
                    </span>
                    {" · "}
                    <span style={{ color: pdNotGen ? "#f87171" : pdPending > 0 ? "#facc15" : "#4ade80" }}>
                      PD: {pdNotGen ? "not generated" : pdPending > 0 ? pdPending + " pending" : "done"}
                    </span>
                  </span>
                );
              })()}
            </div>
            <button
              className={"card-archive-btn" + (lg.archivable ? " active" : "")}
              title={lg.archivable ? "Tagged for archive — click to remove" : "Tag for archive"}
              onClick={e => { e.stopPropagation(); onToggleArchivable(lg.id); }}>
              📦
            </button>
          </div>
        ))}
        {!IS_SHARE && <div className="card card-new" onClick={() => setModal(true)}>+ New League</div>}
        <div className="card card-new" style={{ borderColor: "#4ade80", color: "#4ade80" }} onClick={onOpenBelgian}>🇧🇪 Belgian Handball</div>
        <div className="card card-new" style={{ borderColor: "#fbbf24", color: "#fbbf24" }} onClick={onOpenArchive}>📦 Archive</div>
      </div>

      {modal && (
        <div className="overlay-c" onClick={() => setModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>New League</h3>
            <input className="inp" autoFocus value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.key === "Enter" && submit()} placeholder="League name" style={{ marginBottom: ".85rem" }} />
            <div className="type-cards">
              <div className={"type-card" + (type === "standard" ? " sel" : "")} onClick={() => setType("standard")}>
                <div className="type-card-title">Standard</div>
                <div className="type-card-desc">Regular season only. Top 2 promoted, bottom 2 relegated.</div>
              </div>
              <div className={"type-card" + (type === "playoff" ? " sel po" : "")} onClick={() => setType("playoff")}>
                <div className="type-card-title">Play-off</div>
                <div className="type-card-desc">Regular season with post-season phases.</div>
              </div>
            </div>
            {type === "playoff" && (
              <div className="phase-config" style={{ marginTop: ".75rem" }}>
                <div className="phase-config-title">Phase configuration</div>
                <div className="config-row">
                  <span className="config-label">Play-off teams:</span>
                  <div className="config-opts">
                    {[4, 6, 8].map(n => <span key={n} className={"config-opt" + (poSize === n && customPo === "" ? " sel" : "")} onClick={() => { setPoSize(n); setCustomPo(""); }}>{n}</span>)}
                    <input className="config-inp" type="number" min="2" placeholder="Other" value={customPo} onChange={e => setCustomPo(e.target.value)} style={{ width: "4.5rem" }} />
                  </div>
                </div>
                <div className="config-row">
                  <span className="config-label">Play-down teams:</span>
                  <div className="config-opts">
                    {[2, 4, 6].map(n => <span key={n} className={"config-opt" + (pdSize === n && customPd === "" ? " sel" : "")} onClick={() => { setPdSize(n); setCustomPd(""); }}>{n}</span>)}
                    <input className="config-inp" type="number" min="2" placeholder="Other" value={customPd} onChange={e => setCustomPd(e.target.value)} style={{ width: "4.5rem" }} />
                  </div>
                </div>
                <div className="config-row">
                  <span className="config-label">Format:</span>
                  <div className="config-opts">
                    <span className={"config-opt" + (phaseFormat === "round-robin" ? " sel" : "")} onClick={() => setPhaseFormat("round-robin")}>2-Round Robin</span>
                    <span className={"config-opt" + (phaseFormat === "tournament" ? " sel" : "")} onClick={() => setPhaseFormat("tournament")}>Tournament</span>
                  </div>
                </div>
              </div>
            )}
            <div className="config-row" style={{ marginTop: ".85rem" }}>
              <span className="config-label">Include in archive:</span>
              <div className="config-opts">
                <span className={"config-opt" + (archivable ? " active" : "")}
                  style={archivable ? { borderColor: "#fbbf24", background: "rgba(251,191,36,.1)", color: "#fbbf24" } : {}}
                  onClick={() => setArchivable(a => !a)}>
                  📦 {archivable ? "Yes" : "No"}
                </span>
              </div>
            </div>
            <div className="modal-btns">
              <button className="btn btn-cyan" onClick={submit} disabled={!name.trim()}>Create</button>
              <button className="btn btn-ghost" onClick={() => setModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── TEAM DETAIL PANEL ─────────────────────────────────────────────────────────
function TeamDetail({ team, teamIdx, teams, fixtures, onClose, leagueId, aliases, archiveScorers, phase }) {
  const mine = fixtures.filter(f => f.homeIdx === teamIdx || f.awayIdx === teamIdx);

  const sorted = [...mine].sort((a, b) => {
    const wa = a.week ?? 99999, wb = b.week ?? 99999;
    return wa - wb;
  });

  // Compute home/away stats from played fixtures
  const homePlayed = mine.filter(f => f.homeIdx === teamIdx && f.played && f.homeScore != null);
  const awayPlayed = mine.filter(f => f.awayIdx === teamIdx && f.played && f.homeScore != null);

  const homeWins  = homePlayed.filter(f => +f.homeScore > +f.awayScore).length;
  const awayWins  = awayPlayed.filter(f => +f.awayScore > +f.homeScore).length;
  const homeWinPct = homePlayed.length ? Math.round(homeWins / homePlayed.length * 100) : null;
  const awayWinPct = awayPlayed.length ? Math.round(awayWins / awayPlayed.length * 100) : null;

  const avgFmt = (arr, fn) => arr.length ? (arr.reduce((s, f) => s + fn(f), 0) / arr.length).toFixed(1) : null;
  const homeGFavg  = avgFmt(homePlayed, f => +f.homeScore);
  const homeGAavg  = avgFmt(homePlayed, f => +f.awayScore);
  const awayGFavg  = avgFmt(awayPlayed, f => +f.awayScore);
  const awayGAavg  = avgFmt(awayPlayed, f => +f.homeScore);

  function resColor(f) {
    const home = f.homeIdx === teamIdx;
    const hg = +f.homeScore, ag = +f.awayScore;
    if (hg === ag) return "#facc15";
    return (home ? hg > ag : ag > hg) ? "#4ade80" : "#f87171";
  }

  function HaBadge({ isHome }) {
    const col = isHome ? "#22d3ee" : "#a78bfa";
    const bg = isHome ? "rgba(34,211,238,.1)" : "rgba(167,139,250,.1)";
    return (
      <span className="ha-badge" style={{ color: col, background: bg, border: "1px solid " + col }}>
        {isHome ? "HOME" : "AWAY"}
      </span>
    );
  }

  const hasStats = homePlayed.length > 0 || awayPlayed.length > 0;

  // Toughest/weakest opponent — GD vs each opponent across all played games
  const oppStats = (() => {
    const byOpp = {};
    mine.filter(f => f.played && f.homeScore != null).forEach(f => {
      const isHome = f.homeIdx === teamIdx;
      const oppIdx = isHome ? f.awayIdx : f.homeIdx;
      const oppName = teams[oppIdx]?.name || "Unknown";
      const gf = isHome ? +f.homeScore : +f.awayScore;
      const ga = isHome ? +f.awayScore : +f.homeScore;
      if (!byOpp[oppName]) byOpp[oppName] = { gf: 0, ga: 0, games: 0 };
      byOpp[oppName].gf += gf;
      byOpp[oppName].ga += ga;
      byOpp[oppName].games++;
    });
    return Object.entries(byOpp).map(([name, s]) => ({ name, gd: s.gf - s.ga, gf: s.gf, ga: s.ga, games: s.games }));
  })();
  const toughest = oppStats.length > 0 ? oppStats.reduce((a, b) => a.gd < b.gd ? a : b) : null;
  const weakest  = oppStats.length > 1 ? oppStats.reduce((a, b) => a.gd > b.gd ? a : b) : null;

  // Best and worst individual fixtures by GD for selected team
  const playedWithScore = mine.filter(f => f.played && f.homeScore != null);
  const fixtureGD = playedWithScore.map(f => {
    const isHome = f.homeIdx === teamIdx;
    const gf = isHome ? +f.homeScore : +f.awayScore;
    const ga = isHome ? +f.awayScore : +f.homeScore;
    const opp = isHome ? teams[f.awayIdx]?.name : teams[f.homeIdx]?.name;
    return { f, gd: gf - ga, gf, ga, opp, isHome };
  });

  // Worst: lowest GD, tie-broken by lowest GF first
  const worstGD = fixtureGD.length > 0 ? Math.min(...fixtureGD.map(x => x.gd)) : null;
  const worstFixtures = worstGD != null
    ? fixtureGD.filter(x => x.gd === worstGD).sort((a, b) => a.gf - b.gf)
    : [];

  // Best: highest GD, tie-broken by highest GF first
  const bestGD = fixtureGD.length > 0 ? Math.max(...fixtureGD.map(x => x.gd)) : null;
  const bestFixtures = bestGD != null
    ? fixtureGD.filter(x => x.gd === bestGD).sort((a, b) => b.gf - a.gf)
    : [];

  function StatRow({ label, homeVal, awayVal, color }) {
    return (
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: ".3rem", padding: ".28rem 0", borderBottom: "1px solid #1c1f27", fontSize: ".78rem", alignItems: "center" }}>
        <span style={{ fontFamily: "DM Mono,monospace", fontSize: ".68rem", color: "#5a6070" }}>{label}</span>
        <span style={{ textAlign: "center", fontFamily: "DM Mono,monospace", fontWeight: 600, color: homeVal != null ? color : "#3a3f50" }}>{homeVal != null ? homeVal : "—"}</span>
        <span style={{ textAlign: "center", fontFamily: "DM Mono,monospace", fontWeight: 600, color: awayVal != null ? color : "#3a3f50" }}>{awayVal != null ? awayVal : "—"}</span>
      </div>
    );
  }

  return (
    <>
      <div className="detail-overlay" onClick={onClose} />
      <div className="detail-panel">
        <div className="detail-h">
          <h3>{team?.name}</h3>
          <button className="detail-close" onClick={onClose}>✕</button>
        </div>

        <div className="detail-cols" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", alignItems: "start" }}>

          {/* Left column: stats */}
          <div>
            <div className="detail-sec" style={{ marginBottom: ".5rem" }}>Statistics</div>
            {!hasStats && <div className="muted" style={{ fontSize: ".8rem" }}>No played games yet.</div>}
            {hasStats && (
              <div>
                {/* Header row */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: ".3rem", padding: ".2rem 0", marginBottom: ".15rem" }}>
                  <span></span>
                  <span style={{ textAlign: "center", fontFamily: "DM Mono,monospace", fontSize: ".65rem", color: "#22d3ee", fontWeight: 700 }}>HOME</span>
                  <span style={{ textAlign: "center", fontFamily: "DM Mono,monospace", fontSize: ".65rem", color: "#a78bfa", fontWeight: 700 }}>AWAY</span>
                </div>
                <StatRow label="Games" homeVal={homePlayed.length || null} awayVal={awayPlayed.length || null} color="#d4d8e0" />
                <StatRow label="Win %" homeVal={homeWinPct != null ? homeWinPct + "%" : null} awayVal={awayWinPct != null ? awayWinPct + "%" : null} color="#4ade80" />
                <StatRow label="Avg GF" homeVal={homeGFavg} awayVal={awayGFavg} color="#4ade80" />
                <StatRow label="Avg GA" homeVal={homeGAavg} awayVal={awayGAavg} color="#f87171" />
                {(toughest || weakest) && (
                  <div style={{ marginTop: ".6rem", borderTop: "1px solid #1c1f27", paddingTop: ".45rem" }}>
                    {oppStats.length > 0 && (() => {
                      const [oppOpen, setOppOpen] = useState(false);
                      const sorted = [...oppStats].sort((a, b) => a.gd - b.gd);
                      return (
                        <div>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: ".25rem 0", cursor: "pointer", userSelect: "none" }}
                            onClick={() => setOppOpen(o => !o)}>
                            <span style={{ fontFamily: "DM Mono,monospace", fontSize: ".68rem", color: "#5a6070" }}>
                              Opponents {oppOpen ? "▲" : "▼"}
                            </span>
                            {!oppOpen && toughest && (
                              <span style={{ fontSize: ".78rem" }}>
                                <span style={{ color: "#f87171", fontWeight: 600 }}>{toughest.name}</span>
                                <span style={{ fontFamily: "DM Mono,monospace", fontSize: ".7rem", color: "#3a3f50", marginLeft: ".3rem" }}>{toughest.gd > 0 ? "+" : ""}{toughest.gd}</span>
                                {weakest && weakest.name !== toughest.name && (
                                  <span style={{ marginLeft: ".5rem" }}>
                                    <span style={{ color: "#4ade80", fontWeight: 600 }}>{weakest.name}</span>
                                    <span style={{ fontFamily: "DM Mono,monospace", fontSize: ".7rem", color: "#3a3f50", marginLeft: ".3rem" }}>{weakest.gd > 0 ? "+" : ""}{weakest.gd}</span>
                                  </span>
                                )}
                              </span>
                            )}
                          </div>
                          {oppOpen && (
                            <div style={{ borderTop: "1px solid #1c1f27", paddingTop: ".25rem" }}>
                              {sorted.map((o, i) => (
                                <div key={o.name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: ".2rem 0", borderBottom: i < sorted.length-1 ? "1px solid #1c1f27" : "none" }}>
                                  <span style={{ fontFamily: "DM Mono,monospace", fontSize: ".65rem", color: "#3a3f50", minWidth: "1.4rem" }}>{i+1}.</span>
                                  <span style={{ flex: 1, fontSize: ".78rem", color: o.gd < 0 ? "#f87171" : o.gd > 0 ? "#4ade80" : "#d4d8e0", fontWeight: 600 }}>{o.name}</span>
                                  <span style={{ fontFamily: "DM Mono,monospace", fontSize: ".72rem", color: "#3a3f50" }}>{o.gd > 0 ? "+" : ""}{o.gd} GD</span>
                                  <span style={{ fontFamily: "DM Mono,monospace", fontSize: ".68rem", color: "#3a3f50", marginLeft: ".35rem" }}>({o.games}g)</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                )}
                {(bestFixtures.length > 0 || worstFixtures.length > 0) && (
                  <div style={{ marginTop: ".6rem", borderTop: "1px solid #1c1f27", paddingTop: ".45rem" }}>
                    {bestFixtures.map((x, i) => (
                      <div key={x.f.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: ".22rem 0", borderBottom: i < bestFixtures.length - 1 ? "1px solid #1c1f27" : "none" }}>
                        {i === 0 && <span style={{ fontFamily: "DM Mono,monospace", fontSize: ".68rem", color: "#5a6070", minWidth: "3rem" }}>Best</span>}
                        {i > 0 && <span style={{ minWidth: "3rem" }} />}
                        <span style={{ flex: 1, fontSize: ".78rem", color: "#4ade80", fontWeight: 600 }}>{x.opp}</span>
                        <span style={{ fontFamily: "DM Mono,monospace", fontSize: ".75rem", color: "#4ade80" }}>{x.gf}—{x.ga}</span>
                        <span style={{ fontFamily: "DM Mono,monospace", fontSize: ".7rem", color: "#3a3f50", marginLeft: ".4rem" }}>{x.gd > 0 ? "+" : ""}{x.gd}</span>
                      </div>
                    ))}
                    {worstFixtures.map((x, i) => (
                      <div key={x.f.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: ".22rem 0", borderBottom: i < worstFixtures.length - 1 ? "1px solid #1c1f27" : "none", marginTop: bestFixtures.length > 0 && i === 0 ? ".35rem" : 0 }}>
                        {i === 0 && <span style={{ fontFamily: "DM Mono,monospace", fontSize: ".68rem", color: "#5a6070", minWidth: "3rem" }}>Worst</span>}
                        {i > 0 && <span style={{ minWidth: "3rem" }} />}
                        <span style={{ flex: 1, fontSize: ".78rem", color: "#f87171", fontWeight: 600 }}>{x.opp}</span>
                        <span style={{ fontFamily: "DM Mono,monospace", fontSize: ".75rem", color: "#f87171" }}>{x.gf}—{x.ga}</span>
                        <span style={{ fontFamily: "DM Mono,monospace", fontSize: ".7rem", color: "#3a3f50", marginLeft: ".4rem" }}>{x.gd > 0 ? "+" : ""}{x.gd}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right column: fixture list */}
          <div>
            <div className="detail-sec" style={{ marginBottom: ".5rem" }}>
              Fixtures ({mine.filter(f => f.played).length} played, {mine.filter(f => !f.played).length} pending)
            </div>
            {sorted.length === 0 && <div className="empty" style={{ padding: ".5rem" }}>No fixtures yet.</div>}
            {sorted.map(f => {
              const isHome = f.homeIdx === teamIdx;
              const opp = isHome ? teams[f.awayIdx]?.name : teams[f.homeIdx]?.name;
              return (
                <div key={f.id} className="detail-match" style={{ opacity: f.played ? 1 : 0.6 }}>
                  {f.week != null && (
                    <span className="week-badge" style={{ fontSize: ".6rem", padding: ".08rem .3rem" }}>W{f.week}</span>
                  )}
                  <HaBadge isHome={isHome} />
                  <span className="detail-opp" style={{ color: f.played ? "#d4d8e0" : "#5a6070" }}>{opp}</span>
                  {f.played && f.homeScore != null
                    ? <span className="detail-score" style={{ color: resColor(f) }}>{f.homeScore}&mdash;{f.awayScore}</span>
                    : <span style={{ fontFamily: "DM Mono,monospace", fontSize: ".7rem", color: "#3a3f50" }}>pending</span>
                  }
                </div>
              );
            })}
          </div>

        </div>

        {(leagueId || archiveScorers !== undefined) && <TeamScorers leagueId={leagueId} teamName={team?.name} aliases={aliases} archiveScorers={archiveScorers} phase={phase} />}

      </div>
    </>
  );
}

function TeamScorers({ leagueId, teamName, aliases, archiveScorers, phase }) {
  const live = useScorers(archiveScorers !== undefined ? null : leagueId, phase);
  const scorers = archiveScorers !== undefined ? archiveScorers : live.scorers;
  const error = archiveScorers !== undefined ? false : live.error;
  return <ScorerPanel scorers={scorers} error={error} filterClub={teamName} title={teamName + " Scorers"} maxRows={5} aliases={aliases} />;
}

function ToughPanel({ ranking }) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? ranking : ranking.slice(0, 5);
  return (
    <div className="mini-box" style={{ marginTop: "1rem" }}>
      <div className="mini-ttl" style={{ color: "#f87171", marginBottom: ".6rem" }}>💀 Toughest Teams</div>
      <div style={{ fontSize: ".72rem", color: "#4a5060", marginBottom: ".6rem" }}>How tough a team is to beat.</div>
      {shown.map((r, i) => (
        <div key={r.id} className="mini-row">
          <span className="mini-pos" style={{ minWidth: "1.8rem", color: i < 3 ? "#f87171" : "#3a3f50" }}>{i < 3 ? MEDALS[i] : (i+1)+"."}</span>
          <span className="mini-name">{r.name}</span>
          <span className="mini-val" style={{ color: "#f87171" }}>{r.pts} pts</span>
        </div>
      ))}
      {ranking.length > 5 && (
        <div style={{ marginTop: ".4rem", textAlign: "center" }}>
          <button className="btn-ghost" style={{ fontSize: ".72rem", padding: ".2rem .6rem" }} onClick={() => setExpanded(e => !e)}>
            {expanded ? "Show less ▲" : "Show all " + ranking.length + " ▼"}
          </button>
        </div>
      )}
      <div style={{ fontSize: ".7rem", color: "#4a5060", marginTop: ".75rem", lineHeight: "1.4", borderTop: "1px solid #1c1f27", paddingTop: ".6rem" }}>
        Comparison for teams by other teams. Decided by total GD over Home and Away Fixture.
      </div>
    </div>
  );
}

function LeagueScorers({ leagueId, teams, aliases, archiveScorers, phaseTeams, phase }) {
  const live = useScorers(archiveScorers !== undefined ? null : leagueId, phase);
  const scorers = archiveScorers !== undefined ? archiveScorers : live.scorers;
  const error = archiveScorers !== undefined ? false : live.error;
  const relevantTeams = phaseTeams || teams;
  const clubIndex = useMemo(() => buildClubIndex(scorers), [scorers]);
  const clubNames = useMemo(() => new Set(relevantTeams.map(t => resolveClubName(t.name, aliases, clubIndex))), [relevantTeams, aliases, clubIndex]);
  const filtered = useMemo(() => scorers ? scorers.filter(s => clubNames.has(s.club)) : null, [scorers, clubNames]);
  return <ScorerPanel scorers={filtered} error={error} title="Top Scorers" maxRows={10} aliases={aliases} />;
}

// ── LEAGUE TABLE ──────────────────────────────────────────────────────────────
function LeagueTable({ teams, fixtures, onTeamClick, highlightTop, highlightBottom, confirmedTop, confirmedBottom, leagueId, aliases, archiveScorers, phaseTeams, phase, toughFullWidth }) {
  const rows = useMemo(() => calcStats(teams, fixtures), [teams, fixtures]);
  const hasPlayed = fixtures.some(f => f.played && f.homeScore != null);
  const n = rows.length;
  const attackers = useMemo(() => rows.filter(r => r.P > 0).sort((a, b) => b.GF - a.GF || a.name.localeCompare(b.name)).slice(0, 3), [rows]);
  const defenders = useMemo(() => rows.filter(r => r.P > 0).sort((a, b) => a.GA - b.GA || a.name.localeCompare(b.name)).slice(0, 3), [rows]);
  const allAttackers = useMemo(() => rows.filter(r => r.P > 0).sort((a, b) => b.GF - a.GF || a.name.localeCompare(b.name)), [rows]);
  const allDefenders = useMemo(() => rows.filter(r => r.P > 0).sort((a, b) => a.GA - b.GA || a.name.localeCompare(b.name)), [rows]);
  const [rankingPanel, setRankingPanel] = useState(null); // null | "attackers" | "defenders" | "tough" | "home" | "away" | "clutch" | "unlucky"

  // Tough team rankings
  // For each team T, build oppGD map: opponent name -> total GD for T vs that opponent
  // Then rank opponents toughest->easiest (lowest GD first)
  // tough-points: for each appearance in another team's opponent list, 
  //   points = max(0, N_opponents - rank)  where rank is 1-based
  const toughRanking = useMemo(() => {
    const played = fixtures.filter(f => f.played && f.homeScore != null && f.awayScore != null);
    const N = teams.length;
    const oppMap = teams.map(() => ({}));
    played.forEach(f => {
      const hi = f.homeIdx, ai = f.awayIdx;
      if (hi >= N || ai >= N) return;
      const hg = +f.homeScore, ag = +f.awayScore;
      oppMap[hi][ai] = (oppMap[hi][ai] || 0) + (hg - ag);
      oppMap[ai][hi] = (oppMap[ai][hi] || 0) + (ag - hg);
    });
    const toughPts = new Array(N).fill(0);
    teams.forEach((_, ti) => {
      const opps = Object.entries(oppMap[ti])
        .map(([oi, gd]) => ({ oi: +oi, gd }))
        .sort((a, b) => a.gd - b.gd); // ascending = toughest first
      const nOpps = opps.length;
      opps.forEach(({ oi }, rank0) => {
        toughPts[oi] += Math.max(0, nOpps - rank0 - 1);
      });
    });
    return teams.map((t, i) => ({ id: t.id, name: t.name, pts: toughPts[i] })).sort((a, b) => b.pts - a.pts || a.name.localeCompare(b.name));
  }, [fixtures, teams]);

  // Top 3 tough for mini card
  const topTough = toughRanking.slice(0, 3);

  // Home GD ranking: sum of (homeScore - awayScore) for every played home fixture per team
  const homeGDRanking = useMemo(() => {
    const played = fixtures.filter(f => f.played && f.homeScore != null && f.awayScore != null);
    const N = teams.length;
    const gd = new Array(N).fill(0);
    const games = new Array(N).fill(0);
    played.forEach(f => {
      if (f.homeIdx < N) { gd[f.homeIdx] += (+f.homeScore - +f.awayScore); games[f.homeIdx]++; }
    });
    return teams.map((t, i) => ({ id: t.id, name: t.name, gd: gd[i], P: games[i] })).sort((a, b) => b.gd - a.gd || a.name.localeCompare(b.name));
  }, [fixtures, teams]);
  const topHome = homeGDRanking.slice(0, 3);

  // Away GD ranking: sum of (awayScore - homeScore) for every played away fixture per team
  const awayGDRanking = useMemo(() => {
    const played = fixtures.filter(f => f.played && f.homeScore != null && f.awayScore != null);
    const N = teams.length;
    const gd = new Array(N).fill(0);
    const games = new Array(N).fill(0);
    played.forEach(f => {
      if (f.awayIdx < N) { gd[f.awayIdx] += (+f.awayScore - +f.homeScore); games[f.awayIdx]++; }
    });
    return teams.map((t, i) => ({ id: t.id, name: t.name, gd: gd[i], P: games[i] })).sort((a, b) => b.gd - a.gd || a.name.localeCompare(b.name));
  }, [fixtures, teams]);
  const topAway = awayGDRanking.slice(0, 3);

  // Clutch ranking: games won by exactly 1 or 2 GD
  const clutchRanking = useMemo(() => {
    const played = fixtures.filter(f => f.played && f.homeScore != null && f.awayScore != null);
    const N = teams.length;
    const wins = new Array(N).fill(0);
    played.forEach(f => {
      const gd = +f.homeScore - +f.awayScore;
      if (gd === 1 || gd === 2) { if (f.homeIdx < N) wins[f.homeIdx]++; }
      if (gd === -1 || gd === -2) { if (f.awayIdx < N) wins[f.awayIdx]++; }
    });
    const sorted = teams.map((t, i) => ({ id: t.id, name: t.name, wins: wins[i] }))
      .sort((a, b) => b.wins - a.wins || a.name.localeCompare(b.name));
    // Mark ties: if a team has same wins as the next, flag as tied except the first alphabetically
    return sorted.map((r, i, arr) => ({
      ...r,
      tied: i > 0 && arr[i].wins === arr[i - 1].wins && arr[i - 1].wins > 0
    }));
  }, [fixtures, teams]);
  const topClutch = clutchRanking.slice(0, 3);

  // Unlucky ranking: draws and losses by 1 or 2 GD
  // points: draw = 3, loss by 1GD = 2, loss by 2GD = 1. Tiebreak: more draws first, then least total GD in those games, then alphabetical
  const unluckyRanking = useMemo(() => {
    const played = fixtures.filter(f => f.played && f.homeScore != null && f.awayScore != null);
    const N = teams.length;
    const data = teams.map(() => ({ draws: 0, losses1: 0, losses2: 0, gdSum: 0 }));
    played.forEach(f => {
      const gd = +f.homeScore - +f.awayScore;
      const absGd = Math.abs(gd);
      if (gd === 0) {
        if (f.homeIdx < N) { data[f.homeIdx].draws++; }
        if (f.awayIdx < N) { data[f.awayIdx].draws++; }
      } else if (absGd === 1) {
        if (gd > 0 && f.awayIdx < N) { data[f.awayIdx].losses1++; data[f.awayIdx].gdSum += 1; }
        if (gd < 0 && f.homeIdx < N) { data[f.homeIdx].losses1++; data[f.homeIdx].gdSum += 1; }
      } else if (absGd === 2) {
        if (gd > 0 && f.awayIdx < N) { data[f.awayIdx].losses2++; data[f.awayIdx].gdSum += 2; }
        if (gd < 0 && f.homeIdx < N) { data[f.homeIdx].losses2++; data[f.homeIdx].gdSum += 2; }
      }
    });
    return teams.map((t, i) => ({
      id: t.id, name: t.name,
      draws: data[i].draws,
      losses1: data[i].losses1,
      losses2: data[i].losses2,
      gdSum: data[i].gdSum,
      pts: (3 * data[i].draws) + (2 * data[i].losses1) + data[i].losses2
    })).sort((a, b) =>
      b.pts - a.pts ||
      b.draws - a.draws ||
      a.gdSum - b.gdSum ||
      a.name.localeCompare(b.name)
    );
  }, [fixtures, teams]);
  const topUnlucky = unluckyRanking.slice(0, 3);

  function rowBg(i, r) {
    if (confirmedTop && confirmedTop.has(r.id)) return "rgba(22,163,74,.45)";
    if (confirmedBottom && confirmedBottom.has(r.id)) return "rgba(185,28,28,.45)";
    if (highlightTop && i < highlightTop) return "rgba(22,101,52,.3)";
    if (highlightBottom && i >= n - highlightBottom) return "rgba(127,29,29,.3)";
    return "";
  }

  return (
    <div>
      <div className="tbl-wrap">
        <table className="ltbl">
          <thead>
            <tr>
              <th style={{ width: "2rem" }}>#</th>
              <th className="tl">Team</th>
              <th title="Played">P</th>
              <th title="Won">W</th>
              <th title="Draw">D</th>
              <th title="Lost">L</th>
              <th title="Goals For">GF</th>
              <th title="Goals Against">GA</th>
              <th className="tgd" title="Goal Difference">GD</th>
              <th className="tpts" title="Points">Pts</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const ti = teams.findIndex(t => t.id === r.id);
              const bg = rowBg(i, r);
              const gdc = r.GD > 0 ? "gdp" : r.GD < 0 ? "gdn" : "gd0";
              return (
                <tr key={r.id} style={bg ? { background: bg } : {}}>
                  <td className="tpos" style={bg ? { color: "rgba(255,255,255,0.85)", fontWeight: 700 } : {}}>{i + 1}</td>
                  <td className="tl">
                    <button className="otbtn" onClick={() => onTeamClick && onTeamClick(ti)}>{r.name}</button>
                  </td>
                  <td>{r.P}</td>
                  <td style={{ color: "#4ade80" }}>{r.W}</td>
                  <td style={{ color: "#facc15" }}>{r.D}</td>
                  <td style={{ color: "#f87171" }}>{r.L}</td>
                  <td>{r.GF}</td>
                  <td>{r.GA}</td>
                  <td className={gdc}>{r.GD > 0 ? "+" + r.GD : r.GD}</td>
                  <td className="tpts">{r.totalPts}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="note">Click a team name for match details</p>
      {(leagueId || archiveScorers !== undefined) && <LeagueScorers leagueId={leagueId} teams={teams} aliases={aliases} archiveScorers={archiveScorers} phaseTeams={phaseTeams} phase={phase} />}
      {hasPlayed && (
        <>
          {/* Row 1: Attackers + Defenders */}
          <div className="mini-rankings" style={{ marginTop: "1rem" }}>
            <div>
              <div className="mini-box" style={{ cursor: "pointer" }} onClick={() => setRankingPanel(rankingPanel === "attackers" ? null : "attackers")}>
                <div className="mini-ttl" style={{ color: "#f87171", userSelect: "none", display: "flex", justifyContent: "space-between" }}>
                  <span>⚽ Top Attackers</span><span>{rankingPanel === "attackers" ? "▲" : "▼"}</span>
                </div>
                {attackers.map((r, i) => (
                  <div key={r.id} className="mini-row">
                    <span className="mini-pos">{MEDALS[i]}</span>
                    <span className="mini-name">{r.name}</span>
                    <span className="mini-val" style={{ color: "#f87171" }}>{r.GF} GF</span>
                  </div>
                ))}
              </div>
              {rankingPanel === "attackers" && (
                <div className="ranking-expand">
                  <div style={{ fontSize: ".72rem", color: "#4a5060", marginBottom: ".5rem" }}>Total goals scored across all played fixtures.</div>
                  {allAttackers.map((r, i) => (
                    <div key={r.id} className="mini-row">
                      <span className="mini-pos" style={{ minWidth: "1.8rem", color: i < 3 ? "#f87171" : "#3a3f50" }}>{i < 3 ? MEDALS[i] : (i+1)+"."}</span>
                      <span className="mini-name">{r.name}</span>
                      <span className="mini-val" style={{ color: "#f87171" }}>{r.GF} GF</span>
                      <span className="muted" style={{ fontSize: ".72rem", marginLeft: ".25rem" }}>({r.P}g)</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div>
              <div className="mini-box" style={{ cursor: "pointer" }} onClick={() => setRankingPanel(rankingPanel === "defenders" ? null : "defenders")}>
                <div className="mini-ttl" style={{ color: "#4ade80", userSelect: "none", display: "flex", justifyContent: "space-between" }}>
                  <span>🛡 Top Defenders</span><span>{rankingPanel === "defenders" ? "▲" : "▼"}</span>
                </div>
                {defenders.map((r, i) => (
                  <div key={r.id} className="mini-row">
                    <span className="mini-pos">{MEDALS[i]}</span>
                    <span className="mini-name">{r.name}</span>
                    <span className="mini-val" style={{ color: "#4ade80" }}>{r.GA} GA</span>
                  </div>
                ))}
              </div>
              {rankingPanel === "defenders" && (
                <div className="ranking-expand">
                  <div style={{ fontSize: ".72rem", color: "#4a5060", marginBottom: ".5rem" }}>Fewest goals conceded across all played fixtures.</div>
                  {allDefenders.map((r, i) => (
                    <div key={r.id} className="mini-row">
                      <span className="mini-pos" style={{ minWidth: "1.8rem", color: i < 3 ? "#4ade80" : "#3a3f50" }}>{i < 3 ? MEDALS[i] : (i+1)+"."}</span>
                      <span className="mini-name">{r.name}</span>
                      <span className="mini-val" style={{ color: "#4ade80" }}>{r.GA} GA</span>
                      <span className="muted" style={{ fontSize: ".72rem", marginLeft: ".25rem" }}>({r.P}g)</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Row 2: Home + Away */}
          <div className="mini-rankings" style={{ marginTop: ".75rem" }}>
            <div>
              <div className="mini-box" style={{ cursor: "pointer" }} onClick={() => setRankingPanel(rankingPanel === "home" ? null : "home")}>
                <div className="mini-ttl" style={{ color: "#fb923c", userSelect: "none", display: "flex", justifyContent: "space-between" }}>
                  <span>🏠 Strongest Home</span><span>{rankingPanel === "home" ? "▲" : "▼"}</span>
                </div>
                {topHome.map((r, i) => (
                  <div key={r.id} className="mini-row">
                    <span className="mini-pos">{i < 3 ? MEDALS[i] : (i+1)+"."}</span>
                    <span className="mini-name">{r.name}</span>
                    <span className="mini-val" style={{ color: "#fb923c" }}>{r.gd > 0 ? "+" : ""}{r.gd} GD</span>
                  </div>
                ))}
              </div>
              {rankingPanel === "home" && (
                <div className="ranking-expand">
                  <div style={{ fontSize: ".72rem", color: "#4a5060", marginBottom: ".5rem" }}>Combined goal difference across all home fixtures.</div>
                  {homeGDRanking.map((r, i) => (
                    <div key={r.id} className="mini-row">
                      <span className="mini-pos" style={{ minWidth: "1.8rem", color: i < 3 ? "#fb923c" : "#3a3f50" }}>{i < 3 ? MEDALS[i] : (i+1)+"."}</span>
                      <span className="mini-name">{r.name}</span>
                      <span className="mini-val" style={{ color: "#fb923c" }}>{r.gd > 0 ? "+" : ""}{r.gd} GD</span>
                      <span className="muted" style={{ fontSize: ".72rem", marginLeft: ".25rem" }}>({r.P}g)</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div>
              <div className="mini-box" style={{ cursor: "pointer" }} onClick={() => setRankingPanel(rankingPanel === "away" ? null : "away")}>
                <div className="mini-ttl" style={{ color: "#a78bfa", userSelect: "none", display: "flex", justifyContent: "space-between" }}>
                  <span>✈️ Strongest Away</span><span>{rankingPanel === "away" ? "▲" : "▼"}</span>
                </div>
                {topAway.map((r, i) => (
                  <div key={r.id} className="mini-row">
                    <span className="mini-pos">{i < 3 ? MEDALS[i] : (i+1)+"."}</span>
                    <span className="mini-name">{r.name}</span>
                    <span className="mini-val" style={{ color: "#a78bfa" }}>{r.gd > 0 ? "+" : ""}{r.gd} GD</span>
                  </div>
                ))}
              </div>
              {rankingPanel === "away" && (
                <div className="ranking-expand">
                  <div style={{ fontSize: ".72rem", color: "#4a5060", marginBottom: ".5rem" }}>Combined goal difference across all away fixtures.</div>
                  {awayGDRanking.map((r, i) => (
                    <div key={r.id} className="mini-row">
                      <span className="mini-pos" style={{ minWidth: "1.8rem", color: i < 3 ? "#a78bfa" : "#3a3f50" }}>{i < 3 ? MEDALS[i] : (i+1)+"."}</span>
                      <span className="mini-name">{r.name}</span>
                      <span className="mini-val" style={{ color: "#a78bfa" }}>{r.gd > 0 ? "+" : ""}{r.gd} GD</span>
                      <span className="muted" style={{ fontSize: ".72rem", marginLeft: ".25rem" }}>({r.P}g)</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Row 3: Toughest Teams — full width if toughFullWidth, else paired with Clutch */}
          {toughFullWidth ? (
            <div className="mini-rankings" style={{ marginTop: ".75rem" }}>
              <div style={{ gridColumn: "1 / -1" }}>
                <div className="mini-box" style={{ cursor: "pointer" }} onClick={() => setRankingPanel(rankingPanel === "tough" ? null : "tough")}>
                  <div className="mini-ttl" style={{ color: "#f87171", userSelect: "none", display: "flex", justifyContent: "space-between" }}>
                    <span>💀 Toughest Teams</span><span>{rankingPanel === "tough" ? "▲" : "▼"}</span>
                  </div>
                  {toughRanking.slice(0, 3).map((r, i) => (
                    <div key={r.id} className="mini-row">
                      <span className="mini-pos">{MEDALS[i]}</span>
                      <span className="mini-name">{r.name}</span>
                      <span className="mini-val" style={{ color: "#f87171" }}>{r.pts} pts</span>
                    </div>
                  ))}
                </div>
                {rankingPanel === "tough" && (
                  <div className="ranking-expand">
                    <div style={{ fontSize: ".72rem", color: "#4a5060", marginBottom: ".5rem" }}>How tough a team is to beat, scored by total GD opponents face against them.</div>
                    {toughRanking.map((r, i) => (
                      <div key={r.id} className="mini-row">
                        <span className="mini-pos" style={{ minWidth: "1.8rem", color: i < 3 ? "#f87171" : "#3a3f50" }}>{i < 3 ? MEDALS[i] : (i+1)+"."}</span>
                        <span className="mini-name">{r.name}</span>
                        <span className="mini-val" style={{ color: "#f87171" }}>{r.pts} pts</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="mini-rankings" style={{ marginTop: ".75rem" }}>
              <div>
                <div className="mini-box" style={{ cursor: "pointer" }} onClick={() => setRankingPanel(rankingPanel === "tough" ? null : "tough")}>
                  <div className="mini-ttl" style={{ color: "#f87171", userSelect: "none", display: "flex", justifyContent: "space-between" }}>
                    <span>💀 Toughest Teams</span><span>{rankingPanel === "tough" ? "▲" : "▼"}</span>
                  </div>
                  {toughRanking.slice(0, 3).map((r, i) => (
                    <div key={r.id} className="mini-row">
                      <span className="mini-pos">{MEDALS[i]}</span>
                      <span className="mini-name">{r.name}</span>
                      <span className="mini-val" style={{ color: "#f87171" }}>{r.pts} pts</span>
                    </div>
                  ))}
                </div>
                {rankingPanel === "tough" && (
                  <div className="ranking-expand">
                    <div style={{ fontSize: ".72rem", color: "#4a5060", marginBottom: ".5rem" }}>How tough a team is to beat, scored by total GD opponents face against them.</div>
                    {toughRanking.map((r, i) => (
                      <div key={r.id} className="mini-row">
                        <span className="mini-pos" style={{ minWidth: "1.8rem", color: i < 3 ? "#f87171" : "#3a3f50" }}>{i < 3 ? MEDALS[i] : (i+1)+"."}</span>
                        <span className="mini-name">{r.name}</span>
                        <span className="mini-val" style={{ color: "#f87171" }}>{r.pts} pts</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <div className="mini-box" style={{ cursor: "pointer" }} onClick={() => setRankingPanel(rankingPanel === "clutch" ? null : "clutch")}>
                  <div className="mini-ttl" style={{ color: "#facc15", userSelect: "none", display: "flex", justifyContent: "space-between" }}>
                    <span>🎯 Most Clutch</span><span>{rankingPanel === "clutch" ? "▲" : "▼"}</span>
                  </div>
                  {topClutch.map((r, i) => (
                    <div key={r.id} className="mini-row">
                      <span className="mini-pos">{r.tied ? "—" : (i < 3 ? MEDALS[i] : (i+1)+".")}</span>
                      <span className="mini-name">{r.name}</span>
                      <span className="mini-val" style={{ color: "#facc15" }}>{r.wins}W</span>
                    </div>
                  ))}
                </div>
                {rankingPanel === "clutch" && (
                  <div className="ranking-expand">
                    <div style={{ fontSize: ".72rem", color: "#4a5060", marginBottom: ".5rem" }}>Number of wins by 1 or 2 goals.</div>
                    {clutchRanking.map((r, i) => (
                      <div key={r.id} className="mini-row">
                        <span className="mini-pos" style={{ minWidth: "1.8rem", color: i < 3 ? "#facc15" : "#3a3f50" }}>{r.tied ? "—" : (i < 3 ? MEDALS[i] : (i+1)+".")}</span>
                        <span className="mini-name">{r.name}</span>
                        <span className="mini-val" style={{ color: "#facc15" }}>{r.wins}W</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Row 4: Unlucky (+ Clutch if toughFullWidth) */}
          <div className="mini-rankings" style={{ marginTop: ".75rem" }}>
            {toughFullWidth ? (
              <>
                <div>
                  <div className="mini-box" style={{ cursor: "pointer" }} onClick={() => setRankingPanel(rankingPanel === "unlucky" ? null : "unlucky")}>
                    <div className="mini-ttl" style={{ color: "#94a3b8", userSelect: "none", display: "flex", justifyContent: "space-between" }}>
                      <span>😤 Most Unlucky</span><span>{rankingPanel === "unlucky" ? "▲" : "▼"}</span>
                    </div>
                    {topUnlucky.map((r, i) => (
                      <div key={r.id} className="mini-row">
                        <span className="mini-pos">{i < 3 ? MEDALS[i] : (i+1)+"."}</span>
                        <span className="mini-name">{r.name}</span>
                        <span className="mini-val" style={{ color: "#94a3b8" }}>{r.draws}D {r.losses1 + r.losses2}L</span>
                      </div>
                    ))}
                  </div>
                  {rankingPanel === "unlucky" && (
                    <div className="ranking-expand">
                      <div style={{ fontSize: ".72rem", color: "#4a5060", marginBottom: ".5rem" }}>Draw = 3 pts · Loss 1GD = 2 pts · Loss 2GD = 1 pt.</div>
                      {unluckyRanking.map((r, i) => (
                        <div key={r.id} className="mini-row">
                          <span className="mini-pos" style={{ minWidth: "1.8rem", color: i < 3 ? "#94a3b8" : "#3a3f50" }}>{i < 3 ? MEDALS[i] : (i+1)+"."}</span>
                          <span className="mini-name">{r.name}</span>
                          <span className="mini-val" style={{ color: "#94a3b8" }}>{r.draws}D {r.losses1 + r.losses2}L</span>
                          <span className="muted" style={{ fontSize: ".72rem", marginLeft: ".25rem" }}>({r.pts} pts)</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <div className="mini-box" style={{ cursor: "pointer" }} onClick={() => setRankingPanel(rankingPanel === "clutch" ? null : "clutch")}>
                    <div className="mini-ttl" style={{ color: "#facc15", userSelect: "none", display: "flex", justifyContent: "space-between" }}>
                      <span>🎯 Most Clutch</span><span>{rankingPanel === "clutch" ? "▲" : "▼"}</span>
                    </div>
                    {topClutch.map((r, i) => (
                      <div key={r.id} className="mini-row">
                        <span className="mini-pos">{r.tied ? "—" : (i < 3 ? MEDALS[i] : (i+1)+".")}</span>
                        <span className="mini-name">{r.name}</span>
                        <span className="mini-val" style={{ color: "#facc15" }}>{r.wins}W</span>
                      </div>
                    ))}
                  </div>
                  {rankingPanel === "clutch" && (
                    <div className="ranking-expand">
                      <div style={{ fontSize: ".72rem", color: "#4a5060", marginBottom: ".5rem" }}>Number of wins by 1 or 2 goals.</div>
                      {clutchRanking.map((r, i) => (
                        <div key={r.id} className="mini-row">
                          <span className="mini-pos" style={{ minWidth: "1.8rem", color: i < 3 ? "#facc15" : "#3a3f50" }}>{r.tied ? "—" : (i < 3 ? MEDALS[i] : (i+1)+".")}</span>
                          <span className="mini-name">{r.name}</span>
                          <span className="mini-val" style={{ color: "#facc15" }}>{r.wins}W</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div style={{ gridColumn: "1 / -1" }}>
                <div className="mini-box" style={{ cursor: "pointer" }} onClick={() => setRankingPanel(rankingPanel === "unlucky" ? null : "unlucky")}>
                  <div className="mini-ttl" style={{ color: "#94a3b8", userSelect: "none", display: "flex", justifyContent: "space-between" }}>
                    <span>😤 Most Unlucky</span><span>{rankingPanel === "unlucky" ? "▲" : "▼"}</span>
                  </div>
                  {topUnlucky.map((r, i) => (
                    <div key={r.id} className="mini-row">
                      <span className="mini-pos">{i < 3 ? MEDALS[i] : (i+1)+"."}</span>
                      <span className="mini-name">{r.name}</span>
                      <span className="mini-val" style={{ color: "#94a3b8" }}>{r.draws}D {r.losses1 + r.losses2}L</span>
                    </div>
                  ))}
                </div>
                {rankingPanel === "unlucky" && (
                  <div className="ranking-expand">
                    <div style={{ fontSize: ".72rem", color: "#4a5060", marginBottom: ".5rem" }}>Draw = 3 pts · Loss 1GD = 2 pts · Loss 2GD = 1 pt.</div>
                    {unluckyRanking.map((r, i) => (
                      <div key={r.id} className="mini-row">
                        <span className="mini-pos" style={{ minWidth: "1.8rem", color: i < 3 ? "#94a3b8" : "#3a3f50" }}>{i < 3 ? MEDALS[i] : (i+1)+"."}</span>
                        <span className="mini-name">{r.name}</span>
                        <span className="mini-val" style={{ color: "#94a3b8" }}>{r.draws}D {r.losses1 + r.losses2}L</span>
                        <span className="muted" style={{ fontSize: ".72rem", marginLeft: ".25rem" }}>({r.pts} pts)</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ── STEP 1: TEAMS ─────────────────────────────────────────────────────────────
function TeamsStep({ teams, fixtures, setTeams, leagueType, onNext }) {
  function update(id, field, val) {
    setTeams(prev => prev.map(t => t.id === id ? { ...t, [field]: val } : t));
  }
  function addTeam() {
    setTeams(prev => [...prev, makeTeam(prev.length)]);
  }
  function removeTeam(id) {
    const ti = teams.findIndex(t => t.id === id);
    if (fixtures.some(f => f.homeIdx === ti || f.awayIdx === ti)) return;
    setTeams(prev => prev.filter(t => t.id !== id));
  }
  const minTeams = leagueType === "playoff" ? 10 : 2;

  return (
    <div className="panel">
      <div className="ph">
        <span className="ph-num">01</span>
        <div>
          <h2>League Setup</h2>
          <p>Name, starting points, optional home advantage override (H%) per team.{leagueType === "playoff" ? " Min 10 teams." : ""}</p>
        </div>
      </div>
      {teams.map((t, i) => {
        const hasF = fixtures.some(f => f.homeIdx === i || f.awayIdx === i);
        return (
          <div key={t.id}>
            <div className="team-row">
              <span className="team-num">#{i + 1}</span>
              <input className="inp team-name-inp" value={t.name} autoComplete="off" onChange={e => update(t.id, "name", e.target.value)} placeholder={"Team " + (i + 1)} />
              <div className="team-extras">
                <input className="inp inp-sm team-pts-inp" type="number" min="0" value={t.points} onChange={e => update(t.id, "points", parseInt(e.target.value) || 0)} placeholder="0" title="Starting points" />
                <span className="muted team-pts-lbl" style={{ fontSize: ".7rem", whiteSpace: "nowrap" }}>pts</span>
                <input className="inp inp-sm team-hbonus-inp" type="number" min="0" max="100" value={t.homeBonus} onChange={e => update(t.id, "homeBonus", e.target.value)} placeholder="H%" title="Home advantage override" />
                <span className="muted team-hbonus-lbl" style={{ fontSize: ".7rem" }}>H%</span>
                <button className="btn-rm team-del" onClick={() => removeTeam(t.id)} style={{ color: hasF ? "#3a3f50" : undefined, cursor: hasF ? "not-allowed" : "pointer" }}>✕</button>
              </div>
            </div>
            {hasF && <div className="warn-txt">This team has fixtures — remove them first to delete this team.</div>}
          </div>
        );
      })}
      <button className="btn-add" style={{ marginTop: ".6rem" }} onClick={addTeam}>+ Add Team</button>
      <div className="nav-row">
        <button className="btn btn-cyan" onClick={onNext} disabled={teams.length < minTeams}>
          Set Fixtures {teams.length < minTeams ? "(need " + (minTeams - teams.length) + " more)" : "→"}
        </button>
      </div>
    </div>
  );
}

// ── STEP 2: FIXTURES ──────────────────────────────────────────────────────────
function FixturesStep({ teams, fixtures, setFixtures, settings, setSettings, onBack, onNext }) {
  const [hi, setHi] = useState(0);
  const [ai, setAi] = useState(Math.min(1, teams.length - 1));
  const [week, setWeek] = useState(1);
  const ok = hi !== ai;
  const preview = useMemo(() => calcProbs(hi, ai, teams, fixtures, settings), [hi, ai, teams, fixtures, settings]);

  const liveProbs = useMemo(() => {
    const m = {};
    fixtures.forEach(f => { m[f.id] = calcProbs(f.homeIdx, f.awayIdx, teams, fixtures, settings); });
    return m;
  }, [fixtures, teams, settings]);

  function addOne() {
    if (!ok) return;
    const p = calcProbs(hi, ai, teams, fixtures, settings);
    setFixtures(prev => [...prev, { id: "f" + Date.now(), homeIdx: hi, awayIdx: ai, homeWin: p.homeWin, draw: p.draw, awayWin: p.awayWin, overrideOn: false, ovHW: "", ovD: "", ovAW: "", played: false, homeScore: null, awayScore: null, week: week }]);
  }

  function autoGenerate() {
    if (fixtures.length > 0 && !confirm("Replace all current fixtures with an auto-generated 2-round robin?")) return;
    setFixtures(makeFixtures(teams, settings));
  }

  function remove(id) { setFixtures(prev => prev.filter(f => f.id !== id)); }

  return (
    <div className="panel">
      <div className="ph">
        <span className="ph-num">02</span>
        <div><h2>Fixtures</h2><p>Probabilities are calculated automatically from current standings.</p></div>
      </div>
      <SettingsPanel settings={settings} onChange={(k, v) => setSettings(s => ({ ...s, [k]: v }))} showTiebreakers={false} readOnly={IS_SHARE} />
      <div style={{ marginBottom: "1.1rem" }}>
        <div className="row" style={{ marginBottom: ".6rem" }}>
          <select className="inp sel" value={hi} onChange={e => setHi(+e.target.value)}>
            {teams.map((t, i) => <option key={i} value={i}>{t.name}</option>)}
          </select>
          <span className="vs">vs</span>
          <select className="inp sel" value={ai} onChange={e => setAi(+e.target.value)}>
            {teams.map((t, i) => <option key={i} value={i}>{t.name}</option>)}
          </select>
        </div>
        <div className="prob-bar">
          <span className="muted">Auto:</span>
          <span className="ph-col">{preview.homeWin}% {teams[hi]?.name}</span>
          <span className="muted">·</span>
          <span className="pd-col">{preview.draw}% Draw</span>
          <span className="muted">·</span>
          <span className="pa-col">{preview.awayWin}% {teams[ai]?.name}</span>
        </div>
        <div style={{ display: "flex", gap: ".5rem", marginTop: ".65rem", flexWrap: "wrap", alignItems: "center" }}>
          <span className="lbl" style={{ marginBottom: 0, whiteSpace: "nowrap" }}>Week:</span>
          <input className="inp" type="number" min="1" max="999" value={week} onChange={e => setWeek(parseInt(e.target.value) || 1)} style={{ width: "4rem", textAlign: "center", fontFamily: "DM Mono,monospace" }} />
          <button className="btn-add" onClick={addOne} disabled={!ok}>+ Add Match</button>
          <button className="btn-add-pu" onClick={autoGenerate} disabled={teams.length < 2}>⚡ Auto 2-round robin</button>
        </div>
      </div>
      {fixtures.length > 0 && (
        <div>
          <div className="sub-ttl">Scheduled ({fixtures.length})</div>
          {fixtures.map(f => {
            const p = liveProbs[f.id] || f;
            return (
              <div key={f.id} className="fix-item">
                <div style={{ display: "flex", alignItems: "center", gap: ".3rem", flexShrink: 0 }}>
                  <span className="lbl" style={{ marginBottom: 0, fontSize: ".65rem" }}>W</span>
                  <input
                    type="number" min="1" max="999"
                    value={f.week ?? ""}
                    placeholder="—"
                    onChange={e => {
                      const v = e.target.value === "" ? null : parseInt(e.target.value) || null;
                      setFixtures(prev => prev.map(x => x.id === f.id ? { ...x, week: v } : x));
                    }}
                    style={{ width: "3rem", textAlign: "center", padding: ".22rem .3rem", fontFamily: "DM Mono,monospace", fontSize: ".8rem", background: "#0d1117", border: "1px solid #252830", color: "#22d3ee", borderRadius: "4px", outline: "none" }}
                  />
                </div>
                <div className="fix-teams"><b>{teams[f.homeIdx]?.name}</b><span className="vs">vs</span><b>{teams[f.awayIdx]?.name}</b></div>
                <div className="fix-probs">
                  <span className="ph-col">{p.homeWin}%</span>
                  <span className="pd-col">{p.draw}%</span>
                  <span className="pa-col">{p.awayWin}%</span>
                </div>
                <button className="btn-rm" onClick={() => remove(f.id)}>✕</button>
              </div>
            );
          })}
        </div>
      )}
      <div className="nav-row">
        <button className="btn btn-ghost" onClick={onBack}>← Back</button>
        <button className="btn btn-cyan" onClick={onNext} disabled={fixtures.length === 0}>Continue →</button>
      </div>
    </div>
  );
}

// ── SCORE ROW ─────────────────────────────────────────────────────────────────
function ScoreRow({ f, teams, liveP, settings, onConfirm, onUndo, onOverride, onTeamClick, onWeekChange }) {
  const [hg, setHg] = useState("");
  const [ag, setAg] = useState("");
  const hn = teams[f.homeIdx]?.name || "?";
  const an = teams[f.awayIdx]?.name || "?";
  const ws = settings?.winScore || 30;
  const ls = settings?.lossScore || 25;
  const ds = settings?.drawScore || 25;
  const probs = (f.overrideOn && f.ovHW !== "") ? { homeWin: parseFloat(f.ovHW) || 0, draw: parseFloat(f.ovD) || 0, awayWin: parseFloat(f.ovAW) || 0 } : (liveP || f);

  if (f.played && f.homeScore != null) {
    const hs = +f.homeScore, as_ = +f.awayScore;
    const res = hs > as_ ? "home" : hs < as_ ? "away" : "draw";
    const lbl = res === "home" ? hn + " Win" : res === "away" ? an + " Win" : "Draw";
    const col = res === "home" ? "#4ade80" : res === "away" ? "#f87171" : "#facc15";
    return (
      <div className="outcome done">
        {f.week != null && <span className="week-badge" style={{ fontSize: ".6rem" }}>W{f.week}</span>}
        <div className="oteams">
          <button className="otbtn" onClick={() => onTeamClick && onTeamClick(f.homeIdx)}>{hn}</button>
          <span className="vs">vs</span>
          <button className="otbtn" onClick={() => onTeamClick && onTeamClick(f.awayIdx)}>{an}</button>
        </div>
        <div className="score-done">
          <span style={{ color: res === "home" ? "#4ade80" : res === "draw" ? "#facc15" : "#d4d8e0" }}>{f.homeScore}</span>
          <span className="score-sep">&mdash;</span>
          <span style={{ color: res === "away" ? "#f87171" : res === "draw" ? "#facc15" : "#d4d8e0" }}>{f.awayScore}</span>
        </div>
        <span className="res-lbl" style={{ color: col }}>{lbl}</span>
        {onWeekChange && (
          <div style={{ display: "flex", alignItems: "center", gap: ".3rem" }}>
            <span style={{ fontFamily: "DM Mono,monospace", fontSize: ".65rem", color: "#3a3f50" }}>W</span>
            <input type="number" min="1" max="999" value={f.week ?? ""} placeholder="—"
              onChange={e => onWeekChange(f.id, e.target.value === "" ? null : parseInt(e.target.value) || null)}
              style={{ width: "2.8rem", textAlign: "center", padding: ".2rem .25rem", fontFamily: "DM Mono,monospace", fontSize: ".78rem", background: "#0d1117", border: "1px solid #252830", color: "#22d3ee", borderRadius: "4px", outline: "none" }} />
          </div>
        )}
        <button className="btn-undo" onClick={() => onUndo(f.id)}>↩ Undo</button>
      </div>
    );
  }

  const ovrTotal = (parseFloat(f.ovHW) || 0) + (parseFloat(f.ovD) || 0) + (parseFloat(f.ovAW) || 0);
  const ovrOk = !f.overrideOn || Math.abs(ovrTotal - 100) <= 0.5;

  return (
    <div className="outcome" style={{ flexDirection: "column", alignItems: "stretch", gap: ".42rem" }}>
      <div style={{ display: "flex", alignItems: "center", gap: ".5rem", flexWrap: "wrap" }}>
        <div className="oteams">
          <button className="otbtn" onClick={() => onTeamClick && onTeamClick(f.homeIdx)}>{hn}</button>
          <span className="vs">vs</span>
          <button className="otbtn" onClick={() => onTeamClick && onTeamClick(f.awayIdx)}>{an}</button>
        </div>
        <div className="fix-probs">
          {f.overrideOn && f.ovHW !== "" && <span className="ovr-tag">override</span>}
          <span className="ph-col">{probs.homeWin}%</span>
          <span className="pd-col">{probs.draw}%</span>
          <span className="pa-col">{probs.awayWin}%</span>
        </div>
        <button className={"ovr-btn" + (f.overrideOn ? " active" : "")} onClick={() => onOverride(f.id, "toggle")}>
          {f.overrideOn ? "✓ Override" : "Override %"}
        </button>
        {onWeekChange && (
          <div style={{ display: "flex", alignItems: "center", gap: ".3rem", marginLeft: "auto" }}>
            <span style={{ fontFamily: "DM Mono,monospace", fontSize: ".65rem", color: "#3a3f50" }}>W</span>
            <input type="number" min="1" max="999" value={f.week ?? ""} placeholder="—"
              onChange={e => onWeekChange(f.id, e.target.value === "" ? null : parseInt(e.target.value) || null)}
              style={{ width: "2.8rem", textAlign: "center", padding: ".2rem .25rem", fontFamily: "DM Mono,monospace", fontSize: ".78rem", background: "#0d1117", border: "1px solid #252830", color: "#22d3ee", borderRadius: "4px", outline: "none" }} />
          </div>
        )}
      </div>
      {f.overrideOn && (
        <div className="ovr-row">
          <span className="muted" style={{ fontSize: ".7rem" }}>{hn.split(" ")[0]} W:</span>
          <input className="ovr-inp" type="number" min="0" max="100" value={f.ovHW} onChange={e => onOverride(f.id, "hw", e.target.value)} placeholder="0" />
          <span className="muted">Draw:</span>
          <input className="ovr-inp" type="number" min="0" max="100" value={f.ovD} onChange={e => onOverride(f.id, "d", e.target.value)} placeholder="0" />
          <span className="muted">{an.split(" ")[0]} W:</span>
          <input className="ovr-inp" type="number" min="0" max="100" value={f.ovAW} onChange={e => onOverride(f.id, "aw", e.target.value)} placeholder="0" />
          {f.ovHW !== "" && (
            <span style={{ fontSize: ".7rem", color: ovrOk ? "#22d3ee" : "#f87171", fontFamily: "DM Mono,monospace" }}>
              {ovrTotal}% {ovrOk ? "✓" : "⚠ must = 100"}
            </span>
          )}
        </div>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: ".38rem", flexWrap: "wrap" }}>
        <button className="qbtn hw" onClick={() => onConfirm(f.id, ws, ls)}>{hn.split(" ")[0]} W</button>
        <button className="qbtn dr" onClick={() => onConfirm(f.id, ds, ds)}>Draw</button>
        <button className="qbtn aw" onClick={() => onConfirm(f.id, ls, ws)}>{an.split(" ")[0]} W</button>
        <input className="score-inp" type="number" min="0" value={hg} onChange={e => setHg(e.target.value)} placeholder="0" />
        <span className="score-sep">&mdash;</span>
        <input className="score-inp" type="number" min="0" value={ag} onChange={e => setAg(e.target.value)} placeholder="0" />
        <button className="confirm-btn" disabled={hg === "" || ag === ""} onClick={() => { if (hg !== "" && ag !== "") onConfirm(f.id, +hg, +ag); }}>Confirm</button>
      </div>
    </div>
  );
}

// ── MONTE CARLO TAB ───────────────────────────────────────────────────────────
function MCTab({ teams, fixtures, settings, highlightTop, highlightBottom, onConfirmed }) {
  const [results, setResults] = useState(null);
  const [running, setRunning] = useState(false);
  const pending = fixtures.filter(f => !f.played);

  // Use a ref so the effect closure always reads the latest value
  // without needing it as a dependency (which would cause infinite re-runs).
  const playedFixtures = fixtures.filter(f => f.played && f.homeScore != null && f.awayScore != null);
  const pendingRef = useRef([]);
  const teamsRef = useRef([]);
  const playedRef = useRef([]);
  pendingRef.current = pending.map(f => ({ ...f, ...fixProbs(f, teams, fixtures, settings) }));
  teamsRef.current = teams;
  playedRef.current = playedFixtures;

  useEffect(() => {
    if (pendingRef.current.length === 0) { setResults(null); return; }
    setRunning(true);
    const tid = setTimeout(() => {
      const res = runMC(teamsRef.current, pendingRef.current, playedRef.current);
      setResults(res);
      setRunning(false);
      if (onConfirmed) {
        const n = teamsRef.current.length;
        const ct = new Set(), cb = new Set();
        teamsRef.current.forEach((t, i) => {
          if (highlightTop && res[i].slice(0, highlightTop).reduce((a, v) => a + v, 0) > 99.9) ct.add(t.id);
          if (highlightBottom && res[i].slice(n - highlightBottom).reduce((a, v) => a + v, 0) > 99.9) cb.add(t.id);
        });
        onConfirmed(ct, cb);
      }
    }, 20);
    return () => clearTimeout(tid);
  }, []); // runs once on mount — parent re-mounts this via key= when fixtures change

  const n = teams.length;
  const sorted = useMemo(() => {
    if (!results) return [];
    return teams.map((t, i) => ({ ...t, idx: i, avg: results[i].reduce((s, p, pos) => s + (p / 100) * (pos + 1), 0) })).sort((a, b) => a.avg - b.avg);
  }, [results, teams]);

  return (
    <div>
      {running && <div className="empty">Running 100,000 simulations…</div>}
      {!running && pending.length === 0 && <div className="empty">All fixtures played — nothing to simulate.</div>}
      {!running && results && (
        <div>
          <div className="tbl-wrap">
            <table className="stbl">
              <thead>
                <tr>
                  <th className="tl">Team</th>
                  <th>Pts</th>
                  {Array.from({ length: n }, (_, i) => <th key={i}>#{i + 1}</th>)}
                </tr>
              </thead>
              <tbody>
                {sorted.map(t => (
                  <tr key={t.idx}>
                    <td className="tl">{t.name}</td>
                    <td className="dm">{t.points}</td>
                    {results[t.idx].map((p, pos) => (
                      <td key={pos} style={{ background: heatColor(p) }}>{fmtPct(p)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="legend">
            <span className="muted" style={{ fontSize: ".7rem" }}>Low</span>
            <div className="leg-grad" />
            <span className="muted" style={{ fontSize: ".7rem" }}>High</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ── SCORES TAB ───────────────────────────────────────────────────────────────
function ScoresTab({ teams, fixtures, liveProbs, settings, onConfirm, onUndo, onOverride, onTeamClick, onWeekChange }) {
  const [selectedTeam, setSelectedTeam] = useState("all");
  const [selectedWeek, setSelectedWeek] = useState("all");

  // All unique weeks, sorted numerically
  const weeks = useMemo(() => {
    const ws = [...new Set(fixtures.map(f => f.week).filter(w => w != null))].sort((a, b) => a - b);
    return ws;
  }, [fixtures]);

  const hasWeeks = weeks.length > 0;

  const filtered = useMemo(() => {
    let fs = fixtures;
    if (selectedTeam !== "all") fs = fs.filter(f => f.homeIdx === +selectedTeam || f.awayIdx === +selectedTeam);
    if (selectedWeek !== "all") fs = fs.filter(f => f.week === +selectedWeek);
    return fs;
  }, [fixtures, selectedTeam, selectedWeek]);

  // Group by week, sorted chronologically; fixtures without week go to a separate group
  const grouped = useMemo(() => {
    const sorted = [...filtered].sort((a, b) => {
      const wa = a.week ?? 99999, wb = b.week ?? 99999;
      if (wa !== wb) return wa - wb;
      return 0;
    });
    const groups = [];
    let cur = null;
    sorted.forEach(f => {
      const w = f.week ?? null;
      if (!cur || cur.week !== w) { cur = { week: w, fixtures: [] }; groups.push(cur); }
      cur.fixtures.push(f);
    });
    return groups;
  }, [filtered]);

  const pending = filtered.filter(f => !f.played);
  const played  = filtered.filter(f =>  f.played);

  return (
    <div>
      {fixtures.length === 0 && <div className="empty">No fixtures added.</div>}
      {fixtures.length > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: ".6rem", marginBottom: "1rem", flexWrap: "wrap" }}>
          <span className="lbl" style={{ marginBottom: 0, whiteSpace: "nowrap" }}>Team:</span>
          <select className="inp" style={{ maxWidth: "200px", flex: 1 }} value={selectedTeam} onChange={e => setSelectedTeam(e.target.value)}>
            <option value="all">All teams</option>
            {teams.map((t, i) => <option key={i} value={i}>{t.name}</option>)}
          </select>
          {hasWeeks && (
            <>
              <span className="lbl" style={{ marginBottom: 0, whiteSpace: "nowrap" }}>Week:</span>
              <select className="inp" style={{ maxWidth: "120px" }} value={selectedWeek} onChange={e => setSelectedWeek(e.target.value)}>
                <option value="all">All weeks</option>
                {weeks.map(w => <option key={w} value={w}>Week {w}</option>)}
              </select>
            </>
          )}
        </div>
      )}
      {fixtures.length > 0 && filtered.length === 0 && <div className="empty">No fixtures for this selection.</div>}
      {(() => {
        if (selectedWeek !== "all" || !hasWeeks) {
          // Specific week selected or no weeks assigned — show all grouped normally
          return grouped.map(group => {
            const gPending = group.fixtures.filter(f => !f.played);
            const gPlayed  = group.fixtures.filter(f =>  f.played);
            return (
              <div key={group.week ?? "none"}>
                {group.week != null && <div className="week-header">Week {group.week}</div>}
                {gPending.map(f => (
                  <ScoreRow key={f.id} f={f} teams={teams} liveP={liveProbs[f.id]} settings={settings}
                    onConfirm={onConfirm} onUndo={onUndo} onOverride={onOverride} onTeamClick={onTeamClick} onWeekChange={onWeekChange} />
                ))}
                {gPlayed.map(f => (
                  <ScoreRow key={f.id} f={f} teams={teams} liveP={liveProbs[f.id]} settings={settings}
                    onConfirm={onConfirm} onUndo={onUndo} onOverride={onOverride} onTeamClick={onTeamClick} onWeekChange={onWeekChange} />
                ))}
              </div>
            );
          });
        }

        // "All weeks" selected with weeks assigned:
        // Split groups into: completed vs pending
        const completedGroups = grouped.filter(g => g.week != null && g.fixtures.every(f => f.played));
        const pendingGroups   = grouped.filter(g => g.week == null || !g.fixtures.every(f => f.played));
        // Last completed = highest week number that is fully done
        const lastCompleted   = completedGroups.length > 0
          ? completedGroups[completedGroups.length - 1]
          : null;
        const olderCompleted  = completedGroups.slice(0, -1).reverse(); // rest, newest first

        function renderGroup(group) {
          const gPending = group.fixtures.filter(f => !f.played);
          const gPlayed  = group.fixtures.filter(f =>  f.played);
          const allDone  = gPending.length === 0;
          return (
            <div key={group.week ?? "none"}>
              {group.week != null && (
                <div className="week-header" style={allDone ? { color: "#4ade80" } : {}}>
                  Week {group.week}{allDone ? " ✓" : ""}
                </div>
              )}
              {gPending.map(f => (
                <ScoreRow key={f.id} f={f} teams={teams} liveP={liveProbs[f.id]} settings={settings}
                  onConfirm={onConfirm} onUndo={onUndo} onOverride={onOverride} onTeamClick={onTeamClick} onWeekChange={onWeekChange} />
              ))}
              {gPlayed.map(f => (
                <ScoreRow key={f.id} f={f} teams={teams} liveP={liveProbs[f.id]} settings={settings}
                  onConfirm={onConfirm} onUndo={onUndo} onOverride={onOverride} onTeamClick={onTeamClick} onWeekChange={onWeekChange} />
              ))}
            </div>
          );
        }

        return (
          <div>
            {lastCompleted && renderGroup(lastCompleted)}
            {pendingGroups.map(g => renderGroup(g))}
            {olderCompleted.length > 0 && (
              <div>
                <div style={{ borderTop: "1px solid #1c1f27", margin: "1rem 0 .5rem", fontFamily: "DM Mono,monospace", fontSize: ".68rem", color: "#3a3f50", textTransform: "uppercase", letterSpacing: ".08em" }}>
                  Completed weeks
                </div>
                {olderCompleted.map(g => renderGroup(g))}
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}


// ── TOURNAMENT BRACKET COMPONENT ──────────────────────────────────────────────
function MatchRow({ match, teams, rounds, liveProbs, settings, onConfirm, onUndo, onOverride, isTwoLeg }) {
  const [hg, setHg] = useState("");
  const [ag, setAg] = useState("");

  const hIdx = resolveRef(match.homeRef, teams, rounds);
  const aIdx = resolveRef(match.awayRef, teams, rounds);
  const hn = hIdx != null ? (teams[hIdx]?.name || "?") : "TBD";
  const an = aIdx != null ? (teams[aIdx]?.name || "?") : "TBD";
  const isTbd = hIdx == null || aIdx == null;
  const ws = settings?.winScore || 30;
  const ls = settings?.lossScore || 25;
  const ds = settings?.drawScore || 25;
  const probs = liveProbs && liveProbs[match.id] ? liveProbs[match.id] : null;

  // For two-leg duels, find the paired leg to show aggregate
  const pairedMatch = match.leg && match.pairedLegId
    ? rounds.flatMap(r => r.matches).find(m => m.id === match.pairedLegId)
    : null;

  let aggText = null;
  if (isTwoLeg && pairedMatch && (match.played || pairedMatch.played)) {
    // Calculate aggregate goals for "seedA" (the team that was home in leg 1)
    const leg1 = match.leg === 1 ? match : pairedMatch;
    const leg2 = match.leg === 2 ? match : pairedMatch;
    const seedAIdx = resolveRef(leg1.homeRef, teams, rounds);
    const seedBIdx = resolveRef(leg1.awayRef, teams, rounds);
    const aggA = (leg1.played ? +leg1.homeScore : 0) + (leg2.played ? +leg2.awayScore : 0);
    const aggB = (leg1.played ? +leg1.awayScore : 0) + (leg2.played ? +leg2.homeScore : 0);
    if (leg1.played || leg2.played) {
      const nameA = teams[seedAIdx]?.name || "?";
      const nameB = teams[seedBIdx]?.name || "?";
      aggText = nameA + " " + aggA + " — " + aggB + " " + nameB + " (agg)";
    }
  }

  const legLabel = match.leg ? "Leg " + match.leg : null;
  const neutralLabel = match.neutral ? "Neutral" : null;

  if (match.played && match.homeScore != null) {
    const hs = +match.homeScore, as_ = +match.awayScore;
    const res = hs > as_ ? "home" : hs < as_ ? "away" : "draw";
    const col = res === "home" ? "#4ade80" : res === "away" ? "#f87171" : "#facc15";
    return (
      <div className={"bracket-match done" + (match.neutral ? " neutral" : "") + (isTbd ? " tbd" : "")}>
        <div className="bm-teams">
          <span style={{ color: res === "home" ? "#4ade80" : "#d4d8e0" }}>{hn}</span>
          <span className="vs">vs</span>
          <span style={{ color: res === "away" ? "#f87171" : "#d4d8e0" }}>{an}</span>
        </div>
        <div className="bm-score">
          <span style={{ color: res === "home" ? "#4ade80" : res === "draw" ? "#facc15" : "#d4d8e0" }}>{match.homeScore}</span>
          <span className="score-sep">&mdash;</span>
          <span style={{ color: res === "away" ? "#f87171" : res === "draw" ? "#facc15" : "#d4d8e0" }}>{match.awayScore}</span>
          {aggText && <span className="bm-agg">{aggText}</span>}
        </div>
        {legLabel && <span className="bm-label">{legLabel}</span>}
        {neutralLabel && <span className="bm-label" style={{ color: "#a78bfa", borderColor: "#a78bfa" }}>{neutralLabel}</span>}
        <button className="btn-undo" onClick={() => onUndo(match.id)}>↩</button>
      </div>
    );
  }

  if (isTbd) {
    return (
      <div className="bracket-match tbd">
        <div className="bm-teams"><span className="muted">TBD</span><span className="vs">vs</span><span className="muted">TBD</span></div>
        {legLabel && <span className="bm-label">{legLabel}</span>}
        {neutralLabel && <span className="bm-label" style={{ color: "#a78bfa", borderColor: "#a78bfa" }}>{neutralLabel}</span>}
      </div>
    );
  }

  const ovrTotal = (parseFloat(match.ovHW) || 0) + (parseFloat(match.ovD) || 0) + (parseFloat(match.ovAW) || 0);
  const ovrOk = !match.overrideOn || Math.abs(ovrTotal - 100) <= 0.5;
  const displayProbs = (match.overrideOn && match.ovHW !== "") ? { homeWin: parseFloat(match.ovHW) || 0, draw: parseFloat(match.ovD) || 0, awayWin: parseFloat(match.ovAW) || 0 } : probs;

  return (
    <div className={"bracket-match" + (match.neutral ? " neutral" : "")} style={{ flexDirection: "column", alignItems: "stretch", gap: ".38rem" }}>
      <div style={{ display: "flex", alignItems: "center", gap: ".5rem", flexWrap: "wrap" }}>
        <div className="bm-teams"><span>{hn}</span><span className="vs">vs</span><span>{an}</span></div>
        {displayProbs && (
          <div className="fix-probs">
            {match.overrideOn && match.ovHW !== "" && <span className="ovr-tag">override</span>}
            <span className="ph-col">{displayProbs.homeWin}%</span>
            <span className="pd-col">{displayProbs.draw}%</span>
            <span className="pa-col">{displayProbs.awayWin}%</span>
          </div>
        )}
        {legLabel && <span className="bm-label">{legLabel}</span>}
        {neutralLabel && <span className="bm-label" style={{ color: "#a78bfa", borderColor: "#a78bfa" }}>{neutralLabel}</span>}
        <button className={"ovr-btn" + (match.overrideOn ? " active" : "")} onClick={() => onOverride(match.id, "toggle")}>
          {match.overrideOn ? "✓ Ovr" : "Ovr %"}
        </button>
      </div>
      {match.overrideOn && (
        <div className="ovr-row">
          <span className="muted" style={{ fontSize: ".7rem" }}>{hn.split(" ")[0]} W:</span>
          <input className="ovr-inp" type="number" min="0" max="100" value={match.ovHW} onChange={e => onOverride(match.id, "hw", e.target.value)} placeholder="0" />
          <span className="muted">D:</span>
          <input className="ovr-inp" type="number" min="0" max="100" value={match.ovD} onChange={e => onOverride(match.id, "d", e.target.value)} placeholder="0" />
          <span className="muted">{an.split(" ")[0]} W:</span>
          <input className="ovr-inp" type="number" min="0" max="100" value={match.ovAW} onChange={e => onOverride(match.id, "aw", e.target.value)} placeholder="0" />
          {match.ovHW !== "" && <span style={{ fontSize: ".7rem", color: ovrOk ? "#22d3ee" : "#f87171", fontFamily: "DM Mono,monospace" }}>{ovrTotal}% {ovrOk ? "✓" : "⚠"}</span>}
        </div>
      )}
      {aggText && <div style={{ fontSize: ".72rem", color: "#a78bfa", fontFamily: "DM Mono,monospace" }}>{aggText}</div>}
      <div style={{ display: "flex", alignItems: "center", gap: ".35rem", flexWrap: "wrap" }}>
        <button className="qbtn hw" onClick={() => onConfirm(match.id, ws, ls)}>{hn.split(" ")[0]} W</button>
        <button className="qbtn dr" onClick={() => onConfirm(match.id, ds, ds)}>Draw</button>
        <button className="qbtn aw" onClick={() => onConfirm(match.id, ls, ws)}>{an.split(" ")[0]} W</button>
        <input className="score-inp" type="number" min="0" value={hg} onChange={e => setHg(e.target.value)} placeholder="0" />
        <span className="score-sep">&mdash;</span>
        <input className="score-inp" type="number" min="0" value={ag} onChange={e => setAg(e.target.value)} placeholder="0" />
        <button className="confirm-btn" disabled={hg === "" || ag === ""} onClick={() => { if (hg !== "" && ag !== "") onConfirm(match.id, +hg, +ag); }}>OK</button>
      </div>
    </div>
  );
}

function TournamentBracket({ rounds, teams, liveProbs, settings, phase, onConfirm, onUndo, onOverride, onTeamClick }) {
  return (
    <div className="bracket">
      {rounds.map(round => (
        <div key={round.id} className="bracket-round">
          <div className={"bracket-round-title" + (round.type === "losers" ? " losers" : "")}>{round.label}</div>
          {round.matches.map((match, mi) => {
            const isTwoLeg = match.leg != null;
            return (
              <MatchRow key={match.id} match={match} teams={teams} rounds={rounds}
                liveProbs={liveProbs} settings={settings} isTwoLeg={isTwoLeg}
                onConfirm={onConfirm} onUndo={onUndo} onOverride={onOverride}
                onTeamClick={onTeamClick} />
            );
          })}
        </div>
      ))}
    </div>
  );
}

// ── PHASE VIEW (playoffs or playdowns) ────────────────────────────────────────
function PhaseView({ phase, phaseData, setPhaseData, settings, sourceStats, phaseFormat, label, color, infoText, onTeamClick, leagueId, aliases }) {
  const [tab, setTab] = useState(phaseFormat === "tournament" ? "bracket" : "table");
  const [confirmedTop, setConfirmedTop] = useState(null);
  const [confirmedBottom, setConfirmedBottom] = useState(null);

  // All hooks must come before any conditional return (React rules of hooks).
  const baseTeams = phaseData ? phaseData.teams : [];
  const isTournament = phaseData ? phaseData.format === "tournament" : phaseFormat === "tournament";
  const fixtures = phaseData ? (phaseData.fixtures || []) : [];
  const rounds = phaseData ? (phaseData.rounds || []) : [];
  const allMatches = isTournament ? rounds.flatMap(r => r.matches) : fixtures;
  const pending = allMatches.filter(f => !f.played);
  const played = allMatches.filter(f => f.played);

  // Add points earned from played fixtures on top of locked starting points.
  const teams = useMemo(() => {
    const earned = baseTeams.map(() => 0);
    played.forEach(f => {
      const hg = +f.homeScore, ag = +f.awayScore;
      if (isNaN(hg) || isNaN(ag)) return;
      if (hg > ag) earned[f.homeIdx] += 2;
      else if (hg < ag) earned[f.awayIdx] += 2;
      else { earned[f.homeIdx]++; earned[f.awayIdx]++; }
    });
    return baseTeams.map((t, i) => ({ ...t, points: t.points + earned[i] }));
  }, [baseTeams, played]);
  const liveProbs = useMemo(() => {
    if (!phaseData) return {};
    const m = {};
    pending.forEach(f => {
      if (f.tbd) return; // TBD matches — teams not yet known
      if (f.neutral) {
        const hIdx = resolveRef(f.homeRef, baseTeams, rounds);
        const aIdx = resolveRef(f.awayRef, baseTeams, rounds);
        if (hIdx != null && aIdx != null) m[f.id] = calcProbsNeutral(hIdx, aIdx, baseTeams, settings);
      } else if (isTournament) {
        const hIdx = resolveRef(f.homeRef, baseTeams, rounds);
        const aIdx = resolveRef(f.awayRef, baseTeams, rounds);
        if (hIdx != null && aIdx != null) m[f.id] = calcProbs(hIdx, aIdx, baseTeams, [], settings);
      } else {
        m[f.id] = calcProbs(f.homeIdx, f.awayIdx, teams, fixtures, settings);
      }
    });
    return m;
  }, [phaseData, settings, teams]);

  function generate() {
    if (phaseFormat === "tournament") {
      const isPlaydown = phase === "playdown";
      const result = generateTournament(sourceStats, settings, isPlaydown);
      setPhaseData({ teams: result.teams, fixtures: [], rounds: result.rounds, format: "tournament" });
    } else {
      const phTeams = sourceStats.map(r => ({ id: r.id, name: r.name, points: r.startingPts, homeBonus: "" }));
      const phFixtures = makeFixtures(phTeams, settings);
      setPhaseData({ teams: phTeams, fixtures: phFixtures, format: "round-robin" });
    }
  }

  if (!phaseData) {
    return (
      <div className="panel" style={{ borderColor: color, borderWidth: 2 }}>
        <div style={{ textAlign: "center", padding: "2rem" }}>
          <div style={{ fontFamily: "Syne,sans-serif", fontSize: "1.1rem", fontWeight: 700, color: "#fff", marginBottom: ".5rem" }}>{label}</div>
          <div className="muted" style={{ marginBottom: "1.25rem", fontSize: ".85rem" }}>{infoText}</div>
          {sourceStats && sourceStats.length > 0
            ? <button className="btn btn-cyan" style={{ background: color, borderColor: color }} onClick={generate}>Generate {label} Fixtures</button>
            : <div className="muted">Complete the regular season first.</div>
          }
        </div>
      </div>
    );
  }

  function updateMatch(id, updater) {
    setPhaseData(prev => {
      if (prev.format === "tournament") {
        return { ...prev, rounds: prev.rounds.map(r => ({ ...r, matches: r.matches.map(m => m.id === id ? updater(m) : m) })) };
      }
      return { ...prev, fixtures: prev.fixtures.map(f => f.id === id ? updater(f) : f) };
    });
  }
  function confirmScore(id, hg, ag) { updateMatch(id, m => ({ ...m, played: true, homeScore: hg, awayScore: ag, tbd: false })); }
  function unplay(id) { updateMatch(id, m => ({ ...m, played: false, homeScore: null, awayScore: null })); }
  function handleOverride(id, field, val) {
    updateMatch(id, m => {
      if (field === "toggle") return { ...m, overrideOn: !m.overrideOn };
      if (field === "hw") return { ...m, ovHW: val };
      if (field === "d") return { ...m, ovD: val };
      if (field === "aw") return { ...m, ovAW: val };
      return m;
    });
  }

  const htop = phase === "playoff" ? 2 : 0;
  const hbot = phase === "playdown" ? 2 : 0;

  return (
    <div className="panel" style={{ borderColor: color, borderWidth: 2 }}>
      <div className="ph">
        <span className="ph-num" style={{ color }}>{label[0]}</span>
        <div>
          <h2>{label}</h2>
          <p>2-round robin · {teams.length} teams · Starting points locked at generation</p>
        </div>
        <button className="btn btn-ghost" style={{ marginLeft: "auto", fontSize: ".72rem" }} onClick={() => { if (confirm("Regenerate? This clears all entered results.")) setPhaseData(null); }}>↺ Reset</button>
      </div>
      <div className="tabs">
        {(isTournament ? ["bracket", "monte"] : ["table", "scores", "monte"]).map(t => (
          <button key={t} className={"tab" + (tab === t ? " on" : "")} onClick={() => setTab(t)}>
            {t === "bracket" ? "Bracket" : t === "table" ? "Table" : t === "scores" ? "Scores" + (pending.length ? " (" + pending.length + ")" : "") : "Monte Carlo"}
          </button>
        ))}
      </div>
      {tab === "table" && (
        <LeagueTable teams={baseTeams} fixtures={fixtures} onTeamClick={i => onTeamClick && onTeamClick(baseTeams[i]?.id)} highlightTop={htop} highlightBottom={hbot} confirmedTop={confirmedTop} confirmedBottom={confirmedBottom} leagueId={leagueId} aliases={aliases} phaseTeams={baseTeams} phase={phase} />
      )}
      {tab === "scores" && (
        <ScoresTab teams={teams} fixtures={fixtures} liveProbs={liveProbs} settings={settings}
          onConfirm={confirmScore} onUndo={unplay} onOverride={handleOverride}
          onTeamClick={i => onTeamClick && onTeamClick(teams[i]?.id)}
          onWeekChange={(id, w) => updateMatch(id, m => ({ ...m, week: w }))} />
      )}
      {tab === "bracket" && (
        <TournamentBracket rounds={rounds} teams={baseTeams} liveProbs={liveProbs} settings={settings}
          phase={phase} onConfirm={confirmScore} onUndo={unplay} onOverride={handleOverride}
          onTeamClick={i => onTeamClick && onTeamClick(baseTeams[i]?.id)} />
      )}
      {tab === "monte" && (
        <MCTab key={played.length} teams={teams} fixtures={isTournament ? allMatches.filter(m => !m.tbd) : fixtures} settings={settings} highlightTop={htop} highlightBottom={hbot}
          onConfirmed={(ct, cb) => { setConfirmedTop(ct); setConfirmedBottom(cb); }} />
      )}
    </div>
  );
}

// ── STEP 3: SIMULATE ──────────────────────────────────────────────────────────
function SimStep({ league, setLeague, onBack }) {
  const { teams: initTeams, fixtures: initFixtures, settings, type, playoffs, playdowns, poSize: _poSize, pdSize: _pdSize, phaseFormat: _pfmt } = league;
  const [phase, setPhase] = useState("regular");
  const [tab, setTab] = useState("table");
  const [detail, setDetail] = useState(null);
  const [confirmedTop, setConfirmedTop] = useState(null);
  const [confirmedBottom, setConfirmedBottom] = useState(null);

  // Live points from scores
  const teams = useMemo(() => {
    const earned = initTeams.map(() => 0);
    initFixtures.filter(f => f.played && f.homeScore != null).forEach(f => {
      const hg = +f.homeScore, ag = +f.awayScore;
      if (isNaN(hg) || isNaN(ag)) return;
      if (hg > ag) earned[f.homeIdx] += 2;
      else if (hg < ag) earned[f.awayIdx] += 2;
      else { earned[f.homeIdx]++; earned[f.awayIdx]++; }
    });
    return initTeams.map((t, i) => ({ ...t, points: t.points + earned[i] }));
  }, [initTeams, initFixtures]);

  const pending = initFixtures.filter(f => !f.played);
  const played = initFixtures.filter(f => f.played);

  const liveProbs = useMemo(() => {
    const m = {};
    pending.forEach(f => { m[f.id] = fixProbs(f, teams, initFixtures, settings); });
    return m;
  }, [pending, teams, initFixtures, settings]);

  function setFixtures(u) { setLeague(lg => ({ ...lg, fixtures: typeof u === "function" ? u(lg.fixtures) : u })); }
  function setSettings(u) { setLeague(lg => ({ ...lg, settings: typeof u === "function" ? u(lg.settings) : u })); }
  function setPlayoffs(u) { setLeague(lg => ({ ...lg, playoffs: typeof u === "function" ? u(lg.playoffs) : u })); }
  function setPlaydowns(u) { setLeague(lg => ({ ...lg, playdowns: typeof u === "function" ? u(lg.playdowns) : u })); }

  function confirmScore(id, hg, ag) { setFixtures(prev => prev.map(f => f.id === id ? { ...f, played: true, homeScore: hg, awayScore: ag } : f)); }
  function unplay(id) { setFixtures(prev => prev.map(f => f.id === id ? { ...f, played: false, homeScore: null, awayScore: null } : f)); }
  function handleOverride(id, field, val) {
    setFixtures(prev => prev.map(f => {
      if (f.id !== id) return f;
      if (field === "toggle") return { ...f, overrideOn: !f.overrideOn };
      if (field === "hw") return { ...f, ovHW: val };
      if (field === "d") return { ...f, ovD: val };
      if (field === "aw") return { ...f, ovAW: val };
      return f;
    }));
  }

  const regStats = useMemo(() => calcStats(teams, initFixtures), [teams, initFixtures]);
  const n = teams.length;

  // Playoff source: top 6 with starting pts 6,5,4,3,2,1
  const poSz = _poSize || 6;
  const pdSz = _pdSize || 4;
  const pfmt = _pfmt || "round-robin";
  const playoffSource = useMemo(() => regStats.slice(0, poSz).map((r, i) => ({ ...r, startingPts: poSz - i })), [regStats, poSz]);
  // Playdown source: bottom 4 with starting pts 4,3,2,1
  const playdownSource = useMemo(() => regStats.slice(Math.max(0, n - pdSz)).map((r, i) => ({ ...r, startingPts: pdSz - i })), [regStats, n, pdSz]);

  const isPlayoff = type === "playoff";
  const stdPromo = (league.promoTop != null) ? league.promoTop : 2;
  const stdDemot = (league.demotBot != null) ? league.demotBot : 2;
  const hlTop = isPlayoff ? poSz : stdPromo;
  const hlBot = isPlayoff ? pdSz : stdDemot;

  // Detail lookup
  function openDetail(idx) { setDetail({ source: "regular", idx }); }

  const detailTeam = detail ? (detail.source === "regular" ? teams[detail.idx] : null) : null;

  return (
    <div>
      {isPlayoff && (
        <div className="phase-tabs">
          <button className={"phase-tab" + (phase === "regular" ? " rs-on" : "")} onClick={() => setPhase("regular")}>Regular Season</button>
          <button className={"phase-tab" + (phase === "playoff" ? " po-on" : "")} onClick={() => setPhase("playoff")}>Play-offs (Top 6)</button>
          <button className={"phase-tab" + (phase === "playdown" ? " pd-on" : "")} onClick={() => setPhase("playdown")}>Play-downs (Bottom 4)</button>
        </div>
      )}

      {phase === "playoff" && (
        <PhaseView phase="playoff" phaseData={playoffs} setPhaseData={setPlayoffs} settings={settings} sourceStats={playoffSource}
          phaseFormat={pfmt}
          label="Play-offs" color="#a78bfa"
          infoText={"Top " + poSz + " from regular season. Starting pts: rank 1 = " + poSz + " pts, rank 2 = " + (poSz-1) + " pts, etc."}
          leagueId={league.name} aliases={league.scorerAliases || {}}
          onTeamClick={id => { const t = (playoffs?.teams || []).find(t => t.id === id); const i = (playoffs?.teams || []).indexOf(t); if (t) setDetail({ source: "playoff", idx: i }); }} />
      )}
      {phase === "playdown" && (
        <PhaseView phase="playdown" phaseData={playdowns} setPhaseData={setPlaydowns} settings={settings} sourceStats={playdownSource}
          phaseFormat={pfmt}
          label="Play-downs" color="#f87171"
          infoText={"Bottom " + pdSz + " from regular season. Starting pts: rank 1 = " + pdSz + " pts, rank 2 = " + (pdSz-1) + " pts, etc."}
          leagueId={league.name} aliases={league.scorerAliases || {}}
          onTeamClick={id => { const t = (playdowns?.teams || []).find(t => t.id === id); const i = (playdowns?.teams || []).indexOf(t); if (t) setDetail({ source: "playdown", idx: i }); }} />
      )}

      {phase === "regular" && (
        <div className="panel">
          <div className="ph">
            <span className="ph-num">03</span>
            <div>
              <h2>{isPlayoff ? "Regular Season" : "Match Day & Results"}</h2>
              <p>Enter scores — table updates automatically.</p>
            </div>
          </div>
          <div className="tabs">
            {["table", "scores", "monte", "settings"].map(t => (
              <button key={t} className={"tab" + (tab === t ? " on" : "")} onClick={() => setTab(t)}>
                {t === "table" ? "League Table" : t === "scores" ? "Scores" + (pending.length ? " (" + pending.length + ")" : "") : t === "monte" ? "Monte Carlo" : "Settings"}
              </button>
            ))}
          </div>

          {tab === "table" && (
            <LeagueTable teams={initTeams} fixtures={initFixtures} onTeamClick={openDetail}
              highlightTop={hlTop} highlightBottom={hlBot}
              confirmedTop={confirmedTop} confirmedBottom={confirmedBottom}
              leagueId={league.name} aliases={league.scorerAliases || {}} />
          )}

          {tab === "scores" && (
            <ScoresTab teams={teams} fixtures={initFixtures} liveProbs={liveProbs} settings={settings}
              onConfirm={confirmScore} onUndo={unplay} onOverride={handleOverride} onTeamClick={openDetail}
              onWeekChange={(id, w) => setFixtures(prev => prev.map(f => f.id === id ? { ...f, week: w } : f))} />
          )}

          {tab === "monte" && (
            <MCTab key={played.length} teams={teams} fixtures={initFixtures} settings={settings}
              highlightTop={hlTop} highlightBottom={hlBot}
              onConfirmed={(ct, cb) => { setConfirmedTop(ct); setConfirmedBottom(cb); }} />
          )}

          {tab === "settings" && (
            <SettingsPanel settings={settings} onChange={(k, v) => setSettings(s => ({ ...s, [k]: v }))} showTiebreakers={true} league={league} onLeagueChange={setLeague} readOnly={IS_SHARE} />
          )}

          <div className="nav-row">
            {onBack && <button className="btn btn-ghost" onClick={onBack}>← Edit Fixtures</button>}
          </div>
        </div>
      )}

      {detail && (() => {
        let t = null, idx = null, fx = initFixtures, tms = teams;
        if (detail.source === "regular") { idx = detail.idx; t = teams[idx]; }
        else if (detail.source === "playoff" && playoffs) { tms = playoffs.teams; fx = playoffs.fixtures; idx = detail.idx; t = playoffs.teams[idx]; }
        else if (detail.source === "playdown" && playdowns) { tms = playdowns.teams; fx = playdowns.fixtures; idx = detail.idx; t = playdowns.teams[idx]; }
        if (!t) return null;
        return <TeamDetail team={t} teamIdx={idx} teams={tms} fixtures={fx} onClose={() => setDetail(null)} leagueId={league.name} aliases={league.scorerAliases || {}} phase={detail.source === "playoff" ? "playoff" : detail.source === "playdown" ? "playdown" : "regular"} />;
      })()}
    </div>
  );
}

// ── LEAGUE EDITOR ─────────────────────────────────────────────────────────────
function LeagueEditor({ league, onChange }) {
  const isLive = !!league.vhvLive;
  const [step, setStep] = useState(isLive ? 2 : (league.step || 0));

  function set(field) {
    return u => onChange(lg => ({ ...lg, [field]: typeof u === "function" ? u(lg[field]) : u }));
  }
  function setSettings(u) {
    onChange(lg => ({ ...lg, settings: typeof u === "function" ? u(lg.settings || defaultSettings()) : u }));
  }
  function goStep(s) { setStep(s); onChange(lg => ({ ...lg, step: s })); }

  const LABELS = ["Teams", "Fixtures", "Simulate"];

  return (
    <div>
      {!isLive && (
        <div className="steps">
          {LABELS.map((l, i) => (
            <div key={i} className={"step" + (step === i ? " on" : step > i ? " done" : "")}
              onClick={() => { if (i <= step) goStep(i); }}>
              {step > i ? "✓ " : ""}{l}
            </div>
          ))}
        </div>
      )}
      {!isLive && step === 0 && (
        <TeamsStep teams={league.teams} fixtures={league.fixtures} setTeams={set("teams")} leagueType={league.type} onNext={() => goStep(1)} />
      )}
      {!isLive && step === 1 && (
        <FixturesStep teams={league.teams} fixtures={league.fixtures} setFixtures={set("fixtures")}
          settings={league.settings || defaultSettings()} setSettings={setSettings}
          onBack={() => goStep(0)} onNext={() => goStep(2)} />
      )}
      {(isLive || step === 2) && (
        <SimStep league={league} setLeague={onChange} onBack={isLive ? null : () => goStep(1)} />
      )}
    </div>
  );
}

// ── BELGIAN HANDBALL SCREEN ───────────────────────────────────────────────────
const VHV_DATA_URL = "https://raw.githubusercontent.com/ozzyzorcopter/handball-League/refs/heads/main/vhv-data.json";

const FED_META = {
  "VHV":       { label: "VHV",       color: "#22d3ee", desc: "Vlaamse Handbalfederatie" },
  "LFH":       { label: "LFH",       color: "#a78bfa", desc: "Ligue Francophone de Handball" },
  "URBH-KBHB": { label: "URBH-KBHB", color: "#fbbf24", desc: "Union Royale Belge de Handball" },
};

function useVhvData() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    fetch(VHV_DATA_URL)
      .then(r => { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
      .then(d => setData(d))
      .catch(() => setError(true));
  }, []);
  return { data, error };
}

// The top-level Belgian screen — federation picker
function BelgianScreen({ onBack }) {
  const { data, error } = useVhvData();
  const [fed, setFed]   = useState(null);   // selected federation
  const [league, setLeague] = useState(null); // selected league object

  if (league) return <BelgianLeagueView league={league} onBack={() => setLeague(null)} />;

  const feds = data ? Object.keys(data.federations || {}) : [];

  return (
    <div className="panel">
      <div className="ph">
        <div>
          <h2>🇧🇪 Belgian Handball</h2>
          <p style={{ color: "#5a6070", fontSize: ".82rem" }}>
            Live competition data
            {data?.updatedAt && (
              <span> · updated {new Date(data.updatedAt).toLocaleString("nl-BE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
            )}
          </p>
        </div>
        <button className="btn btn-ghost" style={{ marginLeft: "auto" }} onClick={onBack}>← Back</button>
      </div>

      {!data && !error && (
        <div className="muted" style={{ padding: "2rem", textAlign: "center" }}>Loading data…</div>
      )}
      {error && (
        <div style={{ color: "#f87171", padding: "2rem", textAlign: "center" }}>Could not load data.</div>
      )}

      {data && (
        <>
          {/* Federation tabs */}
          <div style={{ display: "flex", gap: ".5rem", marginBottom: "1.5rem", flexWrap: "wrap" }}>
            {Object.keys(FED_META).map(f => {
              const available = feds.includes(f);
              const meta = FED_META[f];
              return (
                <button key={f}
                  className={"btn" + (fed === f ? "" : " btn-ghost")}
                  style={fed === f
                    ? { background: meta.color, color: "#08090c", border: "none" }
                    : { opacity: available ? 1 : 0.35 }}
                  disabled={!available}
                  onClick={() => setFed(fed === f ? null : f)}>
                  {meta.label}
                </button>
              );
            })}
          </div>

          {/* League cards for selected federation */}
          {fed && (() => {
            const leagues = Object.values(data.federations[fed] || {});
            const meta = FED_META[fed];
            if (leagues.length === 0) return (
              <div className="muted" style={{ padding: "1.5rem", textAlign: "center" }}>No leagues available yet for {meta.label}.</div>
            );
            return (
              <div className="card-grid">
                {leagues.map(lg => {
                  const played  = (lg.fixtures || []).filter(f => f.played).length;
                  const pending = (lg.fixtures || []).filter(f => !f.played).length;
                  return (
                    <div key={lg.serieId} className="card" onClick={() => setLeague(lg)}>
                      <div className="card-badge badge-std" style={{ borderColor: meta.color + "44", color: meta.color, background: meta.color + "18" }}>
                        {meta.label}
                      </div>
                      <div className="card-name">{lg.name}</div>
                      <div className="card-meta">
                        {(lg.teams || []).length} teams · {played} played · {pending} pending
                        {lg.live && (
                          <span style={{ display: "inline-block", marginLeft: ".4rem", fontSize: ".65rem", fontWeight: 700, color: "#4ade80", border: "1px solid #4ade80", borderRadius: "3px", padding: ".05rem .3rem", letterSpacing: ".04em" }}>● LIVE</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}

          {!fed && feds.length === 0 && (
            <div className="muted" style={{ padding: "2rem", textAlign: "center" }}>No competition data fetched yet — run the fetch-vhv workflow first.</div>
          )}
          {!fed && feds.length > 0 && (
            <div className="muted" style={{ padding: "1rem", textAlign: "center" }}>Select a federation above to browse leagues.</div>
          )}
        </>
      )}
    </div>
  );
}

// Read-only league view for Belgian Handball data
function BelgianLeagueView({ league, onBack }) {
  const { teams: initTeams = [], fixtures = [] } = league;
  const [detail, setDetail]           = useState(null);
  const [tab, setTab]                 = useState("table");
  const [settings, setSettings]       = useState({ baseWin: 47, baseDraw: 6, homeBonus: 10, rankBonus: 3, winScore: 30, lossScore: 25, drawScore: 25 });
  const [confirmedTop, setConfirmedTop]       = useState(null);
  const [confirmedBottom, setConfirmedBottom] = useState(null);
  // Local league state for SettingsPanel (highlight zones, aliases) — not persisted
  const [leagueState, setLeagueState] = useState({
    type: "standard", promoTop: 2, demotBot: 2,
    scorerUrl: "", playoffScorerUrl: "", playdownScorerUrl: "",
    scorerAliases: {}, teams: initTeams,
  });

  // Derive live points from played fixtures — same as SimStep
  const teams = useMemo(() => {
    const earned = initTeams.map(() => 0);
    fixtures.filter(f => f.played && f.homeScore != null).forEach(f => {
      const hg = +f.homeScore, ag = +f.awayScore;
      if (isNaN(hg) || isNaN(ag)) return;
      if (hg > ag) earned[f.homeIdx] += 2;
      else if (hg < ag) earned[f.awayIdx] += 2;
      else { earned[f.homeIdx]++; earned[f.awayIdx]++; }
    });
    return initTeams.map((t, i) => ({ ...t, points: t.points + earned[i] }));
  }, [initTeams, fixtures]);

  const pending = fixtures.filter(f => !f.played);
  const played  = fixtures.filter(f => f.played);

  const liveProbs = useMemo(() => {
    const m = {};
    pending.forEach(f => { m[f.id] = fixProbs(f, teams, fixtures, settings); });
    return m;
  }, [pending, teams, fixtures, settings]);

  const hlTop = leagueState.promoTop ?? 2;
  const hlBot = leagueState.demotBot ?? 2;

  return (
    <div>
      <div className="masthead" style={{ marginBottom: "1rem" }}>
        <div>
          <div className="logo" style={{ fontSize: "1.1rem" }}>{league.name}</div>
          <div className="sub" style={{ color: "#22d3ee" }}>
            {league.federation}
            {league.live && (
              <span style={{ display: "inline-block", marginLeft: ".5rem", fontSize: ".65rem", fontWeight: 700, color: "#4ade80", border: "1px solid #4ade80", borderRadius: "3px", padding: ".05rem .3rem", letterSpacing: ".04em" }}>● LIVE</span>
            )}
          </div>
        </div>
        <button className="btn btn-ghost" onClick={onBack}>← All Leagues</button>
      </div>

      <div className="panel">
        <div className="tabs">
          {["table", "scores", "monte", "settings"].map(t => (
            <button key={t} className={"tab" + (tab === t ? " on" : "")} onClick={() => setTab(t)}>
              {t === "table" ? "League Table" : t === "scores" ? "Scores" + (pending.length ? " (" + pending.length + ")" : "") : t === "monte" ? "Monte Carlo" : "Settings"}
            </button>
          ))}
        </div>

        {tab === "table" && (
          <LeagueTable
            teams={teams}
            fixtures={fixtures}
            onTeamClick={idx => setDetail({ idx })}
            highlightTop={hlTop}
            highlightBottom={hlBot}
            confirmedTop={confirmedTop}
            confirmedBottom={confirmedBottom}
            leagueId={`vhv:${league.serieId}`}
            aliases={leagueState.scorerAliases || {}}
            phaseTeams={null}
            phase="regular"
            toughFullWidth={true}
          />
        )}

        {tab === "scores" && (
          <ScoresTab
            teams={teams}
            fixtures={fixtures}
            liveProbs={liveProbs}
            settings={settings}
            onConfirm={null}
            onUndo={null}
            onOverride={null}
            onTeamClick={idx => setDetail({ idx })}
            onWeekChange={null}
          />
        )}

        {tab === "monte" && (
          <MCTab
            key={played.length}
            teams={teams}
            fixtures={fixtures}
            settings={settings}
            highlightTop={hlTop}
            highlightBottom={hlBot}
            onConfirmed={(ct, cb) => { setConfirmedTop(ct); setConfirmedBottom(cb); }}
          />
        )}

        {tab === "settings" && (
          <SettingsPanel
            settings={settings}
            onChange={(k, v) => setSettings(s => ({ ...s, [k]: v }))}
            showTiebreakers={true}
            league={leagueState}
            onLeagueChange={u => setLeagueState(s => typeof u === "function" ? u(s) : u)}
            readOnly={false}
          />
        )}
      </div>

      {detail != null && (
        <TeamDetail
          team={teams[detail.idx]}
          teamIdx={detail.idx}
          teams={teams}
          fixtures={fixtures}
          onClose={() => setDetail(null)}
          leagueId={`vhv:${league.serieId}`}
          aliases={leagueState.scorerAliases || {}}
          phase="regular"
        />
      )}
    </div>
  );
}

// ── ARCHIVE SCREEN ────────────────────────────────────────────────────────────
const ARCHIVE_INDEX_URL = "https://ozzyzorcopter.github.io/handball-League/archive/index.json";

function useArchiveIndex() {
  const [index, setIndex] = useState(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    fetch(ARCHIVE_INDEX_URL)
      .then(r => { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
      .then(data => setIndex(data))
      .catch(() => { setError(true); setIndex([]); });
  }, []);
  return { index, error };
}

function useArchiveSeason(filename) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    if (!filename) return;
    const url = "https://ozzyzorcopter.github.io/handball-League/archive/" + filename;
    fetch(url)
      .then(r => { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
      .then(d => setData(d))
      .catch(() => setError(true));
  }, [filename]);
  return { data, error };
}

function ArchiveScreen({ onBack }) {
  const { index, error } = useArchiveIndex();
  const [selected, setSelected] = useState(null);

  if (selected) return <ArchiveSeasonView filename={selected} onBack={() => setSelected(null)} />;

  return (
    <div className="panel">
      <div className="ph">
        <div>
          <h2>📦 Archive</h2>
          <p style={{ color: "#5a6070", fontSize: ".82rem" }}>Past seasons — read only</p>
        </div>
        <button className="btn btn-ghost" style={{ marginLeft: "auto" }} onClick={onBack}>← Back</button>
      </div>
      {index === null && <div className="muted" style={{ padding: "2rem", textAlign: "center" }}>Loading archive…</div>}
      {error && <div style={{ color: "#f87171", padding: "2rem", textAlign: "center" }}>Could not load archive.</div>}
      {index && index.length === 0 && <div className="muted" style={{ padding: "2rem", textAlign: "center" }}>No archived seasons yet.</div>}
      {index && index.length > 0 && (
        <div className="card-grid" style={{ marginTop: "1rem" }}>
          {index.map(s => (
            <div key={s.filename} className="season-card" onClick={() => setSelected(s.filename)}>
              <div className="season-card-title">{s.season}</div>
              <div className="season-card-meta">{s.leagueCount} leagues · archived {new Date(s.archivedAt).toLocaleDateString("nl-BE")}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ArchiveSeasonView({ filename, onBack }) {
  const { data, error } = useArchiveSeason(filename);
  const [activeLeague, setActiveLeague] = useState(null);

  if (error) return (
    <div className="panel">
      <button className="btn btn-ghost" onClick={onBack}>← Back</button>
      <div style={{ color: "#f87171", padding: "2rem", textAlign: "center" }}>Could not load season data.</div>
    </div>
  );

  if (!data) return <div className="muted" style={{ padding: "3rem", textAlign: "center" }}>Loading season…</div>;

  if (activeLeague !== null) {
    const lg = data.leagues[activeLeague];
    return <ArchiveLeagueView league={lg} scorers={data.scorers} season={data.season} onBack={() => setActiveLeague(null)} />;
  }

  return (
    <div className="panel">
      <div className="ph">
        <div>
          <h2>📦 {data.season}</h2>
          <p style={{ color: "#5a6070", fontSize: ".82rem" }}>Archived {new Date(data.archivedAt).toLocaleDateString("nl-BE")} · read only</p>
        </div>
        <button className="btn btn-ghost" style={{ marginLeft: "auto" }} onClick={onBack}>← Back</button>
      </div>
      <div className="card-grid" style={{ marginTop: "1rem" }}>
        {data.leagues.map((lg, i) => (
          <div key={lg.id} className="card" onClick={() => setActiveLeague(i)}>
            <div className={"card-badge " + (lg.type === "playoff" ? "badge-po" : "badge-std")}>
              {lg.type === "playoff" ? "Play-off League" : "Standard League"}
            </div>
            <div className="card-name">{lg.name}</div>
            <div className="card-meta">{(lg.teams || []).length} teams · {(lg.fixtures || []).filter(f => f.played).length} played</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ArchiveLeagueView({ league, scorers, season, onBack }) {
  const [detail, setDetail] = useState(null);
  const { teams, fixtures, settings, type, playoffs, playdowns } = league;
  const [phase, setPhase] = useState("regular");

  // Cached scorer data from archive
  const archiveScorers = useMemo(() => {
    if (!scorers) return null;
    const leagueData = scorers[league.name];
    return leagueData || null;
  }, [scorers, league.name]);

  const currentTeams = phase === "playoff" && playoffs ? playoffs.teams
    : phase === "playdown" && playdowns ? playdowns.teams
    : teams;
  const currentFixtures = phase === "playoff" && playoffs ? playoffs.fixtures
    : phase === "playdown" && playdowns ? playdowns.fixtures
    : fixtures;

  function openDetail(idx) {
    if (idx >= 0 && idx < currentTeams.length) setDetail({ idx, phase });
  }

  return (
    <div>
      <div className="masthead" style={{ marginBottom: "1rem" }}>
        <div>
          <div className="logo" style={{ fontSize: "1rem" }}>{league.name}</div>
          <div className="sub" style={{ color: "#fbbf24" }}>📦 {season} — read only</div>
        </div>
        <button className="btn btn-ghost" onClick={onBack}>← Back</button>
      </div>

      <div className="archive-banner">📦 Archive — {season} · Read only</div>

      {type === "playoff" && (
        <div className="tabs" style={{ marginBottom: "1rem" }}>
          {["regular", "playoff", "playdown"].map(p => (
            <button key={p} className={"tab" + (phase === p ? " on" : "")} onClick={() => setPhase(p)}>
              {p === "regular" ? "Regular Season" : p === "playoff" ? "Play-offs" : "Play-downs"}
            </button>
          ))}
        </div>
      )}

      <LeagueTable
        teams={currentTeams}
        fixtures={currentFixtures}
        onTeamClick={id => openDetail(id)}
        highlightTop={phase === "playoff" ? 2 : league.promoTop ?? 2}
        highlightBottom={phase === "playdown" ? 2 : league.demotBot ?? 2}
        confirmedTop={null}
        confirmedBottom={null}
        leagueId={null}
        aliases={league.scorerAliases || {}}
        archiveScorers={archiveScorers}
      />

      {detail && (() => {
        const tms = detail.phase === "playoff" && playoffs ? playoffs.teams
          : detail.phase === "playdown" && playdowns ? playdowns.teams
          : teams;
        const fx = detail.phase === "playoff" && playoffs ? playoffs.fixtures
          : detail.phase === "playdown" && playdowns ? playdowns.fixtures
          : fixtures;
        const t = tms[detail.idx];
        if (!t) return null;
        return <TeamDetail team={t} teamIdx={detail.idx} teams={tms} fixtures={fx} onClose={() => setDetail(null)} leagueId={null} aliases={league.scorerAliases || {}} archiveScorers={archiveScorers} />;
      })()}
    </div>
  );
}

// ── ROOT APP ──────────────────────────────────────────────────────────────────
const LEAGUESIM_DATA_URL = "https://raw.githubusercontent.com/ozzyzorcopter/handball-League/refs/heads/main/leaguesim-data.json";

function App() {
  const [store, setStore] = useState({ leagues: [] });
  const [activeId, setActiveId] = useState(null);
  const [showArchive, setShowArchive] = useState(false);
  const [showBelgian, setShowBelgian] = useState(false);

  // ── Share mode: auto-load from repo ──────────────────────────────────────
  const [loadStatus, setLoadStatus] = useState(IS_SHARE ? "loading" : "ok");
  useEffect(() => {
    if (!IS_SHARE) return;
    fetch(LEAGUESIM_DATA_URL)
      .then(r => { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
      .then(data => {
        if (!data.leagues) throw new Error("Not a LeagueSim file");
        setStore(data);
        setActiveId(data.leagues.length === 1 ? data.leagues[0].id : null);
        setLoadStatus("ok");
      })
      .catch(e => { console.error(e); setLoadStatus("error"); });
  }, []);

  // ── Edit mode: manual save/load ───────────────────────────────────────────
  const [msg, setMsg] = useState("");
  const msgTimer = useRef(null);
  function flash(m) { setMsg(m); clearTimeout(msgTimer.current); msgTimer.current = setTimeout(() => setMsg(""), 2500); }
  function handleSave() { saveData(store); flash("Downloading…"); }
  function handleLoad() {
    loadData().then(data => {
      if (!data.leagues) throw new Error("Not a LeagueSim file");
      setStore(data); setActiveId(null); flash("Loaded!");
    }).catch(e => alert("Could not load: " + e));
  }

  function createLeague(name, type, poSize, pdSize, phaseFormat, archivable) { const lg = makeLeague(name, type, poSize, pdSize, phaseFormat, archivable); setStore(s => ({ ...s, leagues: [...s.leagues, lg] })); setActiveId(lg.id); }
  function deleteLeague(id) { if (!confirm("Delete this league?")) return; setStore(s => ({ ...s, leagues: s.leagues.filter(lg => lg.id !== id) })); if (activeId === id) setActiveId(null); }
  function updateLeague(id, u) { setStore(s => ({ ...s, leagues: s.leagues.map(lg => lg.id === id ? (typeof u === "function" ? u(lg) : u) : lg) })); }
  function toggleArchivable(id) { updateLeague(id, lg => ({ ...lg, archivable: !lg.archivable })); }

  const active = store.leagues.find(lg => lg.id === activeId) || null;

  if (showBelgian) return <BelgianScreen onBack={() => setShowBelgian(false)} />;
  if (showArchive) return <ArchiveScreen onBack={() => setShowArchive(false)} />;

  return (
    <div className="app">
      <div className="masthead">
        <div>
          <div className="logo">League<span>Sim</span></div>
          <div className="sub">{active ? active.name : store.leagues.length + " league" + (store.leagues.length !== 1 ? "s" : "")}</div>
        </div>
        <div className="top-btns">
          {IS_SHARE ? (
            <>
              {loadStatus === "loading" && <span className="muted">⏳ Loading data…</span>}
              {loadStatus === "error" && <span style={{ color: "#f87171" }}>⚠️ Could not load data</span>}
              {active && <button className="btn btn-ghost" onClick={() => setActiveId(null)}>← All Leagues</button>}
            </>
          ) : (
            <>
              {msg && <span className="muted">{msg}</span>}
              <button className="btn btn-cyan" onClick={handleSave}>💾 Save</button>
              <button className="btn btn-ghost" onClick={handleLoad}>📂 Load</button>
              {active && <button className="btn btn-ghost" onClick={() => setActiveId(null)}>← All Leagues</button>}
            </>
          )}
        </div>
      </div>
      {!active && <HomeScreen leagues={store.leagues} onOpen={setActiveId} onCreate={createLeague} onDelete={deleteLeague} onToggleArchivable={toggleArchivable} onOpenArchive={() => setShowArchive(true)} onOpenBelgian={() => setShowBelgian(true)} />}
      {active && <LeagueEditor key={active.id} league={active} onChange={u => updateLeague(active.id, u)} />}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
