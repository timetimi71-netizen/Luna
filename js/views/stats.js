// Luna · Statistik: Kennzahlen, Verlauf, Durchschnitte, Zusammenhänge, Jahr in Pixeln
import { S, avg, rating, sleepStatus, currentStreak, longestStreak, STATUS_LABEL, foodOn, weightOn, smokeOn } from '../store.js';
import { isSetUp, targets, totals, progress, kcalStatus, fmtKcal } from '../nutrition.js';
import { isSetUp as smokeSetUp, tabOn as smokeTabOn, phase as smokePhase, stats as smokeStats, dayStatus, fmtSpan, fmtMoney, historyStart, unitWord, parts } from '../smoke.js';
import { slipText } from './smoke.js';
import { icon, face, CATS, LABELS, segHTML, setSeg, hydratePhotos } from '../ui.js';
import { lineChart, barChart, weightChart } from '../charts.js';
import {
  $,
  esc,
  today,
  iso,
  fromISO,
  addDays,
  datesBack,
  MONTHS_SHORT,
  WD,
  fmtLong,
  fmtDayMonth,
  fmtDur,
  fmtHM,
  fmtNum,
  pad,
  haptic,
  countUp,
} from '../util.js';
import { act } from '../app.js';

let range = '30';
let metric = 'tag';
let pxMode = 'mood';

const visibleCats = () => CATS.filter((c) => c.id === 'tag' || S.settings.cats[c.id] !== false);

export function render() {
  return `
  <header class="vhead"><div class="vhead-text"><div class="eyebrow">Statistik</div><h1 class="vtitle">Dein <em>Verlauf</em></h1></div></header>
  ${segHTML('st-range', [
    ['7', '7 Tage'],
    ['30', '30 Tage'],
    ['365', 'Jahr'],
  ], range)}
  <div class="stack" id="st-body">${body()}</div>`;
}

function body() {
  const n = Number(range);
  const dates = datesBack(n);
  const prev = datesBack(n, addDays(today(), -n));
  const food = S.settings.tabs?.food !== false;
  return [tilesHTML(dates), chartHTML(), food ? kcalHTML(dates) : '', food ? weightHTML() : '', smokeHTML(dates), avgsHTML(dates, prev), insightsHTML(), pixelsHTML(), photosHTML(dates), totalsHTML()].join('');
}

/* ---------- Kacheln ---------- */
function tilesHTML(dates) {
  const entries = dates.map((d) => S.journal.get(d)).filter(Boolean);
  const done = entries.filter((e) => e.done).length;
  const sleepAvg = avg(dates, (d) => S.sleep.get(d)?.hours);
  const sportMin = entries.reduce((s, e) => s + (e.sport?.minutes || 0), 0);
  const active = entries.filter((e) => (e.sport?.minutes || 0) > 0 || e.sport?.types?.length).length;
  const streak = currentStreak();
  const best = longestStreak();
  const sport =
    sportMin >= 120
      ? `<span data-count="${(sportMin / 60).toFixed(1)}" data-dec="1">${fmtNum(sportMin / 60, 1)}</span><small>h</small>`
      : `<span data-count="${sportMin}">${sportMin}</span><small>min</small>`;
  return `<div class="tiles">
    <div class="stat"><span class="k">${icon('journal')} Einträge</span><span class="v" data-count="${done}">${done}</span><span class="s">an ${dates.length} Tagen</span></div>
    <div class="stat"><span class="k">${icon('flame')} Serie</span><span class="v"><span data-count="${streak}">${streak}</span><small>${streak === 1 ? 'Tag' : 'Tage'}</small></span><span class="s">Rekord: ${best} ${best === 1 ? 'Tag' : 'Tage'}</span></div>
    <div class="stat"><span class="k">${icon('moon')} Ø Schlaf</span><span class="v">${sleepAvg ? `${fmtHM(sleepAvg)}<small>h</small>` : '–'}</span><span class="s">${sleepAvg ? STATUS_LABEL[sleepStatus(sleepAvg)] : 'Noch keine Nächte'}</span></div>
    <div class="stat"><span class="k">${icon('dumbbell')} Bewegung</span><span class="v">${sport}</span><span class="s">${active} ${active === 1 ? 'aktiver Tag' : 'aktive Tage'}</span></div>
    ${S.settings.tabs?.food !== false ? foodTiles(dates) : ''}
    ${smokeTiles()}
  </div>`;
}
function foodTiles(dates) {
  const days = dates.filter((d) => foodOn(d).length);
  if (!days.length && !S.weights.size) return '';
  const avgKcal = avg(days, (d) => totals(d).kcal);
  const hit = isSetUp() ? days.filter((d) => progress(d) >= 1).length : null;
  const wNow = weightOn(today());
  const wThen = weightOn(dates[0]) || [...S.weights.values()].filter((w) => w.date >= dates[0]).sort((a, b) => a.date.localeCompare(b.date))[0];
  const diff = wNow && wThen ? wNow.kg - wThen.kg : null;
  return `<div class="stat"><span class="k">${icon('apple')} Ø Kalorien</span><span class="v">${avgKcal ? `<span data-count="${Math.round(avgKcal)}">${fmtKcal(avgKcal)}</span>` : '–'}</span><span class="s">${hit != null && days.length ? `Ziel an ${hit} von ${days.length} Tagen` : `${days.length} Tage erfasst`}</span></div>
    <div class="stat"><span class="k">${icon('scale')} Gewicht</span><span class="v">${wNow ? `${fmtNum(wNow.kg, 1)}<small>kg</small>` : '–'}</span><span class="s">${diff != null && Math.abs(diff) >= 0.05 ? `${diff > 0 ? '+' : '−'}${fmtNum(Math.abs(diff), 1)} kg im Zeitraum` : wNow && wThen && wThen.date !== wNow.date ? 'kaum Veränderung' : wNow ? 'Erste Messung' : 'Noch nicht gewogen'}</span></div>`;
}

const smokeOnStats = () => smokeTabOn() && smokeSetUp() && smokePhase() !== 'countdown';
function smokeTiles() {
  if (!smokeOnStats()) return '';
  const st = smokeStats();
  const free = smokePhase() === 'free';
  const p = parts(st.ms);
  const since = p.d >= 1 ? `${p.d}<small>${p.d === 1 ? 'Tag' : 'Tage'}</small>` : fmtSpan(st.ms, true);
  return `<div class="stat"><span class="k">${icon('nosmoke')} ${free ? 'Rauchfrei' : 'Im Plan'}</span><span class="v">${free ? since : `${fmtNum(st.avoided, 0)}<small>weniger</small>`}</span><span class="s">${free ? slipText(st) : 'als früher geraucht'}</span></div>
    <div class="stat"><span class="k">${icon('coin')} Gespart</span><span class="v">${fmtMoney(st.saved)}</span><span class="s">${st.resisted}× Lust besiegt</span></div>`;
}

/* ---------- Rauchfrei ---------- */
function smokeHTML(dates) {
  if (!smokeOnStats()) return '';
  const t = today();
  const cnt = (d, f) => smokeOn(d).filter(f).reduce((s, e) => s + (e.type === 'craving' ? 1 : e.count || 1), 0);
  const won = (d) => cnt(d, (e) => e.type === 'craving' && e.resisted !== false);
  const smoked = (d) => cnt(d, (e) => e.type === 'slip' || e.type === 'cig');
  let items;
  if (range === '365') {
    items = [];
    for (let w = 51; w >= 0; w--) {
      const ds = datesBack(7, addDays(t, -w * 7));
      const sts = ds.map(dayStatus).filter(Boolean);
      const v = ds.reduce((s, d) => s + won(d) + smoked(d), 0);
      const bad = sts.some((x) => x.st === 'bad');
      const m = fromISO(addDays(t, -w * 7)).getMonth();
      items.push({ value: sts.length ? v : null, label: w % 9 === 0 ? MONTHS_SHORT[m] : '', cls: bad ? 'st-bad' : 'st-good' });
    }
  } else {
    const n = dates.length;
    items = dates.map((d, i) => {
      const ds = dayStatus(d);
      const label = n <= 7 ? WD[fromISO(d).getDay()] : (n - 1 - i) % 7 === 0 ? `${fromISO(d).getDate()}.${fromISO(d).getMonth() + 1}.` : '';
      return { value: ds ? won(d) + smoked(d) : null, label, hl: d === t, cls: `st-${ds?.st || 'good'}`, title: ds ? `${fmtDayMonth(d)}: ${won(d)}× Lust besiegt${smoked(d) ? `, ${smoked(d)} geraucht` : ''}` : '' };
    });
  }
  if (!items.some((i) => i.value != null)) return '';
  const sts = dates.map(dayStatus).filter(Boolean);
  const freeDays = sts.filter((x) => x.kind === 'free' && !x.smoked).length;
  const planDays = sts.filter((x) => x.kind === 'plan');
  const max = Math.max(4, ...items.map((i) => i.value || 0));
  return `<section class="card">
    <div class="card-h"><h2 class="card-t">${icon('nosmoke')} Rauchfrei</h2><span class="faint small">Lust &amp; Zigaretten</span></div>
    ${barChart({ items, max, height: 140 })}
    <div class="sm-legend"><span><i class="sdot st-good"></i>${planDays.length ? 'im Plan / rauchfrei' : 'rauchfrei'}</span><span><i class="sdot st-bad"></i>geraucht</span></div>
    <div class="debt"><span>${planDays.length && !freeDays ? 'Tage im Plan' : 'Rauchfreie Tage'}</span><b>${planDays.length && !freeDays ? planDays.filter((x) => x.st === 'good').length : freeDays} <span class="faint" style="font-weight:500">von ${sts.length}</span></b></div>
  </section>`;
}

/* ---------- Kalorien & Gewicht ---------- */
function kcalHTML(dates) {
  if (!dates.some((d) => foodOn(d).length)) return '';
  let items;
  let goal;
  const t = today();
  if (range === '365') {
    items = [];
    const goals = [];
    for (let w = 51; w >= 0; w--) {
      const ds = datesBack(7, addDays(t, -w * 7)).filter((d) => foodOn(d).length);
      const v = avg(ds, (d) => totals(d).kcal);
      const gv = isSetUp() && ds.length ? avg(ds, (d) => targets(d).kcal) : null;
      if (gv) goals.push(gv);
      const m = fromISO(addDays(t, -w * 7)).getMonth();
      items.push({ value: v, label: w % 9 === 0 ? MONTHS_SHORT[m] : '', cls: v && gv ? `st-${kcalStatus(v / gv)}` : 'st-ok' });
    }
    goal = goals.length ? goals.reduce((a, b) => a + b, 0) / goals.length : null;
  } else {
    const n = dates.length;
    items = dates.map((d, i) => {
      const k = foodOn(d).length ? totals(d).kcal : null;
      const st = k != null && isSetUp() ? kcalStatus(k / targets(d).kcal) : 'ok';
      const label = n <= 7 ? WD[fromISO(d).getDay()] : (n - 1 - i) % 7 === 0 ? `${fromISO(d).getDate()}.${fromISO(d).getMonth() + 1}.` : '';
      return { value: k, label, hl: d === t, cls: `st-${st}`, title: k != null ? `${fmtDayMonth(d)}: ${fmtKcal(k)} kcal` : '' };
    });
    goal = isSetUp() ? avg(dates, (d) => targets(d).kcal) : null;
  }
  const max = Math.max(goal ? goal * 1.2 : 0, ...items.map((i) => i.value || 0));
  const days = dates.filter((d) => foodOn(d).length);
  const pAvg = avg(days, (d) => totals(d).p);
  return `<section class="card">
    <div class="card-h"><h2 class="card-t">${icon('apple')} Kalorien${range === '365' ? ' <span class="faint" style="letter-spacing:0;text-transform:none;font-weight:500">(Wochenmittel)</span>' : ''}</h2></div>
    ${barChart({ items, max, target: goal, targetLabel: goal ? `Ø Ziel ${fmtKcal(goal)}` : '' })}
    <div class="debt"><span>Ø Eiweiß pro Tag</span><b>${pAvg ? `${Math.round(pAvg)} g` : '–'}${isSetUp() ? ` <span class="faint" style="font-weight:500">/ ${targets(t).protein} g</span>` : ''}</b></div>
  </section>`;
}
function weightHTML() {
  const span = Math.max(Number(range), 28);
  const pts = [...S.weights.values()].filter((w) => w.date >= addDays(today(), -span)).sort((a, b) => a.date.localeCompare(b.date));
  if (pts.length < 2) return '';
  const first = pts[0];
  const last = pts[pts.length - 1];
  const diff = last.kg - first.kg;
  return `<section class="card">
    <div class="card-h"><h2 class="card-t">${icon('scale')} Gewicht</h2><span class="delta ${diff > 0.05 ? 'up' : diff < -0.05 ? 'down' : 'flat'}">${diff > 0 ? '+' : diff < 0 ? '−' : '±'}${fmtNum(Math.abs(diff), 1)} kg</span></div>
    ${weightChart({ points: pts, goal: S.settings.nutrition.goalWeight })}
  </section>`;
}

/* ---------- Verlauf ---------- */
function chartHTML() {
  const t = today();
  let values;
  let labels;
  let raw = null;
  if (range === '365') {
    const weeks = [];
    for (let w = 51; w >= 0; w--) {
      const end = addDays(t, -w * 7);
      weeks.push({ end, v: avg(datesBack(7, end), (d) => rating(d, metric)) });
    }
    values = weeks.map((w) => w.v);
    labels = [];
    let lastM = null;
    weeks.forEach((w, i) => {
      const m = fromISO(w.end).getMonth();
      if (m !== lastM) {
        if (lastM !== null && m % 2 === 0 && i < 50) labels.push({ i, text: MONTHS_SHORT[m] });
        lastM = m;
      }
    });
  } else {
    const dates = datesBack(Number(range));
    raw = dates.map((d) => rating(d, metric));
    // 30 Tage: gleitendes 3-Tage-Mittel, damit die Kurve lesbar bleibt
    values =
      range === '30'
        ? raw.map((v, i) => {
            const w = raw.slice(Math.max(0, i - 1), i + 2).filter((x) => x != null);
            return v == null && w.length < 2 ? null : w.length ? w.reduce((a, b) => a + b, 0) / w.length : null;
          })
        : raw;
    labels =
      range === '7'
        ? dates.map((d, i) => ({ i, text: WD[fromISO(d).getDay()], hl: d === t }))
        : dates
            .map((d, i) => ({ i, d }))
            .filter(({ i }) => (dates.length - 1 - i) % 7 === 0)
            .map(({ i, d }) => ({ i, text: `${fromISO(d).getDate()}.${fromISO(d).getMonth() + 1}.`, hl: d === t }));
  }
  const a = avg(raw || values, (v) => v);
  const chips = visibleCats()
    .map((c) => `<button type="button" class="chip ${c.id === metric ? 'on' : ''}" data-act="st-metric" data-v="${c.id}">${c.short}</button>`)
    .join('');
  const has = values.some((v) => v != null);
  return `<section class="card clip" id="st-chart">
    <div class="card-h"><h2 class="card-t">${icon('stats')} Verlauf${range === '7' ? '' : ` <span class="faint" style="letter-spacing:0;text-transform:none;font-weight:500">(${range === '365' ? 'Wochenmittel' : '3-Tage-Mittel'})</span>`}</h2></div>
    <div class="metric-chips">${chips}</div>
    ${has ? lineChart({ values, labels }) : '<div class="chart-empty">Für diesen Zeitraum gibt es noch keine Bewertungen.</div>'}
    ${a ? `<div class="chart-foot">${face(Math.round(a))}<span>Im Schnitt <b>${fmtNum(a, 1)}</b> · ${LABELS[metric][Math.round(a) - 1]}</span></div>` : ''}
  </section>`;
}

/* ---------- Durchschnitt ---------- */
function deltaHTML(d) {
  if (d == null) return '<span class="delta flat">neu</span>';
  if (Math.abs(d) < 0.05) return '<span class="delta flat">±0</span>';
  return `<span class="delta ${d > 0 ? 'up' : 'down'}">${d > 0 ? '↑' : '↓'} ${fmtNum(Math.abs(d), 1)}</span>`;
}
function avgsHTML(dates, prev) {
  const rows = visibleCats()
    .map((c) => {
      const a = avg(dates, (d) => rating(d, c.id));
      if (a == null) return '';
      const b = avg(prev, (d) => rating(d, c.id));
      const lv = Math.round(a);
      return `<div class="avg-row lv${lv}">${face(lv)}<div style="min-width:0"><div class="avg-name"><span>${c.name}</span><span>${fmtNum(a, 1)}</span></div><div class="avg-bar"><i style="--w:${((a / 5) * 100).toFixed(1)}%"></i></div></div>${deltaHTML(b == null ? null : a - b)}</div>`;
    })
    .join('');
  if (!rows) return '';
  const span = range === '365' ? 'Vorjahr' : `vorige ${range} Tage`;
  return `<section class="card"><div class="card-h"><h2 class="card-t">Durchschnitt</h2><span class="faint small">Pfeil: vs. ${span}</span></div><div class="avgs">${rows}</div></section>`;
}

/* ---------- Zusammenhänge (letzte 90 Tage) ---------- */
function insightsHTML() {
  const days = datesBack(90).filter((d) => S.journal.get(d)?.ratings);
  const J = (d) => S.journal.get(d);
  const list = [];
  const add = (key, a, b, metricCat, extra = {}) => {
    const A = avg(a, (d) => rating(d, metricCat));
    const B = avg(b, (d) => rating(d, metricCat));
    const na = a.filter((d) => rating(d, metricCat)).length;
    const nb = b.filter((d) => rating(d, metricCat)).length;
    if (na < 3 || nb < 3 || A == null || B == null) return;
    list.push({ key, A, B, diff: A - B, ...extra });
  };
  const hours = (d) => S.sleep.get(d)?.hours;
  add('sleep', days.filter((d) => hours(d) >= 8), days.filter((d) => hours(d) != null && hours(d) < 7), 'tag');
  const moved = (d) => (J(d).sport?.minutes || 0) > 0 || (J(d).sport?.types || []).length > 0;
  add('sport', days.filter(moved), days.filter((d) => J(d).done && !moved(d)), 'tag');
  const goal = S.settings.waterGoal;
  add('water', days.filter((d) => (J(d).water || 0) >= goal), days.filter((d) => J(d).water != null && J(d).water < goal * 0.6), 'energie');
  add('social', days.filter((d) => rating(d, 'sozial') >= 4), days.filter((d) => rating(d, 'sozial') && rating(d, 'sozial') <= 2), 'tag');
  add('food', days.filter((d) => rating(d, 'ernaehrung') >= 4), days.filter((d) => rating(d, 'ernaehrung') && rating(d, 'ernaehrung') <= 2), 'energie');
  if (smokeOnStats()) {
    const s0 = iso(new Date(historyStart()));
    add('smoke', days.filter((d) => d >= s0), days.filter((d) => d < s0), 'tag');
  }
  if (isSetUp()) {
    const fed = days.filter((d) => foodOn(d).length);
    add('kcal', fed.filter((d) => progress(d) >= 1), fed.filter((d) => progress(d) < 0.85), 'energie');
  }
  let bestHabit = null;
  for (const h of S.settings.habits) {
    const a = days.filter((d) => J(d).habits?.[h.id]);
    const b = days.filter((d) => J(d).done && !J(d).habits?.[h.id]);
    const A = avg(a, (d) => rating(d, 'tag'));
    const B = avg(b, (d) => rating(d, 'tag'));
    if (a.length >= 3 && b.length >= 3 && A != null && B != null && (!bestHabit || Math.abs(A - B) > Math.abs(bestHabit.diff))) {
      bestHabit = { key: 'habit', A, B, diff: A - B, name: `${h.emoji} ${h.name}` };
    }
  }
  if (bestHabit) list.push(bestHabit);

  const f = (v) => fmtNum(v, 1);
  const T = {
    sleep: (x) => [`Nach Nächten mit <b>mindestens 8 Stunden</b> Schlaf bewertest du deinen Tag mit <b>${f(x.A)}</b>, nach Nächten unter 7 Stunden mit <b>${f(x.B)}</b>.`, '≥ 8 h Schlaf', '< 7 h Schlaf'],
    sport: (x) => [`An Tagen <b>mit Bewegung</b> bewertest du deinen Tag mit <b>${f(x.A)}</b>, ohne Bewegung mit <b>${f(x.B)}</b>.`, 'Mit Bewegung', 'Ohne'],
    water: (x) => [`Wenn du dein <b>Wasserziel</b> schaffst, liegt deine Energie bei <b>${f(x.A)}</b>, an Tagen mit wenig Wasser bei <b>${f(x.B)}</b>.`, 'Ziel geschafft', 'Wenig Wasser'],
    social: (x) => [`Nach <b>guter Zeit mit anderen</b> bewertest du deinen Tag mit <b>${f(x.A)}</b>, an einsamen Tagen mit <b>${f(x.B)}</b>.`, 'Gute Zeit', 'Eher allein'],
    food: (x) => [`Isst du <b>gesund</b>, liegt deine Energie bei <b>${f(x.A)}</b>, sonst bei <b>${f(x.B)}</b>.`, 'Gesund', 'Ungesund'],
    habit: (x) => [`An Tagen mit <b>${esc(x.name)}</b> bewertest du deinen Tag mit <b>${f(x.A)}</b>, ohne mit <b>${f(x.B)}</b>.`, 'Mit', 'Ohne'],
    smoke: (x) => [`Seit du <b>mit dem Rauchen aufhörst</b>, bewertest du deinen Tag mit <b>${f(x.A)}</b>, in den Wochen davor mit <b>${f(x.B)}</b>.`, 'Seitdem', 'Davor'],
    kcal: (x) => [`Wenn du dein <b>Kalorienziel</b> schaffst, liegt deine Energie bei <b>${f(x.A)}</b>, an Tagen mit zu wenig Essen bei <b>${f(x.B)}</b>.`, 'Ziel geschafft', 'Zu wenig'],
  };
  const top = list
    .filter((x) => Math.abs(x.diff) >= 0.15)
    .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff))
    .slice(0, 3);
  const bar = (label, v) =>
    `<span>${label}</span><span class="track"><span class="fill lv${Math.round(v)}" style="--w:${((v / 5) * 100).toFixed(1)}%"></span></span><span class="val">${f(v)}</span>`;
  const items = top
    .map((x) => {
      const [text, la, lb] = T[x.key](x);
      return `<div class="insight"><p>${text}</p><div class="cmp">${bar(la, x.A)}${bar(lb, x.B)}</div></div>`;
    })
    .join('');
  return `<section class="card"><div class="card-h"><h2 class="card-t">${icon('sparkle')} Zusammenhänge</h2><span class="faint small">letzte 90 Tage</span></div>
    ${items || '<p class="empty">Nach ein paar Wochen mit Einträgen zeigt Luna dir hier, wie zum Beispiel Schlaf, Bewegung und deine Stimmung zusammenhängen.</p>'}
  </section>`;
}

/* ---------- Jahr in Pixeln ---------- */
function scaleHTML() {
  if (pxMode === 'mood') {
    return `<span class="px-scale">Furchtbar ${[1, 2, 3, 4, 5].map((l) => `<i class="lv${l}"></i>`).join('')} Super</span>`;
  }
  if (pxMode === 'smoke') {
    return `<span class="px-scale"><i class="st-good"></i>rauchfrei / im Plan <i class="st-bad" style="margin-left:8px"></i>geraucht</span>`;
  }
  if (pxMode === 'kcal') {
    return `<span class="px-scale"><i class="st-bad"></i>zu wenig <i class="st-ok" style="margin-left:8px"></i>knapp <i class="st-good" style="margin-left:8px"></i>Ziel geschafft</span>`;
  }
  return `<span class="px-scale"><i class="st-bad"></i>unter 7 h <i class="st-ok" style="margin-left:8px"></i>7–8 h <i class="st-good" style="margin-left:8px"></i>ab 8 h</span>`;
}
function pixelsHTML() {
  const y = new Date().getFullYear();
  const t = today();
  let grid = `<div class="pixels" id="px-grid"><span></span>${Array.from(
    { length: 31 },
    (_, i) => `<span class="pd">${[1, 10, 20, 31].includes(i + 1) ? i + 1 : ''}</span>`,
  ).join('')}`;
  for (let m = 0; m < 12; m++) {
    grid += `<span class="pm">${MONTHS_SHORT[m]}</span>`;
    const dim = new Date(y, m + 1, 0).getDate();
    for (let d = 1; d <= 31; d++) {
      if (d > dim) {
        grid += '<span class="px na"></span>';
        continue;
      }
      const ds = `${y}-${pad(m + 1)}-${pad(d)}`;
      let cls = '';
      if (pxMode === 'mood') {
        const v = rating(ds, 'tag');
        if (v) cls = `has lv${v}`;
      } else if (pxMode === 'kcal') {
        const kp = progress(ds);
        if (kp != null) cls = `has st-${kcalStatus(kp)}`;
      } else if (pxMode === 'smoke') {
        const st = dayStatus(ds);
        if (st) cls = `has st-${st.st}`;
      } else {
        const h = S.sleep.get(ds)?.hours;
        if (h) cls = `has st-${sleepStatus(h)}`;
      }
      grid += `<button type="button" class="px ${cls} ${ds > t ? 'fut' : ''} ${ds === t ? 'is-today' : ''}" data-act="px" data-date="${ds}" aria-label="${fmtLong(ds)}"></button>`;
    }
  }
  grid += '</div>';
  return `<section class="card" id="st-pixels">
    <div class="card-h"><h2 class="card-t">Dein Jahr ${y}</h2>${segHTML('st-px', [
      ['mood', 'Stimmung'],
      ['sleep', 'Schlaf'],
      ...(isSetUp() && S.settings.tabs?.food !== false ? [['kcal', 'Essen']] : []),
      ...(smokeOnStats() ? [['smoke', 'Rauchfrei']] : []),
    ], pxMode, 'sm')}</div>
    ${grid}
    <div class="px-read" id="px-read">${scaleHTML()}</div>
  </section>`;
}

/* ---------- Fotos & Gesamt ---------- */
function photosHTML(dates) {
  const ds = dates.filter((d) => S.photoDates.has(d)).reverse();
  if (!ds.length) return '';
  return `<section class="card clip"><div class="card-h"><h2 class="card-t">${icon('image')} Fotos des Tages</h2><span class="faint small">${ds.length}</span></div>
    <div class="strip">${ds
      .slice(0, 60)
      .map((d) => `<button type="button" data-act="photo-view" data-date="${d}"><img data-photo="${d}" alt="Foto vom ${fmtDayMonth(d)}"><span>${fromISO(d).getDate()}. ${MONTHS_SHORT[fromISO(d).getMonth()]}</span></button>`)
      .join('')}</div></section>`;
}
const words = (e) => [e.text, e.gratitude, e.good, e.better].reduce((s, t) => s + (t ? t.trim().split(/\s+/).filter(Boolean).length : 0), 0);
function totalsHTML() {
  const all = [...S.journal.values()];
  const done = all.filter((e) => e.done).length;
  if (!done) return '';
  const first = all.map((e) => e.date).sort()[0];
  const fy = fromISO(first).getFullYear();
  const sport = all.reduce((s, e) => s + (e.sport?.minutes || 0), 0);
  const sleepAll = avg([...S.sleep.values()], (e) => e.hours);
  const w = all.reduce((s, e) => s + words(e), 0);
  return `<section class="card"><div class="card-h"><h2 class="card-t">Seit dem ${fmtDayMonth(first)}${fy !== new Date().getFullYear() ? ` ${fy}` : ''}</h2></div>
    <div class="totals">
      <div><b>${done}</b><span>Tage festgehalten</span></div>
      <div><b>${fmtNum(w, 0)}</b><span>Wörter geschrieben</span></div>
      <div><b>${S.photoDates.size}</b><span>Fotos des Tages</span></div>
      <div><b>${longestStreak()}</b><span>Tage längste Serie</span></div>
      <div><b>${sleepAll ? `${fmtHM(sleepAll)} h` : '–'}</b><span>Ø Schlaf insgesamt</span></div>
      <div><b>${fmtNum(sport / 60, 0)} h</b><span>Bewegung</span></div>
    </div></section>`;
}

/* ---------- Aktionen ---------- */
function paintBody() {
  const b = $('#st-body');
  if (!b) return;
  b.innerHTML = body();
  [...b.children].forEach((c, i) => {
    c.classList.add('reveal');
    c.style.setProperty('--d', Math.min(i, 6));
  });
  hydratePhotos(b);
  countUp(b);
}
act('st-range', (el) => {
  if (el.dataset.v === range) return;
  range = el.dataset.v;
  setSeg(el);
  haptic();
  paintBody();
});
act('st-metric', (el) => {
  metric = el.dataset.v;
  const card = $('#st-chart');
  const scroll = card.querySelector('.metric-chips').scrollLeft;
  card.outerHTML = chartHTML();
  $('#st-chart .metric-chips').scrollLeft = scroll;
  haptic();
});
act('st-px', (el) => {
  if (el.dataset.v === pxMode) return;
  pxMode = el.dataset.v;
  setSeg(el);
  $('#st-pixels').outerHTML = pixelsHTML();
  haptic();
});
act('px', (el) => {
  document.querySelectorAll('.px.picked').forEach((p) => p.classList.remove('picked'));
  el.classList.add('picked');
  const d = el.dataset.date;
  const read = $('#px-read');
  let text;
  if (pxMode === 'mood') {
    const v = rating(d, 'tag');
    text = v ? `${face(v)}<span>${fmtLong(d)} · ${LABELS.tag[v - 1]}</span>` : `<span>${fmtLong(d)} · kein Eintrag</span>`;
  } else if (pxMode === 'smoke') {
    const st = dayStatus(d);
    text = st
      ? `<i class="sdot st-${st.st}"></i><span>${fmtLong(d)} · ${st.kind === 'plan' ? `${st.smoked} von ${st.limit} ${unitWord(st.limit)}` : st.smoked ? `${st.smoked} ${unitWord(st.smoked)} geraucht` : 'rauchfrei'}</span>`
      : `<span>${fmtLong(d)} · noch nicht im Plan</span>`;
  } else if (pxMode === 'kcal') {
    const kp = progress(d);
    text = kp != null ? `<i class="sdot st-${kcalStatus(kp)}"></i><span>${fmtLong(d)} · ${fmtKcal(totals(d).kcal)} von ${fmtKcal(targets(d).kcal)} kcal</span>` : `<span>${fmtLong(d)} · nichts eingetragen</span>`;
  } else {
    const h = S.sleep.get(d)?.hours;
    text = h ? `<i class="sdot st-${sleepStatus(h)}"></i><span>${fmtLong(d)} · ${fmtDur(h)}</span>` : `<span>${fmtLong(d)} · kein Eintrag</span>`;
  }
  read.innerHTML = text;
  haptic();
});
