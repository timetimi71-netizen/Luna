// Luna · Ernährung: Kalorienbedarf, Tagessummen, Mahlzeiten, Gewichtstrend
import { S, foodOn, weightOn, saveNutrition } from './store.js';
import { fromISO, addDays, today, fmtNum, toMin } from './util.js';

export const MEALS = [
  ['fruehstueck', 'Frühstück'],
  ['mittag', 'Mittagessen'],
  ['abend', 'Abendessen'],
  ['snack', 'Snacks'],
];
export const mealName = (id) => (MEALS.find((m) => m[0] === id) || MEALS[3])[1];
// Mahlzeit nach Uhrzeit vorschlagen
export function mealFor(time) {
  const m = toMin(time) ?? 12 * 60;
  if (m >= 4 * 60 && m < 10 * 60 + 30) return 'fruehstueck';
  if (m >= 10 * 60 + 30 && m < 15 * 60) return 'mittag';
  if (m >= 17 * 60 + 30 && m < 21 * 60 + 30) return 'abend';
  return 'snack';
}

export const ACTIVITY = [
  ['wenig', 'Wenig', 'Schule, Büro, viel Sitzen', 1.35],
  ['normal', 'Normal', 'Viel unterwegs und auf den Beinen', 1.5],
  ['viel', 'Viel', 'Körperliche Arbeit', 1.7],
];
export const TEMPO = [
  [250, 'Gemütlich', 'ca. +0,25 kg pro Woche'],
  [400, 'Normal', 'ca. +0,35 kg pro Woche'],
  [600, 'Schnell', 'ca. +0,5 kg pro Woche'],
];

export const nut = () => S.settings.nutrition;
export const isSetUp = () => !!nut().setup && !!nut().age;

// Trainingstag: eigener Eintrag für den Tag zählt vor dem Wochenplan
export function isTraining(date) {
  const own = S.journal.get(date)?.training;
  if (typeof own === 'boolean') return own;
  return (nut().trainingDays || []).includes(fromISO(date).getDay());
}

export function currentKg(date = today()) {
  return weightOn(date)?.kg ?? nut().startWeight ?? null;
}

/* Bedarf nach Mifflin-St Jeor × Alltagsfaktor, an Trainingstagen plus Training, dazu der Überschuss zum Zunehmen. */
export function targets(date = today(), n = nut()) {
  const kg = weightOn(date)?.kg ?? n.startWeight ?? 60;
  const age = n.age || 25;
  const bmr = 10 * kg + 6.25 * (n.height || 175) - 5 * age + (n.sex === 'w' ? -161 : 5);
  const factor = (ACTIVITY.find((a) => a[0] === n.activity) || ACTIVITY[1])[3];
  const training = isTraining(date);
  const base = bmr * factor;
  const kcal = Math.round((base + (training ? n.trainingKcal : 0) + n.surplus) / 50) * 50;
  const protein = Math.round(kg * (n.proteinPerKg || 1.8));
  const fat = Math.round((kcal * 0.28) / 9);
  const carbs = Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4));
  return { kcal, protein, carbs, fat, training, bmr: Math.round(bmr), base: Math.round(base), kg };
}

export function totals(date) {
  const t = { kcal: 0, p: 0, c: 0, f: 0, n: 0 };
  for (const e of foodOn(date)) {
    t.kcal += e.kcal || 0;
    t.p += e.p || 0;
    t.c += e.c || 0;
    t.f += e.f || 0;
    t.n++;
  }
  return t;
}

// Anteil am Kalorienziel; null wenn an dem Tag nichts eingetragen ist
export function progress(date) {
  const t = totals(date);
  if (!t.n || !isSetUp()) return null;
  return t.kcal / targets(date).kcal;
}
export const kcalStatus = (p) => (p == null ? null : p >= 1 ? 'good' : p >= 0.85 ? 'ok' : 'bad');
export const KCAL_LABEL = { good: 'Ziel geschafft', ok: 'Knapp drunter', bad: 'Zu wenig' };

export const fmtKcal = (n) => fmtNum(Math.round(n), 0);
export const fmtG = (n) => `${fmtNum(Math.round(n), 0)} g`;

/* Gewichtstrend: lineare Regression über die letzten 28 Tage */
export function weightTrend(days = 28) {
  const end = today();
  const start = addDays(end, -days);
  const pts = [...S.weights.values()].filter((w) => w.date >= start && w.date <= end).sort((a, b) => a.date.localeCompare(b.date));
  if (pts.length < 3) return null;
  const x0 = fromISO(pts[0].date).getTime();
  const xs = pts.map((p) => (fromISO(p.date).getTime() - x0) / 864e5);
  const span = xs[xs.length - 1];
  if (span < 10) return null;
  const ys = pts.map((p) => p.kg);
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length;
  const my = ys.reduce((a, b) => a + b, 0) / ys.length;
  let num = 0;
  let den = 0;
  xs.forEach((x, i) => {
    num += (x - mx) * (ys[i] - my);
    den += (x - mx) ** 2;
  });
  const perDay = den ? num / den : 0;
  return { perWeek: perDay * 7, points: pts.length, span };
}

// Nach ein paar Wochen ohne Zunahme mehr Überschuss vorschlagen. Nach einer Anpassung drei Wochen abwarten.
const ADJUST_PAUSE = 21 * 864e5;
export function adjustHint() {
  const tr = weightTrend();
  if (!tr) return null;
  if (nut().adjustedAt && Date.now() - nut().adjustedAt < ADJUST_PAUSE) return { kind: 'ok', perWeek: tr.perWeek };
  const kg = weightOn(today())?.kg;
  const reached = nut().goalWeight && kg >= nut().goalWeight;
  if (tr.perWeek < 0.1 && !reached) return { kind: 'more', perWeek: tr.perWeek, plus: 150 };
  if (tr.perWeek > 0.7) return { kind: 'less', perWeek: tr.perWeek, plus: -150 };
  return { kind: 'ok', perWeek: tr.perWeek };
}
export const applyAdjust = (plus) => saveNutrition({ surplus: Math.max(150, Math.min(1000, nut().surplus + plus)), adjustedAt: Date.now() });

// Kalorienbomben für den Abend: viel Energie bei kleinem Volumen
export const SNACK_IDEAS = [
  { name: 'Zunehm-Shake', amount: '400 ml Milch, 50 g Haferflocken, 1 Banane, 2 EL Erdnussbutter', kcal: 740, p: 29, c: 76, f: 33 },
  { name: 'Toast mit Erdnussbutter', amount: '2 Scheiben, 2 EL Erdnussbutter', kcal: 310, p: 12, c: 28, f: 17 },
  { name: 'Handvoll Nüsse', amount: '50 g gemischt', kcal: 310, p: 9, c: 6, f: 27 },
  { name: 'Griechischer Joghurt mit Honig und Granola', amount: '200 g Joghurt, 1 EL Honig, 40 g Granola', kcal: 485, p: 12, c: 48, f: 27 },
  { name: 'Käsebrot mit Butter', amount: '2 Scheiben Brot, Butter, 2 Scheiben Gouda', kcal: 445, p: 17, c: 44, f: 22 },
  { name: 'Banane und Glas Vollmilch', amount: '1 Banane, 250 ml Milch', kcal: 270, p: 10, c: 36, f: 9 },
  { name: 'Studentenfutter', amount: '60 g', kcal: 280, p: 8, c: 22, f: 17 },
  { name: 'Müsli mit Vollmilch', amount: '80 g Müsli, 250 ml Milch', kcal: 450, p: 16, c: 62, f: 14 },
];
