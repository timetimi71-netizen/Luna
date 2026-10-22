// Luna · Essen: Kalorienziel zum Zunehmen, Mahlzeiten per Foto, Beschreibung oder Liste, Gewichtsverlauf
import {
  S,
  foodOn,
  saveFood,
  deleteFood,
  saveFoodPic,
  foodPicURL,
  saveWeight,
  deleteWeight,
  weightOn,
  saveLib,
  deleteLib,
  saveNutrition,
  updateJournal,
} from '../store.js';
import {
  MEALS,
  mealName,
  mealFor,
  ACTIVITY,
  TEMPO,
  nut,
  isSetUp,
  isTraining,
  targets,
  totals,
  kcalStatus,
  fmtKcal,
  weightTrend,
  adjustHint,
  applyAdjust,
  SNACK_IDEAS,
} from '../nutrition.js';
import { estimate, connect, errorText } from '../gemini.js';
import { FOODS, FOOD_CATS } from '../foods.js';
import { icon, openSheet, confirmDialog, segHTML, setSeg } from '../ui.js';
import { barChart, weightChart } from '../charts.js';
import {
  $,
  esc,
  today,
  fromISO,
  addDays,
  datesBack,
  relDay,
  journalDate,
  WD,
  WD_LONG,
  MONTHS,
  fmtNum,
  fmtDayMonth,
  pad,
  clamp,
  debounce,
  haptic,
  toast,
  autosize,
  blobToDataURL,
  IS_PREVIEW,
} from '../util.js';
import { act, onChange, app } from '../app.js';
import { toggleDictation, stopDictation } from '../speech.js';

let date = journalDate();

export function enter(opts = {}) {
  date = opts.date || journalDate();
}

const nowTime = () => {
  const d = new Date();
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const entryTime = (d) => (d === today() || d === journalDate() ? nowTime() : '12:00');
const fmt1 = (n) => fmtNum(n, Number.isInteger(Math.round(n * 10) / 10) ? 0 : 1);
const g = (n) => `${fmtNum(Math.round(n), 0)} g`;
const hasKey = () => !!nut().geminiKey && !IS_PREVIEW;

/* ---------- Ansicht ---------- */
export function render() {
  const d = fromISO(date);
  const rel = relDay(date);
  return `
  <header class="jhead" id="fhead">
    <button type="button" class="icon-btn" data-act="f-shift" data-d="-1" aria-label="Vorheriger Tag">${icon('chevL')}</button>
    <div class="jdate">
      <div class="eyebrow">${rel ? esc(rel) : 'Essen'}</div>
      <div class="jdate-t">${WD_LONG[d.getDay()]},<em>${d.getDate()}. ${MONTHS[d.getMonth()]}</em></div>
      <input type="date" class="jdate-in" value="${date}" max="${today()}" data-change="f-date" aria-label="Datum wählen">
    </div>
    <button type="button" class="icon-btn" data-act="f-shift" data-d="1" ${date >= today() ? 'disabled' : ''} aria-label="Nächster Tag">${icon('chevR')}</button>
  </header>
  ${isSetUp() ? ringCard() : setupCard()}
  ${quickAdd()}
  ${favRow()}
  ${mealsCard()}
  ${nudgeCard()}
  ${weightCard()}
  ${isSetUp() ? weekCard() : ''}`;
}

export function mount(root) {
  hydrateFoodPics(root);
  const head = $('#fhead');
  let x0 = null;
  let y0 = 0;
  head?.addEventListener(
    'touchstart',
    (e) => {
      x0 = e.touches[0].clientX;
      y0 = e.touches[0].clientY;
    },
    { passive: true },
  );
  head?.addEventListener(
    'touchend',
    (e) => {
      if (x0 == null) return;
      const dx = e.changedTouches[0].clientX - x0;
      const dy = e.changedTouches[0].clientY - y0;
      x0 = null;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) shift(dx < 0 ? 1 : -1);
    },
    { passive: true },
  );
}

export function hydrateFoodPics(root = document) {
  root.querySelectorAll('img[data-foodpic]:not([src])').forEach(async (img) => {
    const url = await foodPicURL(img.dataset.foodpic);
    if (url) img.src = url;
  });
}

function setupCard() {
  return `<section class="card hero">
    <div class="eyebrow">${icon('target')} Zunehm-Ziel</div>
    <h2 class="hero-title">Wie viel solltest du <em>essen?</em></h2>
    <p>Mit Größe, Gewicht, Alter und deinen Fußballtagen rechnet Luna dein tägliches Kalorienziel aus.</p>
    <button type="button" class="btn btn-primary btn-block" data-act="f-setup">Ziel einrichten ${icon('arrowR')}</button>
  </section>`;
}

/* Ring + Makros */
export function ringSVG(p, cls = '') {
  const pct = Math.max(0, Math.min(1, p || 0)) * 100;
  return `<svg class="ring ${cls} ${p >= 1 ? 'full' : ''}" viewBox="0 0 120 120" aria-hidden="true">
    <circle class="ring-track" cx="60" cy="60" r="52"/>
    <circle class="ring-val" cx="60" cy="60" r="52" pathLength="100" style="--p:${pct.toFixed(1)}"/>
  </svg>`;
}
function macroRow(label, cls, val, goal) {
  const pct = goal ? Math.min(100, (val / goal) * 100) : 0;
  return `<div class="mac ${cls}"><div class="mac-h"><span>${label}</span><span><b>${Math.round(val)}</b> / ${goal} g</span></div><div class="mac-bar"><i style="--w:${pct.toFixed(1)}%"></i></div></div>`;
}
function ringCard() {
  const t = targets(date);
  const s = totals(date);
  const p = s.kcal / t.kcal;
  const left = t.kcal - s.kcal;
  return `<section class="card ring-card">
    <div class="ring-top">
      <div class="ring-wrap">${ringSVG(p)}
        <div class="ring-center"><div class="ring-num" data-count="${Math.round(s.kcal)}">${fmtKcal(s.kcal)}</div><div class="ring-of">von ${fmtKcal(t.kcal)} kcal</div></div>
      </div>
      <div class="ring-side">
        <div class="ring-left ${left <= 0 ? 'done' : ''}">${left > 0 ? `noch <b>${fmtKcal(left)}</b> kcal` : `${icon('check')} Ziel geschafft${left < -50 ? ` <span>+${fmtKcal(-left)}</span>` : ''}`}</div>
        ${macroRow('Eiweiß', 'pro', s.p, t.protein)}
        ${macroRow('Kohlenh.', 'carb', s.c, t.carbs)}
        ${macroRow('Fett', 'fat', s.f, t.fat)}
      </div>
    </div>
    <button type="button" class="train ${t.training ? 'on' : ''}" data-act="f-training" aria-pressed="${t.training}">
      ${icon('ball')}<span>${t.training ? `Trainingstag · +${fmtKcal(nut().trainingKcal)} kcal` : 'Ruhetag'}</span><small>${t.training ? 'Tippen für Ruhetag' : 'Tippen, wenn du heute trainierst'}</small>
    </button>
  </section>`;
}

function quickAdd() {
  const photo = hasKey()
    ? `<label class="qbtn" data-act="noop">${icon('camera')}<span>Foto</span><input type="file" accept="image/*" data-change="f-photo"></label>`
    : `<button type="button" class="qbtn" data-act="f-key" data-then="photo">${icon('camera')}<span>Foto</span></button>`;
  return `<div class="qadd">
    ${photo}
    <button type="button" class="qbtn" data-act="${hasKey() ? 'f-describe' : 'f-key'}" data-then="describe">${icon('mic')}<span>Erzählen</span></button>
    <button type="button" class="qbtn" data-act="f-search">${icon('search')}<span>Liste</span></button>
    <button type="button" class="qbtn" data-act="f-quick">${icon('bolt')}<span>Schnell</span></button>
  </div>`;
}

const favs = () =>
  [...S.foodlib.values()].filter((x) => x.type === 'fav').sort((a, b) => (b.uses || 0) - (a.uses || 0) || b.createdAt - a.createdAt);
function favRow() {
  const list = favs();
  if (!list.length) return '';
  return `<div class="fav-row">${list
    .slice(0, 12)
    .map((f) => `<button type="button" class="fav-chip" data-act="f-fav-add" data-id="${esc(f.id)}">${icon('star')}<span>${esc(f.name)}</span><b>${fmtKcal(f.kcal)}</b></button>`)
    .join('')}</div>`;
}

const SOURCE_IC = { foto: 'camera', text: 'mic', liste: 'search', fav: 'star', schnell: 'bolt', idee: 'sparkle' };
export function foodItemHTML(e) {
  const thumb = S.foodPics.has(e.id) ? `<img data-foodpic="${esc(e.id)}" alt="">` : icon(SOURCE_IC[e.source] || 'apple');
  const sub = [e.amount, e.p ? `${Math.round(e.p)} g Eiweiß` : ''].filter(Boolean).join(' · ');
  return `<button type="button" class="fitem" data-act="f-edit" data-id="${esc(e.id)}">
    <span class="fthumb">${thumb}</span>
    <span class="fmain"><span class="fname">${esc(e.name)}</span>${sub ? `<span class="fsub">${esc(sub)}</span>` : ''}</span>
    <span class="fkcal">${fmtKcal(e.kcal)}<small>kcal</small></span>
  </button>`;
}
function mealsCard() {
  const list = foodOn(date);
  return `<section class="card meals">${MEALS.map(([id, name]) => {
    const items = list.filter((e) => e.meal === id);
    const sum = items.reduce((s, e) => s + e.kcal, 0);
    return `<div class="meal">
      <div class="meal-h"><h3>${name}</h3>${items.length ? `<span>${fmtKcal(sum)} kcal</span>` : ''}<button type="button" class="meal-add" data-act="f-add-meal" data-meal="${id}" aria-label="${name} eintragen">${icon('plus')}</button></div>
      ${items.length ? `<div class="flist">${items.map(foodItemHTML).join('')}</div>` : ''}
    </div>`;
  }).join('')}</section>`;
}

function ideasFor(left) {
  return [...SNACK_IDEAS].sort((a, b) => Math.abs(a.kcal - left * 0.8) - Math.abs(b.kcal - left * 0.8)).slice(0, 3);
}
function nudgeCard() {
  if (!isSetUp() || date !== journalDate()) return '';
  const h = new Date().getHours();
  const left = targets(date).kcal - totals(date).kcal;
  if (left < 250 || (h < 17 && h >= 5)) return '';
  return `<section class="card nudge">
    <div class="card-h"><h2 class="card-t">${icon('sparkle')} Noch ${fmtKcal(left)} kcal offen</h2></div>
    <p class="muted small">Ein paar Ideen mit viel Energie, ohne dass du riesige Portionen brauchst:</p>
    <div class="ideas">${ideasFor(left)
      .map(
        (x) => `<button type="button" class="idea" data-act="f-idea" data-name="${esc(x.name)}"><span class="fmain"><span class="fname">${esc(x.name)}</span><span class="fsub">${esc(x.amount)}</span></span><span class="fkcal">${fmtKcal(x.kcal)}<small>kcal</small></span><span class="idea-add">${icon('plus')}</span></button>`,
      )
      .join('')}</div>
  </section>`;
}

function weightCard() {
  const n = nut();
  const latest = weightOn(today());
  const start = n.startWeight;
  const tr = weightTrend();
  const hint = adjustHint();
  const pts = [...S.weights.values()].filter((w) => w.date >= addDays(today(), -84)).sort((a, b) => a.date.localeCompare(b.date));
  let body;
  if (!latest) {
    body = `<p class="muted small">Wieg dich ein- bis zweimal pro Woche, am besten morgens nach dem Aufstehen. Dann siehst du hier, ob du wirklich zunimmst.</p>
      <button type="button" class="btn btn-soft btn-block" data-act="f-weight" style="margin-top:12px">${icon('plus')} Gewicht eintragen</button>`;
  } else {
    const diff = start ? latest.kg - start : null;
    const toGo = n.goalWeight ? n.goalWeight - latest.kg : null;
    const weeks = toGo > 0 && tr?.perWeek > 0.05 ? Math.ceil(toGo / tr.perWeek) : null;
    body = `<div class="wrow">
        <div class="wbig">${fmt1(latest.kg)}<small>kg</small></div>
        ${diff != null ? `<span class="delta ${diff > 0.05 ? 'up' : diff < -0.05 ? 'down' : 'flat'}">${diff > 0 ? '+' : diff < 0 ? '−' : '±'}${fmt1(Math.abs(diff))} kg seit Start</span>` : ''}
      </div>
      ${pts.length >= 2 ? weightChart({ points: pts, goal: n.goalWeight }) : ''}
      <p class="note">${tr ? `Tempo: <b>${tr.perWeek >= 0 ? '+' : '−'}${fmtNum(Math.abs(tr.perWeek), 2)} kg pro Woche</b>` : 'Für das Tempo braucht Luna Einträge über mindestens zehn Tage.'}${
        toGo > 0 ? ` · noch ${fmt1(toGo)} kg bis ${fmt1(n.goalWeight)} kg${weeks ? `, ca. ${weeks} ${weeks === 1 ? 'Woche' : 'Wochen'}` : ''}` : n.goalWeight && toGo <= 0 ? ' · Zielgewicht erreicht!' : ''
      }</p>
      ${
        hint && hint.kind !== 'ok' && isSetUp()
          ? `<div class="adjust"><p>${hint.kind === 'more' ? 'In den letzten Wochen hast du kaum zugenommen. Soll Luna dein Ziel um 150 kcal pro Tag erhöhen?' : 'Du nimmst gerade sehr schnell zu, mehr davon wird eher Fett. Ziel um 150 kcal senken?'}</p><button type="button" class="btn btn-soft btn-sm" data-act="f-adjust" data-plus="${hint.plus}">${hint.kind === 'more' ? '+150 kcal' : '−150 kcal'}</button></div>`
          : ''
      }`;
  }
  return `<section class="card">
    <div class="card-h"><h2 class="card-t">${icon('scale')} Gewicht</h2>${latest ? `<button type="button" class="link" data-act="f-weight">${icon('plus')} Eintragen</button>` : ''}</div>
    ${body}
  </section>`;
}

function weekCard() {
  const days = datesBack(7, today());
  let hit = 0;
  const items = days.map((d) => {
    const t = totals(d);
    const goal = targets(d).kcal;
    const st = t.n ? kcalStatus(t.kcal / goal) : null;
    if (st === 'good') hit++;
    return {
      label: d === today() ? 'Heute' : WD[fromISO(d).getDay()],
      value: t.n ? t.kcal : null,
      cls: st ? `st-${st}` : '',
      hl: d === today(),
      title: t.n ? `${fmtDayMonth(d)}: ${fmtKcal(t.kcal)} von ${fmtKcal(goal)} kcal` : '',
    };
  });
  const goals = days.map((d) => targets(d).kcal);
  const avgGoal = goals.reduce((a, b) => a + b, 0) / goals.length;
  const max = Math.max(avgGoal * 1.25, ...items.map((i) => i.value || 0));
  return `<section class="card">
    <div class="card-h"><h2 class="card-t">Letzte 7 Tage</h2><span class="faint small">Ziel an ${hit} von 7 Tagen</span></div>
    ${barChart({ items, max, target: avgGoal, targetLabel: `Ø Ziel ${fmtKcal(avgGoal)}` })}
  </section>`;
}

/* ---------- Navigation ---------- */
function shift(dir) {
  const nd = addDays(date, dir);
  if (nd > today()) return;
  date = nd;
  app.refresh({ animate: true });
  $('#fhead')?.classList.add(dir > 0 ? 'swipe-l' : 'swipe-r');
  haptic();
}
act('f-shift', (el) => shift(+el.dataset.d));
onChange('f-date', (el) => {
  if (el.value && el.value <= today()) {
    date = el.value;
    app.refresh({ animate: true });
  }
});
act('f-training', () => {
  const now = isTraining(date);
  updateJournal(date, { training: !now });
  haptic();
  app.refresh();
  toast(now ? 'Als Ruhetag markiert' : `Trainingstag: Ziel +${fmtKcal(nut().trainingKcal)} kcal`, { icon: icon('ball') });
});
act('f-adjust', (el) => {
  applyAdjust(+el.dataset.plus);
  haptic('success');
  toast(`Neues Ziel: ${fmtKcal(targets(date).kcal)} kcal`, { icon: icon('target') });
  app.refresh();
});

/* ---------- Bausteine für Sheets ---------- */
const mealChips = (sel) =>
  `<div class="chips meal-chips">${MEALS.map(([id, name]) => `<button type="button" class="chip ${id === sel ? 'on' : ''}" data-meal="${id}">${name}</button>`).join('')}</div>`;
function bindMealChips(root, onPick) {
  root.querySelectorAll('[data-meal]').forEach((b) =>
    b.addEventListener('click', () => {
      root.querySelectorAll('[data-meal]').forEach((x) => x.classList.toggle('on', x === b));
      onPick(b.dataset.meal);
      haptic();
    }),
  );
}
const macroLine = (v) =>
  `<div class="macro-line"><span class="pro">${g(v.p)} <small>Eiweiß</small></span><span class="carb">${g(v.c)} <small>Kohlenh.</small></span><span class="fat">${g(v.f)} <small>Fett</small></span></div>`;
const scaled = (v, k) => ({ kcal: v.kcal * k, p: v.p * k, c: v.c * k, f: v.f * k });
const sum = (items) => items.reduce((s, x) => ({ kcal: s.kcal + x.kcal, p: s.p + x.p, c: s.c + x.c, f: s.f + x.f }), { kcal: 0, p: 0, c: 0, f: 0 });

// Doppeltipp-Schutz: derselbe Eintrag innerhalb einer Sekunde zählt nur einmal
let lastAdd = { key: '', t: 0 };
function addEntry(base, { meal, toastMsg = true, fav = false } = {}) {
  const key = `${date}|${base.name}|${Math.round(base.kcal)}`;
  if (key === lastAdd.key && Date.now() - lastAdd.t < 1000) return null;
  lastAdd = { key, t: Date.now() };
  const e = saveFood({
    date,
    time: entryTime(date),
    meal: meal || mealFor(entryTime(date)),
    ...base,
    kcal: Math.round(base.kcal),
    p: Math.round(base.p * 10) / 10,
    c: Math.round(base.c * 10) / 10,
    f: Math.round(base.f * 10) / 10,
  });
  if (fav) saveAsFav(e);
  haptic('success');
  app.refresh();
  if (toastMsg) {
    toast(`${e.name} · ${fmtKcal(e.kcal)} kcal eingetragen`, {
      icon: icon('check'),
      action: 'Rückgängig',
      ms: 4500,
      onAction: async () => {
        await deleteFood(e.id);
        app.refresh();
      },
    });
  }
  return e;
}
function saveAsFav(e) {
  const existing = [...S.foodlib.values()].find((x) => x.type === 'fav' && x.name === e.name && Math.round(x.kcal) === Math.round(e.kcal));
  if (existing) return existing;
  return saveLib({ type: 'fav', name: e.name, amount: e.amount || '', kcal: e.kcal, p: e.p, c: e.c, f: e.f, items: e.items || null, uses: 0 });
}

/* ---------- Ziel einrichten ---------- */
function setupHTML(n) {
  const days = [1, 2, 3, 4, 5, 6, 0];
  return `<div class="form setup">
    <p class="muted">Aus diesen Angaben rechnet Luna deinen Grundbedarf aus und legt einen Überschuss zum Zunehmen drauf. An Trainingstagen kommt das Training dazu.</p>
    <div class="group">
      <div class="li"><span class="li-title">Geschlecht</span><div class="look-seg">${segHTML('su-sex', [
        ['m', 'Mann'],
        ['w', 'Frau'],
      ], n.sex, 'sm')}</div></div>
      <label class="li" for="su-age"><span class="li-title">Alter</span><input class="num-in" id="su-age" type="number" inputmode="numeric" min="12" max="90" placeholder="Jahre" value="${n.age ?? ''}"></label>
      <label class="li" for="su-height"><span class="li-title">Größe</span><span class="unit-in"><input class="num-in" id="su-height" type="number" inputmode="numeric" min="120" max="230" value="${n.height ?? ''}"><small>cm</small></span></label>
      <label class="li" for="su-weight"><span class="li-title">Gewicht jetzt</span><span class="unit-in"><input class="num-in" id="su-weight" type="number" inputmode="decimal" step="0.1" min="30" max="250" placeholder="z. B. 58" value="${weightOn(today())?.kg ?? n.startWeight ?? ''}"><small>kg</small></span></label>
      <label class="li" for="su-goal"><span class="li-title">Zielgewicht</span><span class="unit-in"><input class="num-in" id="su-goal" type="number" inputmode="decimal" step="0.5" min="30" max="250" placeholder="z. B. 66" value="${n.goalWeight ?? ''}"><small>kg</small></span></label>
    </div>
    <div class="group-label">Alltag ohne Sport</div>
    <div class="opt-list" id="su-activity">${ACTIVITY.map(
      ([id, label, sub]) => `<button type="button" class="opt ${n.activity === id ? 'on' : ''}" data-v="${id}"><b>${label}</b><span>${sub}</span></button>`,
    ).join('')}</div>
    <div class="group-label">Training (z. B. Fußball)</div>
    <div class="group pad">
      <div class="li-sub" style="margin-bottom:10px">An welchen Tagen trainierst oder spielst du meistens?</div>
      <div class="wd-chips" id="su-days">${days
        .map((d) => `<button type="button" class="chip ${(n.trainingDays || []).includes(d) ? 'on' : ''}" data-d="${d}">${WD[d]}</button>`)
        .join('')}</div>
      <div class="li-sub" style="margin:14px 0 8px">Verbrauch pro Training</div>
      ${segHTML('su-train', [
        [400, '400'],
        [600, '600'],
        [800, '800 kcal'],
      ].map(([v, l]) => [String(v), l]), String(n.trainingKcal), 'sm')}
      <div class="note" style="margin-top:8px">90 Minuten Fußballtraining sind ungefähr 600 kcal, ein Spiel eher 800.</div>
    </div>
    <div class="group-label">Tempo beim Zunehmen</div>
    <div class="opt-list" id="su-tempo">${TEMPO.map(
      ([v, label, sub]) => `<button type="button" class="opt ${n.surplus === v ? 'on' : ''}" data-v="${v}"><b>${label} · +${v} kcal</b><span>${sub}</span></button>`,
    ).join('')}</div>
    <div class="calc" id="su-calc"></div>
    <button type="button" class="btn btn-primary btn-lg btn-block" id="su-save">Ziel speichern</button>
  </div>`;
}
export function openSetup({ onDone = null } = {}) {
  const draft = { ...nut() };
  if (!draft.trainingDays?.length && !draft.setup) draft.trainingDays = [2, 4, 6];
  const sheet = openSheet({ title: 'Dein Zunehm-Ziel', cls: 'tall', body: setupHTML(draft) });
  const q = (s) => sheet.body.querySelector(s);
  const read = () => {
    draft.age = parseInt(q('#su-age').value, 10) || null;
    draft.height = parseInt(q('#su-height').value, 10) || null;
    const kg = parseFloat(String(q('#su-weight').value).replace(',', '.'));
    // Startgewicht = erste eigene Messung vor heute; sonst das, was jetzt im Feld steht (lässt sich so auch korrigieren)
    const first = [...S.weights.values()].filter((w) => !w.demo && w.date < today()).sort((a, b) => a.date.localeCompare(b.date))[0];
    draft.startWeight = first ? first.kg : Number.isFinite(kg) ? kg : null;
    draft._kg = Number.isFinite(kg) ? kg : null;
    const goal = parseFloat(String(q('#su-goal').value).replace(',', '.'));
    draft.goalWeight = Number.isFinite(goal) ? goal : null;
  };
  const calc = () => {
    read();
    const box = q('#su-calc');
    if (!draft.age || !draft.height || !draft._kg) {
      box.innerHTML = '<p class="note">Trag Alter, Größe und Gewicht ein, dann siehst du hier dein Ziel.</p>';
      return;
    }
    if (draft.height < 120 || draft.height > 230 || draft._kg < 30 || draft._kg > 250 || draft.age < 12 || draft.age > 90) {
      box.innerHTML = '<p class="note">Die Angaben sehen noch nicht ganz richtig aus. Größe bitte in Zentimetern, Gewicht in Kilo.</p>';
      return;
    }
    const t = (training) => {
      const bmr = 10 * draft._kg + 6.25 * draft.height - 5 * draft.age + (draft.sex === 'w' ? -161 : 5);
      const factor = ACTIVITY.find((a) => a[0] === draft.activity)[3];
      return Math.round((bmr * factor + (training ? draft.trainingKcal : 0) + draft.surplus) / 50) * 50;
    };
    box.innerHTML = `<div class="calc-grid">
      <div><b>${fmtKcal(t(false))}</b><span>kcal am Ruhetag</span></div>
      <div><b>${fmtKcal(t(true))}</b><span>kcal am Trainingstag</span></div>
      <div><b>${Math.round(draft._kg * draft.proteinPerKg)} g</b><span>Eiweiß pro Tag</span></div>
    </div>`;
  };
  sheet.body.addEventListener('input', debounce(calc, 120));
  sheet.body.addEventListener('click', (e) => {
    const seg = e.target.closest('.seg button');
    if (seg) {
      setSeg(seg);
      if (seg.dataset.act === 'su-sex') draft.sex = seg.dataset.v;
      if (seg.dataset.act === 'su-train') draft.trainingKcal = Number(seg.dataset.v);
    }
    const opt = e.target.closest('.opt');
    if (opt) {
      opt.parentElement.querySelectorAll('.opt').forEach((o) => o.classList.toggle('on', o === opt));
      if (opt.parentElement.id === 'su-activity') draft.activity = opt.dataset.v;
      else draft.surplus = Number(opt.dataset.v);
    }
    const day = e.target.closest('#su-days [data-d]');
    if (day) {
      const d = Number(day.dataset.d);
      const set = new Set(draft.trainingDays || []);
      if (set.has(d)) set.delete(d);
      else set.add(d);
      draft.trainingDays = [...set];
      day.classList.toggle('on', set.has(d));
    }
    if (seg || opt || day) {
      haptic();
      calc();
    }
  });
  q('#su-save').addEventListener('click', async () => {
    read();
    const out = (v, lo, hi) => v != null && (v < lo || v > hi);
    const bad = [
      [!draft.age || out(draft.age, 12, 90), '#su-age', 'Bitte prüf dein Alter.'],
      [!draft.height || out(draft.height, 120, 230), '#su-height', 'Bitte prüf deine Größe in Zentimetern, z. B. 182.'],
      [!draft._kg || out(draft._kg, 30, 250), '#su-weight', 'Bitte prüf dein Gewicht in Kilo.'],
      [out(draft.goalWeight, 30, 250), '#su-goal', 'Bitte prüf dein Zielgewicht.'],
    ].find((x) => x[0]);
    if (bad) {
      const el = q(bad[1]);
      el.classList.remove('shake');
      void el.offsetWidth;
      el.classList.add('shake');
      el.focus();
      haptic('error');
      toast(!draft.age || !draft.height || !draft._kg ? 'Alter, Größe und Gewicht brauche ich für die Rechnung.' : bad[2]);
      return;
    }
    const kg = draft._kg;
    const { _kg, ...clean } = draft;
    await saveNutrition({ ...clean, setup: true, demo: false, startWeight: draft.startWeight ?? kg });
    if (!weightOn(today()) || weightOn(today()).kg !== kg) saveWeight(today(), kg);
    haptic('success');
    sheet.close();
    app.refresh({ animate: true });
    onDone?.();
    toast(`Dein Ziel heute: ${fmtKcal(targets(date).kcal)} kcal`, { icon: icon('target') });
  });
  calc();
}
act('f-setup', () => openSetup());

/* ---------- Gemini-Schlüssel ---------- */
export function openKeySheet(then, onDone = null) {
  if (IS_PREVIEW) {
    toast('Die Foto-Schätzung geht erst in der installierten App.', { ms: 3600 });
    return;
  }
  const n = nut();
  const sheet = openSheet({
    title: 'Foto-Erkennung einrichten',
    body: `<div class="form">
      <p class="muted">Luna schickt dein Essensfoto an Gemini von Google und bekommt eine Schätzung der Nährwerte zurück. Dafür brauchst du einmal einen kostenlosen Schlüssel.</p>
      <ol class="steps">
        <li><span>Öffne <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener"><b>aistudio.google.com/apikey</b></a> und melde dich mit deinem Google-Konto an.</span></li>
        <li><span>Tippe auf <b>„Create API key“</b> (oder vorher <b>„Get API key“</b>).</span></li>
        <li><span>Kopiere den Schlüssel und füg ihn hier ein.</span></li>
      </ol>
      <div class="group"><input class="li-input" id="gk-key" placeholder="Schlüssel einfügen (beginnt mit AIza…)" autocomplete="off" autocapitalize="off" spellcheck="false" value="${esc(n.geminiKey)}"></div>
      <button type="button" class="btn btn-primary btn-lg btn-block" id="gk-save">${n.geminiKey ? 'Schlüssel prüfen' : 'Verbinden'}</button>
      <p class="note" id="gk-status">${n.geminiModel ? `Verbunden mit ${esc(n.geminiModel)}.` : 'Der Schlüssel bleibt nur auf diesem iPhone und landet nicht im Backup.'}</p>
      ${n.geminiKey ? '<button type="button" class="btn btn-danger btn-block" id="gk-remove">Schlüssel entfernen</button>' : ''}
    </div>`,
  });
  const q = (s) => sheet.body.querySelector(s);
  q('#gk-save').addEventListener('click', async () => {
    const key = q('#gk-key').value.trim();
    const status = q('#gk-status');
    if (key.length < 20) {
      status.textContent = 'Der Schlüssel sieht zu kurz aus. Kopier ihn bitte komplett.';
      haptic('error');
      return;
    }
    const btn = q('#gk-save');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner sm"></span> Prüfe …';
    try {
      const model = await connect(key);
      status.textContent = `Verbunden mit ${model}.`;
      haptic('success');
      toast('Foto-Erkennung ist bereit', { icon: icon('check') });
      setTimeout(() => {
        sheet.close();
        app.refresh();
        onDone?.();
        if (then === 'describe') openDescribe();
      }, 600);
    } catch (e) {
      status.textContent = errorText(e);
      haptic('error');
      btn.disabled = false;
      btn.textContent = 'Nochmal prüfen';
    }
  });
  q('#gk-remove')?.addEventListener('click', async () => {
    await saveNutrition({ geminiKey: '', geminiModel: '' });
    sheet.close();
    app.refresh();
    onDone?.();
    toast('Schlüssel entfernt');
  });
}
act('f-key', (el) => openKeySheet(el.dataset.then));

/* ---------- Bild vorbereiten ---------- */
// Einmal dekodieren: 1024 px für Gemini, daraus 640 px als Vorschaubild. Leinwände danach freigeben (iOS hat wenig Canvas-Speicher).
async function loadImage(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}
function fit(src, w, h, max) {
  const s = Math.min(1, max / Math.max(w, h));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w * s));
  c.height = Math.max(1, Math.round(h * s));
  const ctx = c.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(src, 0, 0, c.width, c.height);
  return c;
}
const toJPEG = (c, q) =>
  new Promise((r) => c.toBlob(r, 'image/jpeg', q)).then((b) => b || fetch(c.toDataURL('image/jpeg', q)).then((x) => x.blob()));
async function preparePhoto(file) {
  const img = await loadImage(file);
  const big = fit(img, img.naturalWidth, img.naturalHeight, 1024);
  const small = fit(big, big.width, big.height, 640);
  const bigBlob = await toJPEG(big, 0.8);
  const thumb = await toJPEG(small, 0.78);
  big.width = big.height = small.width = small.height = 0;
  if (!bigBlob?.size || !thumb?.size) throw new Error('Foto leer');
  const b64 = (await blobToDataURL(bigBlob)).split(',')[1];
  return { b64, thumb };
}
const whenVisible = () =>
  new Promise((r) => {
    if (document.visibilityState === 'visible') return r();
    const h = () => {
      if (document.visibilityState !== 'visible') return;
      document.removeEventListener('visibilitychange', h);
      r();
    };
    document.addEventListener('visibilitychange', h);
  });

/* ---------- Schätzung (Foto oder Text) ---------- */
function estimateSheet({ title, file = null, text = '', meal = null }) {
  const sheet = openSheet({ title, cls: 'tall' });
  const st = { pic: null, text, note: '', est: null, factor: 1, meal: meal || mealFor(entryTime(date)), fav: false, removed: new Set(), retried: false };
  let picURL = null;
  let ctrl = null;
  sheet.onClose = () => {
    ctrl?.abort();
    if (picURL) setTimeout(() => URL.revokeObjectURL(picURL), 1000);
  };
  const q = (s) => sheet.body.querySelector(s);

  const preparing = () => {
    sheet.body.innerHTML = `<div class="est">
      <div class="est-pic est-pic-wait scanning"><i class="scan"></i></div>
      <div class="est-wait"><span class="spinner sm"></span> Foto wird vorbereitet …</div>
    </div>`;
  };
  const loading = () => {
    sheet.body.innerHTML = `<div class="est">
      ${picURL ? `<div class="est-pic scanning"><img src="${picURL}" alt=""><i class="scan"></i></div>` : `<div class="est-text">„${esc(text)}“</div>`}
      <div class="est-wait"><span class="spinner sm"></span> Gemini schätzt die Nährwerte …</div>
    </div>`;
  };
  const failed = (e, msg = null) => {
    sheet.body.innerHTML = `<div class="est">
      ${picURL ? `<div class="est-pic"><img src="${picURL}" alt=""></div>` : ''}
      <div class="est-error">${icon('info')}<p>${esc(msg || errorText(e))}</p></div>
      <button type="button" class="btn btn-primary btn-block" id="est-retry">Nochmal versuchen</button>
      <button type="button" class="btn btn-ghost btn-block" id="est-list">${icon('search')} Stattdessen aus der Liste</button>
    </div>`;
    q('#est-retry').addEventListener('click', run);
    q('#est-list').addEventListener('click', () => {
      sheet.close();
      openSearch();
    });
  };
  const shown = () => st.est.items.filter((_, i) => !st.removed.has(i));
  const paint = () => {
    const est = st.est;
    const tot = scaled(sum(shown()), st.factor);
    sheet.body.innerHTML = `<div class="est">
      ${picURL ? `<div class="est-pic"><img src="${picURL}" alt=""></div>` : ''}
      <input class="est-name" id="est-name" value="${esc(est.dish)}" maxlength="60" aria-label="Name">
      <div class="est-total"><b>${fmtKcal(tot.kcal)}</b><span>kcal</span><span class="conf conf-${est.confidence}">${est.confidence === 'hoch' ? 'sicher' : est.confidence === 'mittel' ? 'ungefähr' : 'unsicher'}</span></div>
      ${macroLine(tot)}
      ${est.items.length ? `<div class="est-items">${est.items
        .map(
          (it, i) => `<div class="est-item ${st.removed.has(i) ? 'off' : ''}"><span class="fmain"><span class="fname">${esc(it.name)}</span><span class="fsub">${esc(it.amount)}</span></span><span class="fkcal">${fmtKcal(it.kcal * st.factor)}<small>kcal</small></span><button type="button" class="icon-btn sm" data-item="${i}" aria-label="${st.removed.has(i) ? 'Wieder aufnehmen' : 'Entfernen'}">${icon(st.removed.has(i) ? 'plus' : 'close')}</button></div>`,
        )
        .join('')}</div>` : ''}
      ${est.hint ? `<p class="note est-hint">${icon('info')} ${esc(est.hint)}</p>` : ''}
      <div class="est-row"><span>Portion</span><div class="stepper"><button type="button" data-f="-0.25" aria-label="Kleiner">${icon('minus')}</button><output>${Math.round(st.factor * 100)} %</output><button type="button" data-f="0.25" aria-label="Größer">${icon('plus')}</button></div></div>
      ${mealChips(st.meal)}
      <div class="est-fix"><input class="field" id="est-note" placeholder="Stimmt was nicht? z. B. „große Portion“, „mit Sahnesoße“" value="${esc(st.note)}"><button type="button" class="btn btn-soft btn-sm" id="est-redo">Neu schätzen</button></div>
      <button type="button" class="fav-toggle ${st.fav ? 'on' : ''}" id="est-fav">${icon('star')} Als Favorit merken</button>
      <button type="button" class="btn btn-primary btn-lg btn-block" id="est-save" ${shown().length ? '' : 'disabled'}>Eintragen</button>
    </div>`;
    bindMealChips(sheet.body, (m) => {
      st.meal = m;
    });
    sheet.body.querySelectorAll('[data-item]').forEach((b) =>
      b.addEventListener('click', () => {
        const i = Number(b.dataset.item);
        if (st.removed.has(i)) st.removed.delete(i);
        else st.removed.add(i);
        st.est.dish = q('#est-name').value;
        st.note = q('#est-note').value;
        paint();
        haptic();
      }),
    );
    sheet.body.querySelectorAll('[data-f]').forEach((b) =>
      b.addEventListener('click', () => {
        st.factor = clamp(Math.round((st.factor + Number(b.dataset.f)) * 100) / 100, 0.25, 3);
        st.est.dish = q('#est-name').value;
        st.note = q('#est-note').value;
        paint();
        haptic();
      }),
    );
    q('#est-fav').addEventListener('click', (e) => {
      st.fav = !st.fav;
      e.currentTarget.classList.toggle('on', st.fav);
      haptic();
    });
    q('#est-redo').addEventListener('click', () => {
      st.note = q('#est-note').value.trim();
      if (!st.note) {
        q('#est-note').focus();
        return;
      }
      st.removed.clear();
      st.factor = 1;
      run();
    });
    q('#est-save').addEventListener('click', async (ev) => {
      if (ev.currentTarget.disabled) return;
      ev.currentTarget.disabled = true;
      const items = shown().map((it) => ({ ...it, ...scaled(it, st.factor) }));
      const tot = sum(items);
      const e = addEntry(
        {
          name: q('#est-name').value.trim() || est.dish,
          amount: st.factor === 1 ? '' : `${Math.round(st.factor * 100)} % Portion`,
          ...tot,
          items,
          source: st.pic ? 'foto' : 'text',
          note: st.note || undefined,
        },
        { meal: st.meal, fav: st.fav },
      );
      if (e && st.pic) await saveFoodPic(e.id, st.pic.thumb);
      sheet.close();
      app.refresh();
    });
  };
  async function run() {
    if (file && !st.pic) {
      preparing();
      try {
        st.pic = await preparePhoto(file);
        picURL = URL.createObjectURL(st.pic.thumb);
      } catch (e) {
        console.error(e);
        if (!sheet.closed) failed(null, 'Das Foto ließ sich nicht öffnen. Versuch es mit einem anderen Bild.');
        return;
      }
      if (sheet.closed) return;
    }
    loading();
    // Wechselt man während der Schätzung die App, bricht iOS die Anfrage ab. Dann einmal still neu versuchen.
    let wasHidden = document.visibilityState === 'hidden';
    const onVis = () => {
      if (document.visibilityState === 'hidden') wasHidden = true;
    };
    document.addEventListener('visibilitychange', onVis);
    ctrl = new AbortController();
    try {
      st.est = await estimate({ image: st.pic?.b64 || null, text, note: st.note, signal: ctrl.signal });
      if (sheet.closed) return;
      if (!st.est.items.length) {
        failed(null, st.est.hint || 'Auf dem Foto war kein Essen zu erkennen.');
        return;
      }
      haptic('success');
      paint();
    } catch (e) {
      if (sheet.closed) return;
      if (wasHidden && !st.retried && ['offline', 'timeout'].includes(e?.kind)) {
        st.retried = true;
        await whenVisible();
        if (!sheet.closed) run();
        return;
      }
      console.warn(e);
      failed(e);
    } finally {
      document.removeEventListener('visibilitychange', onVis);
    }
  }
  run();
  return sheet;
}

onChange('f-photo', async (el) => {
  const file = el.files?.[0];
  el.value = '';
  if (!file) return;
  if (el.dataset.date) date = el.dataset.date;
  estimateSheet({ title: 'Foto-Schätzung', file });
});

function openDescribe(meal = null) {
  const sheet = openSheet({
    title: 'Was hast du gegessen?',
    body: `<div class="form">
      <div class="write card describe">
        <textarea class="jtext" id="ds-text" data-field="describe" placeholder="z. B. „Zwei Brötchen mit Nutella und ein Glas Milch“ oder „Döner mit allem“" rows="3"></textarea>
        <div class="listening"><span class="bars"><i></i><i></i><i></i><i></i></span>Ich höre zu … tippe zum Beenden</div>
        <button type="button" class="mic" id="ds-mic" aria-label="Diktieren" aria-pressed="false">${icon('mic')}</button>
      </div>
      <button type="button" class="btn btn-primary btn-lg btn-block" id="ds-go">${icon('sparkle')} Nährwerte schätzen</button>
      <p class="note">Je genauer du Mengen beschreibst („großer Teller“, „300 g“), desto besser wird die Schätzung.</p>
    </div>`,
    onClose: () => stopDictation(),
  });
  const ta = sheet.body.querySelector('#ds-text');
  ta.addEventListener('input', () => autosize(ta));
  sheet.body.querySelector('#ds-mic').addEventListener('click', (e) => toggleDictation(e.currentTarget, ta, () => autosize(ta)));
  sheet.body.querySelector('#ds-go').addEventListener('click', () => {
    const text = ta.value.trim();
    if (text.length < 3) {
      ta.focus();
      haptic('error');
      return;
    }
    stopDictation();
    sheet.close();
    estimateSheet({ title: 'Schätzung', text, meal });
  });
  setTimeout(() => ta.focus(), 450);
}
act('f-describe', () => openDescribe());

/* ---------- Liste ---------- */
const norm = (s) =>
  String(s)
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
const customFoods = () => [...S.foodlib.values()].filter((x) => x.type === 'custom');
function searchFoods(q, cat) {
  const all = [...customFoods(), ...FOODS].filter((f) => !cat || f.cat === cat);
  const nq = norm(q.trim());
  if (!nq) return cat ? all : [];
  const words = nq.split(/\s+/);
  return all
    .map((f) => {
      const name = norm(f.name);
      const kw = (f.kw || []).map(norm).join(' ');
      if (!words.every((w) => name.includes(w) || kw.includes(w))) return null;
      const score = (name.startsWith(nq) ? 0 : name.includes(nq) ? 1 : 2) + (f.type === 'custom' ? -0.5 : 0);
      return { f, score };
    })
    .filter(Boolean)
    .sort((a, b) => a.score - b.score || a.f.name.length - b.f.name.length)
    .slice(0, 60)
    .map((x) => x.f);
}
function recents() {
  const seen = new Set();
  const out = [];
  for (const e of [...S.food.values()].sort((a, b) => b.createdAt - a.createdAt)) {
    const k = `${e.name}|${Math.round(e.kcal)}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(e);
    if (out.length >= 15) break;
  }
  return out;
}
const foodRow = (f) =>
  `<button type="button" class="fitem" data-food="${esc(f.id)}"><span class="fthumb">${icon(f.type === 'custom' ? 'edit' : 'apple')}</span><span class="fmain"><span class="fname">${esc(f.name)}</span><span class="fsub">${fmtKcal(f.kcal)} kcal · ${fmt1(f.p)} g Eiweiß pro 100 ${f.unit || 'g'}</span></span><span class="fgo">${icon('chevR')}</span></button>`;

export function openSearch(meal = null) {
  const sheet = openSheet({ title: 'Lebensmittel', cls: 'tall' });
  const st = { q: '', cat: null, meal: meal || mealFor(entryTime(date)) };
  const listHTML = () => {
    if (!st.q && !st.cat) {
      const rec = recents();
      const fv = favs();
      return `${fv.length ? `<div class="sub-h">Favoriten</div><div class="flist">${fv.map((f) => `<button type="button" class="fitem" data-fav="${esc(f.id)}"><span class="fthumb">${icon('star')}</span><span class="fmain"><span class="fname">${esc(f.name)}</span>${f.amount ? `<span class="fsub">${esc(f.amount)}</span>` : ''}</span><span class="fkcal">${fmtKcal(f.kcal)}<small>kcal</small></span></button>`).join('')}</div>` : ''}
        ${rec.length ? `<div class="sub-h">Zuletzt gegessen</div><div class="flist">${rec.map((e) => `<button type="button" class="fitem" data-again="${esc(e.id)}"><span class="fthumb">${icon('history')}</span><span class="fmain"><span class="fname">${esc(e.name)}</span>${e.amount ? `<span class="fsub">${esc(e.amount)}</span>` : ''}</span><span class="fkcal">${fmtKcal(e.kcal)}<small>kcal</small></span></button>`).join('')}</div>` : ''}
        ${!fv.length && !rec.length ? '<p class="empty center" style="padding:24px 0">Such oben nach einem Lebensmittel oder wähl eine Kategorie.</p>' : ''}`;
    }
    const res = searchFoods(st.q, st.cat);
    return res.length
      ? `<div class="flist">${res.map(foodRow).join('')}</div>`
      : `<p class="empty center" style="padding:24px 0">Nichts gefunden. Leg es als eigenes Lebensmittel an.</p>`;
  };
  const shell = () => {
    sheet.setTitle('Lebensmittel');
    sheet.body.innerHTML = `<div class="search">${icon('search')}<input type="search" class="field" id="fs-q" placeholder="z. B. Haferflocken, Döner, Banane" autocomplete="off" enterkeyhint="search" value="${esc(st.q)}"></div>
      <div class="cat-chips">${Object.entries(FOOD_CATS)
        .map(([k, v]) => `<button type="button" class="chip ${st.cat === k ? 'on' : ''}" data-cat="${k}">${v}</button>`)
        .join('')}</div>
      <div id="fs-list">${listHTML()}</div>
      <button type="button" class="btn btn-soft btn-block" id="fs-custom" style="margin-top:14px">${icon('plus')} Eigenes Lebensmittel anlegen</button>`;
    const input = sheet.body.querySelector('#fs-q');
    input.addEventListener(
      'input',
      debounce(() => {
        st.q = input.value;
        sheet.body.querySelector('#fs-list').innerHTML = listHTML();
      }, 120),
    );
    sheet.body.querySelector('#fs-custom').addEventListener('click', () => customForm());
  };
  sheet.body.addEventListener('click', (e) => {
    const cat = e.target.closest('[data-cat]');
    if (cat) {
      st.cat = st.cat === cat.dataset.cat ? null : cat.dataset.cat;
      sheet.body.querySelectorAll('[data-cat]').forEach((c) => c.classList.toggle('on', c.dataset.cat === st.cat));
      sheet.body.querySelector('#fs-list').innerHTML = listHTML();
      haptic();
      return;
    }
    const food = e.target.closest('[data-food]');
    if (food) {
      const f = [...customFoods(), ...FOODS].find((x) => x.id === food.dataset.food);
      if (f) portion(f);
      return;
    }
    const fav = e.target.closest('[data-fav]');
    if (fav) {
      const f = S.foodlib.get(fav.dataset.fav);
      if (!f) return;
      if (addEntry({ name: f.name, amount: f.amount, kcal: f.kcal, p: f.p, c: f.c, f: f.f, items: f.items || undefined, source: 'fav' }, { meal: st.meal })) {
        saveLib({ ...f, uses: (f.uses || 0) + 1 });
        sheet.close();
      }
      return;
    }
    const again = e.target.closest('[data-again]');
    if (again) {
      const x = S.food.get(again.dataset.again);
      if (!x) return;
      addEntry({ name: x.name, amount: x.amount, kcal: x.kcal, p: x.p, c: x.c, f: x.f, items: x.items, foodId: x.foodId, grams: x.grams, source: x.source === 'foto' ? 'fav' : x.source }, { meal: st.meal });
      sheet.close();
    }
  });

  function portion(f) {
    const unit = f.unit || 'g';
    const presets = [...(f.portions || []), { label: `100 ${unit}`, amount: 100 }];
    // Start: zuletzt gegessene Menge, sonst eine echte Portion statt eines Löffels
    const last = [...S.food.values()].filter((e) => e.foodId === f.id && e.grams > 0).sort((a, b) => b.createdAt - a.createdAt)[0];
    const spoon = (p) => /^\d+ (EL|TL|Schuss|Prise)\b/.test(p.label);
    const start = last
      ? presets.find((p) => p.amount === last.grams) || { label: '', amount: last.grams }
      : presets.find((p) => !spoon(p)) || presets.find((p) => /^1 EL\b/.test(p.label)) || presets[0];
    let amount = start.amount;
    let label = start.label;
    const val = () => scaled(f, amount / 100);
    const chipsHTML = () =>
      presets.map((p) => `<button type="button" class="chip ${p.label === label ? 'on' : ''}" data-amt="${p.amount}" data-lbl="${esc(p.label)}">${esc(p.label)}${p.label.startsWith('100') ? '' : ` <small>${fmtNum(p.amount, 0)} ${unit}</small>`}</button>`).join('');
    // Nur Zahlen und Chips neu malen, nie das Eingabefeld selbst (sonst gehen Tipps beim Schließen der Tastatur verloren)
    const update = (fromInput = false) => {
      const v = val();
      const q = (s) => sheet.body.querySelector(s);
      q('#pt-kcal').textContent = fmtKcal(v.kcal);
      q('#pt-macros').innerHTML = macroLine(v);
      q('#pt-chips').innerHTML = chipsHTML();
      if (!fromInput) q('#pt-amt').value = Math.round(amount);
    };
    const readInput = () => {
      const n = parseFloat(String(sheet.body.querySelector('#pt-amt').value).replace(',', '.'));
      if (Number.isFinite(n) && n > 0) amount = clamp(n, 1, 3000);
    };
    sheet.setTitle(f.name);
    sheet.body.innerHTML = `<div class="form portion">
      <button type="button" class="link" id="pt-back">${icon('chevL')} Zurück zur Liste</button>
      <div class="est-total"><b id="pt-kcal">${fmtKcal(val().kcal)}</b><span>kcal</span></div>
      <div id="pt-macros">${macroLine(val())}</div>
      <div class="chips" id="pt-chips">${chipsHTML()}</div>
      <div class="est-row"><span>Menge</span><div class="stepper"><button type="button" data-step="-1" aria-label="Weniger">${icon('minus')}</button><output><input class="amt-in" id="pt-amt" type="number" inputmode="decimal" value="${Math.round(amount)}"> ${unit}</output><button type="button" data-step="1" aria-label="Mehr">${icon('plus')}</button></div></div>
      ${mealChips(st.meal)}
      <button type="button" class="btn btn-primary btn-lg btn-block" id="pt-save">Eintragen</button>
    </div>`;
    bindMealChips(sheet.body, (m) => {
      st.meal = m;
    });
    sheet.body.querySelector('#pt-back').addEventListener('click', shell);
    sheet.body.querySelector('#pt-chips').addEventListener('click', (e) => {
      const b = e.target.closest('[data-amt]');
      if (!b) return;
      amount = Number(b.dataset.amt);
      label = b.dataset.lbl;
      update();
      haptic();
    });
    sheet.body.querySelectorAll('[data-step]').forEach((b) =>
      b.addEventListener('click', () => {
        readInput();
        const stepSize = amount >= 200 ? 25 : 10;
        amount = clamp(Math.round(amount + Number(b.dataset.step) * stepSize), 5, 3000);
        label = '';
        update();
        haptic();
      }),
    );
    sheet.body.querySelector('#pt-amt').addEventListener('input', () => {
      readInput();
      label = '';
      update(true);
    });
    sheet.body.querySelector('#pt-save').addEventListener('click', () => {
      readInput();
      const preset = presets.find((p) => p.label === label && p.amount === amount);
      const amountText = preset && !preset.label.startsWith('100') ? `${preset.label} (${fmtNum(amount, 0)} ${unit})` : `${fmtNum(amount, 0)} ${unit}`;
      if (addEntry({ name: f.name, amount: amountText, ...val(), foodId: f.id, grams: amount, source: 'liste' }, { meal: st.meal })) sheet.close();
    });
  }

  function customForm() {
    sheet.setTitle('Eigenes Lebensmittel');
    sheet.body.innerHTML = `<div class="form">
      <button type="button" class="link" id="cf-back">${icon('chevL')} Zurück</button>
      <div class="group"><div class="li"><input class="li-input big" id="cf-name" placeholder="Name, z. B. Omas Lasagne" maxlength="40"></div></div>
      <p class="note">Nährwerte pro 100 g (stehen auf der Verpackung):</p>
      <div class="group">
        ${[
          ['kcal', 'Kalorien', 'kcal'],
          ['p', 'Eiweiß', 'g'],
          ['c', 'Kohlenhydrate', 'g'],
          ['f', 'Fett', 'g'],
        ]
          .map(([k, l, u]) => `<label class="li" for="cf-${k}"><span class="li-title">${l}</span><span class="unit-in"><input class="num-in" id="cf-${k}" type="number" inputmode="decimal" step="0.1" min="0"><small>${u}</small></span></label>`)
          .join('')}
      </div>
      <label class="li group" for="cf-portion" style="border-radius:var(--r-md)"><span class="li-title">Typische Portion</span><span class="unit-in"><input class="num-in" id="cf-portion" type="number" inputmode="numeric" placeholder="optional"><small>g</small></span></label>
      <button type="button" class="btn btn-primary btn-lg btn-block" id="cf-save">Speichern</button>
    </div>`;
    const q = (s) => sheet.body.querySelector(s);
    q('#cf-back').addEventListener('click', shell);
    q('#cf-save').addEventListener('click', () => {
      const name = q('#cf-name').value.trim();
      const val = (k) => parseFloat(String(q(`#cf-${k}`).value).replace(',', '.')) || 0;
      if (!name || !val('kcal')) {
        toast('Name und Kalorien brauche ich mindestens.');
        haptic('error');
        return;
      }
      const portionG = val('portion');
      const item = saveLib({
        type: 'custom',
        name,
        cat: 'eigen',
        unit: 'g',
        kcal: val('kcal'),
        p: val('p'),
        c: val('c'),
        f: val('f'),
        kw: [],
        portions: portionG ? [{ label: '1 Portion', amount: portionG }] : [],
      });
      haptic('success');
      portion(item);
    });
  }
  shell();
}
act('f-search', () => openSearch());
act('f-add-meal', (el) => openAddChooser(el.dataset.meal));

/* Auswahl, wenn man direkt bei einer Mahlzeit auf + tippt */
function openAddChooser(meal) {
  const sheet = openSheet({
    title: `${mealName(meal)} eintragen`,
    body: `<div class="chooser">
      ${
        hasKey()
          ? `<label class="choose">${icon('camera')}<span><b>Foto</b><small>Gemini schätzt die Nährwerte</small></span><input type="file" accept="image/*" id="ch-photo"></label>`
          : `<button type="button" class="choose" id="ch-key">${icon('camera')}<span><b>Foto</b><small>Einmal Foto-Erkennung einrichten</small></span></button>`
      }
      <button type="button" class="choose" id="ch-describe">${icon('mic')}<span><b>Beschreiben</b><small>Tippen oder einsprechen, was du gegessen hast</small></span></button>
      <button type="button" class="choose" id="ch-search">${icon('search')}<span><b>Aus der Liste</b><small>Lebensmittel, Favoriten und zuletzt Gegessenes</small></span></button>
      <button type="button" class="choose" id="ch-quick">${icon('bolt')}<span><b>Schnell</b><small>Nur Kalorien und Eiweiß eintippen</small></span></button>
    </div>`,
  });
  const q = (s) => sheet.body.querySelector(s);
  q('#ch-photo')?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    sheet.close();
    estimateSheet({ title: 'Foto-Schätzung', file, meal });
  });
  q('#ch-key')?.addEventListener('click', () => {
    sheet.close();
    openKeySheet('photo');
  });
  q('#ch-describe').addEventListener('click', () => {
    sheet.close();
    if (hasKey()) openDescribe(meal);
    else openKeySheet('describe');
  });
  q('#ch-search').addEventListener('click', () => {
    sheet.close();
    openSearch(meal);
  });
  q('#ch-quick').addEventListener('click', () => {
    sheet.close();
    openQuick(meal);
  });
}

/* ---------- Schnell eintragen ---------- */
function openQuick(meal = null) {
  let m = meal || mealFor(entryTime(date));
  const sheet = openSheet({
    title: 'Schnell eintragen',
    body: `<div class="form">
      <div class="group"><div class="li"><input class="li-input big" id="qk-name" placeholder="Was war es? (optional)" maxlength="60"></div></div>
      <div class="group">
        ${[
          ['kcal', 'Kalorien', 'kcal', 'numeric'],
          ['p', 'Eiweiß', 'g', 'decimal'],
          ['c', 'Kohlenhydrate', 'g', 'decimal'],
          ['f', 'Fett', 'g', 'decimal'],
        ]
          .map(([k, l, u, im]) => `<label class="li" for="qk-${k}"><span class="li-title">${l}</span><span class="unit-in"><input class="num-in" id="qk-${k}" type="number" inputmode="${im}" min="0" ${k === 'kcal' ? '' : 'placeholder="optional"'}><small>${u}</small></span></label>`)
          .join('')}
      </div>
      ${mealChips(m)}
      <button type="button" class="fav-toggle" id="qk-fav">${icon('star')} Als Favorit merken</button>
      <button type="button" class="btn btn-primary btn-lg btn-block" id="qk-save">Eintragen</button>
    </div>`,
  });
  const q = (s) => sheet.body.querySelector(s);
  let fav = false;
  bindMealChips(sheet.body, (x) => {
    m = x;
  });
  q('#qk-fav').addEventListener('click', (e) => {
    fav = !fav;
    e.currentTarget.classList.toggle('on', fav);
  });
  q('#qk-save').addEventListener('click', () => {
    const val = (k) => parseFloat(String(q(`#qk-${k}`).value).replace(',', '.')) || 0;
    if (!val('kcal')) {
      const el = q('#qk-kcal');
      el.classList.remove('shake');
      void el.offsetWidth;
      el.classList.add('shake');
      el.focus();
      haptic('error');
      return;
    }
    addEntry({ name: q('#qk-name').value.trim() || 'Eintrag', amount: '', kcal: val('kcal'), p: val('p'), c: val('c'), f: val('f'), source: 'schnell' }, { meal: m, fav });
    sheet.close();
  });
  setTimeout(() => q('#qk-kcal').focus(), 450);
}
act('f-quick', () => openQuick());

act('f-fav-add', (el) => {
  const f = S.foodlib.get(el.dataset.id);
  if (!f) return;
  if (addEntry({ name: f.name, amount: f.amount, kcal: f.kcal, p: f.p, c: f.c, f: f.f, items: f.items || undefined, source: 'fav' })) saveLib({ ...f, uses: (f.uses || 0) + 1 });
});
act('f-idea', (el) => {
  const x = SNACK_IDEAS.find((i) => i.name === el.dataset.name);
  if (x) addEntry({ name: x.name, amount: x.amount, kcal: x.kcal, p: x.p, c: x.c, f: x.f, source: 'idee' });
});

/* ---------- Eintrag bearbeiten ---------- */
function openEdit(id) {
  const orig = S.food.get(id);
  if (!orig) return;
  // Arbeitskopie: am gespeicherten Eintrag ändert sich erst etwas beim Speichern
  let factor = 1;
  let meal = orig.meal;
  let name = orig.name;
  let time = orig.time || '12:00';
  const favEntry = () =>
    [...S.foodlib.values()].find((x) => x.type === 'fav' && x.name === name.trim() && Math.round(x.kcal) === Math.round(orig.kcal * factor));
  const amountText = () => (factor === 1 ? orig.amount : [orig.amount, `${Math.round(factor * 100)} %`].filter(Boolean).join(' · '));
  const sheet = openSheet({ title: 'Eintrag', cls: 'tall' });
  const draw = () => {
    const v = scaled(orig, factor);
    sheet.body.innerHTML = `<div class="est">
      ${S.foodPics.has(id) ? `<button type="button" class="est-pic" id="ed-pic"><img data-foodpic="${esc(id)}" alt=""></button>` : ''}
      <input class="est-name" id="ed-name" value="${esc(name)}" maxlength="60" aria-label="Name">
      ${orig.amount ? `<p class="faint small center">${esc(orig.amount)}</p>` : ''}
      <div class="est-total"><b>${fmtKcal(v.kcal)}</b><span>kcal</span></div>
      ${macroLine(v)}
      ${orig.items?.length ? `<div class="est-items">${orig.items.map((it) => `<div class="est-item"><span class="fmain"><span class="fname">${esc(it.name)}</span><span class="fsub">${esc(it.amount || '')}</span></span><span class="fkcal">${fmtKcal(it.kcal * factor)}<small>kcal</small></span></div>`).join('')}</div>` : ''}
      <div class="est-row"><span>Menge anpassen</span><div class="stepper"><button type="button" data-f="-0.25" aria-label="Weniger">${icon('minus')}</button><output>${Math.round(factor * 100)} %</output><button type="button" data-f="0.25" aria-label="Mehr">${icon('plus')}</button></div></div>
      ${mealChips(meal)}
      <div class="group"><label class="li" for="ed-time"><span class="li-title">Uhrzeit</span><input type="time" id="ed-time" value="${esc(time)}"></label></div>
      <button type="button" class="fav-toggle ${favEntry() ? 'on' : ''}" id="ed-fav">${icon('star')} ${favEntry() ? 'Ist ein Favorit' : 'Als Favorit merken'}</button>
      <button type="button" class="btn btn-primary btn-lg btn-block" id="ed-save">Speichern</button>
      <button type="button" class="btn btn-danger btn-block" id="ed-del">${icon('trash')} Löschen</button>
    </div>`;
    hydrateFoodPics(sheet.body);
    const q = (s) => sheet.body.querySelector(s);
    const keep = () => {
      name = q('#ed-name').value;
      time = q('#ed-time').value || time;
    };
    bindMealChips(sheet.body, (m) => {
      meal = m;
    });
    q('#ed-pic')?.addEventListener('click', async () => {
      const url = await foodPicURL(id);
      if (url) openPhotoViewerURL(url, name);
    });
    sheet.body.querySelectorAll('[data-f]').forEach((b) =>
      b.addEventListener('click', () => {
        keep();
        factor = clamp(Math.round((factor + Number(b.dataset.f)) * 100) / 100, 0.25, 4);
        draw();
        haptic();
      }),
    );
    q('#ed-fav').addEventListener('click', async (e) => {
      const btn = e.currentTarget;
      keep();
      const f = favEntry();
      if (f) await deleteLib(f.id);
      else saveAsFav({ ...orig, ...scaled(orig, factor), name: name.trim() || orig.name, amount: amountText() });
      btn.classList.toggle('on', !f);
      btn.innerHTML = `${icon('star')} ${f ? 'Als Favorit merken' : 'Ist ein Favorit'}`;
      haptic();
      app.refresh();
    });
    q('#ed-save').addEventListener('click', () => {
      keep();
      const v2 = scaled(orig, factor);
      saveFood({
        ...orig,
        name: name.trim() || orig.name,
        meal,
        time,
        grams: orig.grams ? Math.round(orig.grams * factor) : orig.grams,
        kcal: Math.round(v2.kcal),
        p: Math.round(v2.p * 10) / 10,
        c: Math.round(v2.c * 10) / 10,
        f: Math.round(v2.f * 10) / 10,
        items: orig.items?.map((it) => ({ ...it, ...scaled(it, factor) })),
        amount: amountText(),
      });
      haptic('success');
      sheet.close();
      app.refresh();
    });
    q('#ed-del').addEventListener('click', async () => {
      const ok = await confirmDialog({ title: `„${orig.name}“ löschen?`, ok: 'Löschen', danger: true });
      if (!ok) return;
      await deleteFood(id);
      sheet.close();
      app.refresh();
      toast('Eintrag gelöscht');
    });
  };
  draw();
}
act('f-edit', (el) => openEdit(el.dataset.id));

function openPhotoViewerURL(url, caption) {
  const el = document.createElement('div');
  el.className = 'viewer';
  el.innerHTML = `<div class="cap">${esc(caption)}</div><button type="button" class="icon-btn" aria-label="Schließen">${icon('close')}</button><img src="${url}" alt="">`;
  el.addEventListener('click', () => {
    el.classList.add('out');
    setTimeout(() => el.remove(), 200);
  });
  document.body.appendChild(el);
}

/* ---------- Gewicht ---------- */
export function openWeight() {
  let d = today();
  let kg = weightOn(today())?.kg ?? nut().startWeight ?? 60;
  const sheet = openSheet({ title: 'Gewicht', onClose: () => app.refresh() });
  const draw = () => {
    const recent = [...S.weights.values()].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8);
    sheet.body.innerHTML = `<div class="form">
      <div class="night-pick"><div class="eyebrow">Gewogen am</div><div class="night-pick-t">${esc(relDay(d) || fmtDayMonth(d))}</div><input type="date" id="wg-date" value="${d}" max="${today()}" aria-label="Datum wählen"></div>
      <div class="wpick">
        <button type="button" class="icon-btn" data-s="-0.1" aria-label="100 g weniger">${icon('minus')}</button>
        <div class="wpick-num"><input id="wg-kg" type="number" inputmode="decimal" step="0.1" value="${kg.toFixed(1)}" aria-label="Gewicht in kg"><small>kg</small></div>
        <button type="button" class="icon-btn" data-s="0.1" aria-label="100 g mehr">${icon('plus')}</button>
      </div>
      <button type="button" class="btn btn-primary btn-lg btn-block" id="wg-save">Speichern</button>
      <p class="note center">Am besten morgens nach dem Aufstehen wiegen, vor dem Frühstück.</p>
      ${recent.length ? `<div class="sub-h">Letzte Einträge</div><div class="group">${recent.map((w) => `<div class="li"><span class="li-main">${fmtDayMonth(w.date)}</span><b class="li-end" style="color:var(--text)">${fmt1(w.kg)} kg</b><button type="button" class="icon-btn sm" data-del="${esc(w.date)}" aria-label="Löschen">${icon('trash')}</button></div>`).join('')}</div>` : ''}
    </div>`;
    const q = (s) => sheet.body.querySelector(s);
    q('#wg-date').addEventListener('change', (e) => {
      if (e.target.value && e.target.value <= today()) {
        d = e.target.value;
        kg = S.weights.get(d)?.kg ?? kg;
        draw();
      }
    });
    sheet.body.querySelectorAll('[data-s]').forEach((b) =>
      b.addEventListener('click', () => {
        kg = clamp(Math.round((parseFloat(q('#wg-kg').value) + Number(b.dataset.s)) * 10) / 10, 25, 250);
        q('#wg-kg').value = kg.toFixed(1);
        haptic();
      }),
    );
    sheet.body.querySelectorAll('[data-del]').forEach((b) =>
      b.addEventListener('click', async () => {
        await deleteWeight(b.dataset.del);
        draw();
        haptic();
      }),
    );
    q('#wg-save').addEventListener('click', () => {
      const v = parseFloat(String(q('#wg-kg').value).replace(',', '.'));
      if (!Number.isFinite(v) || v < 25 || v > 250) {
        toast('Das Gewicht sieht nicht richtig aus.');
        return;
      }
      saveWeight(d, v);
      if (!nut().startWeight) saveNutrition({ startWeight: v });
      haptic('success');
      sheet.close();
      toast(`${fmt1(v)} kg gespeichert`, { icon: icon('scale') });
    });
  };
  draw();
}
act('f-weight', () => openWeight());
