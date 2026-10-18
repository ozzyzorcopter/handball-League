import { cleanTeamName } from "./names.js";
import { useLang } from "./i18n.js";
import { MEDALS } from "./config.js";
import { calcStats } from "./standings.js";
import { teamKey, useFollow } from "./follow.js";
import { predictMatch } from "./probabilities.js";
import { LeagueScorers } from "./panels.js";
import { ProbBar } from "./ProbBar.js";
const { useState, useMemo } = React;
// ── LEAGUE TABLE ──────────────────────────────────────────────────────────────
export function LeagueTable({ teams, fixtures, ranking, onTeamClick, highlightTop, highlightBottom, confirmedTop, confirmedBottom, leagueId, aliases, archiveScorers, phaseTeams, phase, toughFullWidth, topSingleGamePlayers, travelRanking, followKey, hideScorers }) {
  const rows = useMemo(() => calcStats(teams, fixtures, ranking), [teams, fixtures, ranking]);
  const follow = useFollow();
  const { t } = useLang();
  const isMine = id => !!followKey && follow.isFollowing(teamKey(followKey, id));
  const nm = idx => (teams[idx] && isMine(teams[idx].id) ? "★ " : "") + cleanTeamName(teams[idx].name);

  // Last 5 results per team (oldest → newest). Played fixtures are ordered by
  // date when present (ISO strings sort correctly); fixtures without a date
  // (e.g. results entered manually in the sim) keep their list order.
  const formById = useMemo(() => {
    const played = fixtures
      .map((f, idx) => ({ f, idx }))
      .filter(({ f }) => f.played && f.homeScore != null && f.awayScore != null)
      .sort((a, b) => {
        const da = a.f.date || "", db = b.f.date || "";
        if (da !== db && da && db) return da < db ? -1 : 1;
        return a.idx - b.idx;
      });
    const m = {};
    played.forEach(({ f }) => {
      const hg = +f.homeScore, ag = +f.awayScore;
      if (isNaN(hg) || isNaN(ag)) return;
      const hid = teams[f.homeIdx]?.id, aid = teams[f.awayIdx]?.id;
      if (hid == null || aid == null) return;
      (m[hid] = m[hid] || []).push(hg > ag ? "W" : hg < ag ? "L" : "D");
      (m[aid] = m[aid] || []).push(ag > hg ? "W" : ag < hg ? "L" : "D");
    });
    Object.keys(m).forEach(k => { m[k] = m[k].slice(-5); });
    return m;
  }, [fixtures, teams]);

  // Weekly windows, rolling over every Monday: "last week" = the previous
  // Monday up to (not including) this Monday (played games); "this week" =
  // this Monday up to (not including) next Monday (played AND upcoming — a
  // game stays here once played until the Monday rollover). Computed from the viewer's current date,
  // so the panels roll over on their own each Monday.
  const weekWindow = useMemo(() => {
    const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const now = new Date();
    const thisMon = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7));
    const prevMon = new Date(thisMon.getFullYear(), thisMon.getMonth(), thisMon.getDate() - 7);
    const nextMon = new Date(thisMon.getFullYear(), thisMon.getMonth(), thisMon.getDate() + 7);
    const lastSun = new Date(thisMon.getFullYear(), thisMon.getMonth(), thisMon.getDate() - 1);
    const nextSun = new Date(nextMon.getFullYear(), nextMon.getMonth(), nextMon.getDate() - 1);
    return { prev: iso(prevMon), cur: iso(thisMon), next: iso(nextMon), prevEnd: iso(lastSun), nextEnd: iso(nextSun) };
  }, []);
  const byDate = (a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
  const lastMatches = useMemo(() => fixtures
    .filter(f => f.played && f.homeScore != null && f.awayScore != null && f.date
      && f.date.slice(0, 10) >= weekWindow.prev && f.date.slice(0, 10) < weekWindow.cur
      && teams[f.homeIdx] && teams[f.awayIdx])
    .sort(byDate), [fixtures, teams, weekWindow]);
  const nextMatches = useMemo(() => fixtures
    .filter(f => f.date
      && f.date.slice(0, 10) >= weekWindow.cur && f.date.slice(0, 10) < weekWindow.next
      && teams[f.homeIdx] && teams[f.awayIdx])
    .sort(byDate), [fixtures, teams, weekWindow]);
  const preds = useMemo(() => {
    const m = {};
    nextMatches.forEach(f => { if (!(f.played && f.homeScore != null)) m[f.id] = predictMatch(f.homeIdx, f.awayIdx, teams, fixtures); });
    return m;
  }, [nextMatches, teams, fixtures]);
  const fmtShort = d => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d || ""); return m ? `${m[3]}/${m[2]}` : "—"; };
  const fmtMatchDate = fmtShort;
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

  // Highest single-game score ranking: the best score any team put up in
  // one match (home or away), with who they beat/played and the date.
  const highGameRanking = useMemo(() => {
    const played = fixtures.filter(f => f.played && f.homeScore != null && f.awayScore != null);
    const N = teams.length;
    const best = new Array(N).fill(null);
    played.forEach(f => {
      const hi = f.homeIdx, ai = f.awayIdx;
      const hg = +f.homeScore, ag = +f.awayScore;
      if (hi < N && (!best[hi] || hg > best[hi].score)) {
        best[hi] = { score: hg, vs: teams[ai]?.name || "?", date: f.date };
      }
      if (ai < N && (!best[ai] || ag > best[ai].score)) {
        best[ai] = { score: ag, vs: teams[hi]?.name || "?", date: f.date };
      }
    });
    return teams
      .map((t, i) => ({ id: t.id, name: t.name, score: best[i]?.score ?? 0, vs: best[i]?.vs || "", date: best[i]?.date }))
      .filter(r => r.score > 0)
      .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  }, [fixtures, teams]);
  const topHighGame = highGameRanking.slice(0, 3);

  // Player-level highest single-game goal count, from the pre-computed
  // per-league boxscore ranking (topSingleGamePlayers) — empty until the
  // data pipeline has boxscores cached for this league's played games.
  const topHighGamePlayers = (topSingleGamePlayers || []).slice(0, 3);

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
              <th className="tl">{t("Team")}</th>
              <th title={t("Played")}>P</th>
              <th title={t("Won")}>W</th>
              <th title={t("Draw")}>D</th>
              <th title={t("Lost")}>L</th>
              <th className="hide-sm" title={t("Goals For")}>GF</th>
              <th className="hide-sm" title={t("Goals Against")}>GA</th>
              <th className="tgd" title={t("Goal Difference")}>GD</th>
              <th className="tpts" title={t("Points")}>Pts</th>
              <th title={t("Last 5 games (oldest → newest)")}>{t("Form")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const ti = teams.findIndex(t => t.id === r.id);
              const bg = rowBg(i, r);
              const gdc = r.GD > 0 ? "gdp" : r.GD < 0 ? "gdn" : "gd0";
              return (
                <tr key={r.id} style={{ ...(bg ? { background: bg, "--rb": bg } : {}), ...(isMine(r.id) ? { boxShadow: "inset 3px 0 0 #fbbf24" } : {}) }}>
                  <td className="tpos" style={bg ? { color: "rgba(255,255,255,0.85)", fontWeight: 700 } : {}}>{i + 1}</td>
                  <td className="tl">
                    {followKey && (
                      <button className="otbtn" style={{ marginRight: ".3rem", color: isMine(r.id) ? "#fbbf24" : "#6b7280", minWidth: "1.6rem" }}
                        aria-label={(isMine(r.id) ? "Unfollow " : "Follow ") + cleanTeamName(r.name)}
                        title={isMine(r.id) ? "Unfollow" : "Follow this team"}
                        onClick={() => follow.toggle(teamKey(followKey, r.id))}>{isMine(r.id) ? "★" : "☆"}</button>
                    )}
                    <button className="otbtn" onClick={() => onTeamClick && onTeamClick(ti)}>{cleanTeamName(r.name)}</button>
                  </td>
                  <td>{r.P}</td>
                  <td style={{ color: "#4ade80" }}>{r.W}</td>
                  <td style={{ color: "#facc15" }}>{r.D}</td>
                  <td style={{ color: "#f87171" }}>{r.L}</td>
                  <td className="hide-sm">{r.GF}</td>
                  <td className="hide-sm">{r.GA}</td>
                  <td className={gdc}>{r.GD > 0 ? "+" + r.GD : r.GD}</td>
                  <td className="tpts">{r.totalPts}</td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    {(formById[r.id] || []).map((res, k) => (
                      <span key={k} title={res === "W" ? "Win" : res === "D" ? "Draw" : "Loss"}
                        style={{ display: "inline-block", width: "1.1rem", textAlign: "center", fontWeight: 700, fontSize: ".78rem",
                          color: res === "W" ? "#4ade80" : res === "D" ? "#9ca3af" : "#f87171" }}>
                        {res === "W" ? "✓" : res === "D" ? "D" : "–"}
                      </span>
                    ))}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="note">{t("Click a team name for match details")}{followKey ? " · " + t("☆ follows a team (saved on this device)") : ""}</p>
      <div className="mini-box" style={{ marginTop: "1rem" }}>
        <div className="mini-ttl" style={{ color: "#22d3ee", display: "flex", justifyContent: "space-between" }}>
          <span>{t("🗓 Games last week")}</span>
          <span className="muted" style={{ fontWeight: 400, fontSize: ".7rem" }}>{fmtShort(weekWindow.prev)} – {fmtShort(weekWindow.prevEnd)}</span>
        </div>
        {lastMatches.length === 0 && <div className="muted" style={{ fontSize: ".78rem" }}>{t("No games last week.")}</div>}
        {lastMatches.map((f, k) => (
          <div key={f.id || k} className="mini-row" style={{ gap: ".5rem" }}>
            <span className="muted" style={{ fontFamily: "DM Mono,monospace", fontSize: ".7rem", minWidth: f.time ? "4.6rem" : "2.6rem" }}>{fmtMatchDate(f.date)}{f.time ? " " + f.time : ""}</span>
            <span style={{ fontSize: ".78rem" }}>
              <span style={{ fontWeight: +f.homeScore > +f.awayScore ? 700 : 400 }}>{nm(f.homeIdx)}</span>
              <span className="mini-val" style={{ margin: "0 .4rem", color: "#fbbf24" }}>{f.homeScore}–{f.awayScore}</span>
              <span style={{ fontWeight: +f.awayScore > +f.homeScore ? 700 : 400 }}>{nm(f.awayIdx)}</span>
            </span>
          </div>
        ))}
      </div>
      <div className="mini-box" style={{ marginTop: "1rem" }}>
        <div className="mini-ttl" style={{ color: "#a78bfa", display: "flex", justifyContent: "space-between" }}>
          <span>{t("⏭ Games this week")}</span>
          <span className="muted" style={{ fontWeight: 400, fontSize: ".7rem" }}>{fmtShort(weekWindow.cur)} – {fmtShort(weekWindow.nextEnd)}</span>
        </div>
        {nextMatches.length === 0 && <div className="muted" style={{ fontSize: ".78rem" }}>{t("No games this week.")}</div>}
        {nextMatches.map((f, k) => (
          <div key={f.id || k} className="mini-row" style={{ gap: ".5rem" }}>
            <span className="muted" style={{ fontFamily: "DM Mono,monospace", fontSize: ".7rem", minWidth: f.time ? "4.6rem" : "2.6rem" }}>{fmtMatchDate(f.date)}{f.time ? " " + f.time : ""}</span>
            <span style={{ fontSize: ".78rem" }}>
              {(() => {
                const done = f.played && f.homeScore != null && f.awayScore != null;
                return (
                  <>
                    <span style={{ fontWeight: done && +f.homeScore > +f.awayScore ? 700 : 400 }}>{nm(f.homeIdx)}</span>
                    {done
                      ? <span className="mini-val" style={{ margin: "0 .4rem", color: "#fbbf24" }}>{f.homeScore}–{f.awayScore}</span>
                      : <span className="muted" style={{ margin: "0 .4rem" }}>{t("vs")}</span>}
                    <span style={{ fontWeight: done && +f.awayScore > +f.homeScore ? 700 : 400 }}>{nm(f.awayIdx)}</span>
                    {!done && preds[f.id] && (
                      <span style={{ display: "block", marginTop: ".25rem", maxWidth: "13rem" }}>
                        <ProbBar title={t("Goal model: home win / draw / away win chance, expected score")} h={preds[f.id].homeWin} d={preds[f.id].draw} a={preds[f.id].awayWin} eh={preds[f.id].eh} ea={preds[f.id].ea} />
                      </span>
                    )}
                  </>
                );
              })()}
            </span>
          </div>
        ))}
      </div>
      {!hideScorers && Array.isArray(archiveScorers) && <LeagueScorers leagueId={leagueId} teams={teams} aliases={aliases} archiveScorers={archiveScorers} phaseTeams={phaseTeams} phase={phase} />}
      {hasPlayed && (
        <>
          {/* Row 1: Attackers + Defenders */}
          <div className="mini-rankings" style={{ marginTop: "1rem" }}>
            <div>
              <div className="mini-box" style={{ cursor: "pointer" }} onClick={() => setRankingPanel(rankingPanel === "attackers" ? null : "attackers")}>
                <div className="mini-ttl" style={{ color: "#f87171", userSelect: "none", display: "flex", justifyContent: "space-between" }}>
                  <span>{t("⚽ Top Attackers")}</span><span>{rankingPanel === "attackers" ? "▲" : "▼"}</span>
                </div>
                {attackers.map((r, i) => (
                  <div key={r.id} className="mini-row">
                    <span className="mini-pos">{MEDALS[i]}</span>
                    <span className="mini-name">{cleanTeamName(r.name)}</span>
                    <span className="mini-val" style={{ color: "#f87171" }}>{r.GF} GF</span>
                  </div>
                ))}
              </div>
              {rankingPanel === "attackers" && (
                <div className="ranking-expand">
                  <div style={{ fontSize: ".72rem", color: "#8b93a5", marginBottom: ".5rem" }}>{t("Total goals scored across all played fixtures.")}</div>
                  {allAttackers.map((r, i) => (
                    <div key={r.id} className="mini-row">
                      <span className="mini-pos" style={{ minWidth: "1.8rem", color: i < 3 ? "#f87171" : "#7d8597" }}>{i < 3 ? MEDALS[i] : (i+1)+"."}</span>
                      <span className="mini-name">{cleanTeamName(r.name)}</span>
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
                  <span>{t("🛡 Top Defenders")}</span><span>{rankingPanel === "defenders" ? "▲" : "▼"}</span>
                </div>
                {defenders.map((r, i) => (
                  <div key={r.id} className="mini-row">
                    <span className="mini-pos">{MEDALS[i]}</span>
                    <span className="mini-name">{cleanTeamName(r.name)}</span>
                    <span className="mini-val" style={{ color: "#4ade80" }}>{r.GA} GA</span>
                  </div>
                ))}
              </div>
              {rankingPanel === "defenders" && (
                <div className="ranking-expand">
                  <div style={{ fontSize: ".72rem", color: "#8b93a5", marginBottom: ".5rem" }}>{t("Fewest goals conceded across all played fixtures.")}</div>
                  {allDefenders.map((r, i) => (
                    <div key={r.id} className="mini-row">
                      <span className="mini-pos" style={{ minWidth: "1.8rem", color: i < 3 ? "#4ade80" : "#7d8597" }}>{i < 3 ? MEDALS[i] : (i+1)+"."}</span>
                      <span className="mini-name">{cleanTeamName(r.name)}</span>
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
                  <span>{t("🏠 Strongest Home")}</span><span>{rankingPanel === "home" ? "▲" : "▼"}</span>
                </div>
                {topHome.map((r, i) => (
                  <div key={r.id} className="mini-row">
                    <span className="mini-pos">{i < 3 ? MEDALS[i] : (i+1)+"."}</span>
                    <span className="mini-name">{cleanTeamName(r.name)}</span>
                    <span className="mini-val" style={{ color: "#fb923c" }}>{r.gd > 0 ? "+" : ""}{r.gd} GD</span>
                  </div>
                ))}
              </div>
              {rankingPanel === "home" && (
                <div className="ranking-expand">
                  <div style={{ fontSize: ".72rem", color: "#8b93a5", marginBottom: ".5rem" }}>{t("Combined goal difference across all home fixtures.")}</div>
                  {homeGDRanking.map((r, i) => (
                    <div key={r.id} className="mini-row">
                      <span className="mini-pos" style={{ minWidth: "1.8rem", color: i < 3 ? "#fb923c" : "#7d8597" }}>{i < 3 ? MEDALS[i] : (i+1)+"."}</span>
                      <span className="mini-name">{cleanTeamName(r.name)}</span>
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
                  <span>{t("✈️ Strongest Away")}</span><span>{rankingPanel === "away" ? "▲" : "▼"}</span>
                </div>
                {topAway.map((r, i) => (
                  <div key={r.id} className="mini-row">
                    <span className="mini-pos">{i < 3 ? MEDALS[i] : (i+1)+"."}</span>
                    <span className="mini-name">{cleanTeamName(r.name)}</span>
                    <span className="mini-val" style={{ color: "#a78bfa" }}>{r.gd > 0 ? "+" : ""}{r.gd} GD</span>
                  </div>
                ))}
              </div>
              {rankingPanel === "away" && (
                <div className="ranking-expand">
                  <div style={{ fontSize: ".72rem", color: "#8b93a5", marginBottom: ".5rem" }}>{t("Combined goal difference across all away fixtures.")}</div>
                  {awayGDRanking.map((r, i) => (
                    <div key={r.id} className="mini-row">
                      <span className="mini-pos" style={{ minWidth: "1.8rem", color: i < 3 ? "#a78bfa" : "#7d8597" }}>{i < 3 ? MEDALS[i] : (i+1)+"."}</span>
                      <span className="mini-name">{cleanTeamName(r.name)}</span>
                      <span className="mini-val" style={{ color: "#a78bfa" }}>{r.gd > 0 ? "+" : ""}{r.gd} GD</span>
                      <span className="muted" style={{ fontSize: ".72rem", marginLeft: ".25rem" }}>({r.P}g)</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Row 2b: Most Goals in a Single Game — team + player */}
          <div className="mini-rankings" style={{ marginTop: ".75rem" }}>
            <div>
              <div className="mini-box" style={{ cursor: "pointer" }} onClick={() => setRankingPanel(rankingPanel === "highgame" ? null : "highgame")}>
                <div className="mini-ttl" style={{ color: "#22d3ee", userSelect: "none", display: "flex", justifyContent: "space-between" }}>
                  <span>{t("🔥 Most Goals (Game)")}</span><span>{rankingPanel === "highgame" ? "▲" : "▼"}</span>
                </div>
                {topHighGame.length === 0 && (
                  <div className="muted" style={{ fontSize: ".78rem" }}>{t("No played games yet.")}</div>
                )}
                {topHighGame.map((r, i) => (
                  <div key={r.id} className="mini-row">
                    <span className="mini-pos">{i < 3 ? MEDALS[i] : (i+1)+"."}</span>
                    <span className="mini-name">{cleanTeamName(r.name)}</span>
                    <span className="mini-val" style={{ color: "#22d3ee" }}>{r.score}</span>
                  </div>
                ))}
              </div>
              {rankingPanel === "highgame" && (
                <div className="ranking-expand">
                  <div style={{ fontSize: ".72rem", color: "#8b93a5", marginBottom: ".5rem" }}>{t("Highest score by a team in a single match.")}</div>
                  {highGameRanking.map((r, i) => (
                    <div key={r.id} className="mini-row">
                      <span className="mini-pos" style={{ minWidth: "1.8rem", color: i < 3 ? "#22d3ee" : "#7d8597" }}>{i < 3 ? MEDALS[i] : (i+1)+"."}</span>
                      <span className="mini-name">{cleanTeamName(r.name)}</span>
                      <span className="mini-val" style={{ color: "#22d3ee" }}>{r.score}</span>
                      <span className="muted" style={{ fontSize: ".72rem", marginLeft: ".25rem" }}>vs {cleanTeamName(r.vs)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div>
              <div className="mini-box" style={{ cursor: "pointer" }} onClick={() => setRankingPanel(rankingPanel === "highgameplayer" ? null : "highgameplayer")}>
                <div className="mini-ttl" style={{ color: "#f472b6", userSelect: "none", display: "flex", justifyContent: "space-between" }}>
                  <span>{t("🎯 Most Goals (Player)")}</span><span>{rankingPanel === "highgameplayer" ? "▲" : "▼"}</span>
                </div>
                {topHighGamePlayers.length === 0 && (
                  <div className="muted" style={{ fontSize: ".78rem" }}>{t("No data yet.")}</div>
                )}
                {topHighGamePlayers.map((r, i) => (
                  <div key={i} className="mini-row">
                    <span className="mini-pos">{i < 3 ? MEDALS[i] : (i+1)+"."}</span>
                    <span className="mini-name">{r.player}</span>
                    <span className="mini-val" style={{ color: "#f472b6" }}>{r.goals}</span>
                  </div>
                ))}
              </div>
              {rankingPanel === "highgameplayer" && (
                <div className="ranking-expand">
                  <div style={{ fontSize: ".72rem", color: "#8b93a5", marginBottom: ".5rem" }}>{t("Most goals scored by a player in a single match.")}</div>
                  {(topSingleGamePlayers || []).map((r, i) => (
                    <div key={i} className="mini-row">
                      <span className="mini-pos" style={{ minWidth: "1.8rem", color: i < 3 ? "#f472b6" : "#7d8597" }}>{i < 3 ? MEDALS[i] : (i+1)+"."}</span>
                      <span className="mini-name">{r.player}</span>
                      <span className="mini-val" style={{ color: "#f472b6" }}>{r.goals}</span>
                      <span className="muted" style={{ fontSize: ".72rem", marginLeft: ".25rem" }}>{r.club}</span>
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
                    <span>{t("💀 Toughest Teams")}</span><span>{rankingPanel === "tough" ? "▲" : "▼"}</span>
                  </div>
                  {toughRanking.slice(0, 3).map((r, i) => (
                    <div key={r.id} className="mini-row">
                      <span className="mini-pos">{MEDALS[i]}</span>
                      <span className="mini-name">{cleanTeamName(r.name)}</span>
                      <span className="mini-val" style={{ color: "#f87171" }}>{r.pts} pts</span>
                    </div>
                  ))}
                </div>
                {rankingPanel === "tough" && (
                  <div className="ranking-expand">
                    <div style={{ fontSize: ".72rem", color: "#8b93a5", marginBottom: ".5rem" }}>{t("How tough a team is to beat, scored by total GD opponents face against them.")}</div>
                    {toughRanking.map((r, i) => (
                      <div key={r.id} className="mini-row">
                        <span className="mini-pos" style={{ minWidth: "1.8rem", color: i < 3 ? "#f87171" : "#7d8597" }}>{i < 3 ? MEDALS[i] : (i+1)+"."}</span>
                        <span className="mini-name">{cleanTeamName(r.name)}</span>
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
                    <span>{t("💀 Toughest Teams")}</span><span>{rankingPanel === "tough" ? "▲" : "▼"}</span>
                  </div>
                  {toughRanking.slice(0, 3).map((r, i) => (
                    <div key={r.id} className="mini-row">
                      <span className="mini-pos">{MEDALS[i]}</span>
                      <span className="mini-name">{cleanTeamName(r.name)}</span>
                      <span className="mini-val" style={{ color: "#f87171" }}>{r.pts} pts</span>
                    </div>
                  ))}
                </div>
                {rankingPanel === "tough" && (
                  <div className="ranking-expand">
                    <div style={{ fontSize: ".72rem", color: "#8b93a5", marginBottom: ".5rem" }}>{t("How tough a team is to beat, scored by total GD opponents face against them.")}</div>
                    {toughRanking.map((r, i) => (
                      <div key={r.id} className="mini-row">
                        <span className="mini-pos" style={{ minWidth: "1.8rem", color: i < 3 ? "#f87171" : "#7d8597" }}>{i < 3 ? MEDALS[i] : (i+1)+"."}</span>
                        <span className="mini-name">{cleanTeamName(r.name)}</span>
                        <span className="mini-val" style={{ color: "#f87171" }}>{r.pts} pts</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <div className="mini-box" style={{ cursor: "pointer" }} onClick={() => setRankingPanel(rankingPanel === "clutch" ? null : "clutch")}>
                  <div className="mini-ttl" style={{ color: "#facc15", userSelect: "none", display: "flex", justifyContent: "space-between" }}>
                    <span>{t("🎯 Most Clutch")}</span><span>{rankingPanel === "clutch" ? "▲" : "▼"}</span>
                  </div>
                  {topClutch.map((r, i) => (
                    <div key={r.id} className="mini-row">
                      <span className="mini-pos">{r.tied ? "—" : (i < 3 ? MEDALS[i] : (i+1)+".")}</span>
                      <span className="mini-name">{cleanTeamName(r.name)}</span>
                      <span className="mini-val" style={{ color: "#facc15" }}>{r.wins}W</span>
                    </div>
                  ))}
                </div>
                {rankingPanel === "clutch" && (
                  <div className="ranking-expand">
                    <div style={{ fontSize: ".72rem", color: "#8b93a5", marginBottom: ".5rem" }}>{t("Number of wins by 1 or 2 goals.")}</div>
                    {clutchRanking.map((r, i) => (
                      <div key={r.id} className="mini-row">
                        <span className="mini-pos" style={{ minWidth: "1.8rem", color: i < 3 ? "#facc15" : "#7d8597" }}>{r.tied ? "—" : (i < 3 ? MEDALS[i] : (i+1)+".")}</span>
                        <span className="mini-name">{cleanTeamName(r.name)}</span>
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
                      <span>{t("😤 Most Unlucky")}</span><span>{rankingPanel === "unlucky" ? "▲" : "▼"}</span>
                    </div>
                    {topUnlucky.map((r, i) => (
                      <div key={r.id} className="mini-row">
                        <span className="mini-pos">{i < 3 ? MEDALS[i] : (i+1)+"."}</span>
                        <span className="mini-name">{cleanTeamName(r.name)}</span>
                        <span className="mini-val" style={{ color: "#94a3b8" }}>{r.draws}D {r.losses1 + r.losses2}L</span>
                      </div>
                    ))}
                  </div>
                  {rankingPanel === "unlucky" && (
                    <div className="ranking-expand">
                      <div style={{ fontSize: ".72rem", color: "#8b93a5", marginBottom: ".5rem" }}>{t("Draw = 3 pts · Loss 1GD = 2 pts · Loss 2GD = 1 pt.")}</div>
                      {unluckyRanking.map((r, i) => (
                        <div key={r.id} className="mini-row">
                          <span className="mini-pos" style={{ minWidth: "1.8rem", color: i < 3 ? "#94a3b8" : "#7d8597" }}>{i < 3 ? MEDALS[i] : (i+1)+"."}</span>
                          <span className="mini-name">{cleanTeamName(r.name)}</span>
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
                      <span>{t("🎯 Most Clutch")}</span><span>{rankingPanel === "clutch" ? "▲" : "▼"}</span>
                    </div>
                    {topClutch.map((r, i) => (
                      <div key={r.id} className="mini-row">
                        <span className="mini-pos">{r.tied ? "—" : (i < 3 ? MEDALS[i] : (i+1)+".")}</span>
                        <span className="mini-name">{cleanTeamName(r.name)}</span>
                        <span className="mini-val" style={{ color: "#facc15" }}>{r.wins}W</span>
                      </div>
                    ))}
                  </div>
                  {rankingPanel === "clutch" && (
                    <div className="ranking-expand">
                      <div style={{ fontSize: ".72rem", color: "#8b93a5", marginBottom: ".5rem" }}>{t("Number of wins by 1 or 2 goals.")}</div>
                      {clutchRanking.map((r, i) => (
                        <div key={r.id} className="mini-row">
                          <span className="mini-pos" style={{ minWidth: "1.8rem", color: i < 3 ? "#facc15" : "#7d8597" }}>{r.tied ? "—" : (i < 3 ? MEDALS[i] : (i+1)+".")}</span>
                          <span className="mini-name">{cleanTeamName(r.name)}</span>
                          <span className="mini-val" style={{ color: "#facc15" }}>{r.wins}W</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div>
                <div className="mini-box" style={{ cursor: "pointer" }} onClick={() => setRankingPanel(rankingPanel === "unlucky" ? null : "unlucky")}>
                  <div className="mini-ttl" style={{ color: "#94a3b8", userSelect: "none", display: "flex", justifyContent: "space-between" }}>
                    <span>{t("😤 Most Unlucky")}</span><span>{rankingPanel === "unlucky" ? "▲" : "▼"}</span>
                  </div>
                  {topUnlucky.map((r, i) => (
                    <div key={r.id} className="mini-row">
                      <span className="mini-pos">{i < 3 ? MEDALS[i] : (i+1)+"."}</span>
                      <span className="mini-name">{cleanTeamName(r.name)}</span>
                      <span className="mini-val" style={{ color: "#94a3b8" }}>{r.draws}D {r.losses1 + r.losses2}L</span>
                    </div>
                  ))}
                </div>
                {rankingPanel === "unlucky" && (
                  <div className="ranking-expand">
                    <div style={{ fontSize: ".72rem", color: "#8b93a5", marginBottom: ".5rem" }}>{t("Draw = 3 pts · Loss 1GD = 2 pts · Loss 2GD = 1 pt.")}</div>
                    {unluckyRanking.map((r, i) => (
                      <div key={r.id} className="mini-row">
                        <span className="mini-pos" style={{ minWidth: "1.8rem", color: i < 3 ? "#94a3b8" : "#7d8597" }}>{i < 3 ? MEDALS[i] : (i+1)+"."}</span>
                        <span className="mini-name">{cleanTeamName(r.name)}</span>
                        <span className="mini-val" style={{ color: "#94a3b8" }}>{r.draws}D {r.losses1 + r.losses2}L</span>
                        <span className="muted" style={{ fontSize: ".72rem", marginLeft: ".25rem" }}>({r.pts} pts)</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            {!toughFullWidth && (travelRanking || []).length > 0 && (
              <div>
                <div className="mini-box" style={{ cursor: "pointer" }} onClick={() => setRankingPanel(rankingPanel === "travel" ? null : "travel")}>
                  <div className="mini-ttl" style={{ color: "#38bdf8", userSelect: "none", display: "flex", justifyContent: "space-between" }}>
                    <span>{t("🚗 Distance Travelled")}</span><span>{rankingPanel === "travel" ? "▲" : "▼"}</span>
                  </div>
                  {travelRanking.slice(0, 3).map((r, i) => (
                    <div key={r.id} className="mini-row">
                      <span className="mini-pos">{MEDALS[i]}</span>
                      <span className="mini-name">{cleanTeamName(r.name)}</span>
                      <span className="mini-val" style={{ color: "#38bdf8" }}>{(r.estimatedLegs || r.missingLegs) ? "~" : ""}{r.km} km</span>
                    </div>
                  ))}
                </div>
                {rankingPanel === "travel" && (
                  <div className="ranking-expand">
                    <div style={{ fontSize: ".72rem", color: "#8b93a5", marginBottom: ".5rem" }}>{t("Driving distance from each team's home venue to every away game played this season.")}</div>
                    {travelRanking.map((r, i) => (
                      <div key={r.id} className="mini-row">
                        <span className="mini-pos" style={{ minWidth: "1.8rem", color: i < 3 ? "#38bdf8" : "#7d8597" }}>{i < 3 ? MEDALS[i] : (i+1)+"."}</span>
                        <span className="mini-name">{cleanTeamName(r.name)}</span>
                        <span className="mini-val" style={{ color: "#38bdf8" }}>{(r.estimatedLegs || r.missingLegs) ? "~" : ""}{r.km} km</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Row 5: Distance Travelled — how far each team has travelled to away games this season */}
          {toughFullWidth && (travelRanking || []).length > 0 && (
            <div className="mini-rankings" style={{ marginTop: ".75rem" }}>
              <div>
                <div className="mini-box" style={{ cursor: "pointer" }} onClick={() => setRankingPanel(rankingPanel === "travel" ? null : "travel")}>
                  <div className="mini-ttl" style={{ color: "#38bdf8", userSelect: "none", display: "flex", justifyContent: "space-between" }}>
                    <span>{t("🚗 Distance Travelled")}</span><span>{rankingPanel === "travel" ? "▲" : "▼"}</span>
                  </div>
                  {travelRanking.slice(0, 3).map((r, i) => (
                    <div key={r.id} className="mini-row">
                      <span className="mini-pos">{MEDALS[i]}</span>
                      <span className="mini-name">{cleanTeamName(r.name)}</span>
                      <span className="mini-val" style={{ color: "#38bdf8" }}>{(r.estimatedLegs || r.missingLegs) ? "~" : ""}{r.km} km</span>
                    </div>
                  ))}
                </div>
                {rankingPanel === "travel" && (
                  <div className="ranking-expand">
                    <div style={{ fontSize: ".72rem", color: "#8b93a5", marginBottom: ".5rem" }}>{t("Driving distance from each team's home venue to every away game played this season.")}</div>
                    {travelRanking.map((r, i) => (
                      <div key={r.id} className="mini-row">
                        <span className="mini-pos" style={{ minWidth: "1.8rem", color: i < 3 ? "#38bdf8" : "#7d8597" }}>{i < 3 ? MEDALS[i] : (i+1)+"."}</span>
                        <span className="mini-name">{cleanTeamName(r.name)}</span>
                        <span className="mini-val" style={{ color: "#38bdf8" }}>{(r.estimatedLegs || r.missingLegs) ? "~" : ""}{r.km} km</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
