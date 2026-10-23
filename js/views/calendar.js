// Luna · Kalender: Monatsansicht, Tagesliste, Termin-Formular und Übergabe an den iPhone-Kalender
import { S, eventsOn, saveEvent, deleteEvent, sleepStatus, smokeOn } from '../store.js';
import { icon, face, openSheet, closeSheet, confirmDialog, evColor, EV_COLORS, switchHTML } from '../ui.js';
import {
  $,
  esc,
  today,
  fromISO,
  addDays,
  addMonths,
  firstOfMonth,
  MONTHS,
  WD,
  WD_LONG,
  relDay,
  fmtDayMonth,
  fmtLong,
  fmtDur,
  toMin,
  addMin,
  pad,
  haptic,
  toast,
  IS_PREVIEW,
} from '../util.js';
import { act, app } from '../app.js';
import { progress, kcalStatus, totals, fmtKcal, KCAL_LABEL } from '../nutrition.js';
import { dayStatus, tabOn as smokeTabOn, unitWord } from '../smoke.js';
import { REPEATS, ALARMS_TIMED, ALARMS_ALLDAY, eventToICS, openInCalendar, shareICS, icsName, alarmPhrase } from '../ics.js';

let month = firstOfMonth(today());
let sel = today();

export function enter(opts = {}) {
  if (opts.date) {
    sel = opts.date;
    month = firstOfMonth(opts.date);
  }
}

export function render() {
  return `
  <header class="vhead">
    <div class="vhead-text"><div class="eyebrow">Kalender</div><h1 class="vtitle" id="cal-title">${titleHTML()}</h1></div>
    <div class="head-actions">
      <button type="button" class="icon-btn" data-act="cal-month" data-d="-1" aria-label="Vorheriger Monat">${icon('chevL')}</button>
      <button type="button" class="icon-btn" data-act="cal-month" data-d="1" aria-label="Nächster Monat">${icon('chevR')}</button>
    </div>
  </header>
  <section class="card cal-card" id="cal-card">${gridHTML()}</section>
  <section class="day-panel" id="day-panel">${dayPanel()}</section>`;
}

export function mount() {
  bindSwipe();
}

function titleHTML() {
  const d = fromISO(month);
  return `${MONTHS[d.getMonth()]} <em>${d.getFullYear()}</em>`;
}

function gridHTML() {
  const t = today();
  const first = fromISO(month);
  const offset = (first.getDay() + 6) % 7;
  const start = addDays(month, -offset);
  const dim = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const cells = Math.ceil((offset + dim) / 7) * 7;
  let html = `<div class="cal-wd">${['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map((w) => `<span>${w}</span>`).join('')}</div><div class="cal-grid" id="cal-grid">`;
  for (let i = 0; i < cells; i++) {
    const d = addDays(start, i);
    const other = d.slice(0, 7) !== month.slice(0, 7);
    const evs = eventsOn(d);
    const mood = S.journal.get(d)?.ratings?.tag;
    const sl = S.sleep.get(d);
    const kp = S.settings.tabs?.food !== false ? progress(d) : null;
    html += `<button type="button" class="day ${other ? 'other' : ''} ${d === t ? 'today' : ''} ${d === sel ? 'sel' : ''}" data-act="cal-day" data-date="${d}" aria-label="${fmtLong(d)}${evs.length ? `, ${evs.length} ${evs.length > 1 ? 'Termine' : 'Termin'}` : ''}">
      <span class="n">${kp != null ? `<i class="kr st-${kcalStatus(kp)}" style="--p:${Math.min(100, Math.round(kp * 100))}"></i>` : ''}${fromISO(d).getDate()}${sl?.hours ? `<i class="sl st-${sleepStatus(sl.hours)}"></i>` : ''}</span>
      <span class="dots">${evs
        .slice(0, 3)
        .map((ev) => `<i style="--c:${evColor(ev)}"></i>`)
        .join('')}</span>${mood ? `<span class="mood lv${mood}"></span>` : ''}</button>`;
  }
  html += `</div><div class="legend"><span><i class="lg-dot"></i>Termin</span><span><i class="lg-bar"></i>Stimmung</span><span><i class="lg-sl"></i>Schlaf</span>${S.settings.tabs?.food !== false ? '<span><i class="lg-kr"></i>Kalorien</span>' : ''}</div>`;
  return html;
}

export function agendaItem(ev, date, showDay = false) {
  const d = fromISO(date);
  const dayLabel = relDay(date) === 'Morgen' ? 'Morgen' : `${WD[d.getDay()]} ${d.getDate()}.`;
  const time = showDay
    ? `${esc(dayLabel)}<small>${ev.allDay ? 'ganztägig' : ev.start}</small>`
    : ev.allDay
      ? 'ganztägig'
      : `${ev.start}<small>${ev.end || ''}</small>`;
  return `<button type="button" class="agenda-item" data-act="event-edit" data-id="${ev.id}" data-date="${date}">
    <div class="ag-time ${ev.allDay && !showDay ? 'allday' : ''}">${time}</div>
    <i class="ag-dot" style="--c:${evColor(ev)}"></i>
    <div class="ag-main"><div class="ag-title">${esc(ev.title)}</div>${ev.location ? `<div class="ag-sub">${icon('pin')}${esc(ev.location)}</div>` : ''}</div>
    <div class="ag-end">${ev.repeat && ev.repeat !== 'none' ? icon('repeat') : ''}${ev.alarm && ev.alarm !== 'none' ? icon('bell') : ''}</div>
  </button>`;
}

function dayPanel() {
  const evs = eventsOn(sel);
  const j = S.journal.get(sel);
  const sl = S.sleep.get(sel);
  const rel = relDay(sel);
  const d = fromISO(sel);
  const title = `${rel || WD_LONG[d.getDay()]}, <em>${fmtDayMonth(sel)}</em>`;
  const extra = [];
  if (j && (j.done || j.ratings?.tag)) {
    extra.push(`<button type="button" class="pill" data-act="go" data-to="journal" data-date="${sel}">${face(j.ratings?.tag || 0)}Journal${j.done ? '' : ' (offen)'}</button>`);
  }
  if (sl?.hours) {
    extra.push(`<button type="button" class="pill st-${sleepStatus(sl.hours)}" data-act="sleep-edit" data-date="${sel}"><i class="sdot"></i>${fmtDur(sl.hours)} geschlafen</button>`);
  }
  const kp = S.settings.tabs?.food !== false ? progress(sel) : null;
  if (kp != null) {
    const st = kcalStatus(kp);
    extra.push(`<button type="button" class="pill st-${st}" data-act="go" data-to="food" data-date="${sel}" aria-label="${KCAL_LABEL[st]}"><i class="sdot"></i>${fmtKcal(totals(sel).kcal)} kcal gegessen</button>`);
  }
  const ds = smokeTabOn() ? dayStatus(sel) : null;
  if (ds) {
    const won = smokeOn(sel).filter((e) => e.type === 'craving' && e.resisted !== false).length;
    const label =
      ds.kind === 'plan' ? `${ds.smoked} von ${ds.limit} ${unitWord(ds.limit)}` : ds.smoked ? `${ds.smoked} ${unitWord(ds.smoked)} geraucht` : sel === today() ? 'Bisher rauchfrei' : 'Rauchfrei';
    extra.push(`<button type="button" class="pill st-${ds.st}" data-act="go" data-to="smoke"><i class="sdot"></i>${label}${won ? ` · ${won}× Lust besiegt` : ''}</button>`);
  }
  return `<div class="dp-head"><h2 class="dp-title">${title}</h2><div class="dp-actions">${
    sel !== today() || month !== firstOfMonth(today()) ? '<button type="button" class="today-pill" data-act="cal-today">Heute</button>' : ''
  }<button type="button" class="btn btn-primary btn-sm" data-act="event-new" data-date="${sel}" aria-label="Neuer Termin">${icon('plus')} Termin</button></div></div>
  ${
    evs.length
      ? `<div class="agenda">${evs.map((ev) => agendaItem(ev, sel)).join('')}</div>`
      : `<button type="button" class="card empty-add" data-act="event-new" data-date="${sel}">${icon('plus')} Termin hinzufügen</button>`
  }
  ${extra.length ? `<div class="dp-extra">${extra.join('')}</div>` : ''}`;
}

function paintPanel() {
  const p = $('#day-panel');
  if (!p) return;
  p.innerHTML = dayPanel();
  p.classList.remove('fade');
  void p.offsetWidth;
  p.classList.add('fade');
}
function changeMonth(dir, target) {
  month = target || addMonths(month, dir);
  const title = $('#cal-title');
  const card = $('#cal-card');
  if (!title || !card) return;
  title.innerHTML = titleHTML();
  card.innerHTML = gridHTML();
  $('#cal-grid').classList.add(dir > 0 ? 'slide-l' : 'slide-r');
  bindSwipe();
  const pill = $('#day-panel .today-pill');
  const wantPill = sel !== today() || month !== firstOfMonth(today());
  if (!!pill !== wantPill) paintPanel();
}
function bindSwipe() {
  const g = $('#cal-grid');
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
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) {
        changeMonth(dx < 0 ? 1 : -1);
        haptic();
      }
    },
    { passive: true },
  );
}

act('cal-month', (el) => {
  changeMonth(+el.dataset.d);
  haptic();
});
act('cal-day', (el) => {
  const d = el.dataset.date;
  sel = d;
  if (d.slice(0, 7) !== month.slice(0, 7)) {
    changeMonth(d > month ? 1 : -1, firstOfMonth(d));
  } else {
    document.querySelectorAll('.day.sel').forEach((x) => x.classList.remove('sel'));
    el.classList.add('sel');
  }
  paintPanel();
  haptic();
});
act('cal-today', () => {
  const t = today();
  sel = t;
  if (firstOfMonth(t) !== month) changeMonth(t < month ? -1 : 1, firstOfMonth(t));
  else {
    $('#cal-card').innerHTML = gridHTML();
    bindSwipe();
  }
  paintPanel();
  haptic();
});

/* ---------- Termin-Formular ---------- */
function defStart(date) {
  if (date === today()) {
    const h = new Date().getHours() + 1;
    return h > 22 ? '22:00' : `${pad(h)}:00`;
  }
  return '09:00';
}
const options = (list, v) => list.map(([k, l]) => `<option value="${k}" ${k === v ? 'selected' : ''}>${l}</option>`).join('');
const alarmOptions = (allDay, v) => options(allDay ? ALARMS_ALLDAY : ALARMS_TIMED, v);

function formHTML(d, editing) {
  return `<form class="form ${d.allDay ? 'allday' : ''}" id="evform" data-color="${d.color || 'mond'}" novalidate autocomplete="off">
    <div class="group">
      <div class="li title-row"><input class="li-input big" id="ev-title" placeholder="Titel" value="${esc(d.title)}" maxlength="120" enterkeyhint="done"></div>
      <div class="li"><span class="li-ic">${icon('pin')}</span><input class="li-input" id="ev-loc" placeholder="Ort" value="${esc(d.location || '')}" maxlength="120"></div>
    </div>
    <div class="group">
      <label class="li" for="ev-allday"><span class="li-title">Ganztägig</span>${switchHTML('ev-allday', d.allDay)}</label>
      <label class="li" for="ev-date"><span class="li-title">Datum</span><input type="date" id="ev-date" value="${d.date}"></label>
      <label class="li timed" for="ev-start"><span class="li-title">Beginn</span><input type="time" id="ev-start" value="${d.start || '09:00'}"></label>
      <label class="li timed" for="ev-end"><span class="li-title">Ende</span><input type="time" id="ev-end" value="${d.end || ''}"></label>
    </div>
    <div class="group">
      <label class="li" for="ev-repeat"><span class="li-ic">${icon('repeat')}</span><span class="li-title">Wiederholen</span><select id="ev-repeat">${options(REPEATS, d.repeat || 'none')}</select></label>
      <label class="li" for="ev-alarm"><span class="li-ic">${icon('bell')}</span><span class="li-title">Erinnerung</span><select id="ev-alarm">${alarmOptions(d.allDay, d.alarm)}</select></label>
    </div>
    <div class="group pad"><div class="li-sub" style="margin-bottom:8px">Farbe</div><div class="colors">${EV_COLORS.map(
      ([k, c]) => `<button type="button" class="color ${k === (d.color || 'mond') ? 'on' : ''}" style="--c:${c}" data-color="${k}" aria-label="Farbe ${k}"></button>`,
    ).join('')}</div></div>
    <div class="group"><textarea class="li-input" id="ev-notes" rows="3" placeholder="Notizen">${esc(d.notes || '')}</textarea></div>
    <button type="submit" class="btn btn-primary btn-lg btn-block">${editing ? 'Änderungen speichern' : 'Termin speichern'}</button>
    ${
      editing
        ? `<button type="button" class="btn btn-soft btn-block" data-act="ev-export" data-id="${d.id}">${icon('calendar')} ${d.exported ? 'Erneut zum iPhone-Kalender' : 'Zum iPhone-Kalender hinzufügen'}</button>
           ${d.exported ? '<p class="note">Schon im iPhone-Kalender. Änderungen übernimmt er nicht von selbst: Füge den Termin nach einer Änderung neu hinzu und lösche dort den alten.</p>' : ''}
           <button type="button" class="btn btn-danger btn-block" data-act="ev-delete" data-id="${d.id}">${icon('trash')} Termin löschen</button>`
        : ''
    }
  </form>`;
}

export function openEventSheet({ id = null, date = null } = {}) {
  const ev = id ? S.events.get(id) : null;
  if (id && !ev) return;
  const day = date || (app.current() === 'calendar' ? sel : today());
  const start = defStart(day);
  const d = ev
    ? { ...ev }
    : { title: '', date: day, allDay: false, start, end: addMin(start, 60), location: '', notes: '', repeat: 'none', alarm: 'm15', color: 'mond' };
  if (!d.allDay && !d.end) d.end = addMin(d.start || '09:00', 60);
  const sheet = openSheet({ title: ev ? 'Termin bearbeiten' : 'Neuer Termin', cls: 'tall', body: formHTML(d, !!ev) });
  const form = sheet.body.querySelector('form');
  const q = (s) => form.querySelector(s);
  q('#ev-allday').addEventListener('change', (e) => {
    form.classList.toggle('allday', e.target.checked);
    q('#ev-alarm').innerHTML = alarmOptions(e.target.checked, e.target.checked ? 'd9' : 'm15');
    haptic();
  });
  q('#ev-start').addEventListener('change', (e) => {
    const s = toMin(e.target.value);
    const end = q('#ev-end');
    if (s != null && (toMin(end.value) == null || toMin(end.value) <= s)) end.value = addMin(e.target.value, 60);
  });
  form.addEventListener('click', (e) => {
    const c = e.target.closest('[data-color]');
    if (!c) return;
    form.querySelectorAll('[data-color]').forEach((x) => x.classList.toggle('on', x === c));
    form.dataset.color = c.dataset.color;
    haptic();
  });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const titleEl = q('#ev-title');
    const title = titleEl.value.trim();
    if (!title) {
      titleEl.classList.remove('shake');
      void titleEl.offsetWidth;
      titleEl.classList.add('shake');
      titleEl.focus();
      haptic('error');
      toast('Gib dem Termin noch einen Titel.');
      return;
    }
    const allDay = q('#ev-allday').checked;
    const data = {
      ...(ev || {}),
      title,
      date: q('#ev-date').value || day,
      allDay,
      start: allDay ? null : q('#ev-start').value || '09:00',
      end: allDay ? null : q('#ev-end').value || null,
      location: q('#ev-loc').value.trim(),
      notes: q('#ev-notes').value.trim(),
      repeat: q('#ev-repeat').value,
      alarm: q('#ev-alarm').value,
      color: form.dataset.color || 'mond',
    };
    if (ev?.exported) {
      const keys = ['title', 'date', 'allDay', 'start', 'end', 'location', 'notes', 'repeat', 'alarm'];
      if (keys.some((k) => (ev[k] ?? '') !== (data[k] ?? ''))) data.exported = false;
    }
    const saved = saveEvent(data);
    sel = saved.date;
    month = firstOfMonth(saved.date);
    haptic('success');
    app.refresh();
    if (ev) {
      sheet.close();
      toast('Termin gespeichert', { icon: icon('check') });
    } else {
      showSuccess(sheet, saved);
    }
  });
  return sheet;
}

function showSuccess(sheet, ev) {
  sheet.setTitle('');
  const when = `${relDay(ev.date) || fmtLong(ev.date)}${ev.allDay ? ', ganztägig' : `, ${ev.start} Uhr`}`;
  const hasAlarm = ev.alarm && ev.alarm !== 'none';
  sheet.body.innerHTML = `<div class="success">
    <div class="success-check"><svg viewBox="0 0 52 52"><circle cx="26" cy="26" r="23" pathLength="1"/><path d="m15.5 27 7 7 14-15" pathLength="1"/></svg></div>
    <h3>„${esc(ev.title)}“ ist gespeichert</h3>
    <p class="muted">${esc(when)}</p>
    <div class="success-box">${icon('bell')}<span>${
      hasAlarm
        ? `Damit dein iPhone dich <b>${esc(alarmPhrase(ev))}</b> erinnert, übernimm den Termin in deinen iPhone-Kalender.`
        : 'Du hast keine Erinnerung gewählt. Übernimm den Termin trotzdem, wenn du ihn auch im iPhone-Kalender sehen willst.'
    }</span></div>
    <button type="button" class="btn btn-primary btn-lg" data-act="ev-export" data-id="${ev.id}">${icon('calendar')} Zum iPhone-Kalender hinzufügen</button>
    <button type="button" class="btn btn-ghost" data-sheet-close>Fertig</button>
    <button type="button" class="link small" data-act="ev-share" data-id="${ev.id}">Klappt nicht? Als Datei teilen</button>
  </div>`;
}

act('event-new', (el) => openEventSheet({ date: el.dataset.date || null }));
act('event-edit', (el) => openEventSheet({ id: el.dataset.id }));
act('ev-export', (el) => {
  const ev = S.events.get(el.dataset.id);
  if (!ev) return;
  if (!IS_PREVIEW) saveEvent({ ...ev, exported: true });
  openInCalendar(eventToICS(ev), icsName(ev));
});
act('ev-share', async (el) => {
  const ev = S.events.get(el.dataset.id);
  if (!ev) return;
  if (IS_PREVIEW) {
    toast('In der Vorschau geht das nicht – in der installierten App schon.');
    return;
  }
  await shareICS(eventToICS(ev), icsName(ev));
});
act('ev-delete', async (el) => {
  const ev = S.events.get(el.dataset.id);
  if (!ev) return;
  const text = ev.exported
    ? 'Im iPhone-Kalender bleibt er stehen – dort musst du ihn selbst löschen.'
    : ev.repeat && ev.repeat !== 'none'
      ? 'Alle Wiederholungen werden gelöscht.'
      : '';
  const ok = await confirmDialog({ title: `„${ev.title}“ löschen?`, text, ok: 'Löschen', danger: true });
  if (!ok) return;
  deleteEvent(ev.id);
  closeSheet();
  app.refresh();
  toast('Termin gelöscht');
});
