// Luna · Service Worker: hält die App offline bereit und liefert Kalender-Dateien aus.
const VERSION = 'luna-1.0.0';
const ASSETS = [
  './',
  './index.html',
  './app.css',
  './manifest.webmanifest',
  './js/main.js',
  './js/app.js',
  './js/util.js',
  './js/store.js',
  './js/ui.js',
  './js/charts.js',
  './js/ics.js',
  './js/speech.js',
  './js/demo.js',
  './js/settings.js',
  './js/views/today.js',
  './js/views/calendar.js',
  './js/views/journal.js',
  './js/views/sleep.js',
  './js/views/stats.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(ASSETS.map((u) => new Request(u, { cache: 'reload' })))));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    (async () => {
      for (const k of await caches.keys()) if (k !== VERSION) await caches.delete(k);
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('message', (e) => {
  if (e.data === 'skip') self.skipWaiting();
});

// .ics aus dem Adressparameter bauen. Safari sieht eine echte Kalender-Datei und bietet „Hinzufügen“ an.
function icsResponse(url) {
  try {
    const b64 = (url.searchParams.get('d') || '').replace(/-/g, '+').replace(/_/g, '/');
    const bin = atob(b64 + '==='.slice((b64.length + 3) % 4));
    const text = new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
    const name = decodeURIComponent(url.pathname.split('/').pop() || 'termin.ics').replace(/[^\w.-]/g, '');
    return new Response(text, {
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': `inline; filename="${name || 'termin.ics'}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch {
    return new Response('Ungültige Kalenderdaten', { status: 400 });
  }
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.includes('/ics/')) {
    e.respondWith(icsResponse(url));
    return;
  }
  if (req.mode === 'navigate') {
    e.respondWith(caches.match('./index.html').then((r) => r || fetch(req)));
    return;
  }
  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then(
      (r) =>
        r ||
        fetch(req).then((res) => {
          if (res.ok && res.type === 'basic') {
            const copy = res.clone();
            caches.open(VERSION).then((c) => c.put(req, copy));
          }
          return res;
        }),
    ),
  );
});
