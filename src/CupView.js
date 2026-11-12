// Cup competition: the knockout phases (rounds) instead of a table and a position chart.
import { cleanTeamName } from "./names.js";
import { useLang } from "./i18n.js";
import { matchStamp } from "./weeks.js";
import { buildCupRounds, aliveTeams, winnerIdx, nextPhase } from "./cupRounds.js";
const { useMemo, useState } = React;

function roundTitle(label, tr) {
  return label.n ? tr("Round") + " " + label.n : tr(label.key);
}
function range(r) {
  const s = d => { const m = /^\d{4}-(\d{2})-(\d{2})/.exec(d || ""); return m ? m[2] + "/" + m[1] : ""; };
  if (!r.from) return "";
  return r.from === r.to ? s(r.from) : s(r.from) + " – " + s(r.to);
}

function Match({ f, teams, onMatchClick }) {
  const { t: tr } = useLang();
  const done = f.played && f.homeScore != null && f.awayScore != null;
  const w = done ? winnerIdx(f) : null;
  const click = done && f.gameId && onMatchClick ? () => onMatchClick(f) : null;
  const row = (idx, score) => (
    <div className={"cup-t" + (done ? (w === idx ? " win" : w != null ? " lose" : "") : "")}>
      <span className="cup-tn">{cleanTeamName(teams[idx]?.name) || "?"}</span>
      <b className="cup-ts">{done ? score : ""}</b>
    </div>
  );
  return (
    <div className={"cup-match" + (click ? " clickable" : "")} onClick={click || undefined}
      role={click ? "button" : undefined} tabIndex={click ? 0 : undefined}
      onKeyDown={click ? e => { if (e.key === "Enter") click(); } : undefined}>
      <div className="cup-when">{matchStamp(f) || tr("No date yet")}{click ? " 📋" : ""}</div>
      <div className="cup-teams">{row(f.homeIdx, f.homeScore)}{row(f.awayIdx, f.awayScore)}</div>
    </div>
  );
}

export function CupView({ league, onMatchClick }) {
  const { t: tr } = useLang();
  const teams = league.teams || [];
  const rounds = useMemo(() => buildCupRounds(league.fixtures), [league.fixtures]);
  const alive = useMemo(() => aliveTeams(rounds), [rounds]);
  const next = useMemo(() => nextPhase(rounds), [rounds]);
  // The round being played now = first with unplayed games, else the last.
  const current = Math.max(0, rounds.findIndex(r => r.played < r.count));
  const cur = rounds.length ? (rounds.findIndex(r => r.played < r.count) < 0 ? rounds.length - 1 : current) : -1;
  const [open, setOpen] = useState(() => new Set(cur >= 0 ? [cur, cur - 1].filter(i => i >= 0) : []));
  const toggle = i => setOpen(o => { const n = new Set(o); n.has(i) ? n.delete(i) : n.add(i); return n; });

  if (!rounds.length) return <div className="muted" style={{ padding: "1.5rem", textAlign: "center" }}>{tr("No games have been published for this cup yet.")}</div>;

  const finalRound = rounds[rounds.length - 1];
  const champ = finalRound.label.key === "Final" && finalRound.played === 1 ? winnerIdx(finalRound.fixtures[0]) : null;

  return (
    <div className="cup">
      <div className="cup-sum">
        {champ != null
          ? <span>🏆 <b>{cleanTeamName(teams[champ]?.name)}</b></span>
          : <span><b>{alive.length}</b> {tr("teams still in the cup")}</span>}
        <span className="muted"> · {tr("Knock-out: a defeat means elimination")}</span>
      </div>
      {rounds.map((r, i) => {
        const isOpen = open.has(i);
        return (
          <section key={r.n} className={"cup-round" + (i === cur ? " now" : "")}>
            <button className="cup-rh" onClick={() => toggle(i)} aria-expanded={isOpen}>
              <span className="cup-rt">{roundTitle(r.label, tr)}</span>
              <span className="muted cup-rd">{range(r)}</span>
              <span className="cup-rc">{r.played}/{r.count}</span>
              <span aria-hidden="true">{isOpen ? "▾" : "▸"}</span>
            </button>
            {isOpen && (
              <div className="cup-grid">
                {r.fixtures.map(f => <Match key={f.id || f.gameId} f={f} teams={teams} onMatchClick={onMatchClick} />)}
              </div>
            )}
          </section>
        );
      })}
      {next && (
        <section className="cup-round cup-next">
          <div className="cup-rh" style={{ cursor: "default" }}>
            <span className="cup-rt">{roundTitle(next.label, tr)}</span>
            <span className="muted cup-rd">{tr("Draw pending")}</span>
            <span className="cup-rc">{next.teams.length}</span>
          </div>
          <div className="cup-chips">
            {next.teams.map(idx => <span key={idx} className="cup-chip">{cleanTeamName(teams[idx]?.name) || "?"}</span>)}
          </div>
          <div className="muted cup-note">
            {tr("Teams through so far; the fixtures appear once the draw has been made.")}
            {next.open ? " " + next.open + " " + tr("games still to play") + "." : ""}
          </div>
        </section>
      )}
    </div>
  );
}
