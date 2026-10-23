// Luna · Beispieldaten zum Ausprobieren (alle mit demo: true markiert, lassen sich wieder entfernen)
import { S, putMany, saveSettings, saveSmokeSettings, sleepHours, reindexFood, reindexSmoke } from './store.js';
import { today, iso, addDays, fromISO, fromMin, clamp } from './util.js';
import { badges } from './smoke.js';

function rng(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const TEXTS = [
  'Ruhiger Tag. Morgens lange gefrühstückt und nachmittags endlich die Steuer erledigt.',
  'Viel los bei der Arbeit, aber das Training am Abend hat richtig gutgetan.',
  'Mit Lena telefoniert, wir planen einen Ausflug an den See.',
  'Etwas müde heute. Ich sollte früher ins Bett gehen.',
  'Super produktiv gewesen, das Projekt ist fast fertig.',
  'Regen den ganzen Tag. Hab gekocht und eine neue Serie angefangen.',
  'Langer Spaziergang im Park, die Blätter werden schon bunt.',
  'Gutes Gespräch mit meinem Bruder, das hat gutgetan.',
  'Stressiger Tag mit zu vielen Terminen. Abends zum Glück Ruhe.',
  'Neues Rezept ausprobiert: Kürbissuppe. Gibt es bald wieder.',
  'Mit Freunden Pizza gegessen und viel gelacht.',
  'Kopfschmerzen am Nachmittag, wahrscheinlich zu wenig getrunken.',
  'Früh aufgestanden und den Sonnenaufgang gesehen. Sehr schön.',
  'Wohnung aufgeräumt, fühlt sich gleich besser an.',
  'Ein bisschen unmotiviert, aber die Laufrunde hat geholfen.',
  'Endlich das Buch fertig gelesen. Das Ende war überraschend.',
];
const GRATITUDE = [
  'Guter Kaffee am Morgen',
  'Sonne in der Mittagspause',
  'Zeit mit Freunden',
  'Ein ruhiger Abend',
  'Dass ich gesund bin',
  'Ein nettes Gespräch mit der Nachbarin',
  'Mein warmes Bett',
  'Leckeres Essen',
  'Eine liebe Nachricht von Mama',
];
const GOOD = [
  'Pünktlich losgekommen',
  'Training durchgezogen',
  'Alles von der To-do-Liste erledigt',
  'Gesund gegessen',
  'Im Meeting ruhig geblieben',
  'Früh schlafen gegangen',
  'Mehr Wasser getrunken',
];
const BETTER = ['Weniger am Handy hängen', 'Früher ins Bett', 'Mehr Wasser trinken', 'Mittags kurz rausgehen', 'Nicht so viel Süßes', 'Öfter Pausen machen'];
const SPORTS = ['Laufen', 'Gym', 'Radfahren', 'Spazieren', 'Fußball', 'Yoga', 'Schwimmen'];

// Beispiel-Mahlzeiten mit realistischen Werten
const M = (name, amount, kcal, p, c, f) => ({ name, amount, kcal, p, c, f });
const BREAKFAST = [
  M('Haferflocken mit Milch und Banane', '80 g Haferflocken, 250 ml Milch', 565, 20, 89, 15),
  M('Brötchen mit Nuss-Nougat-Creme', '2 Brötchen', 480, 12, 78, 13),
  M('Rührei mit Toast', '3 Eier, 2 Scheiben Toast', 430, 24, 26, 25),
  M('Müsli mit Joghurt', '60 g Müsli, 200 g Joghurt', 360, 13, 48, 12),
];
const LUNCH = [
  M('Nudeln Bolognese', 'großer Teller', 780, 34, 96, 26),
  M('Döner Kebab', '1 Döner', 860, 44, 80, 40),
  M('Hähnchen mit Reis und Gemüse', '1 Teller', 640, 46, 78, 14),
  M('Schnitzel mit Pommes', '1 Portion', 1080, 50, 99, 54),
  M('Lasagne', '1 Portion', 620, 28, 52, 32),
];
const DINNER = [
  M('Pizza Salami', '1 ganze Pizza', 1040, 44, 112, 46),
  M('Brot mit Käse und Wurst', '3 Scheiben', 620, 28, 60, 28),
  M('Wraps mit Hähnchen', '2 Wraps', 720, 42, 70, 28),
  M('Spaghetti mit Pesto', '1 Teller', 690, 20, 88, 28),
  M('Reis mit Hähnchen-Curry', '1 Teller', 760, 40, 92, 24),
];
const SNACKS = [
  M('Banane', '1 Stück', 112, 1.4, 24, 0.2),
  M('Handvoll Nüsse', '50 g', 310, 9, 6, 27),
  M('Proteinriegel', '1 Riegel', 219, 19, 18, 7),
  M('Milchschokolade', '50 g', 268, 3.5, 28, 15.5),
  M('Apfel', '1 Stück', 78, 0.4, 17, 0.2),
];
const EXTRA = [
  M('Toast mit Erdnussbutter', '2 Scheiben, 2 EL Erdnussbutter', 310, 12, 28, 17),
  M('Käsebrot mit Butter', '2 Scheiben', 445, 17, 44, 22),
  M('Glas Vollmilch', '250 ml', 160, 8.5, 12, 8.8),
  M('Griechischer Joghurt mit Honig', '200 g, 1 EL Honig', 300, 7, 23, 20),
];
const SHAKE = M('Zunehm-Shake', '400 ml Milch, 50 g Haferflocken, 1 Banane, 2 EL Erdnussbutter', 740, 29, 76, 33);

export async function loadDemo() {
  const r = rng(20261022);
  const gauss = () => {
    let u = 0;
    let v = 0;
    while (!u) u = r();
    while (!v) v = r();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
  const pick = (a) => a[Math.floor(r() * a.length)];
  const lv = (x) => clamp(Math.round(x), 1, 5);
  const t = today();
  const journal = [];
  const sleep = [];
  const habits = S.settings.habits;
  const now = Date.now();

  for (let i = 84; i >= 0; i--) {
    const d = addDays(t, -i);
    const wd = fromISO(d).getDay();
    const weekend = wd === 0 || wd === 6;
    let hours = null;
    if ((i <= 7 || r() < 0.9) && !(S.sleep.has(d) && !S.sleep.get(d).demo)) {
      const bedMin = Math.round(((weekend ? 1460 : 1385) + gauss() * 38) / 5) * 5;
      const dur = Math.round(clamp(7.35 + gauss() * 0.8 + (weekend ? 0.7 : 0), 4.9, 10.2) * 12) * 5;
      const bed = fromMin(bedMin);
      const wake = fromMin(bedMin + dur);
      hours = sleepHours(bed, wake);
      sleep.push({ date: d, bed, wake, hours, demo: true, updatedAt: now });
    }
    if (i > 0 && (i <= 7 || r() < 0.86) && !(S.journal.has(d) && !S.journal.get(d).demo)) {
      const h = hours ?? 7.2;
      const moved = r() < 0.55;
      const social = lv(3.2 + gauss() * 0.9 + (weekend ? 0.6 : 0));
      journal.push({
        date: d,
        demo: true,
        done: true,
        createdAt: now,
        completedAt: now,
        updatedAt: now,
        ratings: {
          tag: lv(2.9 + (h - 7.3) * 0.55 + (moved ? 0.45 : 0) + (social - 3) * 0.25 + gauss() * 0.7),
          schlaf: lv(2.7 + (h - 7) * 0.95 + gauss() * 0.45),
          ernaehrung: lv(3.4 + gauss() * 0.85),
          sport: moved ? lv(3.9 + gauss() * 0.6) : lv(1.7 + gauss() * 0.6),
          energie: lv(2.9 + (h - 7.2) * 0.6 + gauss() * 0.6),
          stress: lv(3.1 + gauss() * 0.9 + (weekend ? 0.6 : -0.2)),
          sozial: social,
        },
        text: pick(TEXTS),
        gratitude: r() < 0.8 ? pick(GRATITUDE) : '',
        good: r() < 0.7 ? pick(GOOD) : '',
        better: r() < 0.6 ? pick(BETTER) : '',
        sport: { types: moved ? [pick(SPORTS)] : [], minutes: moved ? pick([20, 30, 45, 45, 60, 75, 90]) : 0 },
        water: Math.round(clamp(6 + gauss() * 1.8, 2, 11)),
        habits: Object.fromEntries(habits.filter(() => r() < 0.55).map((x) => [x.id, true])),
      });
    }
  }

  // Termine relativ zu heute; der Training-Termin wiederholt sich jeden Dienstag
  const tuesday = addDays(t, -(((fromISO(t).getDay() - 2 + 7) % 7) + 21));
  const events = [
    { id: 'demo-meeting', title: 'Team-Meeting', date: t, start: '16:00', end: '17:00', location: 'Büro', alarm: 'm15', color: 'blau' },
    { id: 'demo-laufen', title: 'Abendrunde laufen', date: t, start: '19:30', end: '20:15', alarm: 'm15', color: 'gruen' },
    { id: 'demo-zahnarzt', title: 'Zahnarzt', date: addDays(t, 2), start: '10:30', end: '11:15', location: 'Praxis Dr. Weber', alarm: 'm60', color: 'rot' },
    { id: 'demo-kino', title: 'Kino mit Lena', date: addDays(t, 4), start: '20:15', end: '22:30', location: 'Kino am Markt', alarm: 'm120', color: 'lila' },
    { id: 'demo-geburtstag', title: 'Geburtstag Oma', date: addDays(t, 9), allDay: true, alarm: 'e18', color: 'gelb', repeat: 'yearly' },
    { id: 'demo-training', title: 'Fußballtraining', date: tuesday, start: '19:00', end: '20:30', location: 'Sportplatz Nord', alarm: 'm60', color: 'gruen', repeat: 'weekly' },
  ].map((e) => ({ allDay: false, location: '', notes: '', repeat: 'none', ...e, demo: true, updatedAt: now }));

  // Essen: die letzten 6 Wochen, heute bis zum Nachmittag
  const n = S.settings.nutrition;
  const trainingDays = n.setup ? n.trainingDays || [] : [2, 4, 6];
  const food = [];
  const add = (d, time, meal, x, extra = {}) =>
    food.push({ id: `demo-f-${d}-${food.length}`, date: d, time, meal, ...x, source: 'liste', demo: true, createdAt: now, updatedAt: now, ...extra });
  for (let i = 42; i >= 0; i--) {
    const d = addDays(t, -i);
    const training = trainingDays.includes(fromISO(d).getDay());
    if (r() < 0.9) add(d, '07:40', 'fruehstueck', pick(BREAKFAST));
    if (r() < 0.6) add(d, '07:45', 'fruehstueck', M('Glas Vollmilch', '250 ml', 160, 8.5, 12, 8.8));
    if (r() < 0.95) add(d, '12:50', 'mittag', pick(LUNCH));
    if (r() < 0.8) add(d, '16:10', 'snack', pick(SNACKS));
    if (i === 0) continue;
    // in den letzten Wochen klappt es besser
    if (r() < 0.5 + (42 - i) / 90) add(d, '10:15', 'snack', pick(EXTRA));
    if (training && r() < 0.85) add(d, '21:30', 'snack', SHAKE, { source: 'fav' });
    if (r() < 0.95) add(d, '19:20', 'abend', pick(DINNER));
    if (r() < 0.6) add(d, '22:00', 'snack', pick(r() < 0.5 ? EXTRA : SNACKS));
  }
  // Gewicht: zweimal pro Woche, langsam steigend
  const weights = [];
  for (let i = 84; i >= 0; i--) {
    const d = addDays(t, -i);
    const wd = fromISO(d).getDay();
    if (wd !== 1 && wd !== 4) continue;
    const kg = 57.2 + ((84 - i) / 7) * 0.2 + gauss() * 0.25;
    weights.push({ date: d, kg: Math.round(kg * 10) / 10, demo: true, updatedAt: now });
  }
  const fav = { id: 'demo-fav-shake', type: 'fav', ...SHAKE, uses: 6, demo: true, createdAt: now, updatedAt: now };

  // Rauchfrei: Rauchstopp vor 12 Tagen um 21:30, die Lust wird mit der Zeit seltener, ein Ausrutscher auf einer Party
  const smokeSet = !S.settings.smoke.setup;
  const quit = fromISO(addDays(t, -12));
  quit.setHours(21, 30, 0, 0);
  const smoke = [];
  if (smokeSet) {
    const TRIG = [
      [8.3, 'kaffee'],
      [10.2, 'pause'],
      [13.1, 'essen'],
      [16.4, 'stress'],
      [19.6, 'essen'],
      [22.2, 'langeweile'],
      [15.2, 'freunde'],
    ];
    for (let i = 12; i >= 0; i--) {
      const d = addDays(t, -i);
      const day = 12 - i;
      const n = i === 12 ? 2 : Math.max(1, Math.round(7.5 - day * 0.55 + gauss() * 0.9));
      const used = new Set();
      for (let k = 0; k < n; k++) {
        let [h, trig] = pick(TRIG);
        if (used.has(trig) && r() < 0.6) [h, trig] = pick(TRIG);
        used.add(trig);
        if (i === 12) h = 22 + k * 0.6;
        const at = fromISO(d);
        at.setHours(0, Math.round((h + r() * 0.8) * 60), 0, 0);
        if (at.getTime() > Date.now() || at.getTime() < quit.getTime()) continue;
        smoke.push({ type: 'craving', at: at.getTime(), resisted: true, strength: day < 4 ? 3 : day < 8 ? 2 : 1, trigger: trig });
      }
    }
    const party = fromISO(addDays(t, -8));
    party.setHours(23, 40, 0, 0);
    smoke.push({ type: 'craving', at: party.getTime() - 6e5, resisted: false, strength: 3, trigger: 'party' });
    smoke.push({ type: 'slip', at: party.getTime(), count: 2, trigger: 'party' });
    smoke.forEach((e, i) => Object.assign(e, { id: `demo-s-${i}`, date: iso(new Date(e.at)), demo: true, createdAt: now, updatedAt: now }));
  }

  journal.forEach((e) => S.journal.set(e.date, e));
  sleep.forEach((e) => S.sleep.set(e.date, e));
  events.forEach((e) => S.events.set(e.id, e));
  food.forEach((e) => S.food.set(e.id, e));
  weights.forEach((e) => {
    if (!S.weights.has(e.date)) S.weights.set(e.date, e);
  });
  S.foodlib.set(fav.id, fav);
  smoke.forEach((e) => S.smoke.set(e.id, e));
  reindexFood();
  reindexSmoke();
  await putMany('journal', journal);
  await putMany('sleep', sleep);
  await putMany('events', events);
  await putMany('food', food);
  await putMany('weights', weights.filter((w) => S.weights.get(w.date) === w));
  await putMany('foodlib', [fav]);
  await putMany('smokelog', smoke);
  const patch = { demoLoaded: true };
  if (smokeSet) {
    patch.smoke = {
      ...S.settings.smoke,
      setup: true,
      demo: true,
      kind: 'zigaretten',
      perDay: 12,
      packPrice: 9.5,
      perPack: 20,
      currency: 'CHF',
      mode: 'stop',
      quitAt: quit.getTime(),
      planStart: null,
      reasons: ['fussball', 'geld', 'freiheit'],
      reasonText: 'Ich will in der zweiten Halbzeit noch genauso viel laufen können wie in der ersten.',
      goalName: 'Neue Fußballschuhe',
      goalPrice: 180,
      attempts: [{ from: quit.getTime() - 40 * 864e5, to: quit.getTime() - 34 * 864e5 }],
      prep: [],
    };
  }
  if (!n.setup) {
    patch.nutrition = { ...n, setup: true, demo: true, sex: 'm', age: 21, height: 182, startWeight: 57.2, goalWeight: 66, activity: 'normal', trainingDays: [2, 4, 6], trainingKcal: 600, surplus: 400 };
  }
  await saveSettings(patch);
  // In der Vorschau nicht alle Erfolge auf einmal feiern
  if (smokeSet) await saveSmokeSettings({ seen: badges().filter((b) => b.ok).map((b) => b.id) });
}
