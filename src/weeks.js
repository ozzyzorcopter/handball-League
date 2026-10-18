// Belgian data has no round numbers (every game arrives as week 0), so rounds
// are derived from the dates: all games in the same calendar week (Mon-Sun)
// form one week, numbered 1, 2, 3... in order. Games without a date stay
// without a week. Leagues that already carry real week numbers are untouched.
const DATE = /^(\d{4})-(\d{2})-(\d{2})/;

function mondayOf(date) {
  const m = DATE.exec(date || "");
  if (!m) return null;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

export function assignWeeks(fixtures) {
  if (!fixtures || !fixtures.length) return fixtures;
  if (fixtures.some(f => f.week != null && f.week > 0)) return fixtures;
  const mondays = [...new Set(fixtures.map(f => mondayOf(f.date)).filter(Boolean))].sort();
  const num = new Map(mondays.map((m, i) => [m, i + 1]));
  return fixtures.map(f => {
    const mon = mondayOf(f.date);
    return { ...f, week: mon ? num.get(mon) : null };
  });
}

// "27/09 17:30" for the badge in front of a game card.
export function matchStamp(f) {
  const m = DATE.exec(f.date || "");
  if (!m) return null;
  return `${m[3]}/${m[2]}` + (f.time ? " " + f.time : "");
}

// "27/09 – 28/09" for a week header.
export function weekRange(fixtures) {
  const ds = fixtures.map(f => f.date).filter(d => DATE.test(d || "")).sort();
  if (!ds.length) return "";
  const s = d => { const m = DATE.exec(d); return `${m[3]}/${m[2]}`; };
  return ds[0] === ds[ds.length - 1] ? s(ds[0]) : `${s(ds[0])} – ${s(ds[ds.length - 1])}`;
}
