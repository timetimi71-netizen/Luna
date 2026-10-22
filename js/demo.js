// Luna · Beispieldaten zum Ausprobieren (alle mit demo: true markiert, lassen sich wieder entfernen)
import { S, putMany, saveSettings, sleepHours } from './store.js';
import { today, addDays, fromISO, fromMin, clamp } from './util.js';

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

  journal.forEach((e) => S.journal.set(e.date, e));
  sleep.forEach((e) => S.sleep.set(e.date, e));
  events.forEach((e) => S.events.set(e.id, e));
  await putMany('journal', journal);
  await putMany('sleep', sleep);
  await putMany('events', events);
  await saveSettings({ demoLoaded: true });
}
