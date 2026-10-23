// Luna · Start, Navigation, Ereignisse, Service Worker
import { S, loadAll, flushWrites, hooks } from './store.js';
import { $, toast, haptic, today, countUp, reduceMotion, legacyBar, IS_PREVIEW } from './util.js';
import { icon, hydratePhotos, DEFS, topSheet } from './ui.js';
import { actions, inputs, changes, act, app } from './app.js';
import * as todayView from './views/today.js';
import * as calendarView from './views/calendar.js';
import * as journalView from './views/journal.js';
import * as sleepView from './views/sleep.js';
import * as statsView from './views/stats.js';
import * as foodView from './views/food.js';
import * as smokeView from './views/smoke.js';
import { applySettings, showLock, showOnboarding } from './settings.js';
import { stopDictation } from './speech.js';
import { loadDemo } from './demo.js';

const VIEWS = { today: todayView, calendar: calendarView, journal: journalView, food: foodView, smoke: smokeView, sleep: sleepView, stats: statsView };
const TABS = [
  ['today', 'Heute', 'today'],
  ['calendar', 'Kalender', 'calendar'],
  ['journal', 'Journal', 'journal'],
  ['food', 'Essen', 'apple'],
  ['smoke', 'Rauchfrei', 'nosmoke'],
  ['sleep', 'Schlaf', 'moon'],
  ['stats', 'Statistik', 'stats'],
];
let current = 'today';
let renderedDay = today();
let switching = null;

function shell() {
  document.body.insertAdjacentHTML(
    'afterbegin',
    `${DEFS}<div class="ambient" aria-hidden="true"></div>
    <main class="app" id="app"><div class="view" id="view"></div></main>
    <nav class="tabbar" aria-label="Bereiche"><div class="tabbar-in" id="tabbar"></div></nav>
    <div class="toasts" id="toasts"></div>`,
  );
}

// Essen und Rauchfrei lassen sich in den Einstellungen ausblenden
const visibleTabs = () => TABS.filter(([id]) => S.settings?.tabs?.[id] !== false);
function buildTabs() {
  const tabs = visibleTabs();
  const bar = $('#tabbar');
  bar.style.setProperty('--tabs', tabs.length);
  bar.classList.toggle('many', tabs.length > 6);
  bar.innerHTML = `<span class="tab-pill" id="tab-pill"></span>${tabs
    .map(([id, label, ic]) => `<button type="button" class="tab" data-tab="${id}">${icon(ic)}<span>${label}</span></button>`)
    .join('')}`;
  markTab();
}
function markTab() {
  document.querySelectorAll('.tab').forEach((t) => {
    const on = t.dataset.tab === current;
    t.classList.toggle('on', on);
    if (on) t.setAttribute('aria-current', 'page');
    else t.removeAttribute('aria-current');
  });
  const i = visibleTabs().findIndex((t) => t[0] === current);
  const pill = $('#tab-pill');
  if (pill) {
    pill.style.setProperty('--i', Math.max(0, i));
    pill.style.opacity = i < 0 ? '0' : '';
  }
}
app.rebuildTabs = () => {
  buildTabs();
  if (S.settings.tabs?.[current] === false) app.go('today', { instant: true });
};

function render({ animate = false } = {}) {
  const view = VIEWS[current];
  const el = $('#view');
  el.innerHTML = view.render();
  el.dataset.view = current;
  if (animate && !reduceMotion()) {
    let i = 0;
    el.querySelectorAll(':scope > *, :scope > .stack > *').forEach((c) => {
      if (c.classList.contains('stack')) return;
      c.classList.add('reveal');
      c.style.setProperty('--d', Math.min(i++, 10));
    });
  }
  view.mount?.(el);
  hydratePhotos(el);
  if (animate) countUp(el);
  markTab();
  renderedDay = today();
}

app.go = (name, opts = {}) => {
  if (!VIEWS[name]) return;
  stopDictation();
  flushWrites();
  VIEWS[name].enter?.(opts);
  current = name;
  clearTimeout(switching);
  const el = $('#view');
  if (opts.instant || reduceMotion()) {
    el.classList.remove('out');
    render({ animate: !!opts.instant });
    window.scrollTo(0, 0);
    return;
  }
  el.classList.add('out');
  switching = setTimeout(() => {
    render({ animate: true });
    el.classList.remove('out');
    window.scrollTo(0, 0);
  }, 130);
};
app.refresh = ({ animate = false } = {}) => {
  const y = window.scrollY;
  render({ animate });
  if (!document.body.classList.contains('locked')) window.scrollTo(0, y);
};
app.current = () => current;

act('go', (el) => app.go(el.dataset.to, { date: el.dataset.date || undefined }));

/* ---------- Ereignisse ---------- */
function wire() {
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-act]');
    if (!el || el.disabled) return;
    actions[el.dataset.act]?.(el, e);
  });
  document.addEventListener('input', (e) => {
    const k = e.target.dataset?.input;
    if (k) inputs[k]?.(e.target, e);
  });
  document.addEventListener('change', (e) => {
    const k = e.target.dataset?.change;
    if (k) changes[k]?.(e.target, e);
  });

  $('#tabbar').addEventListener('click', (e) => {
    const t = e.target.closest('[data-tab]');
    if (!t) return;
    haptic();
    t.classList.remove('bump');
    void t.offsetWidth;
    t.classList.add('bump');
    if (t.dataset.tab === current) {
      window.scrollTo({ top: 0, behavior: reduceMotion() ? 'auto' : 'smooth' });
      return;
    }
    app.go(t.dataset.tab);
  });

  // Tastatur offen → Tableiste weg
  const isField = (el) =>
    !!el &&
    (el.tagName === 'TEXTAREA' ||
      el.tagName === 'SELECT' ||
      (el.tagName === 'INPUT' && !['checkbox', 'radio', 'file', 'button', 'submit', 'range'].includes(el.type)));
  document.addEventListener('focusin', (e) => {
    if (isField(e.target)) document.body.classList.add('kb-open');
  });
  document.addEventListener('focusout', () =>
    setTimeout(() => {
      if (!isField(document.activeElement)) document.body.classList.remove('kb-open');
    }, 80),
  );
  // Sichtbarer Bereich über der Tastatur – damit Sheets nicht dahinter verschwinden
  if (window.visualViewport) {
    const vv = window.visualViewport;
    const upd = () => {
      const kb = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      document.documentElement.style.setProperty('--kb', `${Math.round(kb)}px`);
      document.documentElement.style.setProperty('--vvh', `${Math.round(vv.height)}px`);
    };
    vv.addEventListener('resize', upd);
    vv.addEventListener('scroll', upd);
    upd();
  }

  let hiddenAt = 0;
  document.addEventListener('visibilitychange', () => {
    if (!S.settings) return;
    if (document.hidden) {
      flushWrites();
      stopDictation();
      hiddenAt = Date.now();
      if (S.settings.pinHash && S.settings.lockAfter === 0) showLock();
    } else {
      if (S.settings.pinHash && hiddenAt && Date.now() - hiddenAt >= S.settings.lockAfter * 1000) showLock();
      if (today() !== renderedDay && !topSheet()) app.refresh();
    }
  });
  window.addEventListener('pagehide', flushWrites);
}

/* ---------- Offline & Updates ---------- */
function registerSW() {
  if (IS_PREVIEW || !('serviceWorker' in navigator) || location.protocol === 'file:') return;
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker
    .register('./sw.js')
    .then((reg) => {
      reg.addEventListener('updatefound', () => {
        const w = reg.installing;
        w?.addEventListener('statechange', () => {
          if (w.state === 'installed' && navigator.serviceWorker.controller) {
            toast('Eine neue Version von Luna ist da', { action: 'Aktualisieren', ms: 12000, onAction: () => w.postMessage('skip') });
          }
        });
      });
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden) reg.update().catch(() => {});
      });
    })
    .catch((e) => console.warn('Service Worker:', e));
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || reloading) return;
    reloading = true;
    location.reload();
  });
}

async function boot() {
  shell();
  if (legacyBar()) document.documentElement.classList.add('legacy-bar');
  wire();
  hooks.onError = () => toast('Speichern hat nicht geklappt. Ist der Speicher deines iPhones voll?', { ms: 6000 });
  await loadAll();
  applySettings();
  buildTabs();
  if (IS_PREVIEW && !S.settings.demoLoaded && S.journal.size === 0) await loadDemo();
  if (S.settings.pinHash) showLock();
  app.go('today', { instant: true });
  if (!S.settings.onboarded && !IS_PREVIEW) showOnboarding();
  registerSW();
}

boot().catch((err) => {
  console.error(err);
  const box = document.createElement('div');
  box.style.cssText = 'position:fixed;inset:0;display:grid;place-items:center;padding:24px;text-align:center;color:#eef1fb;background:#070a13;font:16px system-ui';
  box.textContent = `Luna konnte nicht starten: ${err?.message || err}`;
  document.body.appendChild(box);
});
