// Luna · Rauchfrei: Zähler, gespartes Geld, Gesundheit, Erfolge, Plan zum Reduzieren
import { S, smokeOn, saveSmokeSettings } from './store.js';
import { today, iso, fromISO, addDays, diffDays, datesBack, fmtNum } from './util.js';

const MIN = 60e3;
const H = 3600e3;
const D = 864e5;

export const sm = () => S.settings.smoke;
export const isSetUp = () => !!sm().setup && Number.isFinite(sm().quitAt);
export const tabOn = () => S.settings.tabs?.smoke !== false;
export const isVape = () => sm().kind === 'vape';

export const KINDS = [
  ['zigaretten', 'Zigaretten', 'Aus der Schachtel'],
  ['tabak', 'Selbstgedrehte', 'Tabak zum Drehen'],
  ['vape', 'E-Zigarette', 'Vape, Pods oder Einweg'],
];
export const REASONS = [
  ['fussball', 'Fußball & Ausdauer'],
  ['gesundheit', 'Gesundheit'],
  ['geld', 'Geld sparen'],
  ['freiheit', 'Nicht mehr abhängig sein'],
  ['geruch', 'Kein Gestank mehr'],
  ['aussehen', 'Haut & Zähne'],
  ['leute', 'Familie & Freunde'],
];
export const TRIGGERS = [
  ['stress', 'Stress'],
  ['kaffee', 'Kaffee'],
  ['essen', 'Nach dem Essen'],
  ['party', 'Party & Alkohol'],
  ['freunde', 'Andere rauchen'],
  ['langeweile', 'Langeweile'],
  ['pause', 'Pause'],
  ['morgens', 'Morgens'],
];
export const reasonName = (id) => (REASONS.find((r) => r[0] === id) || [id, id])[1];
export const triggerName = (id) => (TRIGGERS.find((r) => r[0] === id) || [id, 'Sonstiges'])[1];

// Laut einer Studie des University College London (2025) kostet jede Zigarette im Schnitt etwa 20 Minuten Lebenszeit.
export const LIFE_MIN = 20;

/* ---------- Kosten ---------- */
export const cigCost = () => (isVape() ? 0 : (sm().packPrice || 0) / Math.max(1, sm().perPack || 20));
export const costPerDay = () => (isVape() ? (sm().weekCost || 0) / 7 : (sm().perDay || 0) * cigCost());
// Ganze Beträge ohne „,00“, sonst mit Rappen bzw. Cent
export const fmtMoney = (v) => `${fmtNum(v, v >= 1000 || Math.abs(v - Math.round(v)) < 0.005 ? 0 : 2)} ${sm().currency === 'EUR' ? '€' : 'CHF'}`;
export const unitWord = (n) => (isVape() ? 'Mal' : n === 1 ? 'Zigarette' : 'Zigaretten');

/* ---------- Phase ---------- */
// none: nicht eingerichtet · reduce: Plan läuft, Rauchstopp kommt noch · countdown: Rauchstopp kommt noch · free: rauchfrei
export function phase(now = Date.now()) {
  if (!isSetUp()) return 'none';
  if (now < sm().quitAt) return sm().mode === 'reduce' && sm().planStart ? 'reduce' : 'countdown';
  return 'free';
}
const logs = () => [...S.smoke.values()];
const count = (list) => list.reduce((s, e) => s + (e.count || 1), 0);
// Beginn des aktuellen Versuchs (bei laufendem Plan der Planstart)
export const attemptStart = () => (sm().mode === 'reduce' && sm().planStart ? Math.min(sm().planStart, sm().quitAt) : sm().quitAt);
// Beginn der ganzen Geschichte: erster Plan oder erster Versuch
export const historyStart = () => Math.min(attemptStart(), sm().planStart || Infinity, ...(sm().attempts || []).map((a) => a.from));

/* ---------- Plan zum Reduzieren ----------
   Der Plan läuft von planStart bis planEnd (solange er aktiv ist: bis zum Rauchstopp). Auch nach dem Plan bleibt er als Geschichte erhalten. */
export const quitDate = () => iso(new Date(sm().quitAt));
export function planRange() {
  const n = sm();
  if (!n.planStart) return null;
  const end = n.planEnd ?? n.quitAt;
  return end > n.planStart ? [n.planStart, end] : null;
}
export function planLimit(date) {
  const r = planRange();
  if (!r) return null;
  const n = sm();
  const startD = iso(new Date(r[0]));
  // Limits immer nach dem ursprünglich geplanten Rauchstopp, auch wenn früher aufgehört wurde
  const endD = iso(new Date(n.planEnd ? (n.planTarget ?? r[1]) : n.quitAt));
  if (date < startD) return null;
  if (date >= endD) return 0;
  // Von fast „wie bisher“ am ersten Tag gleichmäßig runter auf 1 am letzten Tag
  const total = Math.max(1, diffDays(endD, startD));
  const left = diffDays(endD, date);
  return Math.max(1, 1 + Math.round(((sm().perDay - 1) * (left - 1)) / total));
}
// Gerauchte Zigaretten an einem Tag während des Plans
export const smokedBefore = (date) => {
  const end = planRange()?.[1] ?? sm().quitAt;
  return count(smokeOn(date).filter((e) => (e.type === 'cig' || e.type === 'slip') && e.at < end));
};
// Nach dem Rauchstopp: jeder Ausrutscher zählt, auch der vor einem Neustart am selben Tag
export const smokedAfter = (date) => count(smokeOn(date).filter((e) => e.type === 'slip' || (e.type === 'cig' && e.at >= sm().quitAt)));

/* ---------- Kennzahlen ----------
   Die Serie (ms) gilt für den aktuellen Versuch. Geld und nicht gerauchte Zigaretten zählen über alle Versuche,
   denn was du in rauchfreien Tagen nicht ausgegeben hast, bleibt gespart. */
export function stats(now = Date.now()) {
  const n = sm();
  const ms = Math.max(0, now - n.quitAt);
  const ranges = (n.attempts || []).map((a) => [a.from, Math.min(a.to, now)]).filter(([a, b]) => b > a);
  if (now > n.quitAt) ranges.push([n.quitAt, now]);
  const days = ranges.reduce((s, [a, b]) => s + (b - a) / D, 0);
  const inside = (t) => ranges.some(([a, b]) => t >= a && t <= b);
  const allSlips = count(logs().filter((e) => e.type === 'slip' && inside(e.at)));
  const slipList = logs().filter((e) => e.type === 'slip' && e.at >= n.quitAt && e.at <= now);
  let avoided = isVape() ? 0 : Math.max(0, Math.floor(days * n.perDay) - allSlips);
  let saved = Math.max(0, days * costPerDay() - allSlips * cigCost());
  // Im Plan zählt jede Zigarette weniger als früher schon mit, anteilig ab dem Planstart
  const plan = planRange();
  if (plan && !isVape()) {
    const [from, to] = plan;
    let d = iso(new Date(from));
    const last = iso(new Date(Math.min(now, to) - 1));
    for (let i = 0; d <= last && i < 400; i++, d = addDays(d, 1)) {
      const ds = fromISO(d).getTime();
      const de = fromISO(addDays(d, 1)).getTime();
      const part = Math.max(0, (Math.min(de, now, to) - Math.max(ds, from)) / (de - ds));
      const smoked = count(smokeOn(d).filter((e) => (e.type === 'cig' || e.type === 'slip') && e.at >= from && e.at < to));
      const less = Math.max(0, n.perDay * part - smoked);
      avoided += Math.floor(less);
      saved += less * cigCost();
    }
  }
  const cravings = logs().filter((e) => e.type === 'craving' && e.at >= historyStart());
  return {
    ms,
    days,
    slips: count(slipList),
    slipEvents: slipList.length,
    avoided,
    saved,
    lifeMin: avoided * LIFE_MIN,
    resisted: cravings.filter((e) => e.resisted !== false).length,
    cravings: cravings.length,
  };
}
export function best() {
  const cur = phase() === 'free' ? Date.now() - sm().quitAt : 0;
  return Math.max(cur, ...(sm().attempts || []).map((a) => a.to - a.from));
}

/* ---------- Zeit schön schreiben ---------- */
export function parts(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return { d: Math.floor(s / 86400), h: Math.floor((s % 86400) / 3600), m: Math.floor((s % 3600) / 60), s: s % 60 };
}
export function fmtSpan(ms, short = false) {
  const p = parts(ms);
  const day = (n) => `${n} ${n === 1 ? 'Tag' : 'Tage'}`;
  const hour = (n) => `${n} ${short ? 'Std' : n === 1 ? 'Stunde' : 'Stunden'}`;
  const min = (n) => `${n} ${short ? 'Min' : n === 1 ? 'Minute' : 'Minuten'}`;
  if (p.d >= 1) return p.h ? `${day(p.d)} ${hour(p.h)}` : day(p.d);
  if (p.h >= 1) return p.m ? `${hour(p.h)} ${min(p.m)}` : hour(p.h);
  return min(p.m);
}
export function fmtLife(min) {
  if (min < 60) return `${Math.round(min)} Min`;
  if (min < 48 * 60) return `${fmtNum(min / 60, min < 600 ? 1 : 0)} Std`;
  return `${fmtNum(min / 1440, min < 14400 ? 1 : 0)} Tage`;
}

/* ---------- Gesundheit ---------- */
const HEALTH = [
  { at: 20 * MIN, t: '20 Minuten', text: 'Puls und Blutdruck sinken wieder auf normale Werte.', vape: true },
  { at: 12 * H, t: '12 Stunden', text: 'Das Kohlenmonoxid im Blut ist abgebaut. Dein Blut transportiert wieder mehr Sauerstoff.' },
  { at: 2 * D, t: '2 Tage', text: 'Die Nervenenden erholen sich: Du riechst und schmeckst wieder besser.' },
  {
    at: 3 * D,
    t: '3 Tage',
    text: 'Das Nikotin ist raus aus deinem Körper, die Bronchien entspannen sich und Atmen fällt leichter. Jetzt ist der Entzug am stärksten, ab hier wird es Tag für Tag einfacher.',
    vapeText: 'Das Nikotin ist raus aus deinem Körper. Jetzt ist der Entzug am stärksten, ab hier wird es Tag für Tag einfacher.',
    vape: true,
  },
  {
    at: 14 * D,
    t: '2 Wochen',
    text: 'Kreislauf und Lungenfunktion werden besser. Beim Fußball merkst du mehr Puste.',
    vapeText: 'Dein Kreislauf kommt in Schwung. Beim Fußball merkst du mehr Puste.',
    vape: true,
  },
  { at: 28 * D, t: '4 Wochen', text: 'Die körperlichen Entzugserscheinungen sind meistens vorbei. Die Lust kommt seltener und ist schwächer.', vape: true },
  { at: 90 * D, t: '3 Monate', text: 'Deine Lunge arbeitet deutlich besser. Sprints und Treppen fallen leichter.' },
  { at: 270 * D, t: '9 Monate', text: 'Husten und Kurzatmigkeit werden seltener. Die Flimmerhärchen in der Lunge haben sich erholt und halten sie wieder sauber.' },
  { at: 365 * D, t: '1 Jahr', text: 'Dein Risiko für Herzkrankheiten ist nur noch halb so hoch wie bei einem Raucher.' },
  { at: 5 * 365 * D, t: '5 Jahre', text: 'Dein Risiko für einen Schlaganfall sinkt deutlich, mit der Zeit bis auf das eines Nichtrauchers.' },
  { at: 10 * 365 * D, t: '10 Jahre', text: 'Dein Risiko, an Lungenkrebs zu sterben, ist nur noch etwa halb so hoch wie bei einem Raucher.' },
  { at: 15 * 365 * D, t: '15 Jahre', text: 'Dein Herz ist so gesund wie das von jemandem, der nie geraucht hat.' },
];
export const health = () =>
  HEALTH.filter((x) => !isVape() || x.vape).map((x) => ({ ...x, text: isVape() && x.vapeText ? x.vapeText : x.text }));

/* ---------- Ziele & Erfolge ---------- */
const STEPS = [
  [D, '1 Tag'],
  [3 * D, '3 Tage'],
  [7 * D, '1 Woche'],
  [14 * D, '2 Wochen'],
  [30 * D, '1 Monat'],
  [90 * D, '3 Monate'],
  [182 * D, '6 Monate'],
  [365 * D, '1 Jahr'],
  [730 * D, '2 Jahre'],
];
export const CAL_STEPS = STEPS.slice(1, 8);
// Nächstes Zeitziel mit Fortschritt seit dem letzten
export function nextStep(ms) {
  const i = STEPS.findIndex(([at]) => ms < at);
  if (i < 0) return null;
  const from = i ? STEPS[i - 1][0] : 0;
  return { at: STEPS[i][0], label: STEPS[i][1], left: STEPS[i][0] - ms, p: (ms - from) / (STEPS[i][0] - from) };
}

export function badges(st = stats()) {
  const free = phase() === 'free';
  const m = (v) => (sm().currency === 'EUR' ? `${v} €` : `${v} CHF`);
  const list = [
    ...STEPS.slice(0, 8).map(([at, label], i) => ({ id: `t${i}`, icon: 'flame', label, sub: 'rauchfrei', ok: free && st.ms >= at })),
    ...[50, 100, 500, 1000].map((v) => ({ id: `m${v}`, icon: 'coin', label: m(v), sub: 'gespart', ok: st.saved >= v })),
    ...[1, 10, 50, 100].map((v) => ({ id: `c${v}`, icon: 'wind', label: v === 1 ? 'Erste Lust' : `${v}× Lust`, sub: 'besiegt', ok: st.resisted >= v })),
  ];
  if (!isVape()) list.push(...[100, 250, 500, 1000].map((v) => ({ id: `a${v}`, icon: 'nosmoke', label: `${v}`, sub: 'nicht geraucht', ok: st.avoided >= v })));
  return list;
}
// Neu geschaffte Erfolge einmal feiern
export function freshBadges() {
  if (!isSetUp()) return [];
  const seen = new Set(sm().seen || []);
  const fresh = badges().filter((b) => b.ok && !seen.has(b.id));
  if (fresh.length) saveSmokeSettings({ seen: [...seen, ...fresh.map((b) => b.id)] });
  return fresh;
}

/* ---------- Tagesstatus für Kalender und Statistik ---------- */
// good: rauchfrei bzw. im Plan · ok: knapp drüber · bad: geraucht
export function dayStatus(date) {
  if (!isSetUp() || date > today()) return null;
  const n = sm();
  if (date < iso(new Date(historyStart()))) return null;
  const limit = planLimit(date);
  const plan = planRange();
  if (limit != null && plan && date < iso(new Date(plan[1]))) {
    const smoked = smokedBefore(date);
    return { kind: 'plan', smoked, limit, st: smoked <= limit ? 'good' : smoked <= limit + 2 ? 'ok' : 'bad' };
  }
  const quitD = quitDate();
  // Tage aus früheren Versuchen
  if (date < quitD || (date === quitD && Date.now() < n.quitAt)) {
    const inAttempt = (n.attempts || []).some((a) => date >= iso(new Date(a.from)) && date <= iso(new Date(a.to)));
    if (!inAttempt) return null;
  }
  const smoked = smokedAfter(date);
  return { kind: 'free', smoked, st: smoked ? 'bad' : 'good' };
}

/* ---------- Lust-Verlauf ---------- */
export function cravingDays(n = 14) {
  return datesBack(n).map((d) => {
    const list = smokeOn(d);
    return {
      date: d,
      cravings: list.filter((e) => e.type === 'craving').length,
      smoked: count(list.filter((e) => e.type === 'slip' || e.type === 'cig')),
    };
  });
}
export function triggerTop(sinceMs = historyStart(), limit = 3) {
  const c = new Map();
  for (const e of logs()) {
    if (e.at < sinceMs || !e.trigger || e.type === 'cig') continue;
    c.set(e.trigger, (c.get(e.trigger) || 0) + 1);
  }
  return [...c.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit);
}
// Tageszeit mit den meisten Gelüsten (Zweistunden-Fenster)
export function peakHour(sinceMs = historyStart()) {
  const h = new Array(12).fill(0);
  let n = 0;
  for (const e of logs()) {
    if (e.at < sinceMs || e.type === 'cig') continue;
    h[Math.floor(new Date(e.at).getHours() / 2)]++;
    n++;
  }
  if (n < 5) return null;
  const i = h.indexOf(Math.max(...h));
  return { from: i * 2, to: i * 2 + 2 };
}

/* ---------- Neu anfangen ---------- */
export function restart(at = Date.now()) {
  const n = sm();
  const attempts = phase() === 'free' && at > n.quitAt ? [...(n.attempts || []), { from: n.quitAt, to: at }] : n.attempts || [];
  // Ein früherer Plan bleibt als Geschichte erhalten
  const planEnd = n.planStart ? (n.planEnd ?? Math.min(n.quitAt, at)) : null;
  const planTarget = n.planStart ? (n.planTarget ?? n.quitAt) : null;
  return saveSmokeSettings({ quitAt: at, mode: 'stop', planEnd, planTarget, attempts, seen: (n.seen || []).filter((id) => !/^t/.test(id)) });
}

/* Meilensteine fürs iPhone-Kalender-Export: nur die, die noch kommen */
export function upcomingSteps() {
  const n = sm();
  return CAL_STEPS.map(([at, label]) => ({ at: n.quitAt + at, label })).filter((x) => x.at > Date.now());
}
export const DAY = D;
