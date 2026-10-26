// Tournaments screen: build your own tournament (triangle, groups + knock-out, knock-out, round robin),
// play it by filling in scores, and edit every part of it. Saved on this device only.
import { LangSwitch, useLang } from "./i18n.js";
import { useBackLayer } from "./backNav.js";
import * as M from "./tourneyModel.js";
const { useState, useEffect } = React;

const KEY = "leaguesim.tournaments.v1";
function load() { try { const a = JSON.parse(localStorage.getItem(KEY)); return Array.isArray(a) ? a : []; } catch (e) { return []; } }
function useTournaments() {
  const [list, setList] = useState(load);
  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(list)); } catch (e) {} }, [list]);
  return [list, setList];
}
// Model labels are English ("Winner Semi-finals 1", "Group A · 1st"); translate them for display.
function useLoc() {
  const { t, lang } = useLang();
  const loc = s => {
    if (!s) return s;
    let m = /^(Winner|Loser) (.+)$/.exec(s); if (m) return t(m[1]) + " " + loc(m[2]);
    m = /^(.+) · (\d+)(st|nd|rd|th)$/.exec(s); if (m) return m[1] + " · " + (lang === "en" ? m[2] + m[3] : lang === "fr" ? m[2] + (m[2] === "1" ? "er" : "e") : m[2] + "e");
    m = /^(Quarter-finals|Semi-finals|Final|Third place|Bye)(?: (\d+))?$/.exec(s); if (m) return t(m[1]) + (m[2] ? " " + m[2] : "");
    m = /^Round of (\d+)$/.exec(s); if (m) return t("Round of") + " " + m[1];
    m = /^Group ([A-Z])$/.exec(s); if (m) return t("Group") + " " + m[1];
    m = /^Team (\d+)$/.exec(s); if (m) return t("Team") + " " + m[1];
    return t(s);
  };
  return { t, lang, loc };
}

export function TournamentsScreen({ onBack }) {
  const { t } = useLang();
  const [list, setList] = useTournaments();
  const [activeId, setActiveId] = useState(null);
  const [wizard, setWizard] = useState(false);
  useBackLayer(!!activeId, () => setActiveId(null));
  useBackLayer(wizard, () => setWizard(false));
  const active = list.find(x => x.id === activeId);
  const save = nt => setList(l => l.map(x => x.id === nt.id ? nt : x));

  if (active) return (
    <TournamentView key={active.id} T={active} onChange={save} onBack={() => setActiveId(null)}
      onDelete={() => { if (confirm(t("Delete this tournament?"))) { setList(l => l.filter(x => x.id !== active.id)); setActiveId(null); } }} />
  );
  return (
    <div className="panel">
      <div className="ph">
        <div><h2>🏆 {t("Tournaments")}</h2><p>{t("Make your own tournament and keep score. Saved on this device.")}</p></div>
        <span style={{ marginLeft: "auto", display: "inline-flex", gap: ".6rem", alignItems: "center" }}>
          <LangSwitch /><button className="btn btn-ghost" onClick={onBack}>{t("← Back")}</button>
        </span>
      </div>
      <div className="card-grid">
        {list.map(x => {
          const ms = M.allMatches(x), done = ms.filter(y => M.hasScore(y.m)).length, ch = M.champion(x);
          return (
            <div key={x.id} className="card" onClick={() => setActiveId(x.id)}>
              <div className="card-name">{x.name}</div>
              <div className="card-meta">{x.teams.length} {t("teams")} · {done}/{ms.length} {t("played")}{ch ? " · 🏆 " + ch : ""}</div>
            </div>
          );
        })}
        <div className="card card-new" onClick={() => setWizard(true)}>+ {t("New tournament")}</div>
      </div>
      {list.length === 0 && <p className="note" style={{ marginTop: "1rem" }}>{t("No tournaments yet. Try a triangle tournament (3 teams), or a group phase into a knock-out bracket.")}</p>}
      {wizard && <Wizard onClose={() => setWizard(false)} onCreate={nt => { setList(l => [nt, ...l]); setWizard(false); setActiveId(nt.id); }} />}
    </div>
  );
}

const KINDS = [
  ["triangle", "🔺", "Triangle tournament", "3 teams, everyone plays everyone."],
  ["groups_ko", "🏟", "Groups + knock-out", "Group phase, then a bracket."],
  ["ko", "🌳", "Knock-out", "Straight elimination bracket."],
  ["league", "📋", "Round robin", "Everyone plays everyone, one table."],
  ["empty", "🛠", "Build from scratch", "Start empty, add stages yourself."],
];
function Wizard({ onClose, onCreate }) {
  const { t, loc } = useLoc();
  const [kind, setKind] = useState("groups_ko");
  const [name, setName] = useState("");
  const [count, setCount] = useState(8);
  const [names, setNames] = useState("");
  const [groupCount, setGroupCount] = useState(2);
  const [advance, setAdvance] = useState(2);
  const [legs, setLegs] = useState(1);
  const [third, setThird] = useState(false);
  const pick = k => { setKind(k); setCount(k === "triangle" ? 3 : k === "league" ? 6 : 8); };
  const lines = names.split("\n").map(s => s.trim()).filter(Boolean);
  const n = kind === "triangle" ? 3 : Math.max(2, Math.min(64, Math.max(lines.length, +count || 0)));
  const teamNames = kind === "empty" ? lines : Array.from({ length: n }, (_, i) => lines[i] || t("Team") + " " + (i + 1));
  const create = () => onCreate(M.buildTournament({ kind, name: name.trim() || t(KINDS.find(k => k[0] === kind)[2]), teamNames, groupCount, advance, legs, third }));
  const opt = (cur, set, val, label) => <span className={"config-opt" + (cur === val ? " sel" : "")} onClick={() => set(val)}>{label}</span>;
  return (
    <div className="overlay-c" onClick={onClose}>
      <div className="modal tn-wiz" onClick={e => e.stopPropagation()}>
        <h3>{t("New tournament")}</h3>
        <div className="type-cards tn-kinds">
          {KINDS.map(([k, ic, ttl, desc]) => (
            <div key={k} className={"type-card" + (kind === k ? " sel" : "")} onClick={() => pick(k)}>
              <div className="type-card-title">{ic} {t(ttl)}</div><div className="type-card-desc">{t(desc)}</div>
            </div>
          ))}
        </div>
        <input className="inp" value={name} onChange={e => setName(e.target.value)} placeholder={t("Tournament name")} style={{ margin: ".85rem 0 .6rem" }} />
        {kind !== "triangle" && kind !== "empty" && (
          <div className="config-row"><span className="config-label">{t("Teams")}:</span>
            <input className="config-inp" type="number" min="2" max="64" value={count} onChange={e => setCount(e.target.value)} style={{ width: "4.5rem" }} /></div>
        )}
        <textarea className="inp" rows={kind === "triangle" ? 3 : 4} value={names} onChange={e => setNames(e.target.value)}
          placeholder={t("Team names, one per line (optional)")} style={{ margin: ".4rem 0 .6rem", resize: "vertical" }} />
        {kind === "groups_ko" && (<>
          <div className="config-row"><span className="config-label">{t("Groups")}:</span><div className="config-opts">{[1, 2, 3, 4, 6, 8].map(v => opt(groupCount, setGroupCount, v, v))}</div></div>
          <div className="config-row"><span className="config-label">{t("Advance per group")}:</span><div className="config-opts">{[1, 2, 3, 4].map(v => opt(advance, setAdvance, v, v))}</div></div>
        </>)}
        {(kind === "triangle" || kind === "league" || kind === "groups_ko") && (
          <div className="config-row"><span className="config-label">{t("Matches")}:</span><div className="config-opts">{opt(legs, setLegs, 1, t("Single")) }{opt(legs, setLegs, 2, t("Home & away"))}</div></div>
        )}
        {(kind === "ko" || kind === "groups_ko") && (
          <div className="config-row"><span className="config-label">{t("Third place match")}:</span><div className="config-opts">{opt(third, setThird, false, t("No"))}{opt(third, setThird, true, t("Yes"))}</div></div>
        )}
        <div className="modal-btns">
          <button className="btn btn-cyan" onClick={create}>{t("Create")}</button>
          <button className="btn btn-ghost" onClick={onClose}>{t("Cancel")}</button>
        </div>
      </div>
    </div>
  );
}

function SlotSelect({ T, m, side, op, onlyTeams }) {
  const { t, loc } = useLoc();
  const opts = M.slotOptions(T, m.id).filter(o => !onlyTeams || o.v === "" || o.group === "Teams");
  const groups = [...new Set(opts.map(o => o.group || ""))];
  return (
    <select className="inp tn-sel" value={M.slotValue(m[side])} onChange={e => op(M.setSlot, m.id, side, M.parseSlot(e.target.value))}>
      {groups.map(g => g === ""
        ? opts.filter(o => !o.group).map(o => <option key={o.v} value={o.v}>— {t("Bye / empty")} —</option>)
        : <optgroup key={g} label={t(g)}>{opts.filter(o => o.group === g).map(o => <option key={o.v} value={o.v}>{loc(o.label)}</option>)}</optgroup>)}
    </select>
  );
}

function MatchCard({ T, m, R, edit, op, ko }) {
  const { t, loc } = useLoc();
  const res = R.result(m.id);
  const draw = ko && M.hasScore(m) && m.hs === m.as;
  const side = (key, sc) => {
    const slot = m[key], other = m[key === "home" ? "away" : "home"], id = R.team(slot);
    const win = res.winner && id === res.winner;
    const nm = R.name(slot);
    return (
      <div className={"tn-side" + (win ? " win" : "")}>
        {edit
          ? <SlotSelect T={T} m={m} side={key} op={op} onlyTeams={!!m.group} />
          : <span className={"tn-nm" + (nm ? "" : " muted")}>{nm || (!slot && other ? t("Bye") : loc(R.label(slot)))}</span>}
        <input className="tn-sc" type="number" inputMode="numeric" min="0" aria-label={t("Score")}
          value={m[sc] == null ? "" : m[sc]} disabled={res.bye}
          onChange={e => op(M.setScore, m.id, sc, e.target.value)} />
      </div>
    );
  };
  return (
    <div className={"tn-match" + (res.bye ? " bye" : "")}>
      {m.third && <div className="tn-tag">{t("Third place")}</div>}
      {side("home", "hs")}{side("away", "as")}
      {draw && (
        <div className="tn-pen">{t("Decided by")}:
          <span className={"config-opt" + (m.pen === "home" ? " sel" : "")} onClick={() => op(M.setPen, m.id, "home")}>{R.name(m.home) || t("Home")}</span>
          <span className={"config-opt" + (m.pen === "away" ? " sel" : "")} onClick={() => op(M.setPen, m.id, "away")}>{R.name(m.away) || t("Away")}</span>
        </div>
      )}
      {edit && <button className="tn-x" title={t("Remove match")} onClick={() => op(M.removeMatch, m.id)}>✕</button>}
    </div>
  );
}

function GroupBlock({ T, s, g, R, edit, op, hasKo }) {
  const { t, loc } = useLoc();
  const rows = M.groupRows(T, s, g);
  const nameOf = id => (T.teams.find(x => x.id === id) || {}).name;
  const ms = s.matches.filter(m => m.group === g.id);
  const rounds = [...new Set(ms.map(m => m.round || 0))].sort((a, b) => a - b);
  return (
    <div className="mini-box tn-group">
      <div className="mini-ttl" style={{ color: "#fdda24", display: "flex", gap: ".5rem", alignItems: "center" }}>
        {edit ? <input className="inp" value={g.name} onChange={e => op(M.renameGroup, s.id, g.id, e.target.value)} /> : <span>{loc(g.name)}</span>}
        {edit && <button className="tn-x" style={{ position: "static" }} title={t("Remove group")} onClick={() => { if (confirm(t("Remove this group and its matches?"))) op(M.removeGroup, s.id, g.id); }}>✕</button>}
      </div>
      <div className="tbl-wrap">
        <table className="ltbl">
          <thead><tr><th style={{ width: "1.6rem" }}>#</th><th className="tl">{t("Team")}</th><th>P</th><th>W</th><th>D</th><th>L</th><th className="tgd">GD</th><th className="tpts">Pts</th></tr></thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.teamId} style={hasKo && i < s.advance ? { background: "rgba(74,222,128,.10)" } : null}>
                <td className="tpos">{i + 1}</td><td className="tl">{nameOf(r.teamId)}</td>
                <td>{r.p}</td><td>{r.w}</td><td>{r.d}</td><td>{r.l}</td>
                <td className={"tgd " + (r.gd > 0 ? "gdp" : r.gd < 0 ? "gdn" : "gd0")}>{r.gd > 0 ? "+" : ""}{r.gd}</td><td className="tpts">{r.pts}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rounds.map(rd => (
        <div key={rd}>
          {rounds.length > 1 && <div className="tn-md">{t("Matchday")} {rd}</div>}
          <div className="tn-grid">{ms.filter(m => (m.round || 0) === rd).map(m => <MatchCard key={m.id} T={T} m={m} R={R} edit={edit} op={op} />)}</div>
        </div>
      ))}
      {ms.length === 0 && <div className="muted" style={{ fontSize: ".78rem" }}>{t("No matches yet.")}</div>}
      {edit && <button className="btn btn-ghost tn-add" onClick={() => op(M.addMatch, s.id, g.id)}>+ {t("Add match")}</button>}
    </div>
  );
}

function StageHead({ s, edit, op, onRemove }) {
  const { t, loc } = useLoc();
  return (
    <div className="tn-stagehead">
      {edit ? <input className="inp" value={s.name} onChange={e => op(M.setMeta, s.id, { name: e.target.value })} /> : <h3>{s.type === "group" ? "📊" : "🌳"} {loc(s.name)}</h3>}
      {edit && <button className="btn btn-ghost" onClick={onRemove}>🗑 {t("Remove stage")}</button>}
    </div>
  );
}

function TournamentView({ T, onChange, onBack, onDelete }) {
  const { t, loc } = useLoc();
  const [edit, setEdit] = useState(false);
  const op = (fn, ...args) => onChange(fn(T, ...args));
  const R = M.resolver(T);
  const ch = M.champion(T);
  const groupStages = T.stages.filter(s => s.type === "group");
  const removeStage = s => { if (confirm(t("Remove this stage and all its matches?"))) op(M.removeStage, s.id); };
  return (
    <div className="panel tn">
      <div className="ph">
        <div style={{ flex: 1, minWidth: 0 }}>
          {edit ? <input className="inp" value={T.name} onChange={e => onChange({ ...T, name: e.target.value })} style={{ fontSize: "1.05rem", fontWeight: 700 }} /> : <h2>🏆 {T.name}</h2>}
          <p>{T.teams.length} {t("teams")}</p>
        </div>
        <span style={{ marginLeft: "auto", display: "inline-flex", gap: ".6rem", alignItems: "center" }}>
          <LangSwitch /><button className="btn btn-ghost" onClick={onBack}>{t("← Back")}</button>
        </span>
      </div>
      <div className="tn-bar">
        <button className={"btn " + (edit ? "btn-cyan" : "btn-ghost")} onClick={() => setEdit(e => !e)}>{edit ? "✓ " + t("Done editing") : "✏ " + t("Edit tournament")}</button>
        {edit && <button className="btn btn-ghost" style={{ color: "#f87171" }} onClick={onDelete}>🗑 {t("Delete tournament")}</button>}
      </div>
      {ch && <div className="tn-champ">🏆 {t("Champion")}: <b>{ch}</b></div>}

      {edit && (
        <div className="mini-box tn-teams">
          <div className="mini-ttl">👥 {t("Teams")}</div>
          {T.teams.map(tm => (
            <div key={tm.id} className="tn-teamrow">
              <input className="inp" value={tm.name} onChange={e => op(M.renameTeam, tm.id, e.target.value)} />
              {groupStages.map(s => (
                <select key={s.id} className="inp tn-sel" title={s.name} value={(s.groups.find(g => g.teamIds.includes(tm.id)) || {}).id || ""}
                  onChange={e => op(M.moveTeam, s.id, tm.id, e.target.value)}>
                  {!s.groups.some(g => g.teamIds.includes(tm.id)) && <option value="">—</option>}
                  {s.groups.map(g => <option key={g.id} value={g.id}>{loc(g.name)}</option>)}
                </select>
              ))}
              <button className="tn-x" style={{ position: "static" }} title={t("Remove team")}
                onClick={() => { if (confirm(t("Remove this team and its matches?"))) op(M.removeTeam, tm.id); }}>✕</button>
            </div>
          ))}
          <button className="btn btn-ghost tn-add" onClick={() => op(M.addTeam, "")}>+ {t("Add team")}</button>
        </div>
      )}

      {T.stages.map(s => (
        <section key={s.id} className="tn-stage">
          <StageHead s={s} edit={edit} op={op} onRemove={() => removeStage(s)} />
          {s.type === "group" ? (<>
            {edit && (
              <div className="tn-opts">
                <span className="config-label">{t("Matches")}:</span>
                <span className={"config-opt" + (s.legs === 1 ? " sel" : "")} onClick={() => op(M.setMeta, s.id, { legs: 1 })}>{t("Single")}</span>
                <span className={"config-opt" + (s.legs === 2 ? " sel" : "")} onClick={() => op(M.setMeta, s.id, { legs: 2 })}>{t("Home & away")}</span>
                <span className="config-label">{t("Advance per group")}:</span>
                <input className="config-inp" type="number" min="0" value={s.advance} style={{ width: "3.5rem" }} onChange={e => op(M.setMeta, s.id, { advance: Math.max(0, +e.target.value || 0) })} />
                <button className="btn btn-ghost" onClick={() => { if (confirm(t("Rebuild all matches of this stage? Scores in it are lost."))) op(M.regenerateGroups, s.id); }}>↻ {t("Rebuild matches")}</button>
              </div>
            )}
            {s.groups.map(g => <GroupBlock key={g.id} T={T} s={s} g={g} R={R} edit={edit} op={op} hasKo={T.stages.some(k => k.type === "ko")} />)}
            {edit && <button className="btn btn-ghost tn-add" onClick={() => op(M.addGroup, s.id)}>+ {t("Add group")}</button>}
          </>) : (<>
            <div className="tn-bracket">
              {s.rounds.map(r => (
                <div key={r.id} className="tn-round">
                  <div className="tn-rname">
                    {edit ? <input className="inp" value={r.name} onChange={e => op(M.renameRound, s.id, r.id, e.target.value)} /> : loc(r.name)}
                    {edit && <button className="tn-x" style={{ position: "static" }} title={t("Remove round")} onClick={() => { if (confirm(t("Remove this round and its matches?"))) op(M.removeRound, s.id, r.id); }}>✕</button>}
                  </div>
                  <div className="tn-rmatches">
                    {r.matches.map(m => <MatchCard key={m.id} T={T} m={m} R={R} edit={edit} op={op} ko />)}
                    {edit && <button className="btn btn-ghost tn-add" onClick={() => op(M.addMatch, s.id, r.id)}>+ {t("Add match")}</button>}
                  </div>
                </div>
              ))}
              {edit && <div className="tn-round"><button className="btn btn-ghost tn-add" onClick={() => op(M.addRound, s.id)}>+ {t("Add round")}</button></div>}
            </div>
          </>)}
        </section>
      ))}
      {T.stages.length === 0 && <p className="note">{t("This tournament is empty. Use Edit to add a group stage or a knock-out.")}</p>}

      {edit && (
        <div className="tn-addstage">
          <button className="btn btn-ghost" onClick={() => op(M.addStage, "group")}>+ {t("Group stage")}</button>
          {groupStages.length > 0 && <button className="btn btn-ghost" onClick={() => op(M.addStage, "ko-groups")}>+ {t("Knock-out from groups")}</button>}
          <button className="btn btn-ghost" onClick={() => op(M.addStage, "ko")}>+ {t("Knock-out with all teams")}</button>
        </div>
      )}
    </div>
  );
}
