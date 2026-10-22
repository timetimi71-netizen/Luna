// Luna · Datenhaltung. Alles liegt in IndexedDB auf dem Gerät und wird beim Start in den Arbeitsspeicher geladen.
import { addDays, today, toMin, uid, fromISO, diffDays, blobToDataURL, dataURLToBlob } from './util.js';

export const S = {
  journal: new Map(), // Datum -> Eintrag
  sleep: new Map(), // Datum des Aufwachens -> { bed, wake, hours }
  events: new Map(), // id -> Termin
  photoDates: new Set(),
  food: new Map(), // id -> Mahlzeit-Eintrag
  weights: new Map(), // Datum -> { date, kg }
  foodlib: new Map(), // id -> Favorit oder eigenes Lebensmittel
  foodPics: new Set(), // ids von Einträgen mit Foto
  settings: null,
  memoryOnly: false,
};

export const DEFAULTS = {
  name: '',
  accent: 'mond',
  look: 'light',
  haptics: true,
  reduceMotion: false,
  cats: { schlaf: true, ernaehrung: true, sport: true, energie: true, stress: true, sozial: true },
  questions: { gratitude: true, good: true, better: true },
  modules: { photo: true, sport: true, water: true, habits: true },
  waterGoal: 8,
  glassMl: 250,
  habits: [
    { id: 'lesen', name: 'Lesen', emoji: '📖' },
    { id: 'meditieren', name: 'Meditieren', emoji: '🧘' },
    { id: 'luft', name: 'Frische Luft', emoji: '🌿' },
    { id: 'handy', name: 'Kein Handy im Bett', emoji: '📵' },
  ],
  reminderTime: '21:00',
  reminderSet: false,
  pinHash: null,
  pinSalt: null,
  lockAfter: 60,
  onboarded: false,
  installHintDismissed: false,
  reminderHintDismissed: false,
  reinstallHintDismissed: false,
  lastBackup: null,
  demoLoaded: false,
  nutrition: {
    setup: false,
    sex: 'm',
    age: null,
    height: 182,
    startWeight: null,
    goalWeight: null,
    activity: 'normal',
    trainingDays: [],
    trainingKcal: 600,
    surplus: 400,
    proteinPerKg: 1.8,
    adjustedAt: null,
    geminiKey: '',
    geminiModel: '',
  },
};

export const hooks = { onError: null };

let db = null;
const memPhotos = new Map();
const urlCache = new Map();

const wrap = (r) =>
  new Promise((res, rej) => {
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });

function openDB() {
  return new Promise((res, rej) => {
    const r = indexedDB.open('luna', 2);
    r.onupgradeneeded = () => {
      const d = r.result;
      const stores = [
        ['journal', 'date'],
        ['sleep', 'date'],
        ['events', 'id'],
        ['photos', 'date'],
        ['meta', 'key'],
        ['food', 'id'],
        ['weights', 'date'],
        ['foodlib', 'id'],
        ['foodpics', 'id'],
      ];
      for (const [name, keyPath] of stores) {
        if (!d.objectStoreNames.contains(name)) d.createObjectStore(name, { keyPath });
      }
    };
    r.onsuccess = () => {
      const d = r.result;
      // Öffnet eine neuere Version die Datenbank, gibt diese Seite sie frei.
      d.onversionchange = () => {
        d.close();
        if (db === d) db = null;
      };
      d.onclose = () => {
        if (db === d) db = null;
      };
      res(d);
    };
    r.onerror = () => rej(r.error);
    // blockiert = eine ältere Luna-Seite ist noch offen; die Anfrage läuft weiter, sobald sie schließt
    r.onblocked = () => console.warn('IndexedDB wartet auf ältere Luna-Seite');
  });
}
// Verbindung holen. iOS trennt sie manchmal, während Luna im Hintergrund liegt – dann einmal neu öffnen.
let reopening = null;
function getDB() {
  if (db || S.memoryOnly) return Promise.resolve(db);
  reopening ||= openDB()
    .then((d) => (db = d))
    .finally(() => {
      reopening = null;
    });
  return reopening;
}
const lost = (e) => ['InvalidStateError', 'UnknownError', 'TransactionInactiveError'].includes(e?.name);
async function run(name, mode, fn) {
  for (let i = 0; ; i++) {
    const d = await getDB();
    if (!d) return undefined;
    try {
      return await fn(d.transaction(name, mode));
    } catch (e) {
      if (i || !lost(e)) throw e;
      if (db === d) db = null;
    }
  }
}
const req = (name, mode, fn) => run(name, mode, (tx) => wrap(fn(tx.objectStore(name))));
const getAll = (name) => req(name, 'readonly', (s) => s.getAll()).then((r) => r || []);
const getAllKeys = (name) => req(name, 'readonly', (s) => s.getAllKeys()).then((r) => r || []);
const getOne = (name, key) => req(name, 'readonly', (s) => s.get(key));

let errorShown = false;
function report(e) {
  console.error(e);
  if (!errorShown) {
    errorShown = true;
    hooks.onError?.(e);
  }
}
const put = (name, value) => req(name, 'readwrite', (s) => s.put(value)).catch(report);
const remove = (name, key) => req(name, 'readwrite', (s) => s.delete(key)).catch(report);
const clear = (name) => req(name, 'readwrite', (s) => s.clear()).catch(report);

export async function loadAll() {
  try {
    db = await openDB();
  } catch (e) {
    console.warn('IndexedDB nicht verfügbar – Daten nur im Arbeitsspeicher', e);
    db = null;
    S.memoryOnly = true;
  }
  try {
    const [j, s, ev, meta, pk, fo, we, fl, fp] = await Promise.all([
      getAll('journal'),
      getAll('sleep'),
      getAll('events'),
      getAll('meta'),
      getAllKeys('photos'),
      getAll('food'),
      getAll('weights'),
      getAll('foodlib'),
      getAllKeys('foodpics'),
    ]);
    j.forEach((e) => S.journal.set(e.date, e));
    s.forEach((e) => S.sleep.set(e.date, e));
    ev.forEach((e) => S.events.set(e.id, e));
    pk.forEach((k) => S.photoDates.add(k));
    fo.forEach((e) => S.food.set(e.id, e));
    we.forEach((e) => S.weights.set(e.date, e));
    fl.forEach((e) => S.foodlib.set(e.id, e));
    fp.forEach((k) => S.foodPics.add(k));
    reindexFood();
    S.settings = mergeSettings(meta.find((m) => m.key === 'settings')?.value);
  } catch (e) {
    console.error(e);
    S.settings = mergeSettings();
  }
  if (navigator.storage?.persist) navigator.storage.persist().catch(() => {});
}

export function mergeSettings(st = {}) {
  return {
    ...DEFAULTS,
    ...st,
    cats: { ...DEFAULTS.cats, ...st.cats },
    questions: { ...DEFAULTS.questions, ...st.questions },
    modules: { ...DEFAULTS.modules, ...st.modules },
    habits: Array.isArray(st.habits) ? st.habits : DEFAULTS.habits.map((h) => ({ ...h })),
    nutrition: { ...DEFAULTS.nutrition, ...st.nutrition },
  };
}
export const saveNutrition = (patch) => saveSettings({ nutrition: { ...S.settings.nutrition, ...patch } });
export function saveSettings(patch) {
  S.settings = { ...S.settings, ...patch };
  return put('meta', { key: 'settings', value: S.settings });
}

/* ---------- Verzögertes Schreiben (Tippen) ----------
   Gespeichert wird immer der aktuelle Stand aus dem Arbeitsspeicher,
   damit sich schnelle Änderungen nicht gegenseitig überschreiben. */
const pending = new Map();
const current = (name, key) => (name === 'journal' ? S.journal.get(key) : name === 'sleep' ? S.sleep.get(key) : null);
function schedule(name, key, ms = 450) {
  const k = `${name}|${key}`;
  clearTimeout(pending.get(k));
  pending.set(
    k,
    setTimeout(() => {
      pending.delete(k);
      const v = current(name, key);
      if (v) put(name, v);
    }, ms),
  );
}
function writeNow(name, key) {
  const k = `${name}|${key}`;
  if (pending.has(k)) {
    clearTimeout(pending.get(k));
    pending.delete(k);
  }
  const v = current(name, key);
  return v ? put(name, v) : Promise.resolve();
}
export function flushWrites() {
  for (const [k, t] of pending) {
    clearTimeout(t);
    const [name, key] = k.split('|');
    const v = current(name, key);
    if (v) put(name, v);
  }
  pending.clear();
}

/* ---------- Journal ---------- */
export function updateJournal(date, patch, { defer = false } = {}) {
  const cur = S.journal.get(date) || { date, ratings: {}, createdAt: Date.now() };
  const next = { ...cur, ...patch, updatedAt: Date.now() };
  S.journal.set(date, next);
  if (defer) schedule('journal', date);
  else writeNow('journal', date);
  return next;
}
export function setRating(date, cat, v) {
  const ratings = { ...(S.journal.get(date)?.ratings || {}) };
  if (v) ratings[cat] = v;
  else delete ratings[cat];
  return updateJournal(date, { ratings });
}
export const rating = (date, cat) => S.journal.get(date)?.ratings?.[cat] ?? null;
export const isDone = (date) => !!S.journal.get(date)?.done;

export function snippet(e, len = 120) {
  if (!e) return '';
  const t = (e.text || e.good || e.gratitude || '').replace(/\s+/g, ' ').trim();
  return t.length > len ? `${t.slice(0, len - 1)}…` : t;
}

export function currentStreak() {
  let d = today();
  if (!isDone(d)) d = addDays(d, -1);
  let n = 0;
  while (isDone(d)) {
    n++;
    d = addDays(d, -1);
  }
  return n;
}
export function longestStreak() {
  const dates = [...S.journal.values()].filter((e) => e.done).map((e) => e.date).sort();
  let best = 0;
  let run = 0;
  let prev = null;
  for (const d of dates) {
    run = prev && addDays(prev, 1) === d ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  }
  return best;
}
export function avg(list, fn) {
  let s = 0;
  let n = 0;
  for (const x of list) {
    const v = fn(x);
    if (v != null && !Number.isNaN(v)) {
      s += v;
      n++;
    }
  }
  return n ? s / n : null;
}

/* ---------- Schlaf ---------- */
export const SLEEP_GOOD = 8;
export const SLEEP_OK = 7;
export function sleepHours(bed, wake) {
  const b = toMin(bed);
  const w = toMin(wake);
  if (b == null || w == null) return null;
  const d = (w - b + 1440) % 1440;
  return d ? d / 60 : null;
}
export const sleepStatus = (h) => (h == null ? null : h >= SLEEP_GOOD ? 'good' : h >= SLEEP_OK ? 'ok' : 'bad');
export const STATUS_LABEL = { good: 'Ausgeschlafen', ok: 'Ganz okay', bad: 'Zu wenig' };
export function saveSleep(date, bed, wake, extra = {}) {
  const e = { ...(S.sleep.get(date) || {}), ...extra, date, bed, wake, hours: sleepHours(bed, wake), updatedAt: Date.now() };
  S.sleep.set(date, e);
  writeNow('sleep', date);
  return e;
}
export function deleteSleep(date) {
  S.sleep.delete(date);
  return remove('sleep', date);
}
export function latestSleep() {
  let best = null;
  for (const e of S.sleep.values()) if (!best || e.date > best.date) best = e;
  return best;
}

/* ---------- Termine ---------- */
export function saveEvent(ev) {
  const e = { ...ev, id: ev.id || uid(), updatedAt: Date.now() };
  S.events.set(e.id, e);
  put('events', e);
  return e;
}
export function deleteEvent(id) {
  S.events.delete(id);
  return remove('events', id);
}
export function occursOn(ev, date) {
  if (date < ev.date) return false;
  switch (ev.repeat) {
    case 'daily':
      return true;
    case 'weekly':
      return diffDays(date, ev.date) % 7 === 0;
    case 'biweekly':
      return diffDays(date, ev.date) % 14 === 0;
    case 'monthly':
      return fromISO(date).getDate() === fromISO(ev.date).getDate();
    case 'yearly': {
      const a = fromISO(date);
      const b = fromISO(ev.date);
      return a.getDate() === b.getDate() && a.getMonth() === b.getMonth();
    }
    default:
      return date === ev.date;
  }
}
const byTime = (a, b) => (a.allDay === b.allDay ? (a.start || '').localeCompare(b.start || '') : a.allDay ? -1 : 1);
export function eventsOn(date) {
  const out = [];
  for (const ev of S.events.values()) if (occursOn(ev, date)) out.push(ev);
  return out.sort(byTime);
}
export function upcoming(from, days = 21, limit = 4) {
  const out = [];
  for (let i = 0; i <= days && out.length < limit; i++) {
    const d = addDays(from, i);
    for (const ev of eventsOn(d)) {
      if (out.length < limit) out.push({ ev, date: d });
    }
  }
  return out;
}

/* ---------- Fotos ----------
   Gespeichert als ArrayBuffer: Blobs in IndexedDB machen auf älteren iPhones Ärger. */
export async function savePhoto(date, blob, meta = {}) {
  const rec = { date, data: await blob.arrayBuffer(), type: blob.type || 'image/jpeg', ...meta, updatedAt: Date.now() };
  if (!S.memoryOnly) await put('photos', rec);
  else memPhotos.set(date, rec);
  S.photoDates.add(date);
  dropURL(date);
}
export async function getPhoto(date) {
  if (!S.photoDates.has(date)) return null;
  const rec = S.memoryOnly ? memPhotos.get(date) : await getOne('photos', date);
  if (!rec) return null;
  return { ...rec, blob: new Blob([rec.data], { type: rec.type }) };
}
export async function photoURL(date) {
  if (urlCache.has(date)) return urlCache.get(date);
  const rec = await getPhoto(date);
  if (!rec) return null;
  const url = URL.createObjectURL(rec.blob);
  urlCache.set(date, url);
  return url;
}
function dropURL(date) {
  const u = urlCache.get(date);
  if (u) {
    URL.revokeObjectURL(u);
    urlCache.delete(date);
  }
}
export async function deletePhoto(date) {
  S.photoDates.delete(date);
  memPhotos.delete(date);
  dropURL(date);
  await remove('photos', date);
}

/* ---------- Essen ----------
   Einträge liegen alle im Speicher; foodByDate ist ein Index Datum -> Einträge (nach Uhrzeit). */
export const foodByDate = new Map();
export function reindexFood() {
  foodByDate.clear();
  for (const e of S.food.values()) {
    if (!foodByDate.has(e.date)) foodByDate.set(e.date, []);
    foodByDate.get(e.date).push(e);
  }
  for (const list of foodByDate.values()) list.sort((a, b) => (a.time || '').localeCompare(b.time || '') || a.createdAt - b.createdAt);
}
export const foodOn = (date) => foodByDate.get(date) || [];
export function saveFood(entry) {
  const e = { createdAt: Date.now(), ...entry, id: entry.id || uid(), updatedAt: Date.now() };
  S.food.set(e.id, e);
  reindexFood();
  put('food', e);
  return e;
}
export async function deleteFood(id) {
  S.food.delete(id);
  reindexFood();
  await remove('food', id);
  if (S.foodPics.has(id)) await deleteFoodPic(id);
}

const foodURLs = new Map();
export async function saveFoodPic(id, blob) {
  const rec = { id, data: await blob.arrayBuffer(), type: blob.type || 'image/jpeg' };
  if (!S.memoryOnly) await put('foodpics', rec);
  else memPhotos.set(`food:${id}`, rec);
  S.foodPics.add(id);
}
export async function foodPicURL(id) {
  if (!S.foodPics.has(id)) return null;
  if (foodURLs.has(id)) return foodURLs.get(id);
  const rec = S.memoryOnly ? memPhotos.get(`food:${id}`) : await getOne('foodpics', id);
  if (!rec) return null;
  const url = URL.createObjectURL(new Blob([rec.data], { type: rec.type }));
  foodURLs.set(id, url);
  return url;
}
async function foodPicRecord(id) {
  return S.memoryOnly ? memPhotos.get(`food:${id}`) : getOne('foodpics', id);
}
export async function deleteFoodPic(id) {
  S.foodPics.delete(id);
  memPhotos.delete(`food:${id}`);
  const u = foodURLs.get(id);
  if (u) {
    URL.revokeObjectURL(u);
    foodURLs.delete(id);
  }
  await remove('foodpics', id);
}

export function saveWeight(date, kg) {
  const e = { date, kg: Math.round(kg * 10) / 10, updatedAt: Date.now() };
  S.weights.set(date, e);
  put('weights', e);
  return e;
}
export function deleteWeight(date) {
  S.weights.delete(date);
  return remove('weights', date);
}
// Letztes Gewicht an oder vor einem Datum
export function weightOn(date) {
  let best = null;
  for (const e of S.weights.values()) if (e.date <= date && (!best || e.date > best.date)) best = e;
  return best;
}

export function saveLib(item) {
  const e = { createdAt: Date.now(), ...item, id: item.id || uid(), updatedAt: Date.now() };
  S.foodlib.set(e.id, e);
  put('foodlib', e);
  return e;
}
export function deleteLib(id) {
  S.foodlib.delete(id);
  return remove('foodlib', id);
}

/* ---------- Massenoperationen ---------- */
export async function putMany(name, values) {
  if (!values.length) return;
  await run(
    name,
    'readwrite',
    (tx) =>
      new Promise((res, rej) => {
        const os = tx.objectStore(name);
        values.forEach((v) => os.put(v));
        tx.oncomplete = res;
        tx.onerror = () => rej(tx.error);
        tx.onabort = () => rej(tx.error);
      }),
  );
}

export async function wipeAll() {
  S.journal.clear();
  S.sleep.clear();
  S.events.clear();
  S.photoDates.clear();
  S.food.clear();
  S.weights.clear();
  S.foodlib.clear();
  S.foodPics.clear();
  reindexFood();
  memPhotos.clear();
  urlCache.forEach((u) => URL.revokeObjectURL(u));
  urlCache.clear();
  foodURLs.forEach((u) => URL.revokeObjectURL(u));
  foodURLs.clear();
  await Promise.all(['journal', 'sleep', 'events', 'photos', 'meta', 'food', 'weights', 'foodlib', 'foodpics'].map(clear));
  S.settings = mergeSettings();
}

export async function removeDemo() {
  for (const [name, map] of [
    ['journal', S.journal],
    ['sleep', S.sleep],
    ['events', S.events],
    ['food', S.food],
    ['weights', S.weights],
    ['foodlib', S.foodlib],
  ]) {
    for (const [k, v] of [...map]) {
      if (v.demo) {
        map.delete(k);
        await remove(name, k);
      }
    }
  }
  reindexFood();
  const n = S.settings.nutrition;
  // Ziel kam nur aus den Beispieldaten? Dann zurück auf Anfang (Gemini-Schlüssel bleibt).
  const nutrition = n.demo ? { ...DEFAULTS.nutrition, geminiKey: n.geminiKey, geminiModel: n.geminiModel } : n;
  await saveSettings({ demoLoaded: false, nutrition });
}
export const hasDemo = () =>
  [S.journal, S.events, S.sleep, S.food, S.weights].some((m) => [...m.values()].some((e) => e.demo));

/* ---------- Backup ---------- */
export async function buildBackup() {
  const photos = [];
  for (const date of S.photoDates) {
    const rec = await getPhoto(date);
    if (rec) photos.push({ date, type: rec.type, w: rec.w, h: rec.h, data: await blobToDataURL(rec.blob) });
  }
  const foodPics = [];
  for (const id of S.foodPics) {
    const rec = await foodPicRecord(id);
    if (rec) foodPics.push({ id, data: await blobToDataURL(new Blob([rec.data], { type: rec.type })) });
  }
  const { pinHash, pinSalt, ...settings } = S.settings;
  // Der Gemini-Schlüssel bleibt auf dem Gerät und landet nicht in der Backup-Datei.
  settings.nutrition = { ...settings.nutrition, geminiKey: '', geminiModel: '' };
  return {
    app: 'luna',
    version: 2,
    exportedAt: new Date().toISOString(),
    settings,
    journal: [...S.journal.values()],
    sleep: [...S.sleep.values()],
    events: [...S.events.values()],
    photos,
    food: [...S.food.values()],
    weights: [...S.weights.values()],
    foodlib: [...S.foodlib.values()],
    foodPics,
  };
}

const isDate = (d) => /^\d{4}-\d{2}-\d{2}$/.test(d);
// IDs und Uhrzeiten landen in HTML-Attributen: aus fremden Dateien nur harmlose Formate übernehmen
const isId = (v) => typeof v === 'string' && /^[\w-]{1,64}$/.test(v);
const okTime = (t) => t == null || t === '' || /^\d{2}:\d{2}$/.test(t);
export async function restoreBackup(data) {
  if (!data || data.app !== 'luna') throw new Error('Diese Datei ist kein Luna-Backup.');
  const journal = (data.journal || []).filter((e) => e && isDate(e.date));
  const sleep = (data.sleep || []).filter((e) => e && isDate(e.date));
  const events = (data.events || []).filter((e) => e && isId(e.id) && isDate(e.date) && okTime(e.start) && okTime(e.end));
  const food = (data.food || []).filter((e) => e && isId(e.id) && isDate(e.date) && okTime(e.time) && Number.isFinite(e.kcal));
  const weights = (data.weights || []).filter((e) => e && isDate(e.date) && Number.isFinite(e.kg));
  const foodlib = (data.foodlib || []).filter((e) => e && isId(e.id) && e.name);
  journal.forEach((e) => S.journal.set(e.date, e));
  sleep.forEach((e) => S.sleep.set(e.date, e));
  events.forEach((e) => S.events.set(e.id, e));
  food.forEach((e) => S.food.set(e.id, e));
  weights.forEach((e) => S.weights.set(e.date, e));
  foodlib.forEach((e) => S.foodlib.set(e.id, e));
  reindexFood();
  await putMany('journal', journal);
  await putMany('sleep', sleep);
  await putMany('events', events);
  await putMany('food', food);
  await putMany('weights', weights);
  await putMany('foodlib', foodlib);
  let photos = 0;
  for (const p of data.photos || []) {
    if (!p?.date || !p.data) continue;
    await savePhoto(p.date, dataURLToBlob(p.data), { w: p.w, h: p.h });
    photos++;
  }
  for (const p of data.foodPics || []) {
    if (isId(p?.id) && p.data && S.food.has(p.id)) await saveFoodPic(p.id, dataURLToBlob(p.data));
  }
  if (data.settings) {
    const { pinHash, pinSalt, onboarded, demoLoaded, ...rest } = data.settings;
    const key = S.settings.nutrition.geminiKey;
    const model = S.settings.nutrition.geminiModel;
    const merged = mergeSettings({ ...S.settings, ...rest });
    merged.nutrition = { ...merged.nutrition, geminiKey: key, geminiModel: model };
    await saveSettings(merged);
  }
  return { journal: journal.length, sleep: sleep.length, events: events.length, photos, food: food.length };
}
