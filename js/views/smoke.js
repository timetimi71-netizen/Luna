// Luna · Rauchfrei: Live-Zähler, Geld, Gesundheit, Erfolge, Notfall bei Lust, Ausrutscher und Plan zum Reduzieren
import { S, DEFAULTS, saveSmoke, deleteSmoke, saveSmokeSettings } from '../store.js';
import {
  sm,
  isSetUp,
  isVape,
  phase,
  stats,
  best,
  parts,
  fmtSpan,
  fmtLife,
  fmtMoney,
  unitWord,
  costPerDay,
  health,
  nextStep,
  badges,
  freshBadges,
  planLimit,
  smokedBefore,
  quitDate,
  cravingDays,
  triggerTop,
  peakHour,
  restart,
  upcomingSteps,
  KINDS,
  REASONS,
  TRIGGERS,
  reasonName,
  triggerName,
  LIFE_MIN,
} from '../smoke.js';
import { icon, openSheet, confirmDialog, segHTML, setSeg, confetti } from '../ui.js';
import { barChart } from '../charts.js';
import { esc, today, iso, fromISO, addDays, diffDays, WD, WD_LONG, fmtNum, fmtDayMonth, pad, clamp, haptic, toast, debounce } from '../util.js';
import { act, app } from '../app.js';
import { eventsToICS, openInCalendar } from '../ics.js';

let showAllHealth = false;

const TITLE = { none: 'Frei <em>atmen</em>', countdown: 'Bald <em>frei</em>', reduce: 'Schritt für <em>Schritt</em>', free: 'Frei <em>atmen</em>' };

export function render() {
  const ph = phase();
  return `
  <header class="vhead"><div class="vhead-text"><div class="eyebrow">Rauchfrei</div><h1 class="vtitle">${TITLE[ph]}</h1></div>${
    isSetUp() ? `<div class="head-actions"><button type="button" class="icon-btn" data-act="sm-setup" aria-label="Plan bearbeiten">${icon('sliders')}</button></div>` : ''
  }</header>
  ${ph === 'none' ? introHTML() : ph === 'countdown' ? countdownHTML() : ph === 'reduce' ? reduceHTML() : freeHTML()}`;
}

export function mount() {
  startTicker();
  setTimeout(celebrate, 700);
}

/* ---------- Noch nicht eingerichtet ---------- */
function introHTML() {
  return `<section class="card hero sm-intro">
    <div class="eyebrow">${icon('nosmoke')} Aufhören</div>
    <h2 class="hero-title">Bereit, mit dem Rauchen <em>aufzuhören?</em></h2>
    <p>Luna zählt jede rauchfreie Stunde, rechnet aus, wie viel Geld du sparst, und hilft dir, wenn die Lust kommt.</p>
    <button type="button" class="btn btn-primary btn-block" data-act="sm-setup">Plan erstellen ${icon('arrowR')}</button>
  </section>
  <section class="card sm-what">${[
    ['flame', 'Live-Zähler', 'Wie lange du schon rauchfrei bist, auf die Sekunde genau.'],
    ['coin', 'Gespartes Geld', 'Mit Sparziel, zum Beispiel neue Fußballschuhe.'],
    ['heart', 'Gesundheit', 'Was sich in deinem Körper gerade erholt.'],
    ['wind', 'Notfall-Knopf', 'Atemübung und Ablenkung, bis die Lust vorbei ist.'],
  ]
    .map(([ic, t, s]) => `<div class="sm-what-row"><span class="tip-ic">${icon(ic)}</span><div><b>${t}</b><p>${s}</p></div></div>`)
    .join('')}</section>`;
}

/* ---------- Rauchfrei ---------- */
function freeHTML() {
  const st = stats();
  return `${heroFree(st)}${sosRow()}${tilesHTML(st)}${goalCard(st)}${healthCard(st.ms)}${badgesCard(st)}${cravingCard()}${reasonsCard()}${footerHTML()}`;
}
function clockHTML(ms) {
  const p = parts(ms);
  return [
    [p.d, p.d === 1 ? 'Tag' : 'Tage'],
    [pad(p.h), 'Std'],
    [pad(p.m), 'Min'],
    [pad(p.s), 'Sek'],
  ]
    .map(([v, l]) => `<div><b>${v}</b><span>${l}</span></div>`)
    .join('');
}
const nextHTML = (nx) =>
  `<div class="sm-next-h"><span>Nächstes Ziel: <b>${nx.label}</b></span><span>noch ${fmtSpan(nx.left, true)}</span></div><div class="sm-bar"><i style="--w:${(nx.p * 100).toFixed(1)}%"></i></div>`;
const whenText = (ms) => {
  const q = new Date(ms);
  return `${WD[q.getDay()]} ${fmtDayMonth(iso(q))}, ${pad(q.getHours())}:${pad(q.getMinutes())} Uhr`;
};
function heroFree(st) {
  const nx = nextStep(st.ms);
  const rec = best();
  return `<section class="card sm-hero">
    <div class="eyebrow">${icon('nosmoke')} Rauchfrei seit</div>
    <div class="sm-clock" data-live="clock" role="timer">${clockHTML(st.ms)}</div>
    ${nx ? `<div class="sm-next" data-live="next">${nextHTML(nx)}</div>` : ''}
    <p class="sm-since">seit ${whenText(sm().quitAt)}${rec > st.ms + 60e3 ? ` · Rekord ${fmtSpan(rec, true)}` : ''}</p>
  </section>`;
}
function sosRow() {
  return `<div class="sm-actions">
    <button type="button" class="sos-btn" data-act="sm-sos"><span class="sos-ic">${icon('wind')}</span><span class="sos-t"><b>Lust auf eine?</b><small>Tippen und ein paar Minuten durchhalten</small></span>${icon('chevR')}</button>
    <button type="button" class="link sm-slip-link" data-act="sm-slip">Ich hab geraucht</button>
  </div>`;
}
function tilesHTML(st) {
  const stat = (ic, k, v, s, live = '') =>
    `<div class="stat"><span class="k">${icon(ic)} ${k}</span><span class="v"${live ? ` data-live="${live}"` : ''}>${v}</span><span class="s">${s}</span></div>`;
  const resisted = stat('wind', 'Lust besiegt', `${st.resisted}<small>×</small>`, slipText(st));
  if (isVape()) {
    return `<div class="tiles sm-tiles">
      ${stat('coin', 'Gespart', fmtMoney(st.saved), `${fmtMoney(costPerDay())} pro Tag`, 'money')}
      ${stat('coin', 'Pro Jahr', fmtMoney(costPerDay() * 365), 'bleiben dir übrig')}
      ${stat('flame', 'Rekord', fmtSpan(best(), true), 'längste Zeit ohne')}
      ${resisted}
    </div>`;
  }
  return `<div class="tiles sm-tiles">
    ${stat('coin', 'Gespart', fmtMoney(st.saved), `${fmtMoney(costPerDay())} pro Tag`, 'money')}
    ${stat('nosmoke', 'Nicht geraucht', fmtNum(st.avoided, 0), unitWord(st.avoided), 'avoided')}
    ${stat('clock', 'Lebenszeit', fmtLife(st.lifeMin), 'zurückgewonnen*')}
    ${resisted}
  </div>
  <p class="note sm-foot">* Schätzung: Jede Zigarette kostet im Schnitt etwa ${LIFE_MIN} Minuten Lebenszeit (University College London, 2025).</p>`;
}
export const slipText = (st) => (st.slipEvents ? `${st.slipEvents} Ausrutscher` : 'ohne Ausrutscher');
function goalCard(st) {
  const n = sm();
  if (!n.goalName || !n.goalPrice) {
    return `<button type="button" class="card sm-goal-cta" data-act="sm-setup">${icon('gift')}<span><b>Sparziel festlegen</b><small>Worauf sparst du? Zum Beispiel neue Fußballschuhe.</small></span>${icon('chevR')}</button>`;
  }
  const p = Math.min(1, st.saved / n.goalPrice);
  const left = n.goalPrice - st.saved;
  const days = left > 0 && costPerDay() > 0 ? Math.ceil(left / costPerDay()) : 0;
  return `<section class="card sm-goal ${p >= 1 ? 'done' : ''}">
    <div class="card-h"><h2 class="card-t">${icon('gift')} Sparziel</h2><span class="faint small">${Math.floor(p * 100)} %</span></div>
    <div class="sm-goal-name">${esc(n.goalName)}</div>
    <div class="sm-bar big"><i style="--w:${(p * 100).toFixed(1)}%"></i></div>
    <p class="note">${
      p >= 1
        ? `Geschafft! Du hast ${fmtMoney(st.saved)} gespart. Gönn es dir 🎉`
        : `${fmtMoney(st.saved)} von ${fmtMoney(n.goalPrice)} · ${days ? `noch etwa ${days} ${days === 1 ? 'Tag' : 'Tage'}` : 'bald geschafft'}`
    }</p>
  </section>`;
}
function healthCard(ms, preview = false) {
  const list = health();
  const doneN = list.filter((x) => ms >= x.at).length;
  const shown = preview ? list.slice(0, 5) : showAllHealth ? list : list.slice(Math.max(0, doneN - 2), doneN + 3);
  const item = (x) => {
    const done = !preview && ms >= x.at;
    const cur = !preview && !done && list[doneN] === x;
    const p = Math.min(1, ms / x.at);
    return `<div class="hl ${done ? 'done' : ''} ${cur ? 'cur' : ''}">
      <span class="hl-dot">${done ? icon('check') : ''}</span>
      <div class="hl-main"><div class="hl-h"><b>${x.t}</b>${preview ? '' : `<span>${done ? 'geschafft' : `${Math.floor(p * 100)} %`}</span>`}</div>
      <p>${x.text}</p>${!preview && !done ? `<div class="sm-bar"><i style="--w:${(p * 100).toFixed(1)}%"></i></div>` : ''}</div>
    </div>`;
  };
  return `<section class="card sm-health">
    <div class="card-h"><h2 class="card-t">${icon('heart')} ${preview ? 'Nach dem Rauchstopp' : 'Dein Körper'}</h2>${preview ? '' : `<span class="faint small">${doneN} von ${list.length}</span>`}</div>
    <div class="hl-list">${shown.map(item).join('')}</div>
    ${preview ? '' : `<button type="button" class="link" data-act="sm-health-all">${showAllHealth ? 'Weniger anzeigen' : 'Alle Meilensteine'}</button>`}
    <p class="note">Ungefähre Werte nach WHO und Krebsgesellschaften. Bei jedem läuft es etwas anders.</p>
  </section>`;
}
function badgesCard(st) {
  const list = badges(st);
  const got = list.filter((b) => b.ok).length;
  return `<section class="card">
    <div class="card-h"><h2 class="card-t">${icon('trophy')} Erfolge</h2><span class="faint small">${got} von ${list.length}</span></div>
    <div class="badges">${list
      .map((b) => `<div class="badge ${b.ok ? 'ok' : ''}"><span class="badge-ic">${icon(b.ok ? b.icon : 'lock')}</span><b>${esc(b.label)}</b><small>${b.sub}</small></div>`)
      .join('')}</div>
  </section>`;
}
function cravingCard() {
  const days = cravingDays(14);
  if (!days.some((d) => d.cravings || d.smoked)) return '';
  const t = today();
  const items = days.map((d) => ({
    value: d.cravings + d.smoked,
    label: WD[fromISO(d.date).getDay()],
    hl: d.date === t,
    cls: d.smoked ? 'st-bad' : 'st-good',
    title: `${fmtDayMonth(d.date)}: ${d.cravings}× Lust${d.smoked ? `, ${d.smoked} geraucht` : ''}`,
  }));
  const max = Math.max(4, ...items.map((i) => i.value));
  const a = days.slice(0, 7).reduce((s, d) => s + d.cravings, 0) / 7;
  const b = days.slice(7).reduce((s, d) => s + d.cravings, 0) / 7;
  const tops = triggerTop();
  const peak = peakHour();
  return `<section class="card">
    <div class="card-h"><h2 class="card-t">${icon('wind')} Lust</h2><span class="faint small">14 Tage</span></div>
    ${barChart({ items, max, height: 140 })}
    <div class="sm-legend"><span><i class="sdot st-good"></i>rauchfrei</span><span><i class="sdot st-bad"></i>geraucht</span></div>
    ${a || b ? `<div class="debt"><span>Ø Lust pro Tag</span><b>${fmtNum(a, 1)} <span class="faint" style="font-weight:500">→</span> ${fmtNum(b, 1)}</b></div>` : ''}
    ${tops.length ? `<div class="sub-h">Häufigste Auslöser</div><div class="chips">${tops.map(([id, n]) => `<span class="chip">${esc(triggerName(id))} <small>${n}×</small></span>`).join('')}</div>` : ''}
    ${peak ? `<p class="note" style="margin-top:10px">Die Lust kommt meistens zwischen ${peak.from} Uhr und ${peak.to === 24 ? 'Mitternacht' : `${peak.to} Uhr`}. Plan für diese Zeit etwas anderes ein.</p>` : ''}
  </section>`;
}
function reasonsCard() {
  const n = sm();
  const list = (n.reasons || []).map(reasonName);
  if (!list.length && !n.reasonText) return '';
  return `<section class="card sm-reasons">
    <div class="card-h"><h2 class="card-t">${icon('star')} Deine Gründe</h2><button type="button" class="link" data-act="sm-setup">Ändern</button></div>
    ${n.reasonText ? `<p class="sm-quote">„${esc(n.reasonText)}“</p>` : ''}
    ${list.length ? `<div class="chips">${list.map((r) => `<span class="chip on">${esc(r)}</span>`).join('')}</div>` : ''}
  </section>`;
}
function footerHTML() {
  return `<div class="sm-foot-actions">
    ${upcomingSteps().length ? `<button type="button" class="btn btn-soft btn-block" data-act="sm-cal">${icon('calendar')} Meilensteine in den iPhone-Kalender</button>` : ''}
    <button type="button" class="link" data-act="sm-restart">${icon('repeat')} Neu anfangen</button>
  </div>`;
}

/* ---------- Rauchstopp kommt noch ---------- */
const PREP = [
  ['weg', 'Zigaretten, Feuerzeuge und Aschenbecher wegwerfen'],
  ['kaugummi', 'Kaugummi, Pfefferminz oder Nüsse besorgen'],
  ['leute', 'Freunden sagen, dass du aufhörst'],
  ['plan', 'Überlegen, was du statt der Zigarette machst, zum Beispiel nach dem Essen kurz spazieren'],
  ['wasser', 'Eine Wasserflasche bereitstellen'],
];
function prepCard() {
  const done = new Set(sm().prep || []);
  return `<section class="card">
    <div class="card-h"><h2 class="card-t">${icon('check')} Vorbereitung</h2><span class="faint small">${done.size} von ${PREP.length}</span></div>
    <div class="checklist">${PREP.map(
      ([id, t]) =>
        `<button type="button" class="check-row ${done.has(id) ? 'on' : ''}" data-act="sm-prep" data-id="${id}" aria-pressed="${done.has(id)}"><span class="cbox">${icon('check')}</span><span>${t}</span></button>`,
    ).join('')}</div>
  </section>`;
}
function countdownHTML() {
  const n = sm();
  const q = new Date(n.quitAt);
  return `<section class="card sm-hero wait">
    <div class="eyebrow">${icon('flame')} Dein Rauchstopp</div>
    <div class="sm-count"><span>beginnt in</span><b data-live="countdown">${fmtSpan(n.quitAt - Date.now(), true)}</b></div>
    <p class="sm-since">${WD_LONG[q.getDay()]}, ${fmtDayMonth(iso(q))} um ${pad(q.getHours())}:${pad(q.getMinutes())} Uhr</p>
    <button type="button" class="btn btn-soft btn-block" data-act="sm-now">Lieber gleich jetzt starten</button>
  </section>
  ${prepCard()}${reasonsCard()}${healthCard(0, true)}`;
}

/* ---------- Plan zum Reduzieren ---------- */
const planSt = (smoked, limit) => (smoked <= limit ? 'good' : smoked <= limit + 2 ? 'ok' : 'bad');
function reduceHTML() {
  const t = today();
  const lim = planLimit(t) ?? sm().perDay;
  const smoked = smokedBefore(t);
  const st = planSt(smoked, lim);
  const daysLeft = diffDays(quitDate(), t);
  const tomorrow = planLimit(addDays(t, 1));
  const s = stats();
  return `<section class="card sm-hero plan">
    <div class="eyebrow">${icon('target')} Heute</div>
    <div class="sm-today st-${st}"><b>${smoked}</b><span>von höchstens ${lim}</span></div>
    <div class="sm-bar st-${st}"><i style="--w:${Math.min(100, (smoked / Math.max(1, lim)) * 100).toFixed(1)}%"></i></div>
    <p class="sm-since">${
      daysLeft <= 1 ? 'Morgen ist dein Rauchstopp. Ab dann gar nicht mehr.' : `Noch ${daysLeft} Tage bis zum Rauchstopp am ${fmtDayMonth(quitDate())}.${tomorrow ? ` Morgen höchstens ${tomorrow}.` : ''}`
    }</p>
    <div class="sm-row"><button type="button" class="btn btn-primary" data-act="sm-cig">${icon('plus')} Eine geraucht</button><button type="button" class="btn btn-soft" data-act="sm-sos">${icon('wind')} Lust</button></div>
  </section>
  ${planCard()}
  <div class="tiles sm-tiles">
    <div class="stat"><span class="k">${icon('coin')} Gespart</span><span class="v">${fmtMoney(s.saved)}</span><span class="s">seit Planstart</span></div>
    <div class="stat"><span class="k">${icon('nosmoke')} Weniger</span><span class="v">${fmtNum(s.avoided, 0)}</span><span class="s">${unitWord(s.avoided)} als früher</span></div>
  </div>
  ${prepCard()}${reasonsCard()}${healthCard(0, true)}`;
}
function planCard() {
  const n = sm();
  const t = today();
  const start = iso(new Date(n.planStart));
  const end = addDays(quitDate(), -1);
  // Höchstens 13 Tage zeigen, heute möglichst in der Mitte
  let from = start;
  if (diffDays(end, start) > 12) {
    from = addDays(t, -6) < start ? start : addDays(t, -6);
    if (diffDays(end, from) < 12) from = addDays(end, -12);
  }
  const days = [];
  for (let d = from; d <= end && days.length < 13; d = addDays(d, 1)) days.push(d);
  const top = Math.max(1, n.perDay);
  const col = (d) => {
    const lim = planLimit(d);
    const smoked = d <= t ? smokedBefore(d) : null;
    const st = smoked == null ? '' : `st-${planSt(smoked, lim)}`;
    return `<div class="pdx ${st} ${d === t ? 'is-today' : ''} ${d > t ? 'fut' : ''}" title="${fmtDayMonth(d)}: ${smoked ?? '–'} von ${lim}">
      <span class="pdx-col"><i class="pdx-lim" style="--h:${((lim / top) * 100).toFixed(1)}%"></i>${smoked != null ? `<i class="pdx-fill" style="--h:${Math.min(100, (smoked / top) * 100).toFixed(1)}%"></i>` : ''}</span>
      <b>${lim}</b><small>${d === t ? 'Heute' : WD[fromISO(d).getDay()]}</small></div>`;
  };
  return `<section class="card">
    <div class="card-h"><h2 class="card-t">Dein Plan</h2><span class="faint small">${n.perDay} → 0 pro Tag</span></div>
    <div class="plan-days">${days.map(col).join('')}<div class="pdx quit"><span class="pdx-col">${icon('flame')}</span><b>0</b><small>Stopp</small></div></div>
    <p class="note">Die Zahl ist dein Limit für den Tag. Graue Säule: erlaubt, farbige Säule: geraucht.</p>
  </section>`;
}

/* ---------- Live-Werte ---------- */
let ticker = null;
let lastPhase = null;
let ticks = 0;
function tick() {
  const els = document.querySelectorAll('[data-live]');
  if (!els.length) {
    clearInterval(ticker);
    ticker = null;
    return;
  }
  if (document.hidden || !isSetUp()) return;
  const now = Date.now();
  const ph = phase(now);
  // Rauchstopp erreicht: alles neu zeichnen
  if (ph !== lastPhase) {
    lastPhase = ph;
    if (['smoke', 'today'].includes(app.current())) app.refresh();
    return;
  }
  const q = sm().quitAt;
  let st = null;
  const S2 = () => (st ||= stats(now));
  els.forEach((el) => {
    const k = el.dataset.live;
    if (k === 'clock') el.innerHTML = clockHTML(now - q);
    else if (k === 'next') {
      const nx = nextStep(now - q);
      if (nx) el.innerHTML = nextHTML(nx);
    } else if (k === 'money') el.textContent = fmtMoney(S2().saved);
    else if (k === 'avoided') el.textContent = fmtNum(S2().avoided, 0);
    else if (k === 'countdown') el.textContent = fmtSpan(q - now, true);
    else if (k === 'span') el.textContent = fmtSpan(now - q, true);
  });
  if (++ticks % 30 === 0) celebrate();
}
export function startTicker() {
  lastPhase = phase();
  if (!ticker) ticker = setInterval(tick, 1000);
}
// Neu geschaffte Erfolge feiern
export function celebrate() {
  const fresh = freshBadges();
  if (!fresh.length) return;
  confetti();
  haptic('success');
  const last = fresh[fresh.length - 1];
  toast(fresh.length === 1 ? `Neuer Erfolg: ${last.label} ${last.sub}` : `${fresh.length} neue Erfolge, zuletzt ${last.label} ${last.sub}`, { icon: icon('trophy'), ms: 5000 });
  if (app.current() === 'smoke') app.refresh();
}

/* ---------- Lust: Notfall ---------- */
const SOS_TIPS = [
  'Trink ein großes Glas Wasser, langsam und in kleinen Schlucken.',
  'Mach 15 Kniebeugen oder lauf einmal die Treppe hoch.',
  'Kaugummi, Pfefferminz oder ein paar Nüsse beschäftigen Mund und Hände.',
  'Geh kurz an die frische Luft, aber nicht dahin, wo andere rauchen.',
  'Schreib jemandem, dass du gerade Lust hast. Allein das hilft schon.',
  'Putz dir die Zähne. Danach schmeckt eine Zigarette doppelt eklig.',
  'Denk an dein nächstes Spiel: mehr Puste in der zweiten Halbzeit.',
];
const BREATH = [
  [4000, 'Einatmen'],
  [4000, 'Halten'],
  [6000, 'Ausatmen'],
];
export function openSOS() {
  if (!isSetUp()) return openSetup();
  const n = sm();
  const st = { strength: 2, trigger: null, logged: false, t0: Date.now() };
  let timer = null;
  const log = (resisted) => {
    st.logged = true;
    return saveSmoke({ type: 'craving', resisted, strength: st.strength, trigger: st.trigger || undefined });
  };
  const sheet = openSheet({
    title: 'Durchhalten',
    cls: 'tall',
    onClose: () => {
      clearInterval(timer);
      // Ohne Antwort zu, aber eine Weile durchgehalten: zählt als besiegt
      if (!st.logged && Date.now() - st.t0 > 20000) {
        log(true);
        app.refresh();
      }
    },
  });
  const reasons = (n.reasons || []).map(reasonName);
  const s = stats();
  const goal = n.goalName && n.goalPrice ? `<div class="sos-goal">${icon('gift')}<span>${esc(n.goalName)}: <b>${fmtMoney(s.saved)}</b> von ${fmtMoney(n.goalPrice)}</span></div>` : '';
  sheet.body.innerHTML = `<div class="sos">
    <div class="breath"><i class="breath-ring"></i><i class="breath-ring r2"></i><div class="breath-core"><b id="sos-phase">Einatmen</b><span id="sos-time">3:00</span></div></div>
    <p class="sos-tip" id="sos-tip">Die Lust ist wie eine Welle. Sie wird stärker und ebbt dann wieder ab, meistens nach drei bis fünf Minuten.</p>
    ${reasons.length || n.reasonText ? '<div class="sub-h">Darum hörst du auf</div>' : ''}
    ${n.reasonText ? `<p class="sm-quote">„${esc(n.reasonText)}“</p>` : ''}
    ${reasons.length ? `<div class="chips">${reasons.map((r) => `<span class="chip on">${esc(r)}</span>`).join('')}</div>` : ''}
    ${goal}
    <div class="sub-h">Wie stark ist die Lust?</div>
    ${segHTML('sos-str', [
      ['1', 'Leicht'],
      ['2', 'Mittel'],
      ['3', 'Stark'],
    ], '2')}
    <div class="sub-h">Was hat sie ausgelöst?</div>
    <div class="chips" id="sos-trig">${TRIGGERS.map(([id, l]) => `<button type="button" class="chip" data-trig="${id}">${l}</button>`).join('')}</div>
    <button type="button" class="btn btn-primary btn-lg btn-block" id="sos-done">${icon('check')} Geschafft, die Lust ist weg</button>
    <button type="button" class="btn btn-ghost btn-block" id="sos-slip">${phase() === 'reduce' ? 'Ich hab eine geraucht' : 'Ich hab doch geraucht'}</button>
  </div>`;
  const q = (sel) => sheet.body.querySelector(sel);
  sheet.body.addEventListener('click', (e) => {
    const seg = e.target.closest('.seg button');
    if (seg) {
      setSeg(seg);
      st.strength = Number(seg.dataset.v);
      haptic();
      return;
    }
    const tr = e.target.closest('[data-trig]');
    if (tr) {
      st.trigger = st.trigger === tr.dataset.trig ? null : tr.dataset.trig;
      sheet.body.querySelectorAll('[data-trig]').forEach((c) => c.classList.toggle('on', c.dataset.trig === st.trigger));
      haptic();
    }
  });
  // Atmen: 4 Sekunden ein, 4 halten, 6 aus. Dazu drei Minuten Countdown und wechselnde Tipps.
  const cycle = BREATH.reduce((a, b) => a + b[0], 0);
  let lastTip = -1;
  const update = () => {
    const el = Date.now() - st.t0;
    let x = el % cycle;
    let label = BREATH[0][1];
    for (const [ms, l] of BREATH) {
      if (x < ms) {
        label = l;
        break;
      }
      x -= ms;
    }
    q('#sos-phase').textContent = label;
    const left = Math.max(0, 180 - Math.floor(el / 1000));
    q('#sos-time').textContent = left ? `${Math.floor(left / 60)}:${pad(left % 60)}` : 'Stark!';
    if (!left && !sheet.body.classList.contains('over')) {
      sheet.body.classList.add('over');
      q('#sos-tip').textContent = 'Drei Minuten geschafft. Die stärkste Welle ist meistens vorbei.';
      haptic('success');
    }
    const tipI = Math.floor(el / 20000) - 1;
    if (left && tipI >= 0 && tipI !== lastTip) {
      lastTip = tipI;
      q('#sos-tip').textContent = SOS_TIPS[tipI % SOS_TIPS.length];
    }
  };
  update();
  timer = setInterval(update, 250);
  q('#sos-done').addEventListener('click', () => {
    if (st.logged) return;
    log(true);
    sheet.close();
    haptic('success');
    confetti({ count: 90 });
    const n2 = stats().resisted;
    toast(n2 === 1 ? 'Stark! Die erste Lust ist besiegt.' : `Stark! Das war Lust Nummer ${n2}, die du besiegt hast.`, { icon: icon('check'), ms: 4000 });
    app.refresh();
    setTimeout(celebrate, 900);
  });
  q('#sos-slip').addEventListener('click', () => {
    if (st.logged) return;
    log(false);
    const trigger = st.trigger;
    sheet.close();
    setTimeout(() => openSlip({ trigger }), 250);
  });
}
act('sm-sos', () => openSOS());

/* ---------- Ausrutscher ---------- */
function addCig(trigger = null) {
  const e = saveSmoke({ type: 'cig', count: 1, trigger: trigger || undefined });
  const t = today();
  const lim = planLimit(t) ?? sm().perDay;
  const n = smokedBefore(t);
  haptic(n > lim ? 'error' : 'tap');
  toast(n > lim ? `${n} von ${lim}: über dem Limit. Bleib dran, morgen ist ein neuer Tag.` : `${n} von höchstens ${lim} heute`, {
    action: 'Rückgängig',
    ms: 4500,
    onAction: async () => {
      await deleteSmoke(e.id);
      app.refresh();
    },
  });
  app.refresh();
}
act('sm-cig', () => addCig());

export function openSlip({ trigger = null } = {}) {
  if (phase() === 'reduce') return addCig(trigger);
  if (phase() !== 'free') return;
  let cnt = 1;
  let trig = trigger;
  let mode = 'keep';
  const sheet = openSheet({
    title: 'Ausrutscher',
    body: `<div class="form">
      <p class="muted">Passiert. Ein Ausrutscher macht dich nicht wieder zum Raucher. Wichtig ist nicht die letzte Zigarette, sondern dass keine nächste kommt.</p>
      <div class="group"><div class="li"><span class="li-title li-main">Wie viele?</span>
        <div class="stepper"><button type="button" data-c="-1" aria-label="Weniger">${icon('minus')}</button><output id="sl-n">1</output><button type="button" data-c="1" aria-label="Mehr">${icon('plus')}</button></div></div></div>
      <div class="sub-h" style="margin-top:4px">Was war der Auslöser?</div>
      <div class="chips" id="sl-trig">${TRIGGERS.map(([id, l]) => `<button type="button" class="chip ${id === trig ? 'on' : ''}" data-trig="${id}">${l}</button>`).join('')}</div>
      <div class="opt-list" id="sl-mode">
        <button type="button" class="opt on" data-v="keep"><b>Weitermachen</b><span>Dein Zähler läuft weiter. Der Ausrutscher wird notiert und vom gesparten Geld abgezogen.</span></button>
        <button type="button" class="opt" data-v="reset"><b>Neu anfangen</b><span>Der Zähler startet ab jetzt neu. Gespartes Geld und dein Rekord bleiben.</span></button>
      </div>
      <button type="button" class="btn btn-primary btn-lg btn-block" id="sl-save">Speichern</button>
    </div>`,
  });
  const q = (s) => sheet.body.querySelector(s);
  sheet.body.addEventListener('click', (e) => {
    const c = e.target.closest('[data-c]');
    if (c) {
      cnt = clamp(cnt + Number(c.dataset.c), 1, 40);
      q('#sl-n').textContent = cnt;
      haptic();
      return;
    }
    const tr = e.target.closest('[data-trig]');
    if (tr) {
      trig = trig === tr.dataset.trig ? null : tr.dataset.trig;
      sheet.body.querySelectorAll('[data-trig]').forEach((x) => x.classList.toggle('on', x.dataset.trig === trig));
      haptic();
      return;
    }
    const o = e.target.closest('#sl-mode .opt');
    if (o) {
      mode = o.dataset.v;
      sheet.body.querySelectorAll('#sl-mode .opt').forEach((x) => x.classList.toggle('on', x === o));
      haptic();
    }
  });
  q('#sl-save').addEventListener('click', async () => {
    const at = Date.now();
    saveSmoke({ type: 'slip', at, count: cnt, trigger: trig || undefined });
    if (mode === 'reset') await restart(at + 1);
    sheet.close();
    haptic();
    toast(mode === 'reset' ? 'Neuer Start. Du schaffst das.' : 'Notiert. Weiter geht’s.', { icon: icon('heart'), ms: 3500 });
    app.refresh();
  });
}
act('sm-slip', () => openSlip());

/* ---------- Kleine Aktionen ---------- */
act('sm-health-all', () => {
  showAllHealth = !showAllHealth;
  haptic();
  app.refresh();
});
act('sm-prep', (el) => {
  const set = new Set(sm().prep || []);
  if (set.has(el.dataset.id)) set.delete(el.dataset.id);
  else set.add(el.dataset.id);
  saveSmokeSettings({ prep: [...set] });
  haptic();
  app.refresh();
});
act('sm-now', async () => {
  const ok = await confirmDialog({ title: 'Jetzt sofort starten?', text: 'Dein Zähler beginnt ab diesem Moment.', ok: 'Los geht’s' });
  if (!ok) return;
  await saveSmokeSettings({ quitAt: Date.now() });
  haptic('success');
  confetti({ count: 90 });
  app.refresh({ animate: true });
});
act('sm-restart', async () => {
  const ok = await confirmDialog({ title: 'Zähler neu starten?', text: 'Der Zähler beginnt ab jetzt neu. Gespartes Geld und dein Rekord bleiben.', ok: 'Neu anfangen' });
  if (!ok) return;
  await restart();
  haptic();
  toast('Neuer Start. Du schaffst das.', { icon: icon('heart') });
  app.refresh({ animate: true });
});
act('sm-cal', () => {
  const list = upcomingSteps().map(({ at, label }) => {
    const d = new Date(at);
    const start = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
    const e = new Date(at + 15 * 60e3);
    return {
      id: `luna-rauchfrei-${at}`,
      title: `🎉 ${label} rauchfrei`,
      date: iso(d),
      start,
      end: `${pad(e.getHours())}:${pad(e.getMinutes())}`,
      alarm: 'm0',
      notes: 'Öffne Luna und schau dir an, was du schon geschafft hast.',
    };
  });
  if (!list.length) return;
  openInCalendar(eventsToICS(list), 'luna-rauchfrei.ics');
});

/* ---------- Einrichten ---------- */
const QUICK_STOP = () => {
  const now = new Date();
  const out = [['now', 'Jetzt']];
  if (now.getHours() < 20) out.push(['tonight', 'Heute 21 Uhr']);
  out.push(['tomorrow', 'Morgen früh'], ['week', 'In 1 Woche']);
  return out;
};
const QUICK_REDUCE = [
  [7, 'In 1 Woche'],
  [14, 'In 2 Wochen'],
  [21, 'In 3 Wochen'],
  [28, 'In 4 Wochen'],
];
function setupHTML(d, qDate, qTime, first) {
  const cur = d.currency === 'EUR' ? '€' : 'CHF';
  return `<div class="form setup sm-setup ${d.kind === 'vape' ? 'is-vape' : ''} ${d.mode === 'reduce' && d.kind !== 'vape' ? 'is-reduce' : ''}">
    ${first ? '<p class="muted">Ein paar Angaben, dann rechnet Luna aus, was du sparst und wie lange du schon durchhältst. Alles bleibt auf deinem iPhone.</p>' : ''}
    <div class="group-label">Was rauchst du?</div>
    <div class="opt-list" id="sm-kind">${KINDS.map(([id, l, s]) => `<button type="button" class="opt ${d.kind === id ? 'on' : ''}" data-v="${id}"><b>${l}</b><span>${s}</span></button>`).join('')}</div>
    <div class="group">
      <label class="li cig-only" for="sm-perday"><span class="li-title">Wie viele am Tag?</span><span class="unit-in"><input class="num-in" id="sm-perday" type="number" inputmode="numeric" min="1" max="80" value="${d.perDay ?? ''}"><small>Stück</small></span></label>
      <label class="li cig-only" for="sm-price"><span class="li-title" id="sm-price-l">${d.kind === 'tabak' ? 'Preis pro Päckchen' : 'Preis pro Schachtel'}</span><span class="unit-in"><input class="num-in" id="sm-price" type="number" inputmode="decimal" step="0.05" min="0" value="${d.packPrice ?? ''}"><small class="cur">${cur}</small></span></label>
      <label class="li cig-only" for="sm-perpack"><span class="li-title" id="sm-perpack-l">${d.kind === 'tabak' ? 'Reicht für etwa' : 'Stück pro Schachtel'}</span><span class="unit-in"><input class="num-in" id="sm-perpack" type="number" inputmode="numeric" min="1" max="200" value="${d.perPack ?? ''}"><small>Stück</small></span></label>
      <label class="li vape-only" for="sm-week"><span class="li-title">Ausgaben pro Woche</span><span class="unit-in"><input class="num-in" id="sm-week" type="number" inputmode="decimal" min="0" value="${d.weekCost ?? ''}"><small class="cur">${cur}</small></span></label>
      <div class="li"><span class="li-title">Währung</span><div class="look-seg">${segHTML('sm-cur', [
        ['CHF', 'CHF'],
        ['EUR', '€'],
      ], d.currency, 'sm')}</div></div>
    </div>
    <div class="group-label cig-only">Wie willst du aufhören?</div>
    <div class="opt-list cig-only" id="sm-mode">
      <button type="button" class="opt ${d.mode !== 'reduce' ? 'on' : ''}" data-v="stop"><b>Schlusspunkt</b><span>Ab einem festen Zeitpunkt gar nicht mehr. Klappt laut Studien bei den meisten am besten.</span></button>
      <button type="button" class="opt ${d.mode === 'reduce' ? 'on' : ''}" data-v="reduce"><b>Erst reduzieren</b><span>Jeden Tag ein bisschen weniger, bis zum Rauchstopp in ein paar Wochen.</span></button>
    </div>
    <div class="group-label">Dein Rauchstopp</div>
    <div class="group">
      <label class="li" for="sm-date"><span class="li-title">Datum</span><input type="date" id="sm-date" value="${qDate}"></label>
      <label class="li stop-only" for="sm-time"><span class="li-title">Uhrzeit</span><input type="time" id="sm-time" value="${qTime}"></label>
    </div>
    <div class="chips sm-quick" id="sm-quick"></div>
    <p class="note" id="sm-when-note"></p>
    <div class="group-label">Warum willst du aufhören?</div>
    <div class="chips" id="sm-reasons">${REASONS.map(([id, l]) => `<button type="button" class="chip ${(d.reasons || []).includes(id) ? 'on' : ''}" data-r="${id}">${l}</button>`).join('')}</div>
    <div class="group" style="margin-top:10px"><div class="li"><input class="li-input" id="sm-reason-text" maxlength="120" placeholder="Eigener Grund (optional)" value="${esc(d.reasonText)}"></div></div>
    <div class="group-label">Sparziel (optional)</div>
    <div class="group">
      <div class="li"><input class="li-input" id="sm-goal-name" maxlength="40" placeholder="z. B. Neue Fußballschuhe" value="${esc(d.goalName)}"></div>
      <label class="li" for="sm-goal-price"><span class="li-title">Kostet</span><span class="unit-in"><input class="num-in" id="sm-goal-price" type="number" inputmode="decimal" min="0" value="${d.goalPrice ?? ''}"><small class="cur">${cur}</small></span></label>
    </div>
    <div class="calc" id="sm-calc"></div>
    <button type="button" class="btn btn-primary btn-lg btn-block" id="sm-save">${first ? 'Los geht’s' : 'Speichern'}</button>
    ${first ? '' : '<button type="button" class="btn btn-danger btn-block" id="sm-reset">Rauchfrei zurücksetzen</button>'}
  </div>`;
}
const num = (v) => {
  const n = parseFloat(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};
function atOf(date, time) {
  const d = fromISO(date);
  const [h, m] = (time || '00:00').split(':').map(Number);
  d.setHours(h || 0, m || 0, 0, 0);
  return d.getTime();
}

export function openSetup({ onDone = null } = {}) {
  const cur = sm();
  // Ein Plan aus den Beispieldaten zählt nicht: dann wie beim ersten Mal, ohne Beispielwerte
  const fromDemo = !!cur.demo;
  const first = !cur.setup || fromDemo;
  const base = fromDemo ? { ...DEFAULTS.smoke } : cur;
  const d = { ...base, reasons: [...(base.reasons || [])] };
  const now = new Date();
  let qDate = today();
  let qTime = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  if (!first && cur.quitAt) {
    const q = new Date(cur.quitAt);
    qDate = iso(q);
    qTime = `${pad(q.getHours())}:${pad(q.getMinutes())}`;
  }
  const sheet = openSheet({ title: first ? 'Rauchfrei werden' : 'Dein Plan', cls: 'tall', body: setupHTML(d, qDate, qTime, first) });
  const q = (s) => sheet.body.querySelector(s);
  const root = q('.sm-setup');
  const vape = () => d.kind === 'vape';
  const reduce = () => d.mode === 'reduce' && !vape();
  const read = () => {
    d.perDay = num(q('#sm-perday').value);
    d.packPrice = num(q('#sm-price').value);
    d.perPack = num(q('#sm-perpack').value);
    d.weekCost = num(q('#sm-week').value);
    d.reasonText = q('#sm-reason-text').value.trim();
    d.goalName = q('#sm-goal-name').value.trim();
    d.goalPrice = num(q('#sm-goal-price').value);
    d.quitAt = atOf(q('#sm-date').value || today(), reduce() ? '00:00' : q('#sm-time').value);
    // Unverändert gelassen: gespeicherten Zeitpunkt behalten. „Jetzt“ ist sekundengenau, nicht der Anfang der Minute.
    const now2 = Date.now();
    if (!first && cur.quitAt && Math.floor(d.quitAt / 60e3) === Math.floor(cur.quitAt / 60e3)) d.quitAt = cur.quitAt;
    else if (!reduce() && d.quitAt <= now2 && now2 - d.quitAt < 60e3) d.quitAt = now2;
  };
  const quick = () => {
    const list = reduce() ? QUICK_REDUCE : QUICK_STOP();
    q('#sm-quick').innerHTML = list.map(([v, l]) => `<button type="button" class="chip" data-q="${v}">${l}</button>`).join('');
  };
  const daily = () => (vape() ? (d.weekCost || 0) / 7 : (d.perDay || 0) * ((d.packPrice || 0) / Math.max(1, d.perPack || 20)));
  const money = (v) => `${fmtNum(v, v >= 1000 ? 0 : 2)} ${d.currency === 'EUR' ? '€' : 'CHF'}`;
  const calc = () => {
    read();
    const t = Date.now();
    let note = '';
    if (reduce() && !first && cur.mode === 'reduce' && d.quitAt === cur.quitAt && d.quitAt <= t) {
      note = 'Dein Plan ist geschafft. Seit dem Rauchstopp zählt Luna deine rauchfreie Zeit.';
    } else if (reduce()) {
      const days = diffDays(iso(new Date(d.quitAt)), today());
      note = days >= 2 ? `Dein Tageslimit sinkt in ${days} Tagen von ${d.perDay || '?'} auf 1. Ab dem ${fmtDayMonth(iso(new Date(d.quitAt)))} dann gar nicht mehr.` : 'Für einen Plan muss der Rauchstopp mindestens zwei Tage in der Zukunft liegen.';
    } else if (d.quitAt <= t) {
      note = d.quitAt < t - 36e5 ? 'Du hast schon aufgehört? Stark! Luna rechnet ab diesem Zeitpunkt.' : 'Dein Zähler startet sofort.';
    } else {
      note = 'Bis dahin kannst du dich vorbereiten. Luna zählt die Zeit bis zum Start.';
    }
    q('#sm-when-note').textContent = note;
    const day = daily();
    const goalDays = d.goalPrice && day > 0 ? Math.ceil(d.goalPrice / day) : null;
    q('#sm-calc').innerHTML =
      day > 0
        ? `<div class="calc-grid"><div><b>${money(day)}</b><span>pro Tag</span></div><div><b>${money(day * 30.4)}</b><span>pro Monat</span></div><div><b>${money(day * 365)}</b><span>pro Jahr</span></div></div>${
            goalDays ? `<p class="note" style="margin-top:8px">Dein Sparziel hast du nach etwa ${goalDays} ${goalDays === 1 ? 'Tag' : 'Tagen'} rauchfrei zusammen.</p>` : ''
          }`
        : '';
  };
  const layout = () => {
    root.classList.toggle('is-vape', vape());
    root.classList.toggle('is-reduce', reduce());
    q('#sm-price-l').textContent = d.kind === 'tabak' ? 'Preis pro Päckchen' : 'Preis pro Schachtel';
    q('#sm-perpack-l').textContent = d.kind === 'tabak' ? 'Reicht für etwa' : 'Stück pro Schachtel';
    quick();
    calc();
  };
  sheet.body.addEventListener('input', debounce(calc, 150));
  sheet.body.addEventListener('change', calc);
  sheet.body.addEventListener('click', (e) => {
    const kind = e.target.closest('#sm-kind .opt');
    const mode = e.target.closest('#sm-mode .opt');
    const opt = kind || mode;
    if (opt) {
      opt.parentElement.querySelectorAll('.opt').forEach((o) => o.classList.toggle('on', o === opt));
      if (kind) {
        d.kind = kind.dataset.v;
        // Typische Werte beim Wechsel vorschlagen, solange noch nichts Eigenes drinsteht
        if (d.kind === 'tabak' && num(q('#sm-perpack').value) === 20) q('#sm-perpack').value = 40;
        if (d.kind === 'zigaretten' && num(q('#sm-perpack').value) === 40) q('#sm-perpack').value = 20;
      } else {
        d.mode = mode.dataset.v;
        if (d.mode === 'reduce' && q('#sm-date').value <= addDays(today(), 1)) q('#sm-date').value = addDays(today(), 14);
        if (d.mode === 'stop' && first) {
          q('#sm-date').value = today();
          q('#sm-time').value = `${pad(new Date().getHours())}:${pad(new Date().getMinutes())}`;
        }
      }
      haptic();
      layout();
      return;
    }
    const seg = e.target.closest('.seg button');
    if (seg) {
      setSeg(seg);
      d.currency = seg.dataset.v;
      sheet.body.querySelectorAll('.cur').forEach((c) => (c.textContent = d.currency === 'EUR' ? '€' : 'CHF'));
      haptic();
      calc();
      return;
    }
    const r = e.target.closest('[data-r]');
    if (r) {
      const set = new Set(d.reasons);
      if (set.has(r.dataset.r)) set.delete(r.dataset.r);
      else set.add(r.dataset.r);
      d.reasons = REASONS.map((x) => x[0]).filter((id) => set.has(id));
      r.classList.toggle('on', set.has(r.dataset.r));
      haptic();
      return;
    }
    const qk = e.target.closest('[data-q]');
    if (qk) {
      const v = qk.dataset.q;
      const n2 = new Date();
      if (reduce()) q('#sm-date').value = addDays(today(), Number(v));
      else if (v === 'now') {
        q('#sm-date').value = today();
        q('#sm-time').value = `${pad(n2.getHours())}:${pad(n2.getMinutes())}`;
      } else if (v === 'tonight') {
        q('#sm-date').value = today();
        q('#sm-time').value = '21:00';
      } else {
        q('#sm-date').value = addDays(today(), v === 'week' ? 7 : 1);
        q('#sm-time').value = '08:00';
      }
      sheet.body.querySelectorAll('[data-q]').forEach((c) => c.classList.toggle('on', c === qk));
      haptic();
      calc();
    }
  });
  const shake = (sel, msg) => {
    const el = q(sel);
    el.classList.remove('shake');
    void el.offsetWidth;
    el.classList.add('shake');
    el.focus?.();
    haptic('error');
    toast(msg);
  };
  q('#sm-save').addEventListener('click', async () => {
    read();
    const t = Date.now();
    if (!vape()) {
      if (!d.perDay || d.perDay < 1 || d.perDay > 80) return shake('#sm-perday', 'Wie viele rauchst du ungefähr am Tag?');
      if (d.packPrice == null || d.packPrice < 0 || d.packPrice > 300) return shake('#sm-price', 'Bitte prüf den Preis.');
      if (!d.perPack || d.perPack < 1 || d.perPack > 200) return shake('#sm-perpack', 'Wie viele Zigaretten sind in einer Packung?');
    } else if (d.weekCost == null || d.weekCost < 0 || d.weekCost > 1000) return shake('#sm-week', 'Wie viel gibst du ungefähr pro Woche aus?');
    if (!q('#sm-date').value || !Number.isFinite(d.quitAt)) return shake('#sm-date', 'Wann ist dein Rauchstopp?');
    // Nur prüfen, wenn ein Plan neu entsteht oder sein Datum geändert wird
    const planChanged = first || cur.mode !== 'reduce' || d.quitAt !== cur.quitAt;
    if (reduce() && planChanged && diffDays(iso(new Date(d.quitAt)), today()) < 2) return shake('#sm-date', 'Für den Plan muss der Rauchstopp mindestens zwei Tage in der Zukunft liegen.');
    if (d.quitAt > t + 90 * 864e5 && d.quitAt !== cur.quitAt) return shake('#sm-date', 'Such dir einen Rauchstopp in den nächsten Wochen aus.');
    if (d.quitAt < t - 20 * 365 * 864e5) return shake('#sm-date', 'Bitte prüf das Datum.');
    if (d.goalPrice != null && (d.goalPrice < 0 || d.goalPrice > 100000)) return shake('#sm-goal-price', 'Bitte prüf den Preis für dein Sparziel.');
    const mode = reduce() ? 'reduce' : 'stop';
    let planStart = null;
    let planEnd = null;
    let planTarget = null;
    if (mode === 'reduce') {
      // Gleicher Plan, nur angepasst: Start bleibt
      const same = !fromDemo && cur.mode === 'reduce' && cur.planStart && !cur.planEnd && cur.planStart < d.quitAt;
      planStart = same ? cur.planStart : t;
    } else if (!fromDemo && cur.planStart) {
      // Plan beendet (oder war schon vorbei): bleibt als Geschichte mit Ersparnis und Kalendertagen
      planStart = cur.planStart;
      planEnd = cur.planEnd ?? Math.min(cur.quitAt, t, d.quitAt);
      planTarget = cur.planTarget ?? cur.quitAt;
    }
    const patch = {
      setup: true,
      demo: false,
      kind: d.kind,
      perDay: vape() ? cur.perDay : Math.round(d.perDay),
      packPrice: vape() ? cur.packPrice : d.packPrice,
      perPack: vape() ? cur.perPack : Math.round(d.perPack),
      weekCost: vape() ? d.weekCost : cur.weekCost,
      currency: d.currency,
      mode,
      quitAt: d.quitAt,
      planStart,
      planEnd,
      planTarget,
      reasons: d.reasons,
      reasonText: d.reasonText,
      goalName: d.goalName,
      goalPrice: d.goalName && d.goalPrice ? d.goalPrice : null,
    };
    const changed = !first && cur.quitAt !== d.quitAt;
    if (fromDemo) {
      Object.assign(patch, { attempts: [], seen: [], prep: [] });
      await Promise.all([...S.smoke.values()].filter((e) => e.demo).map((e) => deleteSmoke(e.id)));
    }
    await saveSmokeSettings(patch);
    // Beim Korrigieren des Datums nicht alle Erfolge auf einmal feiern
    if (changed) await saveSmokeSettings({ seen: badges().filter((b) => b.ok).map((b) => b.id) });
    sheet.close();
    haptic('success');
    if (first && d.quitAt <= t) confetti({ count: 120 });
    toast(
      first ? (mode === 'reduce' ? 'Dein Plan steht. Schritt für Schritt.' : d.quitAt <= t ? 'Los geht’s! Der Zähler läuft.' : 'Dein Rauchstopp steht fest.') : 'Gespeichert',
      { icon: icon('check') },
    );
    onDone?.();
    if (app.current() === 'smoke') app.refresh({ animate: true });
    else app.go('smoke');
  });
  q('#sm-reset')?.addEventListener('click', async () => {
    const ok = await confirmDialog({
      title: 'Rauchfrei zurücksetzen?',
      text: 'Plan, Zähler und alle Einträge zu Lust und Ausrutschern werden gelöscht.',
      ok: 'Zurücksetzen',
      danger: true,
    });
    if (!ok) return;
    await Promise.all([...S.smoke.keys()].map((id) => deleteSmoke(id)));
    await saveSmokeSettings({ ...DEFAULTS.smoke });
    sheet.close();
    onDone?.();
    toast('Rauchfrei zurückgesetzt');
    app.refresh({ animate: true });
  });
  layout();
}
act('sm-setup', () => openSetup());

/* ---------- Karte für „Heute“ ---------- */
export function todayCard() {
  const ph = phase();
  if (ph === 'none') return '';
  if (ph === 'countdown') {
    return `<button type="button" class="card sm-today-card" data-act="go" data-to="smoke"><span class="smt-ic">${icon('flame')}</span>
      <span class="smt-main"><span class="eyebrow">Rauchstopp</span><b>in <span data-live="countdown">${fmtSpan(sm().quitAt - Date.now(), true)}</span></b></span>${icon('chevR')}</button>`;
  }
  if (ph === 'reduce') {
    const t = today();
    const lim = planLimit(t) ?? sm().perDay;
    const n = smokedBefore(t);
    return `<section class="card sm-today-card">
      <button type="button" class="smt-ic st-${planSt(n, lim)}" data-act="go" data-to="smoke" aria-label="Rauchfrei öffnen">${icon('nosmoke')}</button>
      <button type="button" class="smt-main" data-act="go" data-to="smoke"><span class="eyebrow">Plan · noch ${diffDays(quitDate(), t)} ${diffDays(quitDate(), t) === 1 ? 'Tag' : 'Tage'}</span><b>${n} von höchstens ${lim}</b><span class="smt-sub">${unitWord(lim)} heute</span></button>
      <button type="button" class="smt-sos" data-act="sm-cig" aria-label="Eine geraucht eintragen">${icon('plus')}</button>
    </section>`;
  }
  const st = stats();
  return `<section class="card sm-today-card">
    <button type="button" class="smt-ic" data-act="go" data-to="smoke" aria-label="Rauchfrei öffnen">${icon('nosmoke')}</button>
    <button type="button" class="smt-main" data-act="go" data-to="smoke"><span class="eyebrow">Rauchfrei</span><b data-live="span">${fmtSpan(st.ms, true)}</b><span class="smt-sub"><span data-live="money">${fmtMoney(st.saved)}</span> gespart${isVape() ? '' : ` · ${fmtNum(st.avoided, 0)} nicht geraucht`}</span></button>
    <button type="button" class="smt-sos" data-act="sm-sos" aria-label="Lust auf eine Zigarette: Hilfe">${icon('wind')}<small>Lust?</small></button>
  </section>`;
}
