// Luna · Heute: Begrüßung, Journal-Aufruf, Serie, Schlaf, Termine, Wasser, Woche, Erinnerungen
import { S, currentStreak, eventsOn, upcoming, sleepStatus, snippet, saveSettings, STATUS_LABEL } from '../store.js';
import { icon, face, moonInfo, moonSVG, starsHTML, glassesHTML, waterAmt } from '../ui.js';
import {
  esc,
  today,
  fromISO,
  iso,
  addDays,
  datesBack,
  WD,
  WD_LONG,
  MONTHS,
  fmtHM,
  journalDate,
  toMin,
  fmtNum,
  IS_IOS,
  IS_STANDALONE,
  IS_PREVIEW,
  legacyBar,
  toast,
  haptic,
} from '../util.js';
import { act } from '../app.js';
import { agendaItem } from './calendar.js';
import { ringSVG } from './food.js';
import { isSetUp, targets, totals, fmtKcal, nut } from '../nutrition.js';

function greeting(h) {
  if (h < 5) return 'Gute Nacht';
  if (h < 11) return 'Guten Morgen';
  if (h < 18) return 'Hallo';
  if (h < 22) return 'Guten Abend';
  return 'Gute Nacht';
}

export function render() {
  const t = today();
  const now = new Date();
  const h = now.getHours();
  const night = h >= 20 || h < 6;
  const d = fromISO(t);
  const name = (S.settings.name || '').trim();
  const moon = moonInfo(now);
  return `
  <header class="vhead ${night ? 'night' : ''}">${night ? starsHTML(12, d.getDate()) : ''}
    <div class="vhead-text">
      <div class="eyebrow">${greeting(h)}${name ? `, ${esc(name)}` : ''}</div>
      <h1 class="vtitle">${WD_LONG[d.getDay()]},<br><em>${d.getDate()}. ${MONTHS[d.getMonth()]}</em></h1>
    </div>
    <div class="head-actions">
      <button type="button" class="moon-btn" data-act="moon" aria-label="Mondphase: ${moon.name}">${moonSVG(moon.phase)}</button>
      <button type="button" class="icon-btn" data-act="settings" aria-label="Einstellungen">${icon('sliders')}</button>
    </div>
  </header>
  ${previewNote()}
  ${reinstallTip()}
  ${hero()}
  <div class="row2">${streakTile()}${sleepTile()}</div>
  ${foodCard()}
  ${eventsCard()}
  ${waterCard()}
  ${weekCard()}
  ${memoryCard()}
  ${tips()}`;
}

function previewNote() {
  if (!IS_PREVIEW) return '';
  return `<section class="card tip preview-note"><div class="tip-ic">${icon('info')}</div><div>
    <h3>Vorschau mit Beispieldaten</h3>
    <p>So sieht Luna nach ein paar Wochen aus. Mikrofon, Kalender-Export und Installation gehen erst in der installierten App.</p></div><span></span></section>`;
}

function hero() {
  const jd = journalDate();
  const e = S.journal.get(jd);
  const h = new Date().getHours();
  const yest = jd !== today();
  if (e?.done) {
    const text = snippet(e, 150);
    return `<section class="card hero done">${face(e.ratings?.tag || 0, 'xl')}<div style="min-width:0">
      <div class="eyebrow">${icon('check')} ${yest ? 'Gestern' : 'Heute'} abgeschlossen</div>
      <p class="hero-text">${text ? esc(text) : 'Dein Tag ist festgehalten.'}</p>
      <button type="button" class="link" data-act="go" data-to="journal" data-date="${jd}">Eintrag ansehen ${icon('arrowR')}</button></div></section>`;
  }
  const evening = h >= 18 || h < 5;
  const started = e && (Object.keys(e.ratings || {}).length || e.text);
  const title = yest ? 'Gestern noch <em>abschließen?</em>' : evening ? 'Zeit für deinen <em>Abend</em>' : 'Heute Abend wartet <em>dein Journal</em>';
  const text = evening
    ? 'Ein paar Smileys, ein paar Sätze, vielleicht ein Foto. In drei Minuten ist dein Tag festgehalten.'
    : 'Wenn der Tag vorbei ist, hältst du hier fest, wie er war.';
  return `<section class="card hero ${evening ? 'glow' : ''}">
    <div class="eyebrow">${icon('journal')} Abend-Journal</div>
    <h2 class="hero-title">${title}</h2>
    <p>${text}</p>
    <button type="button" class="btn btn-primary btn-block" data-act="go" data-to="journal" data-date="${jd}">${started ? 'Weiterschreiben' : 'Journal ausfüllen'} ${icon('arrowR')}</button>
  </section>`;
}

function streakTile() {
  const n = currentStreak();
  return `<button type="button" class="card tile" data-act="go" data-to="stats">
    <div class="tile-ic flame ${n ? 'lit' : ''}">${icon('flame')}</div>
    <div class="tile-num" data-count="${n}">${n}</div>
    <div class="tile-label">${n === 1 ? 'Tag in Folge' : 'Tage in Folge'}</div></button>`;
}

function sleepTile() {
  const t = today();
  const e = S.sleep.get(t);
  if (!e?.hours) {
    return `<button type="button" class="card tile" data-act="sleep-edit" data-date="${t}">
      <div class="tile-ic">${icon('moon')}</div><div class="tile-num faint">–</div><div class="tile-label">Schlaf eintragen</div></button>`;
  }
  const st = sleepStatus(e.hours);
  return `<button type="button" class="card tile st-${st}" data-act="sleep-edit" data-date="${t}">
    <div class="tile-ic">${icon('moon')}</div><div class="tile-num">${fmtHM(e.hours)}<small>h</small></div>
    <div class="tile-label"><i class="sdot"></i>${STATUS_LABEL[st]}</div></button>`;
}

function foodCard() {
  const d = journalDate();
  if (!isSetUp()) {
    return `<button type="button" class="card tip food-cta" data-act="go" data-to="food"><div class="tip-ic">${icon('apple')}</div><div>
      <h3>Essen tracken und zunehmen</h3><p>Richte dein Kalorienziel ein. Dann siehst du hier jeden Tag, wie viel noch fehlt.</p></div><span class="x">${icon('chevR')}</span></button>`;
  }
  const t = targets(d);
  const s = totals(d);
  const p = s.kcal / t.kcal;
  const left = t.kcal - s.kcal;
  const cam =
    nut().geminiKey && !IS_PREVIEW
      ? `<label class="ft-cam" data-act="noop" aria-label="Essen fotografieren">${icon('camera')}<input type="file" accept="image/*" data-change="f-photo" data-date="${d}"></label>`
      : `<button type="button" class="ft-cam" data-act="go" data-to="food" data-date="${d}" aria-label="Essen eintragen">${icon('plus')}</button>`;
  return `<section class="card food-today">
    <button type="button" class="ft-ring" data-act="go" data-to="food" data-date="${d}" aria-label="Essen öffnen">${ringSVG(p)}<span>${Math.round(Math.min(p, 9.99) * 100)} %</span></button>
    <button type="button" class="ft-main" data-act="go" data-to="food" data-date="${d}">
      <span class="eyebrow">${icon('apple')} Essen ${d === today() ? 'heute' : 'gestern'}</span>
      <span class="ft-num"><b>${fmtKcal(s.kcal)}</b> / ${fmtKcal(t.kcal)} kcal</span>
      <span class="ft-sub">${left > 0 ? `noch ${fmtKcal(left)} kcal` : 'Ziel geschafft'} · ${Math.round(s.p)} g Eiweiß${t.training ? ' · Trainingstag' : ''}</span>
    </button>
    ${cam}
  </section>`;
}

function eventsCard() {
  const t = today();
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const todays = eventsOn(t).filter((ev) => ev.allDay || (toMin(ev.end) ?? (toMin(ev.start) ?? 0) + 60) > nowMin);
  const next = upcoming(addDays(t, 1), 21, 3);
  return `<section class="card">
    <div class="card-h"><h2 class="card-t">${icon('calendar')} Termine</h2><button type="button" class="link" data-act="event-new" data-date="${t}">${icon('plus')} Neu</button></div>
    ${todays.length ? `<div class="agenda">${todays.map((ev) => agendaItem(ev, t)).join('')}</div>` : '<p class="empty">Heute steht nichts mehr an.</p>'}
    ${next.length ? `<div class="sub-h">Demnächst</div><div class="agenda">${next.map(({ ev, date }) => agendaItem(ev, date, true)).join('')}</div>` : ''}
  </section>`;
}

function waterCard() {
  if (!S.settings.modules.water) return '';
  const t = today();
  const n = S.journal.get(t)?.water || 0;
  return `<section class="card">
    <div class="card-h"><h2 class="card-t">${icon('drop')} Wasser</h2><span class="water-amt" data-water-amt="${t}">${waterAmt(n)}</span></div>
    ${glassesHTML(n, t)}
  </section>`;
}

function weekCard() {
  const t = today();
  const days = datesBack(7);
  return `<section class="card">
    <div class="card-h"><h2 class="card-t">Deine Woche</h2><button type="button" class="link" data-act="go" data-to="stats">Statistik ${icon('chevR')}</button></div>
    <div class="week">${days
      .map((d) => {
        const lv = S.journal.get(d)?.ratings?.tag || 0;
        const s = S.sleep.get(d);
        const st = s?.hours ? sleepStatus(s.hours) : null;
        return `<button type="button" class="wday ${d === t ? 'is-today' : ''}" data-act="go" data-to="journal" data-date="${d}" aria-label="${d === t ? 'Heute' : WD_LONG[fromISO(d).getDay()]}">
          <span class="wd">${d === t ? 'Heute' : WD[fromISO(d).getDay()]}</span>${face(lv)}<i class="sdot ${st ? `st-${st}` : 'none'}"></i></button>`;
      })
      .join('')}</div>
  </section>`;
}

function memoryCard() {
  const t = today();
  const now = fromISO(t);
  const yearAgo = new Date(now);
  yearAgo.setFullYear(now.getFullYear() - 1);
  const monthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
  const opts = [];
  if (yearAgo.getDate() === now.getDate()) opts.push([iso(yearAgo), 'Heute vor einem Jahr']);
  if (monthAgo.getDate() === now.getDate()) opts.push([iso(monthAgo), 'Heute vor einem Monat']);
  opts.push([addDays(t, -7), 'Heute vor einer Woche']);
  for (const [d, label] of opts) {
    const e = S.journal.get(d);
    const photo = S.photoDates.has(d);
    if (!e || !(e.text || photo)) continue;
    return `<button type="button" class="card memory" data-act="go" data-to="journal" data-date="${d}">
      <div style="min-width:0"><div class="eyebrow">${icon('history')} ${label}</div><p class="mem-text">${esc(snippet(e, 160)) || 'Ein Foto von damals.'}</p></div>
      ${photo ? `<img data-photo="${d}" alt="">` : face(e.ratings?.tag || 0)}
    </button>`;
  }
  return '';
}

function tip(id, ic, title, text, actions = '', dismissable = true) {
  return `<section class="card tip" data-tip="${id}"><div class="tip-ic">${ic}</div><div><h3>${title}</h3><div class="tip-p">${text}</div>${
    actions ? `<div class="actions">${actions}</div>` : ''
  }</div>${dismissable ? `<button type="button" class="x" data-act="tip-x" data-tip="${id}" aria-label="Ausblenden">${icon('close')}</button>` : '<span></span>'}</section>`;
}
// Alte, dunkel installierte App: erklären, wie man das neue Icon bekommt, ohne Daten zu verlieren
function reinstallTip() {
  const st = S.settings;
  if (IS_PREVIEW || !legacyBar() || st.reinstallHintDismissed) return '';
  return tip(
    'reinstall',
    icon('sparkle'),
    'Neues Icon holen',
    `Luna ist jetzt hell. Das neue Icon und die helle Leiste oben gibt es erst, wenn du Luna einmal neu hinzufügst. So geht dabei nichts verloren:
    <ol class="steps sm">
      <li><span><b>Backup erstellen</b> und „In Dateien sichern“ wählen</span></li>
      <li><span>Luna auf dem Home-Bildschirm gedrückt halten und <b>App entfernen</b></span></li>
      <li><span>Die Luna-Seite in Safari öffnen, <b>Teilen</b> und <b>„Zum Home-Bildschirm“</b></span></li>
      <li><span>In der neuen Luna: Einstellungen, <b>Backup wiederherstellen</b>${st.nutrition?.geminiKey ? ', danach den Gemini-Schlüssel neu einfügen' : ''}</span></li>
    </ol>`,
    '<button type="button" class="btn btn-soft btn-sm" data-act="backup">Backup erstellen</button>',
  );
}

function tips() {
  if (IS_PREVIEW) return '';
  const st = S.settings;
  let out = '';
  if (IS_IOS && !IS_STANDALONE && !st.installHintDismissed) {
    out += tip(
      'install',
      icon('share'),
      'Als App installieren',
      `Tippe in Safari auf ${icon('share', 'inline-ic')} <b>Teilen</b> und dann auf <b>„Zum Home-Bildschirm“</b>. Danach startet Luna wie eine echte App.`,
    );
  }
  if (!st.reminderSet && !st.reminderHintDismissed && st.onboarded) {
    out += tip(
      'reminder',
      icon('bell'),
      'Abends erinnert werden',
      'Dein iPhone-Kalender kann dich jeden Abend an dein Journal erinnern.',
      '<button type="button" class="btn btn-soft btn-sm" data-act="reminder">Einrichten</button>',
    );
  }
  const last = st.lastBackup;
  const own = [...S.journal.values()].filter((e) => !e.demo).length;
  if (own >= 14 && (!last || Date.now() - last > 30 * 864e5)) {
    out += tip(
      'backup',
      icon('download'),
      'Zeit für ein Backup',
      last ? 'Dein letztes Backup ist über einen Monat alt.' : 'Deine Einträge liegen nur auf diesem iPhone. Sichere sie ab und zu in iCloud Drive.',
      '<button type="button" class="btn btn-soft btn-sm" data-act="backup">Backup erstellen</button>',
      false,
    );
  }
  return out;
}

act('moon', () => {
  const m = moonInfo();
  toast(`${m.name} · ${fmtNum(m.illum * 100, 0)} % beleuchtet`, { icon: icon('moon') });
  haptic();
});
act('tip-x', (el) => {
  const key = { install: 'installHintDismissed', reminder: 'reminderHintDismissed', reinstall: 'reinstallHintDismissed' }[el.dataset.tip];
  if (key) saveSettings({ [key]: true });
  const card = el.closest('.tip');
  card.style.transition = 'opacity .25s, transform .25s';
  card.style.opacity = '0';
  card.style.transform = 'scale(.96)';
  setTimeout(() => card.remove(), 250);
  haptic();
});
