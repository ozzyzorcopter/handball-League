import { calcProbsNeutral } from "./probabilities.js";
// ── TOURNAMENT GENERATOR ──────────────────────────────────────────────────────
// nearestPow2GTE(n): smallest power of 2 >= n
export function nearestPow2GTE(n) { let p = 1; while (p < n) p *= 2; return p; }

// Generate tournament bracket data structure.
// Returns { teams, rounds } where rounds is an array of round objects.
// Each round has { label, type:"winners"|"losers"|"final", matches:[...] }
// Each match: { id, leg:1|2|null, homeRef, awayRef, neutral, played, homeScore, awayScore,
//               overrideOn, ovHW, ovD, ovAW }
// homeRef/awayRef: { type:"team"|"winner"|"loser", teamIdx, matchId, legMatchId }
export function generateTournament(sourceStats, settings, isPlaydown) {
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

// Resolve a ref to a team index given current match results
// Returns teamIdx or null if not yet known
export function resolveRef(ref, teams, rounds) {
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
