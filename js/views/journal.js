// Luna · Abend-Journal: Smileys, Text mit Diktat, Fragen, Foto, Bewegung, Wasser, Gewohnheiten
import { S, updateJournal, setRating, flushWrites, savePhoto, deletePhoto, sleepStatus, currentStreak, snippet } from '../store.js';
import {
  icon,
  face,
  facesHTML,
  CATS,
  LABELS,
  glassesHTML,
  paintWater,
  waterAmt,
  confetti,
  confirmDialog,
  openSheet,
  closeSheet,
  hydratePhotos,
  openPhotoViewer,
} from '../ui.js';
import {
  $,
  esc,
  today,
  addDays,
  fromISO,
  relDay,
  journalDate,
  fmtDur,
  fmtShort,
  WD_LONG,
  MONTHS,
  haptic,
  toast,
  autosize,
  clamp,
  debounce,
} from '../util.js';
import { act, onInput, onChange, app } from '../app.js';
import { toggleDictation, stopDictation } from '../speech.js';

let date = journalDate();

const QUESTIONS = [
  ['gratitude', 'Wofür bist du heute dankbar?', 'Drei kleine Dinge reichen schon …'],
  ['good', 'Was lief heute gut?', 'Auch Kleinigkeiten zählen.'],
  ['better', 'Was machst du morgen besser?', 'Ein Vorsatz für morgen …'],
];
const SPORTS = ['Laufen', 'Gym', 'Radfahren', 'Schwimmen', 'Fußball', 'Yoga', 'Spazieren', 'Tanzen', 'Sonstiges'];

export function enter(opts = {}) {
  date = opts.date || journalDate();
}

export function render() {
  const e = S.journal.get(date) || { ratings: {} };
  const d = fromISO(date);
  const rel = relDay(date);
  const year = d.getFullYear() !== new Date().getFullYear() ? ` ${d.getFullYear()}` : '';
  return `
  <header class="jhead" id="jhead">
    <button type="button" class="icon-btn" data-act="j-shift" data-d="-1" aria-label="Vorheriger Tag">${icon('chevL')}</button>
    <div class="jdate">
      <div class="eyebrow">${rel ? esc(rel) : 'Journal'}</div>
      <div class="jdate-t">${WD_LONG[d.getDay()]},<em>${d.getDate()}. ${MONTHS[d.getMonth()]}${year}</em></div>
      <input type="date" class="jdate-in" id="j-date" value="${date}" max="${today()}" data-change="j-date" aria-label="Datum wählen">
    </div>
    <button type="button" class="icon-btn" data-act="j-shift" data-d="1" ${date >= today() ? 'disabled' : ''} aria-label="Nächster Tag">${icon('chevR')}</button>
  </header>
  <div class="jtools">
    <span class="saved" id="j-saved">${e.updatedAt ? `${icon('check')} Gespeichert` : 'Wird automatisch gespeichert'}</span>
    <button type="button" class="link" data-act="j-history">${icon('history')} Verlauf</button>
  </div>
  ${moodCard(e)}
  ${ratingsCard(e)}
  ${writeCard(e)}
  ${questionsCard(e)}
  ${photoCard()}
  ${sportCard(e)}
  ${waterCard(e)}
  ${habitsCard(e)}
  ${completeHTML(e)}`;
}

export function mount(root) {
  root.querySelectorAll('textarea.jtext').forEach(autosize);
  const head = $('#jhead');
  let x0 = null;
  let y0 = 0;
  head.addEventListener(
    'touchstart',
    (e) => {
      x0 = e.touches[0].clientX;
      y0 = e.touches[0].clientY;
    },
    { passive: true },
  );
  head.addEventListener(
    'touchend',
    (e) => {
      if (x0 == null) return;
      const dx = e.changedTouches[0].clientX - x0;
      const dy = e.changedTouches[0].clientY - y0;
      x0 = null;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) shift(dx < 0 ? 1 : -1);
    },
    { passive: true },
  );
}

/* ---------- Bausteine ---------- */
function moodCard(e) {
  const v = e.ratings?.tag || 0;
  return `<section class="card mood-card" id="mood-card" data-rate="tag" data-empty="Tippe auf einen Smiley">
    <h2 class="q">Wie war dein Tag?</h2>
    ${facesHTML('tag', v, { big: true, date })}
    <div class="rate-label ${v ? `lv${v}` : ''}">${v ? LABELS.tag[v - 1] : 'Tippe auf einen Smiley'}</div>
  </section>`;
}

function sleepLink() {
  const s = S.sleep.get(date);
  if (s?.hours) {
    return `<button type="button" class="mini-link st-${sleepStatus(s.hours)}" data-act="sleep-edit" data-date="${date}"><i class="sdot"></i>${fmtDur(s.hours)}</button>`;
  }
  return `<button type="button" class="mini-link add" data-act="sleep-edit" data-date="${date}">${icon('plus')}Schlafdauer</button>`;
}

function ratingsCard(e) {
  const cats = CATS.filter((c) => c.id !== 'tag' && S.settings.cats[c.id] !== false);
  if (!cats.length) return '';
  const rows = cats
    .map((c) => {
      const v = e.ratings?.[c.id] || 0;
      return `<div class="rate-row" data-rate="${c.id}" data-empty="Noch offen">
        <div class="rate-info">
          <div class="rate-name">${icon(c.icon)}${c.name}</div>
          <div class="rate-label ${v ? `lv${v}` : ''}">${v ? LABELS[c.id][v - 1] : 'Noch offen'}</div>
          ${c.id === 'schlaf' ? sleepLink() : ''}
        </div>
        ${facesHTML(c.id, v, { date })}
      </div>`;
    })
    .join('');
  return `<section class="card"><div class="card-h"><h2 class="card-t">Und wie war …</h2></div>${rows}</section>`;
}

const listening = '<div class="listening"><span class="bars"><i></i><i></i><i></i><i></i></span>Ich höre zu … tippe zum Beenden</div>';
const textarea = (field, value, ph, sm) =>
  `<textarea class="jtext ${sm ? 'sm' : ''}" id="j-${field}" rows="${sm ? 2 : 4}" placeholder="${esc(ph)}" data-input="jtext" data-field="${field}" data-date="${date}" enterkeyhint="enter">${esc(value || '')}</textarea>`;
const micBtn = (field, sm) =>
  `<button type="button" class="mic ${sm ? 'sm' : ''}" data-act="mic" data-for="j-${field}" aria-label="Diktieren" aria-pressed="false">${icon('mic')}</button>`;

function writeCard(e) {
  return `<section class="card">
    <div class="card-h"><h2 class="card-t">${icon('edit')} Erzähl mal</h2></div>
    <div class="write">${textarea('text', e.text, 'Was ist heute passiert? Was hat dich beschäftigt? Tippe auf das Mikrofon und erzähl einfach.', false)}${listening}${micBtn('text', false)}</div>
  </section>`;
}

function questionsCard(e) {
  const qs = QUESTIONS.filter(([id]) => S.settings.questions[id] !== false);
  if (!qs.length) return '';
  return `<section class="card">
    <div class="card-h"><h2 class="card-t">${icon('heart')} Kurz nachgedacht</h2></div>
    ${qs
      .map(
        ([id, q, ph]) =>
          `<div class="qa"><label class="qa-q" for="j-${id}">${q}</label><div class="write">${textarea(id, e[id], ph, true)}${listening}${micBtn(id, true)}</div></div>`,
      )
      .join('')}
  </section>`;
}

function photoCard() {
  if (!S.settings.modules.photo) return '';
  const has = S.photoDates.has(date);
  return `<section class="card" id="photo-card">
    <div class="card-h"><h2 class="card-t">${icon('camera')} Foto des Tages</h2>${
      has ? `<button type="button" class="link danger" data-act="photo-del" data-date="${date}">Entfernen</button>` : ''
    }</div>
    ${
      has
        ? `<div class="photo" data-act="photo-view" data-date="${date}"><img data-photo="${date}" alt="Foto des Tages">
            <label class="icon-btn photo-swap" data-act="noop" aria-label="Foto ersetzen">${icon('camera')}<input type="file" accept="image/*" data-change="photo" data-date="${date}"></label></div>`
        : `<label class="photo-drop">${icon('image', 'lg')}<span>Foto hinzufügen</span><small>Ein Moment, der für heute steht</small><input type="file" accept="image/*" data-change="photo" data-date="${date}"></label>`
    }
  </section>`;
}

const fmtMinutes = (m) => (m >= 60 ? `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60}` : ''}` : `${m} min`);
function sportCard(e) {
  if (!S.settings.modules.sport) return '';
  const sp = { types: [], minutes: 0, ...(e.sport || {}) };
  return `<section class="card">
    <div class="card-h"><h2 class="card-t">${icon('dumbbell')} Bewegung</h2>
      <div class="stepper"><button type="button" data-act="sport-min" data-d="-15" data-date="${date}" aria-label="15 Minuten weniger">${icon('minus')}</button><output id="sport-min">${fmtMinutes(sp.minutes)}</output><button type="button" data-act="sport-min" data-d="15" data-date="${date}" aria-label="15 Minuten mehr">${icon('plus')}</button></div>
    </div>
    <div class="chips">${SPORTS.map(
      (s) => `<button type="button" class="chip ${sp.types.includes(s) ? 'on' : ''}" data-act="sport-type" data-v="${s}" data-date="${date}">${s}</button>`,
    ).join('')}</div>
  </section>`;
}

function waterCard(e) {
  if (!S.settings.modules.water) return '';
  const n = e.water || 0;
  return `<section class="card">
    <div class="card-h"><h2 class="card-t">${icon('drop')} Wasser</h2><span class="water-amt" data-water-amt="${date}">${waterAmt(n)}</span></div>
    ${glassesHTML(n, date)}
  </section>`;
}

function habitsCard(e) {
  const habits = S.settings.habits;
  if (!S.settings.modules.habits || !habits.length) return '';
  return `<section class="card">
    <div class="card-h"><h2 class="card-t">${icon('sparkle')} Gewohnheiten</h2><button type="button" class="link" data-act="settings" data-section="habits">Bearbeiten</button></div>
    <div class="habits">${habits
      .map(
        (h) =>
          `<button type="button" class="habit ${e.habits?.[h.id] ? 'on' : ''}" data-act="habit" data-id="${esc(h.id)}" data-date="${date}" aria-pressed="${!!e.habits?.[h.id]}"><span class="em">${esc(h.emoji)}</span><span class="hn">${esc(h.name)}</span><span class="tick"><svg viewBox="0 0 24 24"><path pathLength="1" d="m5 12.5 4.5 4.5L19 7.5"/></svg></span></button>`,
      )
      .join('')}</div>
  </section>`;
}

function completeHTML(e) {
  if (e?.done) {
    return `<section class="complete"><div class="done-badge">${icon('check')} Tag abgeschlossen</div><p class="note">Änderungen werden weiterhin automatisch gespeichert.</p></section>`;
  }
  return `<section class="complete"><button type="button" class="btn btn-primary btn-lg btn-block" data-act="j-complete">Tag abschließen</button><p class="note">Alles, was du einträgst, wird sofort gespeichert.</p></section>`;
}

/* ---------- Gespeichert-Hinweis ---------- */
function flashSaved() {
  const s = $('#j-saved');
  if (!s) return;
  s.innerHTML = `${icon('check')} Gespeichert`;
  s.classList.remove('flash');
  void s.offsetWidth;
  s.classList.add('flash');
}
const flashSavedSoon = debounce(flashSaved, 700);

/* ---------- Datum wechseln ---------- */
function shift(dir) {
  const nd = addDays(date, dir);
  if (nd > today()) return;
  setDate(nd, dir);
}
function setDate(nd, dir = 0) {
  flushWrites();
  stopDictation();
  date = nd;
  if (app.current() !== 'journal') {
    app.go('journal', { date: nd });
    return;
  }
  app.refresh({ animate: true });
  window.scrollTo(0, 0);
  // Kommt der Wechsel aus einem Sheet, stellt das Schließen sonst die alte Scrollposition wieder her.
  if (document.body.classList.contains('locked')) setTimeout(() => window.scrollTo(0, 0), 450);
  if (dir) $('#jhead')?.classList.add(dir > 0 ? 'swipe-l' : 'swipe-r');
  haptic();
}
act('j-shift', (el) => shift(+el.dataset.d));
onChange('j-date', (el) => {
  if (el.value && el.value <= today() && el.value !== date) setDate(el.value);
});

/* ---------- Bewertungen (auch aus dem Schlaf-Sheet) ---------- */
act('rate', (el) => {
  const cat = el.dataset.cat;
  const d = el.dataset.date || date;
  const v = +el.dataset.v;
  const cur = S.journal.get(d)?.ratings?.[cat] || 0;
  const nv = cur === v ? 0 : v;
  setRating(d, cat, nv);
  const group = el.closest('.faces');
  group.classList.toggle('sel', !!nv);
  group.querySelectorAll('.face-b').forEach((b) => {
    const on = +b.dataset.v === nv;
    b.classList.toggle('on', on);
    b.setAttribute('aria-checked', on);
    b.classList.remove('pop');
  });
  if (nv) {
    void el.offsetWidth;
    el.classList.add('pop');
  }
  const scope = el.closest('[data-rate]');
  const lab = scope?.querySelector('.rate-label');
  if (lab) {
    lab.className = `rate-label bump ${nv ? `lv${nv}` : ''}`;
    lab.textContent = nv ? LABELS[cat][nv - 1] : scope.dataset.empty || 'Noch offen';
  }
  haptic();
  flashSaved();
});

/* ---------- Text & Diktat ---------- */
onInput('jtext', (el) => {
  autosize(el);
  updateJournal(el.dataset.date, { [el.dataset.field]: el.value }, { defer: true });
  flashSavedSoon();
});
act('mic', (el) => {
  const field = document.getElementById(el.dataset.for);
  if (!field) return;
  toggleDictation(el, field, (val, final) => {
    updateJournal(field.dataset.date, { [field.dataset.field]: val }, { defer: !final });
    if (final) flashSaved();
  });
});

/* ---------- Foto ---------- */
async function compressImage(file, max = 1600, quality = 0.82) {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const s = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.round(img.naturalWidth * s);
    const h = Math.round(img.naturalHeight * s);
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    c.getContext('2d').drawImage(img, 0, 0, w, h);
    const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', quality));
    return { blob: blob || file, w, h };
  } finally {
    URL.revokeObjectURL(url);
  }
}
function repaintPhoto() {
  const card = $('#photo-card');
  if (!card) return;
  card.outerHTML = photoCard();
  hydratePhotos($('#photo-card'));
}
onChange('photo', async (el) => {
  const file = el.files?.[0];
  if (!file) return;
  const d = el.dataset.date;
  el.closest('.card')?.querySelector('.photo, .photo-drop')?.classList.add('busy');
  try {
    const { blob, w, h } = await compressImage(file);
    await savePhoto(d, blob, { w, h });
    updateJournal(d, {});
    haptic('success');
    flashSaved();
  } catch (err) {
    console.error(err);
    toast('Das Foto ließ sich nicht öffnen. Versuch es mit einem anderen Bild.');
  }
  repaintPhoto();
});
act('photo-view', (el) => openPhotoViewer(el.dataset.date));
act('noop', () => {});
act('photo-del', async (el) => {
  const ok = await confirmDialog({ title: 'Foto entfernen?', text: 'Das Foto wird aus deinem Journal gelöscht.', ok: 'Entfernen', danger: true });
  if (!ok) return;
  await deletePhoto(el.dataset.date);
  repaintPhoto();
});

/* ---------- Bewegung, Wasser, Gewohnheiten ---------- */
const sportOf = (d) => ({ types: [], minutes: 0, ...(S.journal.get(d)?.sport || {}) });
act('sport-type', (el) => {
  const d = el.dataset.date;
  const sp = sportOf(d);
  const t = el.dataset.v;
  const types = sp.types.includes(t) ? sp.types.filter((x) => x !== t) : [...sp.types, t];
  updateJournal(d, { sport: { ...sp, types } });
  el.classList.toggle('on', types.includes(t));
  haptic();
  flashSaved();
});
act('sport-min', (el) => {
  const d = el.dataset.date;
  const sp = sportOf(d);
  const minutes = clamp(sp.minutes + Number(el.dataset.d), 0, 600);
  updateJournal(d, { sport: { ...sp, minutes } });
  const out = $('#sport-min');
  if (out) out.textContent = fmtMinutes(minutes);
  haptic();
  flashSaved();
});
act('water', (el) => {
  const d = el.dataset.date;
  const old = S.journal.get(d)?.water || 0;
  const n = clamp(Number(el.dataset.n), 0, 40);
  if (n === old) return;
  updateJournal(d, { water: n });
  document.querySelectorAll(`[data-water="${d}"]`).forEach((row) => paintWater(row, n));
  document.querySelectorAll(`[data-water-amt="${d}"]`).forEach((x) => {
    x.innerHTML = waterAmt(n);
  });
  haptic();
  if (n === S.settings.waterGoal && n > old) toast('Wasserziel geschafft', { icon: icon('drop') });
});
act('habit', (el) => {
  const d = el.dataset.date;
  const habits = { ...(S.journal.get(d)?.habits || {}) };
  if (habits[el.dataset.id]) delete habits[el.dataset.id];
  else habits[el.dataset.id] = true;
  updateJournal(d, { habits });
  const on = !!habits[el.dataset.id];
  el.classList.toggle('on', on);
  el.setAttribute('aria-pressed', on);
  haptic();
  flashSaved();
});

/* ---------- Abschließen ---------- */
act('j-complete', (el) => {
  const e = S.journal.get(date);
  if (!e?.ratings?.tag) {
    const card = $('#mood-card');
    card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    card.classList.remove('need');
    void card.offsetWidth;
    card.classList.add('need');
    haptic('error');
    toast('Wie war dein Tag insgesamt? Tippe oben einen Smiley an.');
    return;
  }
  stopDictation();
  updateJournal(date, { done: true, completedAt: Date.now() });
  flushWrites();
  const r = el.getBoundingClientRect();
  confetti({ x: r.left + r.width / 2, y: r.top + 10 });
  haptic('success');
  const n = currentStreak();
  toast(n > 1 ? `Tag abgeschlossen · ${n} Tage in Folge` : 'Tag abgeschlossen. Schön, dass du dir die Zeit nimmst.', { icon: icon('flame'), ms: 3600 });
  el.closest('.complete').outerHTML = completeHTML(S.journal.get(date));
});

/* ---------- Verlauf ---------- */
const reEsc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
function matchSnippet(e, q) {
  if (!q) return esc(snippet(e, 90));
  const src = [e.text, e.gratitude, e.good, e.better].find((t) => t?.toLowerCase().includes(q)) || '';
  const i = src.toLowerCase().indexOf(q);
  const start = Math.max(0, i - 28);
  const part = (start ? '…' : '') + src.slice(start, i + q.length + 70);
  return esc(part).replace(new RegExp(reEsc(esc(q)), 'gi'), (m) => `<mark>${m}</mark>`);
}
function histList(raw) {
  const q = raw.toLowerCase();
  const entries = [...S.journal.values()]
    .filter((e) => e.done || e.text || Object.keys(e.ratings || {}).length)
    .sort((a, b) => b.date.localeCompare(a.date));
  const hits = q ? entries.filter((e) => [e.text, e.gratitude, e.good, e.better].some((t) => t?.toLowerCase().includes(q))) : entries;
  if (!hits.length) return `<p class="empty center" style="padding:36px 0">${q ? 'Nichts gefunden.' : 'Noch keine Einträge.'}</p>`;
  let html = '';
  let month = '';
  for (const e of hits.slice(0, 300)) {
    const m = e.date.slice(0, 7);
    if (m !== month) {
      month = m;
      const d = fromISO(e.date);
      html += `<div class="hist-m">${MONTHS[d.getMonth()]} ${d.getFullYear()}</div>`;
    }
    const text = matchSnippet(e, q);
    html += `<button type="button" class="hist-item" data-act="hist-open" data-date="${e.date}">${face(e.ratings?.tag || 0)}
      <div style="min-width:0"><div class="hist-date">${fmtShort(e.date)}</div><div class="hist-snip">${text || '<span class="faint">Ohne Text</span>'}</div></div>
      ${S.photoDates.has(e.date) ? `<img class="hist-thumb" data-photo="${e.date}" alt="">` : '<span></span>'}</button>`;
  }
  return html;
}
act('j-history', () => {
  const sheet = openSheet({
    title: 'Verlauf',
    cls: 'tall',
    body: `<div class="search">${icon('search')}<input type="search" class="field" id="hist-q" placeholder="Einträge durchsuchen" autocomplete="off" enterkeyhint="search"></div><div class="hist" id="hist-list">${histList('')}</div>`,
  });
  hydratePhotos(sheet.body);
  const q = sheet.body.querySelector('#hist-q');
  q.addEventListener(
    'input',
    debounce(() => {
      sheet.body.querySelector('#hist-list').innerHTML = histList(q.value.trim());
      hydratePhotos(sheet.body);
    }, 160),
  );
});
act('hist-open', (el) => {
  closeSheet();
  setDate(el.dataset.date);
});
