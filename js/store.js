// Luna · Datenhaltung. Alles liegt in IndexedDB auf dem Gerät und wird beim Start in den Arbeitsspeicher geladen.
import { addDays, today, toMin, uid, fromISO, diffDays, blobToDataURL, dataURLToBlob } from './util.js';

export const S = {
  journal: new Map(), // Datum -> Eintrag
  sleep: new Map(), // Datum des Aufwachens -> { bed, wake, hours }
  events: new Map(), // id -> Termin
  photoDates: new Set(),
  settings: null,
  memoryOnly: false,
};

export const DEFAULTS = {
  name: '',
  accent: 'mond',
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
  lastBackup: null,
  demoLoaded: false,
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
    const r = indexedDB.open('luna', 1);
    r.onupgradeneeded = () => {
      const d = r.result;
      const stores = [
        ['journal', 'date'],
        ['sleep', 'date'],
        ['events', 'id'],
        ['photos', 'date'],
        ['meta', 'key'],
      ];
      for (const [name, keyPath] of stores) {
        if (!d.objectStoreNames.contains(name)) d.createObjectStore(name, { keyPath });
      }
    };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
    r.onblocked = () => rej(new Error('IndexedDB blockiert'));
  });
}
const store = (name, mode = 'readonly') => db.transaction(name, mode).objectStore(name);
const getAll = (name) => (db ? wrap(store(name).getAll()) : Promise.resolve([]));
const getAllKeys = (name) => (db ? wrap(store(name).getAllKeys()) : Promise.resolve([]));

let errorShown = false;
function put(name, value) {
  if (!db) return Promise.resolve();
  return wrap(store(name, 'readwrite').put(value)).catch((e) => {
    console.error(e);
    if (!errorShown) {
      errorShown = true;
      hooks.onError?.(e);
    }
  });
}
function remove(name, key) {
  if (!db) return Promise.resolve();
  return wrap(store(name, 'readwrite').delete(key)).catch(console.error);
}
function clear(name) {
  if (!db) return Promise.resolve();
  return wrap(store(name, 'readwrite').clear()).catch(console.error);
}

export async function loadAll() {
  try {
    db = await openDB();
  } catch (e) {
    console.warn('IndexedDB nicht verfügbar – Daten nur im Arbeitsspeicher', e);
    db = null;
    S.memoryOnly = true;
  }
  try {
    const [j, s, ev, meta, pk] = await Promise.all([
      getAll('journal'),
      getAll('sleep'),
      getAll('events'),
      getAll('meta'),
      getAllKeys('photos'),
    ]);
    j.forEach((e) => S.journal.set(e.date, e));
    s.forEach((e) => S.sleep.set(e.date, e));
    ev.forEach((e) => S.events.set(e.id, e));
    pk.forEach((k) => S.photoDates.add(k));
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
  };
}
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
  if (db) await put('photos', rec);
  else memPhotos.set(date, rec);
  S.photoDates.add(date);
  dropURL(date);
}
export async function getPhoto(date) {
  if (!S.photoDates.has(date)) return null;
  const rec = db ? await wrap(store('photos').get(date)) : memPhotos.get(date);
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

/* ---------- Massenoperationen ---------- */
export async function putMany(name, values) {
  if (!db) return;
  await new Promise((res, rej) => {
    const tx = db.transaction(name, 'readwrite');
    const os = tx.objectStore(name);
    values.forEach((v) => os.put(v));
    tx.oncomplete = res;
    tx.onerror = () => rej(tx.error);
  });
}

export async function wipeAll() {
  S.journal.clear();
  S.sleep.clear();
  S.events.clear();
  S.photoDates.clear();
  memPhotos.clear();
  urlCache.forEach((u) => URL.revokeObjectURL(u));
  urlCache.clear();
  await Promise.all(['journal', 'sleep', 'events', 'photos', 'meta'].map(clear));
  S.settings = mergeSettings();
}

export async function removeDemo() {
  for (const [name, map] of [
    ['journal', S.journal],
    ['sleep', S.sleep],
    ['events', S.events],
  ]) {
    for (const [k, v] of [...map]) {
      if (v.demo) {
        map.delete(k);
        await remove(name, k);
      }
    }
  }
  await saveSettings({ demoLoaded: false });
}
export const hasDemo = () =>
  [...S.journal.values()].some((e) => e.demo) || [...S.events.values()].some((e) => e.demo) || [...S.sleep.values()].some((e) => e.demo);

/* ---------- Backup ---------- */
export async function buildBackup() {
  const photos = [];
  for (const date of S.photoDates) {
    const rec = await getPhoto(date);
    if (rec) photos.push({ date, type: rec.type, w: rec.w, h: rec.h, data: await blobToDataURL(rec.blob) });
  }
  const { pinHash, pinSalt, ...settings } = S.settings;
  return {
    app: 'luna',
    version: 1,
    exportedAt: new Date().toISOString(),
    settings,
    journal: [...S.journal.values()],
    sleep: [...S.sleep.values()],
    events: [...S.events.values()],
    photos,
  };
}

export async function restoreBackup(data) {
  if (!data || data.app !== 'luna') throw new Error('Diese Datei ist kein Luna-Backup.');
  const journal = (data.journal || []).filter((e) => e && /^\d{4}-\d{2}-\d{2}$/.test(e.date));
  const sleep = (data.sleep || []).filter((e) => e && /^\d{4}-\d{2}-\d{2}$/.test(e.date));
  const events = (data.events || []).filter((e) => e && e.id && e.date);
  journal.forEach((e) => S.journal.set(e.date, e));
  sleep.forEach((e) => S.sleep.set(e.date, e));
  events.forEach((e) => S.events.set(e.id, e));
  await putMany('journal', journal);
  await putMany('sleep', sleep);
  await putMany('events', events);
  let photos = 0;
  for (const p of data.photos || []) {
    if (!p?.date || !p.data) continue;
    await savePhoto(p.date, dataURLToBlob(p.data), { w: p.w, h: p.h });
    photos++;
  }
  if (data.settings) {
    const { pinHash, pinSalt, onboarded, demoLoaded, ...rest } = data.settings;
    await saveSettings(mergeSettings({ ...S.settings, ...rest }));
  }
  return { journal: journal.length, sleep: sleep.length, events: events.length, photos };
}
