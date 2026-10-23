// Luna · Einstellungen, PIN-Sperre, Willkommen, Erinnerung und Backup
import { S, saveSettings, wipeAll, removeDemo, hasDemo, buildBackup, restoreBackup } from './store.js';
import {
  icon,
  openSheet,
  confirmDialog,
  switchHTML,
  keypadHTML,
  pinDotsHTML,
  pinPad,
  logoSVG,
  starsHTML,
  segHTML,
  setSeg,
  CATS,
} from './ui.js';
import {
  esc,
  toast,
  haptic,
  setHaptics,
  clamp,
  uid,
  debounce,
  lockScroll,
  unlockScroll,
  fmtBytes,
  today,
  IS_IOS,
  IS_STANDALONE,
} from './util.js';
import { act, onInput, onChange, app } from './app.js';
import { reminderICS, openInCalendar, saveFile } from './ics.js';
import { stopDictation } from './speech.js';
import { loadDemo } from './demo.js';
import { isSetUp, targets, fmtKcal } from './nutrition.js';
import { openSetup, openKeySheet } from './views/food.js';
import { openSetup as openSmokeSetup } from './views/smoke.js';
import { isSetUp as smokeSetUp, phase as smokePhase, fmtMoney, costPerDay } from './smoke.js';

export const VERSION = '1.2.1';

const ACCENTS = [
  ['mond', '#8fa3ff', 'Mond'],
  ['flieder', '#b99cff', 'Flieder'],
  ['lagune', '#4fd6c8', 'Lagune'],
  ['koralle', '#ff8fa3', 'Koralle'],
  ['bernstein', '#ffbe6b', 'Bernstein'],
];
const EMOJIS = ['📖', '🧘', '🌿', '📵', '💊', '🏃', '🥗', '🚰', '🛏️', '🙏', '✍️', '🎸', '🧹', '☀️', '🚭', '💤'];

const darkQuery = matchMedia('(prefers-color-scheme: dark)');
export function applySettings() {
  const st = S.settings;
  const root = document.documentElement;
  if (st.accent && st.accent !== 'mond') root.dataset.accent = st.accent;
  else delete root.dataset.accent;
  const dark = st.look === 'dark' || (st.look === 'auto' && darkQuery.matches);
  if (dark) root.dataset.look = 'dark';
  else delete root.dataset.look;
  // Statusleiste und Safari-Leisten passend zum Hintergrund einfärben
  const bg = getComputedStyle(root).getPropertyValue('--bg').trim();
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute('content', bg || (dark ? '#070a13' : '#f3f4f9')));
  root.classList.toggle('calm', !!st.reduceMotion);
  setHaptics(st.haptics !== false);
}
darkQuery.addEventListener?.('change', () => {
  if (S.settings?.look === 'auto') applySettings();
});

/* ---------- Einstellungen ---------- */
const sw = (id, on, attrs) => switchHTML(id, on, attrs);
function habitsList() {
  const hs = S.settings.habits;
  const rows = hs
    .map(
      (h) =>
        `<div class="li"><span style="font-size:20px;width:26px;text-align:center">${esc(h.emoji)}</span><span class="li-title li-main">${esc(h.name)}</span><button type="button" class="icon-btn" style="width:34px;height:34px" data-act="habit-del" data-id="${esc(h.id)}" aria-label="${esc(h.name)} entfernen">${icon('trash')}</button></div>`,
    )
    .join('');
  return `${rows}
    <div class="habit-add li">
      <input class="field em-in" id="habit-emoji" value="✨" maxlength="4" aria-label="Emoji">
      <input class="field" id="habit-name" placeholder="Neue Gewohnheit" maxlength="40" enterkeyhint="done">
      <button type="button" class="btn btn-soft btn-sm" data-act="habit-add">Hinzufügen</button>
    </div>
    <div class="li" style="padding-top:0"><div class="emoji-row">${EMOJIS.map((e) => `<button type="button" data-act="habit-emoji" data-e="${e}">${e}</button>`).join('')}</div></div>`;
}

function settingsHTML() {
  const st = S.settings;
  const lockOpts = [
    [0, 'Sofort'],
    [60, 'Nach 1 Minute'],
    [300, 'Nach 5 Minuten'],
    [900, 'Nach 15 Minuten'],
  ];
  return `<div class="form">
    <div class="group-label">Profil</div>
    <div class="group"><label class="li" for="set-name"><span class="li-title">Dein Name</span><input class="li-input" id="set-name" style="text-align:right" placeholder="optional" value="${esc(st.name)}" data-input="set-name" maxlength="30" autocomplete="given-name"></label></div>

    <div class="group-label">Aussehen</div>
    <div class="group">
      <div class="li"><span class="li-title">Design</span><div class="look-seg">${segHTML('set-look', [
        ['light', 'Hell'],
        ['dark', 'Dunkel'],
        ['auto', 'Automatisch'],
      ], st.look || 'light', 'sm')}</div></div>
      <div class="li"><span class="li-main"><span class="li-title">Akzentfarbe</span></span>
        <div class="accent-row">${ACCENTS.map(
          ([k, c, name]) => `<button type="button" class="color ${st.accent === k ? 'on' : ''}" style="--c:${c}" data-act="set-accent" data-v="${k}" aria-label="${name}"></button>`,
        ).join('')}</div></div>
      <label class="li" for="set-haptics"><span class="li-title li-main">Haptisches Feedback</span>${sw('set-haptics', st.haptics, 'data-change="set-flag" data-key="haptics"')}</label>
      <label class="li" for="set-calm"><span class="li-title li-main">Weniger Animationen</span>${sw('set-calm', st.reduceMotion, 'data-change="set-flag" data-key="reduceMotion"')}</label>
    </div>

    <div class="group-label" id="set-journal">Abend-Journal: Smileys</div>
    <div class="group">
      ${CATS.filter((c) => c.id !== 'tag')
        .map(
          (c) =>
            `<label class="li" for="set-cat-${c.id}"><span class="li-ic">${icon(c.icon)}</span><span class="li-title li-main">${c.name}</span>${sw(`set-cat-${c.id}`, st.cats[c.id] !== false, `data-change="set-nested" data-group="cats" data-key="${c.id}"`)}</label>`,
        )
        .join('')}
    </div>
    <div class="group-note">„Wie war dein Tag?“ ist immer dabei.</div>

    <div class="group-label">Abend-Journal: Bereiche</div>
    <div class="group">
      ${[
        ['gratitude', 'Wofür bist du dankbar?'],
        ['good', 'Was lief gut?'],
        ['better', 'Was machst du morgen besser?'],
      ]
        .map(
          ([k, l]) =>
            `<label class="li" for="set-q-${k}"><span class="li-title li-main">${l}</span>${sw(`set-q-${k}`, st.questions[k] !== false, `data-change="set-nested" data-group="questions" data-key="${k}"`)}</label>`,
        )
        .join('')}
      ${[
        ['photo', 'camera', 'Foto des Tages'],
        ['sport', 'dumbbell', 'Bewegung'],
        ['water', 'drop', 'Wasser'],
        ['habits', 'sparkle', 'Gewohnheiten'],
      ]
        .map(
          ([k, ic, l]) =>
            `<label class="li" for="set-m-${k}"><span class="li-ic">${icon(ic)}</span><span class="li-title li-main">${l}</span>${sw(`set-m-${k}`, st.modules[k] !== false, `data-change="set-nested" data-group="modules" data-key="${k}"`)}</label>`,
        )
        .join('')}
      <div class="li"><span class="li-ic">${icon('drop')}</span><span class="li-main"><span class="li-title">Wasserziel</span><span class="li-sub" id="set-water-sub">${st.waterGoal} Gläser à ${st.glassMl} ml</span></span>
        <div class="stepper"><button type="button" data-act="set-water" data-d="-1" aria-label="Ein Glas weniger">${icon('minus')}</button><output id="set-water-out">${st.waterGoal}</output><button type="button" data-act="set-water" data-d="1" aria-label="Ein Glas mehr">${icon('plus')}</button></div></div>
    </div>

    <div class="group-label" id="set-tabs">Tableiste</div>
    <div class="group">
      ${[
        ['food', 'apple', 'Essen'],
        ['smoke', 'nosmoke', 'Rauchfrei'],
      ]
        .map(
          ([k, ic, l]) =>
            `<label class="li" for="set-tab-${k}"><span class="li-ic">${icon(ic)}</span><span class="li-title li-main">${l}</span>${sw(`set-tab-${k}`, st.tabs?.[k] !== false, `data-change="set-tab" data-key="${k}"`)}</label>`,
        )
        .join('')}
    </div>
    <div class="group-note">Ausgeblendete Bereiche behalten ihre Daten und lassen sich jederzeit wieder einschalten.</div>

    ${
      st.tabs?.smoke !== false
        ? `<div class="group-label" id="set-smoke">Rauchfrei</div>
    <div class="group">
      <button type="button" class="li" data-act="set-smoke"><span class="li-ic">${icon('nosmoke')}</span><span class="li-main"><span class="li-title">Plan &amp; Kosten</span><span class="li-sub">${
        smokeSetUp()
          ? `${{ free: 'Rauchfrei', countdown: 'Rauchstopp geplant', reduce: 'Reduzieren läuft' }[smokePhase()] || ''} · ${fmtMoney(costPerDay())} pro Tag`
          : 'Noch nicht eingerichtet'
      }</span></span><span class="li-end">${icon('chevR')}</span></button>
    </div>`
        : ''
    }

    <div class="group-label" id="set-food">Ernährung</div>
    <div class="group">
      <button type="button" class="li" data-act="set-food-goal"><span class="li-ic">${icon('target')}</span><span class="li-main"><span class="li-title">Zunehm-Ziel</span><span class="li-sub">${
        isSetUp() ? `${fmtKcal(targets().kcal)} kcal heute · Ziel ${st.nutrition.goalWeight ? `${String(st.nutrition.goalWeight).replace('.', ',')} kg` : 'offen'}` : 'Noch nicht eingerichtet'
      }</span></span><span class="li-end">${icon('chevR')}</span></button>
      <button type="button" class="li" data-act="set-food-key"><span class="li-ic">${icon('camera')}</span><span class="li-main"><span class="li-title">Foto-Erkennung (Gemini)</span><span class="li-sub">${
        st.nutrition.geminiKey ? `Verbunden${st.nutrition.geminiModel ? ` · ${esc(st.nutrition.geminiModel)}` : ''}` : 'Nicht eingerichtet'
      }</span></span><span class="li-end">${icon('chevR')}</span></button>
    </div>

    <div class="group-label" id="set-habits">Gewohnheiten</div>
    <div class="group" id="habit-list">${habitsList()}</div>

    <div class="group-label" id="set-reminder">Erinnerung</div>
    <div class="group">
      <label class="li" for="set-rem-time"><span class="li-ic">${icon('bell')}</span><span class="li-title">Jeden Abend um</span><input type="time" id="set-rem-time" value="${st.reminderTime}" data-change="set-rem-time"></label>
      <button type="button" class="li" data-act="reminder-add"><span class="li-ic">${icon('calendar')}</span><span class="li-main"><span class="li-title" style="color:var(--accent-2)">Zum iPhone-Kalender hinzufügen</span>${
        st.reminderSet ? '<span class="li-sub">Schon eingerichtet. Für eine neue Uhrzeit den alten Termin im Kalender löschen.</span>' : ''
      }</span></button>
    </div>
    <div class="group-note">Die Mitteilung kommt dann jeden Abend von deinem iPhone-Kalender. Öffne Luna danach über das Symbol auf deinem Home-Bildschirm.</div>

    <div class="group-label" id="set-lock">Sperre</div>
    <div class="group">
      <label class="li" for="set-pin"><span class="li-ic">${icon('lock')}</span><span class="li-title li-main">PIN-Sperre</span>${sw('set-pin', !!st.pinHash, 'data-change="set-pin"')}</label>
      ${
        st.pinHash
          ? `<label class="li" for="set-lock-after"><span class="li-title li-main">Sperren</span><select id="set-lock-after" data-change="set-lock-after">${lockOpts
              .map(([v, l]) => `<option value="${v}" ${st.lockAfter === v ? 'selected' : ''}>${l}</option>`)
              .join('')}</select></label>
             <button type="button" class="li" data-act="pin-change"><span class="li-title" style="color:var(--accent-2)">PIN ändern</span></button>`
          : ''
      }
    </div>
    <div class="group-note">Die PIN schützt vor neugierigen Blicken. Vergisst du sie, lässt sich Luna nur zurücksetzen – mit allen Daten.</div>

    <div class="group-label" id="set-data">Daten</div>
    <div class="group">
      <button type="button" class="li" data-act="backup"><span class="li-ic">${icon('download')}</span><span class="li-main"><span class="li-title">Backup erstellen</span><span class="li-sub">${
        st.lastBackup ? `Zuletzt am ${new Date(st.lastBackup).toLocaleDateString('de-DE')}` : 'Noch nie gesichert'
      }</span></span><span class="li-end">${icon('chevR')}</span></button>
      <label class="li"><span class="li-ic">${icon('upload')}</span><span class="li-main"><span class="li-title">Backup wiederherstellen</span><span class="li-sub">Luna-Backup (.json) auswählen</span></span><span class="li-end">${icon('chevR')}</span><input type="file" accept="application/json,.json" data-change="backup-import" class="sr"></label>
      ${
        hasDemo()
          ? `<button type="button" class="li" data-act="demo-remove"><span class="li-ic">${icon('sparkle')}</span><span class="li-main"><span class="li-title">Beispieldaten entfernen</span><span class="li-sub">Deine eigenen Einträge bleiben</span></span></button>`
          : `<button type="button" class="li" data-act="demo-load"><span class="li-ic">${icon('sparkle')}</span><span class="li-main"><span class="li-title">Beispieldaten laden</span><span class="li-sub">Zum Ausprobieren, lassen sich wieder entfernen</span></span></button>`
      }
      <button type="button" class="li danger" data-act="wipe"><span class="li-ic" style="color:inherit">${icon('trash')}</span><span class="li-title">Alle Daten löschen</span></button>
    </div>
    ${S.memoryOnly ? '<div class="group-note" style="color:var(--m2)">Dieser Browser erlaubt keine dauerhafte Speicherung. Einträge gehen beim Schließen verloren.</div>' : ''}

    <div class="group-label">Als App installieren</div>
    <div class="group pad"><ol class="steps">
      <li><span>Öffne Luna in <b>Safari</b>.</span></li>
      <li><span>Tippe auf ${icon('share', 'inline-ic')} <b>Teilen</b>.</span></li>
      <li><span>Wähle <b>„Zum Home-Bildschirm“</b> und tippe auf <b>Hinzufügen</b>.</span></li>
    </ol></div>

    <div class="about">${logoSVG('')}<b>Luna</b><span>Version ${VERSION} · Deine Daten bleiben auf diesem Gerät.</span></div>
  </div>`;
}

let settingsSheet = null;
export function openSettings(section) {
  settingsSheet = openSheet({
    title: 'Einstellungen',
    cls: 'tall',
    body: settingsHTML(),
    onClose: () => {
      settingsSheet = null;
      app.refresh();
    },
  });
  if (section) {
    setTimeout(() => settingsSheet?.body.querySelector(`#set-${section}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 420);
  }
}
function rerenderSettings() {
  if (!settingsSheet || settingsSheet.closed) return;
  const top = settingsSheet.body.scrollTop;
  settingsSheet.body.innerHTML = settingsHTML();
  settingsSheet.body.scrollTop = top;
}

act('settings', (el) => openSettings(el.dataset.section));
act('set-food-goal', () => openSetup({ onDone: rerenderSettings }));
act('set-smoke', () => openSmokeSetup({ onDone: rerenderSettings }));
onChange('set-tab', (el) => {
  saveSettings({ tabs: { ...S.settings.tabs, [el.dataset.key]: el.checked } });
  app.rebuildTabs?.();
  haptic();
  setTimeout(rerenderSettings, 250);
});
act('set-food-key', () => openKeySheet(null, rerenderSettings));
const saveName = debounce((v) => saveSettings({ name: v }), 300);
onInput('set-name', (el) => saveName(el.value.trim()));
act('set-look', (el) => {
  saveSettings({ look: el.dataset.v });
  setSeg(el);
  applySettings();
  haptic();
});
act('set-accent', (el) => {
  saveSettings({ accent: el.dataset.v });
  applySettings();
  el.parentElement.querySelectorAll('.color').forEach((c) => c.classList.toggle('on', c === el));
  haptic();
});
onChange('set-flag', (el) => {
  saveSettings({ [el.dataset.key]: el.checked });
  applySettings();
  haptic();
});
onChange('set-nested', (el) => {
  const g = el.dataset.group;
  saveSettings({ [g]: { ...S.settings[g], [el.dataset.key]: el.checked } });
  haptic();
});
act('set-water', (el) => {
  const v = clamp(S.settings.waterGoal + Number(el.dataset.d), 1, 20);
  saveSettings({ waterGoal: v });
  document.getElementById('set-water-out').textContent = v;
  document.getElementById('set-water-sub').textContent = `${v} Gläser à ${S.settings.glassMl} ml`;
  haptic();
});
act('habit-emoji', (el) => {
  const input = document.getElementById('habit-emoji');
  input.value = el.dataset.e;
  el.parentElement.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b === el));
  haptic();
});
act('habit-add', () => {
  const nameEl = document.getElementById('habit-name');
  const name = nameEl.value.trim();
  if (!name) {
    nameEl.classList.remove('shake');
    void nameEl.offsetWidth;
    nameEl.classList.add('shake');
    nameEl.focus();
    return;
  }
  const emoji = document.getElementById('habit-emoji').value.trim() || '✨';
  saveSettings({ habits: [...S.settings.habits, { id: uid(), name, emoji }] });
  document.getElementById('habit-list').innerHTML = habitsList();
  haptic('success');
});
act('habit-del', (el) => {
  const removed = S.settings.habits.find((h) => h.id === el.dataset.id);
  const before = S.settings.habits;
  saveSettings({ habits: before.filter((h) => h.id !== el.dataset.id) });
  document.getElementById('habit-list').innerHTML = habitsList();
  haptic();
  toast(`„${removed?.name}“ entfernt`, {
    action: 'Rückgängig',
    ms: 4500,
    onAction: () => {
      saveSettings({ habits: before });
      const list = document.getElementById('habit-list');
      if (list) list.innerHTML = habitsList();
    },
  });
});
onChange('set-rem-time', (el) => saveSettings({ reminderTime: el.value || '21:00' }));
act('reminder-add', () => {
  const time = document.getElementById('set-rem-time')?.value || S.settings.reminderTime;
  if (openInCalendar(reminderICS(time), 'luna-abend-erinnerung.ics')) {
    saveSettings({ reminderSet: true, reminderTime: time });
    setTimeout(rerenderSettings, 800);
  }
});
onChange('set-lock-after', (el) => saveSettings({ lockAfter: Number(el.value) }));

/* ---------- Abend-Erinnerung (aus dem Heute-Hinweis) ---------- */
export function openReminderSheet() {
  const sheet = openSheet({
    title: 'Abend-Erinnerung',
    body: `<div class="form">
      <p class="muted">Dein iPhone-Kalender erinnert dich jeden Abend an dein Journal. Wähle die Uhrzeit und übernimm den Termin.</p>
      <div class="group"><label class="li" for="rem-time"><span class="li-ic">${icon('bell')}</span><span class="li-title">Jeden Abend um</span><input type="time" id="rem-time" value="${S.settings.reminderTime}"></label></div>
      <button type="button" class="btn btn-primary btn-lg btn-block" id="rem-add">${icon('calendar')} Zum iPhone-Kalender hinzufügen</button>
      <p class="note">Die Mitteilung kommt vom Kalender. Öffne Luna danach über das Symbol auf deinem Home-Bildschirm.</p>
    </div>`,
  });
  sheet.body.querySelector('#rem-add').addEventListener('click', () => {
    const time = sheet.body.querySelector('#rem-time').value || '21:00';
    saveSettings({ reminderTime: time });
    if (openInCalendar(reminderICS(time), 'luna-abend-erinnerung.ics')) {
      saveSettings({ reminderSet: true });
      setTimeout(() => sheet.close(), 900);
    }
  });
}
act('reminder', () => openReminderSheet());

/* ---------- Backup ---------- */
export async function exportBackup() {
  const sheet = openSheet({ title: 'Backup', body: '<div class="success"><div class="spinner"></div><p class="muted">Backup wird vorbereitet …</p></div>' });
  let blob;
  let data;
  try {
    data = await buildBackup();
    blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
  } catch (e) {
    console.error(e);
    sheet.body.innerHTML = '<p class="muted center">Das Backup konnte nicht erstellt werden.</p>';
    return;
  }
  const name = `luna-backup-${today()}.json`;
  sheet.body.innerHTML = `<div class="success">
    <div class="tip-ic" style="width:64px;height:64px;border-radius:20px">${icon('download', 'lg')}</div>
    <h3>Dein Backup ist bereit</h3>
    <p class="muted">${data.journal.length} Einträge · ${data.sleep.length} Nächte · ${data.events.length} Termine · ${data.food.length} Mahlzeiten · ${data.photos.length + data.foodPics.length} Fotos · ${fmtBytes(blob.size)}</p>
    <button type="button" class="btn btn-primary btn-lg" id="bk-save">${icon('share')} Sichern</button>
    <p class="note">Wähle im nächsten Schritt „In Dateien sichern“, am besten in iCloud Drive. So kannst du alles auf einem neuen iPhone wiederherstellen.</p>
  </div>`;
  sheet.body.querySelector('#bk-save').addEventListener('click', async () => {
    try {
      await saveFile(blob, name);
      await saveSettings({ lastBackup: Date.now() });
      toast('Backup gesichert', { icon: icon('check') });
      sheet.close();
      rerenderSettings();
    } catch (e) {
      if (e?.name === 'AbortError' || e?.code === 'declined') return;
      console.error(e);
      toast('Sichern hat nicht geklappt. Versuch es noch einmal.');
    }
  });
}
act('backup', () => exportBackup());
onChange('backup-import', async (el) => {
  const file = el.files?.[0];
  el.value = '';
  if (!file) return;
  let data;
  try {
    data = JSON.parse(await file.text());
  } catch {
    toast('Die Datei ließ sich nicht lesen.');
    return;
  }
  if (data?.app !== 'luna') {
    toast('Das ist kein Luna-Backup.');
    return;
  }
  const when = data.exportedAt ? new Date(data.exportedAt).toLocaleDateString('de-DE') : 'unbekannt';
  const ok = await confirmDialog({
    title: 'Backup wiederherstellen?',
    text: `${data.journal?.length || 0} Einträge, ${data.sleep?.length || 0} Nächte, ${data.events?.length || 0} Termine, ${data.food?.length || 0} Mahlzeiten und ${data.photos?.length || 0} Fotos vom ${when}. Einträge vom selben Tag werden ersetzt.`,
    ok: 'Wiederherstellen',
  });
  if (!ok) return;
  try {
    const r = await restoreBackup(data);
    applySettings();
    app.rebuildTabs?.();
    toast(`Wiederhergestellt: ${r.journal} Einträge, ${r.food} Mahlzeiten, ${r.photos} Fotos`, { icon: icon('check') });
    rerenderSettings();
  } catch (e) {
    toast(e?.message || 'Wiederherstellen hat nicht geklappt.');
  }
});
act('demo-load', async () => {
  await loadDemo();
  toast('Beispieldaten geladen', { icon: icon('sparkle') });
  rerenderSettings();
});
act('demo-remove', async () => {
  const ok = await confirmDialog({ title: 'Beispieldaten entfernen?', text: 'Deine eigenen Einträge bleiben erhalten.', ok: 'Entfernen' });
  if (!ok) return;
  await removeDemo();
  toast('Beispieldaten entfernt');
  rerenderSettings();
});
act('wipe', async () => {
  const ok = await confirmDialog({
    title: 'Alle Daten löschen?',
    text: 'Journal, Schlaf, Termine, Essen, Rauchfrei, Fotos und Einstellungen werden von diesem Gerät gelöscht. Das lässt sich nicht rückgängig machen.',
    ok: 'Alles löschen',
    danger: true,
  });
  if (!ok) return;
  const sure = await confirmDialog({ title: 'Wirklich alles?', text: 'Hast du vorher ein Backup gemacht?', ok: 'Ja, löschen', danger: true });
  if (!sure) return;
  await wipeAll();
  location.reload();
});

/* ---------- PIN ---------- */
async function hashPin(pin, salt) {
  const data = new TextEncoder().encode(`${salt}:${pin}`);
  if (crypto?.subtle) {
    const buf = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
  }
  let h = 2166136261;
  for (const b of data) h = Math.imul(h ^ b, 16777619);
  return `fnv${(h >>> 0).toString(16)}`;
}
const checkPin = async (pin) => (await hashPin(pin, S.settings.pinSalt)) === S.settings.pinHash;

function pinSheet(title, message, onPin) {
  const sheet = openSheet({
    title,
    body: `<div class="lock-in" style="margin:0 auto;padding:6px 0 4px">${icon('lock', 'lg')}<p class="pin-msg">${esc(message)}</p>${pinDotsHTML()}${keypadHTML()}</div>`,
  });
  const msg = sheet.body.querySelector('.pin-msg');
  pinPad(sheet.body, { onComplete: (v, p) => onPin(v, p, msg, sheet) });
  return sheet;
}
function openPinSetup() {
  let first = null;
  pinSheet('PIN festlegen', 'Wähle eine 4-stellige PIN', async (v, p, msg, sheet) => {
    if (!first) {
      first = v;
      msg.textContent = 'Gib die PIN noch einmal ein';
      p.reset();
      return;
    }
    if (v !== first) {
      first = null;
      msg.textContent = 'Die PINs stimmen nicht überein. Noch mal von vorn.';
      p.shake();
      p.reset();
      return;
    }
    const salt = uid();
    await saveSettings({ pinHash: await hashPin(v, salt), pinSalt: salt });
    sheet.body.querySelector('.pin-dots').classList.add('ok');
    haptic('success');
    setTimeout(() => {
      sheet.close();
      toast('PIN-Sperre ist an', { icon: icon('lock') });
      rerenderSettings();
    }, 450);
  });
}
function openPinVerify(onOk) {
  pinSheet('Aktuelle PIN', 'Gib deine aktuelle PIN ein', async (v, p, msg, sheet) => {
    if (await checkPin(v)) {
      sheet.close();
      onOk();
    } else {
      msg.textContent = 'Falsche PIN';
      p.shake();
      p.reset();
    }
  });
}
onChange('set-pin', (el) => {
  const wants = el.checked;
  el.checked = !!S.settings.pinHash;
  if (wants) openPinSetup();
  else {
    openPinVerify(async () => {
      await saveSettings({ pinHash: null, pinSalt: null });
      toast('PIN-Sperre ist aus');
      rerenderSettings();
    });
  }
});
act('pin-change', () => openPinVerify(() => openPinSetup()));

/* ---------- Sperrbildschirm ---------- */
let lockEl = null;
export const isLocked = () => !!lockEl;
export function showLock() {
  if (lockEl || !S.settings.pinHash) return;
  stopDictation();
  document.activeElement?.blur?.();
  lockEl = document.createElement('div');
  lockEl.className = 'lock';
  lockEl.innerHTML = `${starsHTML(18, 3)}<div class="lock-in">${logoSVG('logo')}<h2>Luna ist gesperrt</h2><p class="pin-msg" id="lock-msg">Gib deine PIN ein</p>${pinDotsHTML()}${keypadHTML()}<button type="button" class="link small" id="lock-forgot">PIN vergessen?</button></div>`;
  document.body.appendChild(lockEl);
  lockScroll();
  const el = lockEl;
  const msg = el.querySelector('#lock-msg');
  let fails = 0;
  let until = 0;
  const pad = pinPad(el, {
    onComplete: async (v, p) => {
      if (Date.now() < until) {
        p.reset();
        return;
      }
      if (await checkPin(v)) {
        el.querySelector('.pin-dots').classList.add('ok');
        haptic('success');
        document.removeEventListener('keydown', onKey);
        lockEl = null;
        setTimeout(() => {
          el.classList.add('out');
          unlockScroll();
          setTimeout(() => el.remove(), 520);
        }, 180);
        return;
      }
      fails++;
      p.shake();
      p.reset();
      if (fails >= 5) {
        until = Date.now() + 30000;
        fails = 0;
        msg.textContent = 'Zu viele Versuche. Warte 30 Sekunden.';
        setTimeout(() => {
          msg.textContent = 'Gib deine PIN ein';
        }, 30000);
      } else {
        msg.textContent = 'Falsche PIN';
      }
    },
  });
  const onKey = (e) => {
    if (/^\d$/.test(e.key)) pad.press(e.key);
    else if (e.key === 'Backspace') pad.press('del');
  };
  document.addEventListener('keydown', onKey);
  el.querySelector('#lock-forgot').addEventListener('click', async () => {
    const ok = await confirmDialog({
      title: 'Luna zurücksetzen?',
      text: 'Ohne PIN kommst du nicht mehr an deine Einträge. Beim Zurücksetzen werden alle Daten auf diesem Gerät gelöscht.',
      ok: 'Alles löschen',
      danger: true,
    });
    if (!ok) return;
    await wipeAll();
    location.reload();
  });
}

/* ---------- Willkommen ---------- */
export function showOnboarding() {
  const el = document.createElement('div');
  el.className = 'onb';
  el.innerHTML = `${starsHTML(26, 11)}<div class="onb-in">
    ${logoSVG('logo')}
    <h1>Willkommen bei <em>Luna</em></h1>
    <p class="lead">Dein Tagebuch für den Abend: wie dein Tag war, wie du geschlafen hast und was als Nächstes ansteht.</p>
    <div class="feats">
      <div class="feat"><span class="fi">${icon('journal')}</span><p><b>Abend-Journal</b>Smileys, ein paar Sätze, ein Foto. Tippen oder einfach reinsprechen.</p></div>
      <div class="feat"><span class="fi">${icon('moon')}</span><p><b>Schlaf-Kalender</b>Grün ab 8 Stunden, gelb ab 7, rot darunter.</p></div>
      <div class="feat"><span class="fi">${icon('calendar')}</span><p><b>Termine</b>Dein iPhone-Kalender erinnert dich rechtzeitig.</p></div>
    </div>
    <label class="lbl" for="onb-name">Wie heißt du?<input class="field" id="onb-name" placeholder="Dein Vorname (optional)" autocomplete="given-name" maxlength="30" enterkeyhint="done"></label>
    <div class="onb-actions">
      <button type="button" class="btn btn-primary btn-lg" id="onb-go">Los geht’s</button>
      <button type="button" class="btn btn-ghost" id="onb-demo">Erst mal mit Beispieldaten ausprobieren</button>
      ${IS_IOS && !IS_STANDALONE ? `<p class="note center">Tipp: In Safari auf ${icon('share', 'inline-ic')} Teilen und dann „Zum Home-Bildschirm“ – dann startet Luna wie eine App.</p>` : ''}
    </div>
  </div>`;
  document.body.appendChild(el);
  lockScroll();
  const finish = async (demo) => {
    const name = el.querySelector('#onb-name').value.trim();
    el.querySelectorAll('button').forEach((b) => (b.disabled = true));
    await saveSettings({ name, onboarded: true });
    if (demo) await loadDemo();
    haptic('success');
    el.classList.add('out');
    unlockScroll();
    setTimeout(() => el.remove(), 460);
    app.refresh({ animate: true });
    if (demo) toast('Beispieldaten geladen. Entfernen kannst du sie in den Einstellungen.', { ms: 4500 });
  };
  el.querySelector('#onb-go').addEventListener('click', () => finish(false));
  el.querySelector('#onb-demo').addEventListener('click', () => finish(true));
}
