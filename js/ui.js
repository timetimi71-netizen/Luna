// Luna · Bausteine der Oberfläche: Icons, Smileys, Mond, Sheets, Dialoge, Konfetti, PIN-Feld
import { esc, haptic, lockScroll, unlockScroll, reduceMotion, fmtNum, fmtLong } from './util.js';
import { S, photoURL } from './store.js';

/* ---------- Icons (24er-Raster, Linien) ---------- */
const P = {
  today: '<path d="M3.5 18.5h17"/><path d="M7.5 18.5a4.5 4.5 0 0 1 9 0"/><path d="M12 8v2.5"/><path d="m5.7 11.6 1.7 1.2"/><path d="m18.3 11.6-1.7 1.2"/><path d="M8 21.5h8"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="3.5"/><path d="M3.5 10h17"/><path d="M8 3v4M16 3v4"/><path d="M8 14h.01M12 14h.01M16 14h.01M8 17h.01M12 17h.01"/>',
  journal: '<path d="M6.5 3.5h10a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2h-10z"/><path d="M6.5 3.5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2"/><path d="M9.5 8.5h5.5M9.5 12h5.5M9.5 15.5h3"/>',
  moon: '<path d="M19.5 14.6A7.6 7.6 0 1 1 9.4 4.5a6.1 6.1 0 0 0 10.1 10.1z"/>',
  stats: '<path d="M3.5 20.5h17"/><path d="m4.5 15.5 4.5-5 4 3.5 6.5-8"/><path d="M15.5 6h3.5v3.5"/>',
  sliders: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2.2"/><circle cx="9" cy="17" r="2.2"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  close: '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>',
  chevL: '<path d="m14.5 6-6 6 6 6"/>',
  chevR: '<path d="m9.5 6 6 6-6 6"/>',
  arrowR: '<path d="M5 12h14M13.5 6.5 19 12l-5.5 5.5"/>',
  mic: '<rect x="9" y="3" width="6" height="11.5" rx="3"/><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0"/><path d="M12 18v3"/>',
  camera: '<path d="M4 8.5A2.5 2.5 0 0 1 6.5 6h1.8l1.4-2h4.6l1.4 2h1.8A2.5 2.5 0 0 1 20 8.5v9a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 17.5z"/><circle cx="12" cy="12.8" r="3.4"/>',
  image: '<rect x="3.5" y="4.5" width="17" height="15" rx="3"/><circle cx="9" cy="10" r="1.8"/><path d="m4 17 4.5-4.5 4 4 2.5-2.5 5 5"/>',
  trash: '<path d="M4.5 7h15"/><path d="M9.5 7V4.5h5V7"/><path d="m6.5 7 .9 12a2 2 0 0 0 2 1.8h5.2a2 2 0 0 0 2-1.8l.9-12"/>',
  share: '<path d="M12 3.5v11"/><path d="m8 7 4-4 4 4"/><path d="M8.5 10.5H7a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2h-1.5"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  history: '<path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1"/><path d="M3.5 4v4h4"/><path d="M12 7.5V12l3 2"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/>',
  flame: '<path d="M12 21.5c-4.1 0-6.8-2.7-6.8-6.4 0-3.4 2.3-5.3 3.8-7.8.5 1.8 1.4 2.8 2.5 3.2.3-3.4 1.8-5.9 4.2-7.5-.3 2.7 1 4.6 2.3 6.4 1 1.5 1.9 3.2 1.9 5.4 0 3.9-3.1 6.7-7.9 6.7z"/>',
  drop: '<path d="M12 3.5s6 6.4 6 11a6 6 0 0 1-12 0c0-4.6 6-11 6-11z"/>',
  bell: '<path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>',
  lock: '<rect x="5" y="10.5" width="14" height="10" rx="2.5"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/>',
  download: '<path d="M12 4v11"/><path d="m7.5 10.5 4.5 4.5 4.5-4.5"/><path d="M5 19.5h14"/>',
  upload: '<path d="M12 15V4"/><path d="m7.5 8.5 4.5-4.5 4.5 4.5"/><path d="M5 19.5h14"/>',
  pin: '<path d="M12 21s-6.5-5.8-6.5-11a6.5 6.5 0 0 1 13 0c0 5.2-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.3"/>',
  repeat: '<path d="M4 11V9a3 3 0 0 1 3-3h12"/><path d="m16 3 3 3-3 3"/><path d="M20 13v2a3 3 0 0 1-3 3H5"/><path d="m8 21-3-3 3-3"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M4.6 4.6 6 6M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4"/>',
  apple: '<path d="M12 7.6c-1.5-1-3.5-1.3-5-.4-2.4 1.4-2.7 4.9-1.5 7.9 1.1 2.8 3 5.2 5 5 .6 0 1-.4 1.5-.4s.9.4 1.5.4c2 .2 3.9-2.2 5-5 1.2-3 .9-6.5-1.5-7.9-1.5-.9-3.5-.6-5 .4z"/><path d="M12 7.6c0-2 1-3.6 3-4.1"/>',
  dumbbell: '<path d="M6.5 6.5v11M17.5 6.5v11M3.5 9.5v5M20.5 9.5v5M6.5 12h11"/>',
  bolt: '<path d="M13 2.5 5 13.5h6l-1 8 8-11h-6z"/>',
  wave: '<path d="M3 9c2-2 4-2 6 0s4 2 6 0 4-2 6 0"/><path d="M3 15c2-2 4-2 6 0s4 2 6 0 4-2 6 0"/>',
  people: '<circle cx="9" cy="8.5" r="3"/><path d="M3.5 19a5.5 5.5 0 0 1 11 0"/><circle cx="16.5" cy="9.5" r="2.5"/><path d="M15 14.2a4.5 4.5 0 0 1 6 4.3"/>',
  sparkle: '<path d="M12 3.5l1.8 5.2 5.2 1.8-5.2 1.8L12 17.5l-1.8-5.2L5 10.5l5.2-1.8z"/><path d="M19 16v4M17 18h4"/>',
  backspace: '<path d="M9 5.5h10.5a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H9L3 12z"/><path d="m11.5 9.5 5 5M16.5 9.5l-5 5"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5M12 7.6v.1"/>',
  heart: '<path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.2a4.3 4.3 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20z"/>',
  bed: '<path d="M3.5 19v-12"/><path d="M3.5 15.5h17V19"/><path d="M20.5 15.5v-3a3 3 0 0 0-3-3h-7v6"/><circle cx="7" cy="11.5" r="1.8"/>',
};
export function icon(name, cls = '') {
  return `<svg class="ic ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] || ''}</svg>`;
}
export const iconPath = (name) => P[name] || '';

/* ---------- Kategorien & Smileys ---------- */
export const CATS = [
  { id: 'tag', name: 'Tag allgemein', short: 'Tag', icon: 'sun' },
  { id: 'schlaf', name: 'Schlaf', short: 'Schlaf', icon: 'moon' },
  { id: 'ernaehrung', name: 'Ernährung', short: 'Ernährung', icon: 'apple' },
  { id: 'sport', name: 'Sport', short: 'Sport', icon: 'dumbbell' },
  { id: 'energie', name: 'Energie', short: 'Energie', icon: 'bolt' },
  { id: 'stress', name: 'Stress', short: 'Stress', icon: 'wave' },
  { id: 'sozial', name: 'Soziales', short: 'Soziales', icon: 'people' },
];
export const catName = (id) => CATS.find((c) => c.id === id)?.name || id;
// 5 ist immer das Beste – auch bei Stress (5 = entspannt).
export const LABELS = {
  tag: ['Furchtbar', 'Schlecht', 'Okay', 'Gut', 'Super'],
  schlaf: ['Grauenhaft', 'Unruhig', 'Geht so', 'Erholsam', 'Wie ein Stein'],
  ernaehrung: ['Sehr ungesund', 'Eher ungesund', 'Okay', 'Gesund', 'Super gesund'],
  sport: ['Gar nichts', 'Kaum Bewegung', 'Ein bisschen', 'Aktiv', 'Ausgepowert'],
  energie: ['Leer', 'Müde', 'Okay', 'Fit', 'Voller Energie'],
  stress: ['Extrem gestresst', 'Gestresst', 'Geht so', 'Entspannt', 'Tiefenentspannt'],
  sozial: ['Einsam', 'Eher allein', 'Okay', 'Gute Gespräche', 'Super Zeit'],
};

const INK = 'style="fill:var(--face-ink)"';
const STROKE = 'fill="none" style="stroke:var(--face-ink)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"';
const DOT_EYES = `<circle cx="17.5" cy="20" r="2.7" ${INK}/><circle cx="30.5" cy="20" r="2.7" ${INK}/>`;
export function faceInner(level) {
  const lv = Math.round(level || 0);
  if (!lv) {
    return '<circle cx="24" cy="24" r="20.5" fill="none" style="stroke:var(--line-2)" stroke-width="2" stroke-dasharray="3.2 4.2"/>';
  }
  let eyes = DOT_EYES;
  let mouth = '';
  let extra = '';
  switch (lv) {
    case 1:
      eyes = `<path d="M14.5 17l5.2 3-5.2 3M33.5 17l-5.2 3 5.2 3" ${STROKE} stroke-width="2.8"/>`;
      mouth = `<path d="M15.5 35.5c2.8-4.8 14.2-4.8 17 0" ${STROKE}/>`;
      break;
    case 2:
      mouth = `<path d="M16.5 33.5c3-3 12-3 15 0" ${STROKE}/>`;
      extra = `<path d="M13.8 14.8l5 1.6M34.2 14.8l-5 1.6" ${STROKE} stroke-width="2.4"/>`;
      break;
    case 3:
      mouth = `<path d="M17 31.5h14" ${STROKE}/>`;
      break;
    case 4:
      mouth = `<path d="M15.5 28.5c3.6 4.8 13.4 4.8 17 0" ${STROKE}/>`;
      break;
    default:
      eyes = `<path d="M13.8 21.4c1.2-3.2 5.2-3.2 6.4 0M27.8 21.4c1.2-3.2 5.2-3.2 6.4 0" ${STROKE}/>`;
      mouth =
        `<path d="M14.5 27.2h19c-.8 5.8-4.8 9-9.5 9s-8.7-3.2-9.5-9z" ${INK}/>` +
        '<path d="M19.4 33.7c1.3-1.6 3-2.4 4.6-2.4s3.3.8 4.6 2.4c-1.4 1.5-3 2.1-4.6 2.1s-3.2-.6-4.6-2.1z" style="fill:#ff7b93"/>';
      extra = '<ellipse cx="11.8" cy="27.6" rx="3.2" ry="2" style="fill:#ff6b8a;opacity:.4"/><ellipse cx="36.2" cy="27.6" rx="3.2" ry="2" style="fill:#ff6b8a;opacity:.4"/>';
  }
  return `<circle cx="24" cy="24" r="21" style="fill:var(--m${lv})"/><circle cx="24" cy="24" r="21" fill="url(#faceShine)"/>${extra}${eyes}${mouth}`;
}
export function face(level, cls = '') {
  return `<svg class="face ${cls}" viewBox="0 0 48 48" aria-hidden="true">${faceInner(level)}</svg>`;
}
export function facesHTML(cat, v, { big = false, date = '' } = {}) {
  const labels = LABELS[cat];
  return `<div class="faces ${big ? 'big' : ''} ${v ? 'sel' : ''}" role="radiogroup" aria-label="${esc(catName(cat))}">${[1, 2, 3, 4, 5]
    .map(
      (l) =>
        `<button type="button" class="face-b lv${l} ${v === l ? 'on' : ''}" role="radio" aria-checked="${v === l}" aria-label="${labels[l - 1]}" data-act="rate" data-cat="${cat}" data-v="${l}" data-date="${date}">${face(l)}</button>`,
    )
    .join('')}</div>`;
}

/* ---------- Mond ---------- */
const MOON_NAMES = [
  [0.0339, 'Neumond'],
  [0.216, 'Zunehmende Sichel'],
  [0.284, 'Erstes Viertel'],
  [0.466, 'Zunehmender Mond'],
  [0.534, 'Vollmond'],
  [0.716, 'Abnehmender Mond'],
  [0.784, 'Letztes Viertel'],
  [0.966, 'Abnehmende Sichel'],
  [1.01, 'Neumond'],
];
export function moonInfo(date = new Date()) {
  const synodic = 29.530588853;
  const ref = Date.UTC(2000, 0, 6, 18, 14); // bekannter Neumond
  const age = ((((date.getTime() - ref) / 864e5) % synodic) + synodic) % synodic;
  const phase = age / synodic;
  const illum = (1 - Math.cos(2 * Math.PI * phase)) / 2;
  const name = MOON_NAMES.find(([lim]) => phase < lim)[1];
  return { phase, illum, age, name };
}
export function moonSVG(phase, cls = '') {
  const r = 20;
  const c = 24;
  const rx = (Math.abs(Math.cos(2 * Math.PI * phase)) * r).toFixed(2);
  const waxing = phase < 0.5;
  const limb = waxing ? 1 : 0;
  const term = waxing ? (phase < 0.25 ? 0 : 1) : phase < 0.75 ? 0 : 1;
  const lit = `M${c} ${c - r}A${r} ${r} 0 0 ${limb} ${c} ${c + r}A${rx} ${r} 0 0 ${term} ${c} ${c - r}Z`;
  return `<svg class="moon ${cls}" viewBox="0 0 48 48" aria-hidden="true">
    <circle cx="24" cy="24" r="20" style="fill:#252c4c"/>
    <path d="${lit}" fill="url(#moonLit)"/>
    <circle cx="18" cy="17" r="3.2" style="fill:#000;opacity:.07"/><circle cx="29" cy="28" r="4.2" style="fill:#000;opacity:.06"/><circle cx="21" cy="32" r="2.2" style="fill:#000;opacity:.07"/><circle cx="31" cy="15" r="1.8" style="fill:#000;opacity:.07"/>
  </svg>`;
}
// Logo: Sichel mit zwei Sternen
export function logoSVG(cls = 'logo') {
  return `<svg class="${cls}" viewBox="0 0 96 96" aria-hidden="true">
    <circle cx="48" cy="48" r="30" fill="url(#logoGlow)"/>
    <path d="M60.5 66.5A26 26 0 1 1 41.8 21.4a20.5 20.5 0 0 0 18.7 45.1z" fill="url(#moonLit)"/>
    <path d="M67 26l1.6 4.4L73 32l-4.4 1.6L67 38l-1.6-4.4L61 32l4.4-1.6z" style="fill:var(--moon)"/>
    <circle cx="75" cy="47" r="1.8" style="fill:var(--moon);opacity:.8"/>
  </svg>`;
}
export function starsHTML(n = 14, seed = 7) {
  let s = seed;
  const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  let html = '';
  for (let i = 0; i < n; i++) {
    html += `<i style="left:${(rnd() * 100).toFixed(1)}%;top:${(rnd() * 100).toFixed(1)}%;--t:${(3 + rnd() * 4).toFixed(1)}s;--dl:${(rnd() * 4).toFixed(1)}s;${rnd() > 0.7 ? 'width:3px;height:3px;' : ''}"></i>`;
  }
  return `<div class="stars" aria-hidden="true">${html}</div>`;
}

/* ---------- Sheets (von unten) ---------- */
const sheets = [];
export function openSheet({ title = '', body = '', cls = '', onClose = null } = {}) {
  const wrap = document.createElement('div');
  wrap.className = `sheet-wrap ${cls}`;
  wrap.style.zIndex = String(100 + sheets.length * 2);
  wrap.innerHTML = `<div class="sheet-backdrop" data-sheet-close></div>
    <section class="sheet" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      <div class="sheet-drag"><div class="sheet-grab"></div>
        <header class="sheet-head"><h2 class="sheet-title">${esc(title)}</h2>
          <button type="button" class="icon-btn" data-sheet-close aria-label="Schließen">${icon('close')}</button>
        </header>
      </div>
      <div class="sheet-body">${body}</div>
    </section>`;
  document.body.appendChild(wrap);
  lockScroll();
  const sheet = wrap.querySelector('.sheet');
  const api = {
    el: wrap,
    sheet,
    body: wrap.querySelector('.sheet-body'),
    closed: false,
    onClose,
    close: () => closeSheet(api),
    setTitle(t) {
      wrap.querySelector('.sheet-title').textContent = t;
    },
  };
  wrap.addEventListener('click', (e) => {
    if (e.target.closest('[data-sheet-close]')) {
      e.preventDefault();
      api.close();
    }
  });
  enableDrag(api);
  sheets.push(api);
  requestAnimationFrame(() => requestAnimationFrame(() => wrap.classList.add('open')));
  return api;
}
export function closeSheet(api = sheets[sheets.length - 1]) {
  if (!api || api.closed) return;
  api.closed = true;
  const i = sheets.indexOf(api);
  if (i >= 0) sheets.splice(i, 1);
  if (api.el.contains(document.activeElement)) document.activeElement.blur();
  api.el.classList.remove('open');
  api.el.classList.add('closing');
  api.sheet.style.transform = '';
  setTimeout(() => {
    api.el.remove();
    unlockScroll();
  }, 400);
  api.onClose?.();
}
export const topSheet = () => sheets[sheets.length - 1] || null;
export const closeAllSheets = () => [...sheets].reverse().forEach((s) => closeSheet(s));

function enableDrag(api) {
  const handle = api.sheet.querySelector('.sheet-drag');
  let y0 = null;
  let dy = 0;
  let t0 = 0;
  handle.addEventListener('pointerdown', (e) => {
    if (e.target.closest('button')) return;
    y0 = e.clientY;
    dy = 0;
    t0 = performance.now();
    api.sheet.style.transition = 'none';
    handle.setPointerCapture?.(e.pointerId);
  });
  handle.addEventListener('pointermove', (e) => {
    if (y0 == null) return;
    dy = Math.max(0, e.clientY - y0);
    api.sheet.style.transform = `translateY(${dy}px)`;
  });
  const end = () => {
    if (y0 == null) return;
    const v = dy / Math.max(1, performance.now() - t0);
    y0 = null;
    api.sheet.style.transition = '';
    if (dy > 110 || (v > 0.6 && dy > 30)) api.close();
    else api.sheet.style.transform = '';
  };
  handle.addEventListener('pointerup', end);
  handle.addEventListener('pointercancel', end);
}

/* ---------- Dialog (statt confirm(), das im Web-App-Modus unschön ist) ---------- */
export function confirmDialog({ title, text = '', ok = 'OK', cancel = 'Abbrechen', danger = false }) {
  return new Promise((resolve) => {
    const el = document.createElement('div');
    el.className = 'alert-wrap';
    el.innerHTML = `<div class="alert" role="alertdialog" aria-modal="true" aria-label="${esc(title)}">
      <h3>${esc(title)}</h3>${text ? `<p>${esc(text)}</p>` : ''}
      <div class="alert-btns ${cancel ? '' : 'one'}">${cancel ? `<button type="button" data-v="0">${esc(cancel)}</button>` : ''}<button type="button" data-v="1" class="${danger ? 'danger' : ''}">${esc(ok)}</button></div>
    </div>`;
    el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-v]');
      if (!b && e.target !== el) return;
      const v = b ? b.dataset.v === '1' : false;
      el.classList.add('out');
      setTimeout(() => el.remove(), 200);
      resolve(v);
    });
    document.body.appendChild(el);
    haptic();
  });
}

/* ---------- Konfetti ---------- */
export function confetti({ x = innerWidth / 2, y = innerHeight * 0.7, count = 150 } = {}) {
  if (reduceMotion()) return;
  const c = document.createElement('canvas');
  c.className = 'confetti';
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  c.width = innerWidth * dpr;
  c.height = innerHeight * dpr;
  document.body.appendChild(c);
  const ctx = c.getContext('2d');
  ctx.scale(dpr, dpr);
  const cs = getComputedStyle(document.documentElement);
  const colors = ['--m1', '--m2', '--m3', '--m4', '--m5', '--accent', '--accent-2'].map((v) => cs.getPropertyValue(v).trim());
  const parts = Array.from({ length: count }, () => {
    const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.7;
    const sp = 8 + Math.random() * 10;
    return {
      x,
      y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp,
      w: 6 + Math.random() * 6,
      h: 9 + Math.random() * 8,
      r: Math.random() * 6.28,
      vr: (Math.random() - 0.5) * 0.35,
      c: colors[(Math.random() * colors.length) | 0],
      round: Math.random() < 0.3,
    };
  });
  const t0 = performance.now();
  const life = 2600;
  const frame = (now) => {
    const t = now - t0;
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    for (const p of parts) {
      p.vy += 0.34;
      p.vx *= 0.986;
      p.vy *= 0.986;
      p.x += p.vx;
      p.y += p.vy;
      p.r += p.vr;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.r);
      ctx.globalAlpha = Math.max(0, 1 - t / life);
      ctx.fillStyle = p.c;
      if (p.round) {
        ctx.beginPath();
        ctx.arc(0, 0, p.w / 2.5, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.abs(Math.cos(p.r * 1.7)));
      }
      ctx.restore();
    }
    if (t < life) requestAnimationFrame(frame);
    else c.remove();
  };
  requestAnimationFrame(frame);
}

/* ---------- PIN-Tastenfeld ---------- */
const LETTERS = { 2: 'ABC', 3: 'DEF', 4: 'GHI', 5: 'JKL', 6: 'MNO', 7: 'PQRS', 8: 'TUV', 9: 'WXYZ' };
export function keypadHTML() {
  const keys = [1, 2, 3, 4, 5, 6, 7, 8, 9]
    .map((n) => `<button type="button" class="key" data-key="${n}">${n}<small>${LETTERS[n] || '&nbsp;'}</small></button>`)
    .join('');
  return `<div class="keypad">${keys}<span class="key-gap"></span><button type="button" class="key" data-key="0">0<small>&nbsp;</small></button><button type="button" class="key ghost" data-key="del" aria-label="Löschen">${icon('backspace')}</button></div>`;
}
export const pinDotsHTML = (n = 4) => `<div class="pin-dots">${'<i></i>'.repeat(n)}</div>`;
export function pinPad(root, { length = 4, onComplete }) {
  let val = '';
  let busy = false;
  const dots = root.querySelector('.pin-dots');
  const render = () => dots.querySelectorAll('i').forEach((d, i) => d.classList.toggle('on', i < val.length));
  const press = (k) => {
    if (busy) return;
    haptic();
    if (k === 'del') val = val.slice(0, -1);
    else if (val.length < length) val += k;
    render();
    if (val.length === length) {
      busy = true;
      const v = val;
      setTimeout(() => onComplete(v, api), 140);
    }
  };
  root.addEventListener('click', (e) => {
    const k = e.target.closest('[data-key]');
    if (k) press(k.dataset.key);
  });
  const api = {
    press,
    reset() {
      val = '';
      busy = false;
      render();
    },
    shake() {
      dots.classList.remove('shake');
      void dots.offsetWidth;
      dots.classList.add('shake');
      haptic('error');
    },
  };
  return api;
}

/* ---------- Wasser ---------- */
export function liters(glasses, ml = S.settings.glassMl) {
  const l = (glasses * ml) / 1000;
  const d = Number.isInteger(l) ? 0 : Number.isInteger(Math.round(l * 1000) / 100) ? 1 : 2;
  return `${fmtNum(l, d)} l`;
}
const glassN = (i, n) => (i < n ? (i === n - 1 ? i : i + 1) : i + 1);
const glassBtn = (i, n, date) =>
  `<button type="button" class="glass ${i < n ? 'on' : ''}" data-act="water" data-date="${date}" data-n="${glassN(i, n)}" aria-label="${i + 1}. Glas"><span class="w"></span></button>`;
export function glassesHTML(n, date) {
  const count = Math.max(S.settings.waterGoal, n);
  return `<div class="water-row" data-water="${date}"><div class="glasses">${Array.from({ length: count }, (_, i) => glassBtn(i, n, date)).join('')}</div>
    <div class="water-btns"><button type="button" class="icon-btn" data-act="water" data-date="${date}" data-n="${Math.max(0, n - 1)}" aria-label="Ein Glas weniger">${icon('minus')}</button><button type="button" class="icon-btn" data-act="water" data-date="${date}" data-n="${n + 1}" aria-label="Ein Glas mehr">${icon('plus')}</button></div></div>`;
}
export const waterAmt = (n) => `<b>${liters(n)}</b> von ${liters(S.settings.waterGoal)}`;
export function paintWater(row, n) {
  const box = row.querySelector('.glasses');
  const date = row.dataset.water;
  const count = Math.max(S.settings.waterGoal, n);
  while (box.children.length < count) box.insertAdjacentHTML('beforeend', glassBtn(box.children.length, 0, date));
  while (box.children.length > count) box.lastElementChild.remove();
  requestAnimationFrame(() => {
    [...box.children].forEach((g, i) => {
      g.classList.toggle('on', i < n);
      g.dataset.n = glassN(i, n);
    });
  });
  const [minus, plus] = row.querySelectorAll('.water-btns button');
  minus.dataset.n = Math.max(0, n - 1);
  plus.dataset.n = n + 1;
}

/* ---------- Kleine Bausteine ---------- */
export function segHTML(action, options, value, cls = '') {
  const i = Math.max(0, options.findIndex((o) => o[0] === value));
  return `<div class="seg ${cls}" style="--n:${options.length};--i:${i}" role="tablist"><span class="seg-pill"></span>${options
    .map(
      ([v, label]) =>
        `<button type="button" role="tab" aria-selected="${v === value}" class="${v === value ? 'on' : ''}" data-act="${action}" data-v="${v}">${esc(label)}</button>`,
    )
    .join('')}</div>`;
}
export function setSeg(btn) {
  const seg = btn.closest('.seg');
  const all = [...seg.querySelectorAll('button')];
  all.forEach((b) => {
    b.classList.toggle('on', b === btn);
    b.setAttribute('aria-selected', b === btn);
  });
  seg.style.setProperty('--i', all.indexOf(btn));
}
export function switchHTML(id, checked, attrs = '') {
  return `<span class="switch"><input type="checkbox" id="${id}" ${checked ? 'checked' : ''} ${attrs}><span></span></span>`;
}

export const EV_COLORS = [
  ['mond', 'var(--accent)'],
  ['blau', '#5cb8ff'],
  ['gruen', '#3ddc97'],
  ['gelb', '#ffd166'],
  ['orange', '#ff9657'],
  ['rot', '#ff5d73'],
  ['lila', '#c08bff'],
];
export const evColor = (ev) => (EV_COLORS.find((c) => c[0] === ev?.color) || EV_COLORS[0])[1];

/* ---------- Fotos ---------- */
export function hydratePhotos(root = document) {
  root.querySelectorAll('img[data-photo]:not([src])').forEach(async (img) => {
    const url = await photoURL(img.dataset.photo);
    if (url) img.src = url;
  });
}
export async function openPhotoViewer(date) {
  const url = await photoURL(date);
  if (!url) return;
  const el = document.createElement('div');
  el.className = 'viewer';
  el.innerHTML = `<div class="cap">${esc(fmtLong(date))}</div><button type="button" class="icon-btn" aria-label="Schließen">${icon('close')}</button><img src="${url}" alt="Foto vom ${esc(fmtLong(date))}">`;
  el.addEventListener('click', () => {
    el.classList.add('out');
    setTimeout(() => {
      el.remove();
      unlockScroll();
    }, 200);
  });
  lockScroll();
  document.body.appendChild(el);
}

// Gemeinsame SVG-Verläufe (einmal im Dokument)
export const DEFS = `<svg class="defs" aria-hidden="true" focusable="false"><defs>
  <radialGradient id="faceShine" cx="34%" cy="26%" r="78%"><stop offset="0" stop-color="#fff" stop-opacity=".42"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/></radialGradient>
  <radialGradient id="moonLit" cx="38%" cy="32%" r="78%"><stop offset="0" stop-color="#fffaf0"/><stop offset="1" stop-color="#e3d6b4"/></radialGradient>
  <radialGradient id="logoGlow" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#f5efdc" stop-opacity=".22"/><stop offset="1" stop-color="#f5efdc" stop-opacity="0"/></radialGradient>
</defs></svg>`;
