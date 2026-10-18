import { FED_META, useVhvData } from "./vhvData.js";
import { LANG_LOCALE, LangSwitch, useLang } from "./i18n.js";
import { teamSnapshot, useFollow } from "./follow.js";
import { ClubPicker, PICKER_DISMISS_KEY } from "./ClubPicker.js";
import { modelProbs, predictMatch, weekBounds } from "./probabilities.js";
import { assignWeeks } from "./weeks.js";
import { cleanTeamName } from "./names.js";
import { ProbBar } from "./ProbBar.js";
import { Skeleton } from "./Skeleton.js";
import { ErrorBoundary } from "./ErrorBoundary.js";
import { LeagueTable } from "./LeagueTable.js";
import { TeamDetail } from "./TeamDetail.js";
import { MCTab, ScoresTab } from "./scores.js";
import { PlayersTab } from "./PlayersTab.js";
import { SettingsPanel } from "./SettingsPanel.js";
const { useState, useMemo, useEffect } = React;
// The top-level Belgian screen — federation picker with division sub-groups
export function BelgianScreen({ onBack }) {
  // Bottom bar follows the page: "Leagues" lights up once the federation buttons reach the top half.
  const [navSel, setNavSel] = useState("teams");
  useEffect(() => {
    const onScroll = () => {
      const el = document.getElementById("fed-tabs");
      if (!el) return;
      const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
      setNavSel(el.getBoundingClientRect().top < window.innerHeight * 0.5 && (window.scrollY > 40 || atBottom) ? "leagues" : "teams");
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  const { data, error, loadLeague, failed } = useVhvData();
  const { lang, t } = useLang();
  const [fed, setFed]       = useState(null);
  const [league, setLeague] = useState(null);

  const follow = useFollow();
  const [pickerForced, setPickerForced] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(() => { try { return !localStorage.getItem(PICKER_DISMISS_KEY); } catch { return true; } });
  const myTeams = useMemo(() => {
    if (!data) return [];
    const byLeague = new Map();
    for (const f of Object.values(data.federations || {})) {
      for (const lg of Object.values(f || {})) byLeague.set(String(lg.serieId || lg.id), lg);
    }
    return follow.ids.map(key => {
      const cut = key.indexOf(":");
      const lg = byLeague.get(key.slice(0, cut));
      if (!lg) return null;
      const teamId = (lg.teams || []).find(t => String(t.id) === key.slice(cut + 1))?.id;
      let snap = null;
      try { snap = teamId != null ? teamSnapshot(lg, teamId) : null; } catch { snap = null; }
      return snap ? { key, lg, snap } : null;
    }).filter(Boolean).sort((a, b) => (b.key === follow.main) - (a.key === follow.main));
  }, [data, follow.ids, follow.main]);
  // Load the full data for every league you follow (the rest stays on the server until opened).
  const ready = !!data;
  useEffect(() => {
    if (!ready) return;
    follow.ids.forEach(k => { const cut = k.indexOf(":"); if (cut > 0) loadLeague(k.slice(0, cut)); });
  }, [ready, follow.ids, loadLeague]);
  // Opening a league from the list: fetch it if only the stub is known.
  useEffect(() => { if (league && !league.fixtures) loadLeague(league.serieId); }, [league, loadLeague]);
  const openLeague = useMemo(() => {
    if (!league) return null;
    if (league.fixtures) return league;
    if (!data) return null;
    for (const f of Object.values(data.federations || {})) {
      const lg = f && f[String(league.serieId)];
      if (lg && lg.fixtures) return lg;
    }
    return null;
  }, [league, data]);

  const weekGames = useMemo(() => {
    if (!data) return [];
    const { cur, next } = weekBounds();
    const byLeague = new Map();
    for (const f of Object.values(data.federations || {})) {
      for (const lg of Object.values(f || {})) byLeague.set(String(lg.serieId || lg.id), lg);
    }
    const mine = {};
    follow.ids.forEach(key => {
      const cut = key.indexOf(":");
      (mine[key.slice(0, cut)] = mine[key.slice(0, cut)] || new Set()).add(key.slice(cut + 1));
    });
    const out = [];
    Object.entries(mine).forEach(([lid, ids]) => {
      const lg = byLeague.get(lid);
      if (!lg) return;
      const teams = lg.teams || [], fixtures = lg.fixtures || [];
      fixtures.forEach(f => {
        const h = teams[f.homeIdx], a = teams[f.awayIdx];
        if (!h || !a || !f.date) return;
        const d = f.date.slice(0, 10);
        const hm = ids.has(String(h.id)), am = ids.has(String(a.id));
        if (d < cur || d >= next || !(hm || am)) return;
        const done = f.played && f.homeScore != null && f.awayScore != null;
        let pred = null;
        try { pred = done ? null : predictMatch(f.homeIdx, f.awayIdx, teams, fixtures); } catch { pred = null; }
        out.push({ id: lid + ":" + f.id, date: f.date, time: f.time || null, home: cleanTeamName(h.name), away: cleanTeamName(a.name), hm, am, done, hs: f.homeScore, as: f.awayScore, pred, lg });
      });
    });
    return out.sort((x, y) => (x.date < y.date ? -1 : x.date > y.date ? 1 : 0));
  }, [data, follow.ids]);

  if (league && openLeague) return <ErrorBoundary onBack={() => setLeague(null)}><BelgianLeagueView league={openLeague} onBack={() => setLeague(null)} /></ErrorBoundary>;
  if (league) return (
    <div className="panel">
      <button className="btn btn-ghost" onClick={() => setLeague(null)}>{t("← Back")}</button>
      {failed[String(league.serieId)]
        ? <div style={{ color: "#f87171", padding: "2rem", textAlign: "center" }}>{t("Could not load data.")}</div>
        : <Skeleton label={t("Loading data…")} />}
    </div>
  );

  const feds = data ? Object.keys(data.federations || {}) : [];
  return (
    <div className="panel">
      <div className="ph">
        <div>
          <h2>🇧🇪 {t("Belgian Handball")}</h2>
          <p style={{ color: "#5a6070", fontSize: ".82rem" }}>
            {t("Live competition data")}
            {data?.updatedAt && (
              <span> · {t("updated")} {new Date(data.updatedAt).toLocaleString(LANG_LOCALE[lang], { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
            )}
          </p>
        </div>
        <span style={{ marginLeft: "auto", display: "inline-flex", gap: ".6rem", alignItems: "center" }}><LangSwitch /><button className="btn btn-ghost" onClick={onBack}>{t("← Back")}</button></span>
      </div>

      {!data && !error && <Skeleton rows={8} label={t("Loading data…")} />}
      {error && <div style={{ color: "#f87171", padding: "2rem", textAlign: "center" }}>{t("Could not load data.")}</div>}

      {data && (
        <>
          {/* First visit / add team */}
          {pickerOpen && (follow.ids.length === 0 || pickerForced) && (
            <ClubPicker data={data} follow={follow} onClose={saved => { setPickerForced(false); if (!saved) setPickerOpen(false); }} />
          )}
          {/* My teams */}
          <div className="mini-box" style={{ marginBottom: "1.25rem" }}>
            <div className="mini-ttl" style={{ color: "#fbbf24", marginBottom: ".5rem", display: "flex", justifyContent: "space-between" }}>
              <span>{t("★ My teams")}</span>
              <button className="btn btn-ghost" style={{ fontSize: ".7rem", padding: ".15rem .5rem" }} onClick={() => { setPickerOpen(true); setPickerForced(true); }}>{t("＋ Add club")}</button>
            </div>
            {myTeams.length === 0 && (
              <div className="muted" style={{ fontSize: ".8rem" }}>{t("Open any league and tap ☆ next to a team to follow it. Your teams show up here, with position, form and next match.")}</div>
            )}
            {myTeams.map(({ key, lg, snap }) => (
              <div key={key} className="mini-row" style={{ gap: ".6rem", flexWrap: "wrap", cursor: "pointer", padding: ".45rem 0" }} onClick={() => setLeague(lg)}>
                <span style={{ minWidth: "9rem", fontWeight: 700 }}>
                  {key === follow.main && <span title={t("Main team")} style={{ color: "#fbbf24", marginRight: ".3rem" }}>★</span>}
                  {snap.name}
                  <span className="muted" style={{ display: "block", fontWeight: 400, fontSize: ".68rem" }}>{lg.name}</span>
                </span>
                <span style={{ fontFamily: "DM Mono,monospace", fontSize: ".8rem" }}>{snap.pos}/{snap.of} · {snap.pts} {t("pts")}</span>
                <span style={{ whiteSpace: "nowrap" }}>
                  {snap.form.map((res, k) => (
                    <span key={k} style={{ display: "inline-block", width: "1.1rem", textAlign: "center", fontWeight: 700, fontSize: ".78rem",
                      color: res === "W" ? "#4ade80" : res === "D" ? "#9ca3af" : "#f87171" }}>{res === "W" ? "✓" : res === "D" ? "D" : "–"}</span>
                  ))}
                </span>
                <span className="muted" style={{ fontSize: ".76rem", flex: 1 }}>
                  {snap.next ? t("Next") + ": " + (snap.next.date ? snap.next.date.slice(8, 10) + "/" + snap.next.date.slice(5, 7) + " " + (snap.next.time ? snap.next.time + " " : "") : "") + (snap.next.home ? t("vs") + " " : t("at") + " ") + snap.next.opp : t("No upcoming game")}
                </span>
                {key !== follow.main && (
                  <button className="btn btn-ghost" style={{ fontSize: ".7rem", padding: ".15rem .5rem" }}
                    onClick={e => { e.stopPropagation(); follow.setMain(key); }}>{t("Make main")}</button>
                )}
              </div>
            ))}
            {weekGames.length > 0 && (
              <div style={{ marginTop: ".7rem", borderTop: "1px solid #2a2f3a", paddingTop: ".5rem" }}>
                <div className="muted" style={{ fontSize: ".7rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: ".3rem" }}>{t("This week · all my teams")}</div>
                {weekGames.map(g => (
                  <div key={g.id} className="mini-row" style={{ gap: ".5rem", flexWrap: "wrap", cursor: "pointer" }} onClick={() => setLeague(g.lg)}>
                    <span className="muted" style={{ fontFamily: "DM Mono,monospace", fontSize: ".7rem", minWidth: g.time ? "4.6rem" : "2.6rem" }}>{g.date.slice(8, 10)}/{g.date.slice(5, 7)}{g.time ? " " + g.time : ""}</span>
                    <span style={{ fontSize: ".8rem" }}>
                      <span style={{ fontWeight: g.hm ? 700 : 400 }}>{g.hm ? "★ " : ""}{g.home}</span>
                      {g.done ? <span className="mini-val" style={{ margin: "0 .4rem", color: "#fbbf24" }}>{g.hs}–{g.as}</span> : <span className="muted" style={{ margin: "0 .4rem" }}>{t("vs")}</span>}
                      <span style={{ fontWeight: g.am ? 700 : 400 }}>{g.am ? "★ " : ""}{g.away}</span>
                      <span className="muted" style={{ display: "block", fontSize: ".66rem" }}>{g.lg.name}</span>
                    </span>
                    {g.pred && <div style={{ flexBasis: "100%", maxWidth: "13rem", marginLeft: g.time ? "5.1rem" : "3.1rem" }}><ProbBar title={t("Goal model: home win / draw / away win chance, expected score")} h={g.pred.homeWin} d={g.pred.draw} a={g.pred.awayWin} eh={g.pred.eh} ea={g.pred.ea} /></div>}
                  </div>
                ))}
              </div>
            )}
          </div>
          {/* Federation tabs */}
          <div id="fed-tabs" style={{ display: "flex", gap: ".5rem", marginBottom: "1.5rem", flexWrap: "wrap" }}>
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

          {/* Leagues for selected federation, grouped by division */}
          {fed && (() => {
            const allLeagues = Object.values(data.federations[fed] || {});
            const meta = FED_META[fed];
            if (allLeagues.length === 0) return (
              <div className="muted" style={{ padding: "1.5rem", textAlign: "center" }}>{t("No leagues available yet for")} {meta.label}.</div>
            );
            // Group by division, preserving insertion order
            const divisionMap = new Map();
            for (const lg of allLeagues) {
              const div = lg.division || "General";
              if (!divisionMap.has(div)) divisionMap.set(div, []);
              divisionMap.get(div).push(lg);
            }
            return (
              <>
                {[...divisionMap.entries()].map(([division, leagues]) => (
                  <div key={division} style={{ marginBottom: "1.5rem" }}>
                    <div className="sub-ttl" style={{ marginBottom: ".75rem", color: meta.color }}>{division}</div>
                    <div className="card-grid">
                      {leagues.map(lg => {
                        const played  = lg.fixtures ? lg.fixtures.filter(f => f.played).length : (lg.played || 0);
                        const pending = lg.fixtures ? lg.fixtures.filter(f => !f.played).length : (lg.pending || 0);
                        return (
                          <div key={lg.serieId || lg.id} className="card" onClick={() => setLeague(lg)}>
                            <div className="card-badge badge-std" style={{ borderColor: meta.color + "44", color: meta.color, background: meta.color + "18" }}>
                              {meta.label}
                            </div>
                            <div className="card-name">{lg.name}</div>
                            <div className="card-meta">
                              {(lg.teams || []).length} {t("teams")} · {played} {t("played")} · {pending} {t("pending")}
                              {lg.live && (
                                <span style={{ display: "inline-block", marginLeft: ".4rem", fontSize: ".65rem", fontWeight: 700, color: "#4ade80", border: "1px solid #4ade80", borderRadius: "3px", padding: ".05rem .3rem", letterSpacing: ".04em" }}>● LIVE</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </>
            );
          })()}

          {!fed && feds.length === 0 && (
            <div className="muted" style={{ padding: "2rem", textAlign: "center" }}>{t("No competition data fetched yet — run the fetch-vhv workflow first.")}</div>
          )}
          {!fed && feds.length > 0 && (
            <div className="muted" style={{ padding: "1rem", textAlign: "center" }}>{t("Select a federation above to browse leagues.")}</div>
          )}
                  </>
      )}

      <nav className="bnav" aria-label={t("Main navigation")}>
        <button className={"bnav-btn" + (navSel === "teams" ? " on" : "")} aria-current={navSel === "teams" ? "page" : undefined}
          onClick={() => { setNavSel("teams"); window.scrollTo({ top: 0, behavior: "smooth" }); }}>
          <span className="bnav-ic" aria-hidden="true">★</span><span className="bnav-lbl">{t("Teams")}</span>
        </button>
        <button className={"bnav-btn" + (navSel === "leagues" ? " on" : "")} aria-current={navSel === "leagues" ? "page" : undefined}
          onClick={() => { setNavSel("leagues"); const el = document.getElementById("fed-tabs"); if (el) el.scrollIntoView({ behavior: "smooth", block: "start" }); }}>
          <span className="bnav-ic" aria-hidden="true">🏆</span><span className="bnav-lbl">{t("Leagues")}</span>
        </button>
        <button className="bnav-btn" onClick={onBack}>
          <span className="bnav-ic" aria-hidden="true">☰</span><span className="bnav-lbl">{t("Menu")}</span>
        </button>
      </nav>
    </div>
  );
}

// Read-only league view for Belgian Handball data
export function BelgianLeagueView({ league, onBack }) {
  const { teams: initTeams = [], fixtures: rawFixtures = [], scorers: leagueScorers = null, ranking = [], topSingleGamePlayers = [], travelRanking = [] } = league;
  const fixtures = useMemo(() => assignWeeks(rawFixtures), [rawFixtures]);
  const { t: tr } = useLang();
  const [detail, setDetail]           = useState(null);
  const [tab, setTab]                 = useState("table");
  const [settings, setSettings]       = useState({ baseWin: 47, baseDraw: 6, homeBonus: 10, rankBonus: 3, winScore: 30, lossScore: 25, drawScore: 25 });
  const [confirmedTop, setConfirmedTop]       = useState(null);
  const [confirmedBottom, setConfirmedBottom] = useState(null);
  const [leagueState, setLeagueState] = useState({
    type: "standard", promoTop: 2, demotBot: 2,
    scorerUrl: "", playoffScorerUrl: "", playdownScorerUrl: "",
    scorerAliases: {}, teams: initTeams,
  });

  // Build points lookup from API ranking (source of truth)
  // Falls back to computing from played fixtures if ranking is empty
  const teams = useMemo(() => {
    if (ranking.length > 0) {
      // Map ranking positions/points onto teams by name match
      const rankMap = new Map(ranking.map(r => [r.name.toLowerCase(), r]));
      return initTeams.map(t => {
        const r = rankMap.get(t.name.toLowerCase());
        return r ? { ...t, points: r.points || 0 } : t;
      });
    }
    // Fallback: derive from played fixtures
    const earned = initTeams.map(() => 0);
    fixtures.filter(f => f.played && f.homeScore != null).forEach(f => {
      const hg = +f.homeScore, ag = +f.awayScore;
      if (isNaN(hg) || isNaN(ag)) return;
      if (hg > ag) earned[f.homeIdx] += 2;
      else if (hg < ag) earned[f.awayIdx] += 2;
      else { earned[f.homeIdx]++; earned[f.awayIdx]++; }
    });
    return initTeams.map((t, i) => ({ ...t, points: t.points + earned[i] }));
  }, [initTeams, fixtures, ranking]);

  const pending = fixtures.filter(f => !f.played);
  const played  = fixtures.filter(f => f.played);

  const liveProbs = useMemo(() => {
    const m = {};
    pending.forEach(f => { m[f.id] = modelProbs(f, teams, fixtures, settings, "goal"); });
    return m;
  }, [pending, teams, fixtures, settings]);

  // What-if scenario for the simulator: future games set to a result (and optional % overrides).
  // Nothing here touches the real table or the real games, only the simulator's input.
  const [whatIf, setWhatIf] = useState({});
  const [ovr, setOvr] = useState({});
  const [simTab, setSimTab] = useState("results");
  const simFixtures = useMemo(() => fixtures.map(f => {
    let g = f;
    if (ovr[f.id]) g = { ...g, ...ovr[f.id] };
    if (whatIf[f.id] && !f.played) g = { ...g, played: true, homeScore: whatIf[f.id].hs, awayScore: whatIf[f.id].as, whatIf: true };
    return g;
  }), [fixtures, whatIf, ovr]);
  const simUpcoming = useMemo(() => {
    const ids = new Set(pending.map(f => f.id));
    return simFixtures.filter(f => ids.has(f.id));
  }, [simFixtures, pending.length]); // eslint-disable-line
  const nWhatIf = Object.keys(whatIf).length;
  const simKey = JSON.stringify(whatIf) + JSON.stringify(ovr);
  const simConfirm = (id, hs, as) => setWhatIf(w => ({ ...w, [id]: { hs, as } }));
  const simUndo = id => setWhatIf(w => { const n = { ...w }; delete n[id]; return n; });
  const simOverride = (id, field, val) => setOvr(o => {
    const cur = o[id] || { overrideOn: false, ovHW: "", ovD: "", ovAW: "" };
    const next = field === "toggle" ? { ...cur, overrideOn: !cur.overrideOn }
      : field === "hw" ? { ...cur, ovHW: val } : field === "d" ? { ...cur, ovD: val } : field === "aw" ? { ...cur, ovAW: val } : cur;
    return { ...o, [id]: next };
  });
  const simReset = () => { setWhatIf({}); setOvr({}); };

  const hlTop = leagueState.promoTop ?? 2;
  const hlBot = leagueState.demotBot ?? 2;

  return (
    <div>
      <div className="masthead" style={{ marginBottom: "1rem" }}>
        <div>
          <div className="logo" style={{ fontSize: "1.1rem" }}>{league.name}</div>
          <div className="sub" style={{ color: "#fdda24" }}>
            {league.federation}
            {league.live && (
              <span style={{ display: "inline-block", marginLeft: ".5rem", fontSize: ".65rem", fontWeight: 700, color: "#4ade80", border: "1px solid #4ade80", borderRadius: "3px", padding: ".05rem .3rem", letterSpacing: ".04em" }}>● LIVE</span>
            )}
          </div>
        </div>
        <span style={{ display: "inline-flex", gap: ".6rem", alignItems: "center" }}><LangSwitch /><button className="btn btn-ghost" onClick={onBack}>{tr("← All Leagues")}</button></span>
      </div>

      <div className="panel">
        <div className="tabs tabs-top" style={{ overflowX: "auto", flexWrap: "nowrap", whiteSpace: "nowrap" }}>
          <button className="tab" onClick={onBack} title={tr("Back to My teams and all leagues")}>{tr("⌂ Home")}</button>
          {["table", "scores", "players", "stats", "monte"].map(tabId => (
            <button key={tabId} className={"tab" + (tab === tabId ? " on" : "")} onClick={() => setTab(tabId)}>
              {tr(tabId === "table" ? "Table" : tabId === "scores" ? "Games" : tabId === "players" ? "Players" : tabId === "stats" ? "Stats" : "Simulator")}{tabId === "scores" && pending.length ? " (" + pending.length + ")" : ""}
            </button>
          ))}
        </div>

        {tab === "table" && (
          <LeagueTable
            teams={teams}
            fixtures={fixtures}
            ranking={ranking}
            onTeamClick={idx => setDetail({ idx })}
            highlightTop={hlTop}
            highlightBottom={hlBot}
            confirmedTop={confirmedTop}
            confirmedBottom={confirmedBottom}
            leagueId={leagueScorers ? null : null}
            aliases={leagueState.scorerAliases || {}}
            archiveScorers={leagueScorers}
            phaseTeams={null}
            phase="regular"
            toughFullWidth={false}
            topSingleGamePlayers={topSingleGamePlayers}
            travelRanking={travelRanking}
            followKey={String(league.serieId ?? league.id)}
            hideScorers
            section="table"
          />
        )}

        {tab === "stats" && (
          <LeagueTable
            teams={teams}
            fixtures={fixtures}
            ranking={ranking}
            onTeamClick={idx => setDetail({ idx })}
            highlightTop={hlTop}
            highlightBottom={hlBot}
            confirmedTop={confirmedTop}
            confirmedBottom={confirmedBottom}
            leagueId={leagueScorers ? null : null}
            aliases={leagueState.scorerAliases || {}}
            archiveScorers={leagueScorers}
            phaseTeams={null}
            phase="regular"
            toughFullWidth={false}
            topSingleGamePlayers={topSingleGamePlayers}
            travelRanking={travelRanking}
            followKey={String(league.serieId ?? league.id)}
            hideScorers
            section="fun"
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
            showPlayedPredictions
          />
        )}

        {tab === "players" && <PlayersTab scorers={leagueScorers} teams={teams} aliases={leagueState.scorerAliases || {}} />}


        {tab === "monte" && (
          <div>
            <div className="subtabs" role="tablist">
              {[["results", "Results"], ["games", "Games"], ["settings", "Settings"]].map(([id, label]) => (
                <button key={id} role="tab" aria-selected={simTab === id} className={"subtab" + (simTab === id ? " on" : "")} onClick={() => setSimTab(id)}>
                  {tr(label)}{id === "games" && simUpcoming.length ? " (" + simUpcoming.length + ")" : ""}
                </button>
              ))}
            </div>

            {simTab === "results" && (
              <>
                {nWhatIf > 0 && (
                  <div className="whatif-note">
                    <span>✎ {nWhatIf} {tr("what-if results applied")}</span>
                    <button className="btn btn-ghost" style={{ fontSize: ".7rem", padding: ".25rem .7rem" }} onClick={simReset}>{tr("Reset all")}</button>
                  </div>
                )}
                <MCTab
                  key={simKey}
                  teams={teams}
                  fixtures={simFixtures}
                  settings={settings}
                  model="goal"
                  ranking={ranking}
                  highlightTop={hlTop}
                  highlightBottom={hlBot}
                  onConfirmed={nWhatIf > 0 ? undefined : (ct, cb) => { setConfirmedTop(ct); setConfirmedBottom(cb); }}
                />
              </>
            )}

            {simTab === "games" && (
              <>
                <div className="whatif-note">
                  <span>{tr("Set the result of upcoming games and see how the odds change. The real table and games stay untouched.")}</span>
                  {(nWhatIf > 0 || Object.keys(ovr).length > 0) && <button className="btn btn-ghost" style={{ fontSize: ".7rem", padding: ".25rem .7rem" }} onClick={simReset}>{tr("Reset all")}</button>}
                </div>
                <ScoresTab
                  teams={teams}
                  fixtures={simUpcoming}
                  liveProbs={liveProbs}
                  settings={settings}
                  onConfirm={simConfirm}
                  onUndo={simUndo}
                  onOverride={simOverride}
                  onTeamClick={idx => setDetail({ idx })}
                  onWeekChange={null}
                />
              </>
            )}

            {simTab === "settings" && (
              <SettingsPanel
                settings={settings}
                onChange={(k, v) => setSettings(s => ({ ...s, [k]: v }))}
                showTiebreakers={true}
                belgian
                league={leagueState}
                onLeagueChange={u => setLeagueState(s => typeof u === "function" ? u(s) : u)}
                readOnly={false}
              />
            )}
          </div>
        )}
      </div>

      <nav className="bnav" aria-label={tr("Main navigation")}>
        {[["home", "🏠", "Home"], ["table", "📊", "Table"], ["scores", "⚽", "Games"], ["players", "👥", "Players"], ["stats", "🏅", "Stats"], ["monte", "🎲", "Sim"]].map(([id, icon, label]) => (
          <button key={id} className={"bnav-btn" + (tab === id ? " on" : "")} aria-current={tab === id ? "page" : undefined}
            onClick={() => (id === "home" ? onBack() : setTab(id))}>
            <span className="bnav-ic" aria-hidden="true">{icon}</span>
            <span className="bnav-lbl">{tr(label)}{id === "scores" && pending.length ? " " + pending.length : ""}</span>
          </button>
        ))}
      </nav>

      {detail != null && (
        <TeamDetail
          team={teams[detail.idx]}
          teamIdx={detail.idx}
          teams={teams}
          fixtures={fixtures}
          onClose={() => setDetail(null)}
          leagueId={null}
          aliases={leagueState.scorerAliases || {}}
          archiveScorers={leagueScorers}
          phase="regular"
        />
      )}
    </div>
  );
}
