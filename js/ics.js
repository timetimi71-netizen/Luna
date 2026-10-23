// Luna · Kalender-Dateien (.ics) für den iPhone-Kalender und Datei-Export
import { addDays, addMin, toMin, today, b64urlEncode, IS_PREVIEW, IS_IOS, slug, toast } from './util.js';

export const REPEATS = [
  ['none', 'Nie'],
  ['daily', 'Täglich'],
  ['weekly', 'Wöchentlich'],
  ['biweekly', 'Alle 2 Wochen'],
  ['monthly', 'Monatlich'],
  ['yearly', 'Jährlich'],
];
export const ALARMS_TIMED = [
  ['none', 'Keine'],
  ['m0', 'Zum Termin'],
  ['m5', '5 Min. vorher'],
  ['m10', '10 Min. vorher'],
  ['m15', '15 Min. vorher'],
  ['m30', '30 Min. vorher'],
  ['m60', '1 Std. vorher'],
  ['m120', '2 Std. vorher'],
  ['m1440', '1 Tag vorher'],
];
export const ALARMS_ALLDAY = [
  ['none', 'Keine'],
  ['d9', 'Am Tag um 9:00'],
  ['e18', 'Am Vortag um 18:00'],
  ['w9', '1 Woche vorher um 9:00'],
];
export const alarmLabel = (ev) =>
  ((ev.allDay ? ALARMS_ALLDAY : ALARMS_TIMED).find((a) => a[0] === ev.alarm) || ['none', 'Keine'])[1];
// Für Sätze wie „… dich 15 Minuten vorher erinnert“
export const alarmPhrase = (ev) =>
  ({
    m0: 'zum Termin',
    m5: '5 Minuten vorher',
    m10: '10 Minuten vorher',
    m15: '15 Minuten vorher',
    m30: 'eine halbe Stunde vorher',
    m60: 'eine Stunde vorher',
    m120: 'zwei Stunden vorher',
    m1440: 'einen Tag vorher',
    d9: 'am Tag um 9 Uhr',
    e18: 'am Vortag um 18 Uhr',
    w9: 'eine Woche vorher',
  })[ev.alarm] || 'rechtzeitig';

const RRULE = {
  daily: 'FREQ=DAILY',
  weekly: 'FREQ=WEEKLY',
  biweekly: 'FREQ=WEEKLY;INTERVAL=2',
  monthly: 'FREQ=MONTHLY',
  yearly: 'FREQ=YEARLY',
};

const txt = (s = '') => String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
const compact = (date) => date.replace(/-/g, '');
// „Schwebende“ Ortszeit ohne Zeitzone: 21:00 bleibt 21:00, auch nach der Zeitumstellung.
const dt = (date, time) => `${compact(date)}T${time.replace(':', '')}00`;
const stamp = () => new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

function fold(line) {
  const enc = new TextEncoder();
  if (enc.encode(line).length <= 75) return line;
  const out = [];
  let cur = '';
  let len = 0;
  for (const ch of line) {
    const l = enc.encode(ch).length;
    if (len + l > (out.length ? 74 : 75)) {
      out.push(cur);
      cur = '';
      len = 0;
    }
    cur += ch;
    len += l;
  }
  out.push(cur);
  return out.join('\r\n ');
}

function trigger(ev) {
  const a = ev.alarm;
  if (!a || a === 'none') return null;
  if (ev.allDay) return { d9: 'PT9H', e18: '-PT6H', w9: '-P6DT15H' }[a] || 'PT9H';
  const m = Number(a.slice(1));
  if (!m) return 'PT0M';
  if (m % 1440 === 0) return `-P${m / 1440}D`;
  if (m % 60 === 0) return `-PT${m / 60}H`;
  return `-PT${m}M`;
}

function vevent(ev) {
  const L = ['BEGIN:VEVENT', `UID:${ev.id}@luna-tagebuch`, `DTSTAMP:${stamp()}`, `SUMMARY:${txt(ev.title)}`];
  if (ev.allDay) {
    L.push(`DTSTART;VALUE=DATE:${compact(ev.date)}`, `DTEND;VALUE=DATE:${compact(addDays(ev.date, 1))}`);
  } else {
    const start = ev.start || '09:00';
    const end = ev.end || addMin(start, 60);
    const endDate = toMin(end) <= toMin(start) ? addDays(ev.date, 1) : ev.date;
    L.push(`DTSTART:${dt(ev.date, start)}`, `DTEND:${dt(endDate, end)}`);
  }
  if (ev.location) L.push(`LOCATION:${txt(ev.location)}`);
  if (ev.notes) L.push(`DESCRIPTION:${txt(ev.notes)}`);
  if (RRULE[ev.repeat]) L.push(`RRULE:${RRULE[ev.repeat]}`);
  const trig = trigger(ev);
  if (trig) L.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${txt(ev.title)}`, `TRIGGER:${trig}`, 'END:VALARM');
  L.push('END:VEVENT');
  return L;
}

// Mehrere Termine in einer Datei (z. B. Rauchfrei-Meilensteine)
export function eventsToICS(list) {
  const L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Luna//Tagebuch//DE', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH'];
  list.forEach((ev) => L.push(...vevent(ev)));
  L.push('END:VCALENDAR');
  return `${L.map(fold).join('\r\n')}\r\n`;
}
export const eventToICS = (ev) => eventsToICS([ev]);

export function reminderICS(time) {
  return eventToICS({
    id: 'luna-abend-journal',
    title: 'Abend-Journal ✍️',
    date: today(),
    start: time,
    end: addMin(time, 10),
    repeat: 'daily',
    alarm: 'm0',
    notes: 'Zeit für deinen Tagesrückblick in Luna.',
  });
}

export const icsName = (ev) => `${slug(ev.title)}.ics`;

/* In den iPhone-Kalender:
   Der Service Worker liefert die Datei unter einer echten Adresse mit dem Typ text/calendar aus.
   Safari erkennt das und zeigt die Vorschau mit „Zum Kalender hinzufügen“ – die App bleibt dabei offen. */
export function openInCalendar(ics, filename) {
  if (IS_PREVIEW) {
    toast('In der Vorschau geht das nicht – in der installierten App schon.', { ms: 3600 });
    return false;
  }
  if (navigator.serviceWorker?.controller) {
    location.href = `./ics/${encodeURIComponent(filename)}?d=${b64urlEncode(ics)}`;
    return true;
  }
  const a = document.createElement('a');
  a.href = `data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}`;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  return true;
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

// Datei sichern: auf dem iPhone über das Teilen-Menü („In Dateien sichern“), sonst als Download.
export async function saveFile(blob, filename) {
  if (IS_PREVIEW) {
    const dl = await window.claude?.use?.('downloads');
    if (!dl) throw Object.assign(new Error('unavailable'), { code: 'unavailable' });
    await dl.save({ filename, data: blob });
    return 'saved';
  }
  const file = new File([blob], filename, { type: blob.type || 'application/octet-stream' });
  if (IS_IOS && navigator.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file] });
    return 'shared';
  }
  downloadBlob(blob, filename);
  return 'downloaded';
}

export async function shareICS(ics, filename) {
  const blob = new Blob([ics], { type: 'text/calendar' });
  const file = new File([blob], filename, { type: 'text/calendar' });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return true;
    } catch (e) {
      if (e?.name === 'AbortError') return false;
    }
  }
  downloadBlob(blob, filename);
  return true;
}
