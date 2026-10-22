// Luna · Schlaf: 24-Stunden-Zifferblatt, Kalender mit grünen/gelben/roten Nächten, Bilanz und Verlauf
import { S, saveSleep, deleteSleep, sleepHours, sleepStatus, latestSleep, avg, STATUS_LABEL, SLEEP_GOOD } from '../store.js';
import { icon, iconPath, facesHTML, LABELS, openSheet, confirmDialog } from '../ui.js';
import { barChart } from '../charts.js';
import {
  $,
  esc,
  today,
  fromISO,
  addDays,
  addMonths,
  firstOfMonth,
  datesBack,
  MONTHS,
  WD,
  relDay,
  fmtLong,
  fmtShort,
  fmtDayMonth,
  fmtDur,
  fmtHM,
  toMin,
  fromMin,
  pad,
  haptic,
  toast,
} from '../util.js';
import { act, app } from '../app.js';

let month = firstOfMonth(today());

/* ---------- Zifferblatt ---------- */
const C = 100;
const R = 78;
const SW = 16;
const pt = (m, r = R) => {
  const a = (((m / 1440) * 360 - 90) * Math.PI) / 180;
  return [C + r * Math.cos(a), C + r * Math.sin(a)];
};
const SUN = 'M12 8a4 4 0 1 0 0 8a4 4 0 1 0 0-8zM12 2.5v2M12 19.5v2M4.6 4.6 6 6M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4';
function endMarker([x, y], kind) {
  const d = kind === 'sun' ? SUN : iconPath('moon').match(/d="([^"]+)"/)[1];
  return `<g class="dial-end" transform="translate(${x.toFixed(1)} ${y.toFixed(1)})"><circle r="11"/><path transform="translate(-6.5 -6.5) scale(.54)" d="${d}" style="stroke-width:3.4"/></g>`;
}
export function dialSVG(bed, wake, status = null, still = false) {
  let s = `<svg class="dial ${status ? `st-${status}` : ''} ${still ? 'still' : ''}" viewBox="0 0 200 200" aria-hidden="true">`;
  s += `<circle class="dial-track" cx="${C}" cy="${C}" r="${R}" stroke-width="${SW}"/>`;
  for (let h = 0; h < 24; h++) {
    const major = h % 6 === 0;
    const [x1, y1] = pt(h * 60, R - SW / 2 - 6);
    const [x2, y2] = pt(h * 60, R - SW / 2 - (major ? 13 : 9));
    s += `<line class="dial-tick ${major ? 'major' : ''}" x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}"/>`;
  }
  [
    [0, '0'],
    [720, '12'],
  ].forEach(([m, l]) => {
    const [x, y] = pt(m, R - SW / 2 - 24);
    s += `<text class="dial-num" x="${x.toFixed(1)}" y="${(y + 4).toFixed(1)}" text-anchor="middle">${l}</text>`;
  });
  const b = toMin(bed);
  const w = toMin(wake);
  if (b != null && w != null) {
    const span = (w - b + 1440) % 1440;
    if (span) {
      const p1 = pt(b);
      const p2 = pt(w);
      s += `<path class="dial-arc" d="M${p1[0].toFixed(1)} ${p1[1].toFixed(1)}A${R} ${R} 0 ${span > 720 ? 1 : 0} 1 ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}" stroke-width="${SW}" pathLength="1"/>`;
      s += endMarker(p1, 'moon') + endMarker(p2, 'sun');
    }
  }
  return `${s}</svg>`;
}
function hmBig(h) {
  if (!h) return '–';
  const t = Math.round(h * 60);
  const mm = t % 60;
  return `${Math.floor(t / 60)}<small>h</small>${mm ? `${pad(mm)}<small>min</small>` : ''}`;
}

/* ---------- Ansicht ---------- */
export function render() {
  const t = today();
  return `
  <header class="vhead">
    <div class="vhead-text"><div class="eyebrow">Schlaf</div><h1 class="vtitle">Deine <em>Nächte</em></h1></div>
    <div class="head-actions"><button type="button" class="icon-btn" data-act="sleep-edit" data-date="${t}" aria-label="Schlaf eintragen">${icon('plus')}</button></div>
  </header>
  ${heroCard(t)}
  ${calCard()}
  ${monthCard()}
  ${chartCard()}`;
}
export function mount() {
  bindSwipe();
}

function heroCard(t) {
  const e = S.sleep.get(t);
  if (!e?.hours) {
    return `<section class="card sleep-hero">${dialSVG(null, null)}<div>
      <div class="eyebrow">Letzte Nacht</div>
      <h2 class="hero-title" style="font-size:23px;margin:6px 0 12px">Wie lange hast du <em>geschlafen?</em></h2>
      <button type="button" class="btn btn-primary btn-sm" data-act="sleep-edit" data-date="${t}">Eintragen</button></div></section>`;
  }
  const st = sleepStatus(e.hours);
  return `<button type="button" class="card sleep-hero st-${st}" data-act="sleep-edit" data-date="${t}" style="text-align:left;width:100%">
    ${dialSVG(e.bed, e.wake, st)}
    <div style="min-width:0"><div class="eyebrow">Letzte Nacht</div><div class="sleep-big" style="margin-top:6px">${hmBig(e.hours)}</div>
    <div class="status"><i class="sdot"></i>${STATUS_LABEL[st]}</div>
    <div class="sleep-times">${e.bed} ${icon('arrowR')} ${e.wake}</div></div>
  </button>`;
}

function sgridHTML() {
  const t = today();
  const first = fromISO(month);
  const offset = (first.getDay() + 6) % 7;
  const start = addDays(month, -offset);
  const dim = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const cells = Math.ceil((offset + dim) / 7) * 7;
  let html = `<div class="cal-wd">${['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map((w) => `<span>${w}</span>`).join('')}</div><div class="sgrid" id="sgrid">`;
  for (let i = 0; i < cells; i++) {
    const d = addDays(start, i);
    const other = d.slice(0, 7) !== month.slice(0, 7);
    const future = d > t;
    const e = S.sleep.get(d);
    const st = e?.hours ? sleepStatus(e.hours) : null;
    html += `<button type="button" class="sday ${other ? 'other' : ''} ${d === t ? 'today' : ''} ${future ? 'future' : ''}" data-act="sleep-edit" data-date="${d}" ${future ? 'disabled' : ''} aria-label="${fmtLong(d)}${e?.hours ? `: ${fmtDur(e.hours)}` : ''}">
      <span class="n">${fromISO(d).getDate()}</span><i class="sdot ${st ? `st-${st}` : 'none'}" style="--i:${i}"></i></button>`;
  }
  return `${html}</div>`;
}
function calCard() {
  const d = fromISO(month);
  const atNow = month >= firstOfMonth(today());
  return `<section class="card cal-card">
    <div class="card-h" style="padding:0 6px">
      <h2 class="card-t">${icon('calendar')} ${MONTHS[d.getMonth()]} ${d.getFullYear()}</h2>
      <div class="head-actions"><button type="button" class="icon-btn sm" data-act="sl-month" data-d="-1" aria-label="Vorheriger Monat">${icon('chevL')}</button><button type="button" class="icon-btn sm" data-act="sl-month" data-d="1" ${atNow ? 'disabled' : ''} aria-label="Nächster Monat">${icon('chevR')}</button></div>
    </div>
    ${sgridHTML()}
    <div class="legend"><span><i class="sdot st-good"></i>ab 8 h</span><span><i class="sdot st-ok"></i>7 bis 8 h</span><span><i class="sdot st-bad"></i>unter 7 h</span></div>
  </section>`;
}

function avgClock(times, night) {
  const ms = times.map(toMin).filter((m) => m != null).map((m) => (night && m < 720 ? m + 1440 : m));
  if (!ms.length) return '–';
  return fromMin(ms.reduce((a, b) => a + b, 0) / ms.length);
}
function monthCard() {
  const d = fromISO(month);
  const ym = month.slice(0, 7);
  const entries = [...S.sleep.values()].filter((e) => e.date.startsWith(ym) && e.hours);
  if (!entries.length) {
    return `<section class="card"><div class="card-h"><h2 class="card-t">Bilanz ${MONTHS[d.getMonth()]}</h2></div><p class="empty">Für diesen Monat sind noch keine Nächte eingetragen.</p></section>`;
  }
  const c = { good: 0, ok: 0, bad: 0 };
  entries.forEach((e) => c[sleepStatus(e.hours)]++);
  const avgH = avg(entries, (e) => e.hours);
  return `<section class="card">
    <div class="card-h"><h2 class="card-t">Bilanz ${MONTHS[d.getMonth()]}</h2><span class="faint small">${entries.length} ${entries.length === 1 ? 'Nacht' : 'Nächte'}</span></div>
    <div class="segbar">${['good', 'ok', 'bad']
      .filter((k) => c[k])
      .map((k) => `<i class="st-${k}" style="--f:${c[k]}"></i>`)
      .join('')}</div>
    <div class="segbar-legend"><span><i class="sdot st-good"></i>${c.good} grün</span><span><i class="sdot st-ok"></i>${c.ok} gelb</span><span><i class="sdot st-bad"></i>${c.bad} rot</span></div>
    <div class="sum-grid">
      <div class="sum"><b>${fmtHM(avgH)} h</b><span>Ø Schlaf</span></div>
      <div class="sum"><b>${avgClock(entries.map((e) => e.bed), true)}</b><span>Ø eingeschlafen</span></div>
      <div class="sum"><b>${avgClock(entries.map((e) => e.wake), false)}</b><span>Ø aufgewacht</span></div>
    </div>
  </section>`;
}

function chartCard() {
  const t = today();
  const days = datesBack(14);
  const items = days.map((d) => {
    const e = S.sleep.get(d);
    return {
      label: WD[fromISO(d).getDay()],
      value: e?.hours ?? null,
      cls: e?.hours ? `st-${sleepStatus(e.hours)}` : '',
      hl: d === t,
      title: e?.hours ? `${fmtShort(d)}: ${fmtDur(e.hours)}` : '',
    };
  });
  const max = Math.ceil(Math.max(10, ...items.map((i) => i.value || 0)));
  const last7 = datesBack(7)
    .map((d) => S.sleep.get(d))
    .filter((e) => e?.hours);
  const debt = last7.reduce((s, e) => s + Math.max(0, SLEEP_GOOD - e.hours), 0);
  let run = 0;
  let d = S.sleep.get(t)?.hours ? t : addDays(t, -1);
  while (sleepStatus(S.sleep.get(d)?.hours) === 'good') {
    run++;
    d = addDays(d, -1);
  }
  return `<section class="card">
    <div class="card-h"><h2 class="card-t">Letzte 14 Nächte</h2></div>
    ${barChart({ items, max, target: SLEEP_GOOD, targetLabel: 'Ziel 8 h' })}
    <div class="debt"><span>Schlafschuld der letzten 7 Tage</span><b>${last7.length ? (debt > 0.01 ? fmtDur(debt) : 'keine') : '–'}</b></div>
    <div class="debt" style="margin-top:0;border-top:0;padding-top:4px"><span>Grüne Nächte in Folge</span><b>${run}</b></div>
  </section>`;
}

function bindSwipe() {
  const g = $('#sgrid');
  if (!g) return;
  let x0 = null;
  let y0 = 0;
  g.addEventListener(
    'touchstart',
    (e) => {
      x0 = e.touches[0].clientX;
      y0 = e.touches[0].clientY;
    },
    { passive: true },
  );
  g.addEventListener(
    'touchend',
    (e) => {
      if (x0 == null) return;
      const dx = e.changedTouches[0].clientX - x0;
      const dy = e.changedTouches[0].clientY - y0;
      x0 = null;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) changeMonth(dx < 0 ? 1 : -1);
    },
    { passive: true },
  );
}
function changeMonth(dir) {
  const nm = addMonths(month, dir);
  if (nm > firstOfMonth(today())) return;
  month = nm;
  app.refresh();
  $('#sgrid')?.classList.add(dir > 0 ? 'slide-l' : 'slide-r');
  haptic();
}
act('sl-month', (el) => changeMonth(+el.dataset.d));

/* ---------- Eintragen ---------- */
function sheetBody(d) {
  const e = S.sleep.get(d);
  const last = latestSleep();
  const bed = e?.bed || last?.bed || '23:00';
  const wake = e?.wake || last?.wake || '07:00';
  const h = sleepHours(bed, wake);
  const st = sleepStatus(h);
  const v = S.journal.get(d)?.ratings?.schlaf || 0;
  const rel = relDay(d);
  return `<div class="sleep-edit">
    <div class="night-pick"><div class="eyebrow">Nacht auf</div><div class="night-pick-t">${esc(rel ? `${rel}, ${fmtDayMonth(d)}` : fmtLong(d))}</div>
      <input type="date" id="sl-date" value="${d}" max="${today()}" aria-label="Andere Nacht wählen"></div>
    <div class="dial-wrap" id="sl-dial">${dialSVG(bed, wake, st)}
      <div class="dial-center"><div class="sleep-big" id="sl-h">${hmBig(h)}</div><div class="status ${st ? `st-${st}` : ''}" id="sl-st">${st ? `<i class="sdot"></i>${STATUS_LABEL[st]}` : 'Zeiten prüfen'}</div></div>
    </div>
    <div class="time-pair">
      <label class="time-box" for="sl-bed"><span>${icon('moon')}Eingeschlafen</span><input type="time" id="sl-bed" value="${bed}"></label>
      <label class="time-box" for="sl-wake"><span>${icon('sun')}Aufgewacht</span><input type="time" id="sl-wake" value="${wake}"></label>
    </div>
    <div class="rate-block" data-rate="schlaf" data-empty="Freiwillig">
      <div class="rate-q">Wie erholt fühlst du dich?</div>
      ${facesHTML('schlaf', v, { date: d })}
      <div class="rate-label ${v ? `lv${v}` : ''}">${v ? LABELS.schlaf[v - 1] : 'Freiwillig'}</div>
    </div>
    <button type="button" class="btn btn-primary btn-lg btn-block" id="sl-save">${e ? 'Änderung speichern' : 'Speichern'}</button>
    ${e ? `<button type="button" class="btn btn-danger btn-block" id="sl-del">${icon('trash')} Eintrag löschen</button>` : ''}
  </div>`;
}

export function openSleepSheet(date = today()) {
  const sheet = openSheet({ title: 'Schlaf', cls: 'sleep-sheet', onClose: () => app.refresh() });
  let d = date > today() ? today() : date;
  const q = (s) => sheet.body.querySelector(s);
  const paint = () => {
    sheet.body.innerHTML = sheetBody(d);
    const upd = () => {
      const bed = q('#sl-bed').value;
      const wake = q('#sl-wake').value;
      const h = sleepHours(bed, wake);
      const st = sleepStatus(h);
      q('#sl-dial .dial').outerHTML = dialSVG(bed, wake, st, true);
      q('#sl-h').innerHTML = hmBig(h);
      const s = q('#sl-st');
      s.className = `status ${st ? `st-${st}` : ''}`;
      s.innerHTML = st ? `<i class="sdot"></i>${STATUS_LABEL[st]}` : 'Zeiten prüfen';
    };
    q('#sl-bed').addEventListener('input', upd);
    q('#sl-wake').addEventListener('input', upd);
    q('#sl-bed').addEventListener('change', upd);
    q('#sl-wake').addEventListener('change', upd);
    q('#sl-date').addEventListener('change', (e) => {
      if (e.target.value && e.target.value <= today()) {
        d = e.target.value;
        paint();
      }
    });
    q('#sl-save').addEventListener('click', () => {
      const bed = q('#sl-bed').value;
      const wake = q('#sl-wake').value;
      const h = sleepHours(bed, wake);
      if (!h) {
        toast('Einschlaf- und Aufwachzeit dürfen nicht gleich sein.');
        haptic('error');
        return;
      }
      saveSleep(d, bed, wake);
      const st = sleepStatus(h);
      haptic('success');
      sheet.close();
      toast(`${fmtDur(h)} · ${STATUS_LABEL[st]}`, { icon: `<i class="sdot st-${st}"></i>` });
    });
    q('#sl-del')?.addEventListener('click', async () => {
      const ok = await confirmDialog({ title: 'Eintrag löschen?', text: `Die Nacht auf ${fmtLong(d)} wird entfernt.`, ok: 'Löschen', danger: true });
      if (!ok) return;
      await deleteSleep(d);
      sheet.close();
      toast('Eintrag gelöscht');
    });
  };
  paint();
  return sheet;
}
act('sleep-edit', (el) => openSleepSheet(el.dataset.date || today()));
