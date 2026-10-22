// Luna · Nährwert-Schätzung über die Gemini-API (Foto oder Beschreibung).
// Der Schlüssel liegt nur in den Einstellungen auf dem Gerät; Anfragen gehen direkt vom iPhone an Google.
import { S, saveNutrition } from './store.js';

const BASE = 'https://generativelanguage.googleapis.com/v1beta';

export class GeminiError extends Error {
  constructor(kind, message) {
    super(message);
    this.kind = kind; // key | quota | busy | offline | blocked | model | parse | unknown
  }
}

const MESSAGES = {
  key: 'Der Gemini-Schlüssel stimmt nicht. Prüf ihn in den Einstellungen unter Ernährung.',
  quota: 'Das kostenlose Gemini-Kontingent ist gerade aufgebraucht. Versuch es später noch einmal oder trag es über die Liste ein.',
  busy: 'Gemini ist gerade überlastet. Versuch es gleich noch einmal.',
  offline: 'Keine Verbindung. Ohne Internet geht die Schätzung nicht, die Liste funktioniert aber.',
  blocked: 'Gemini hat das Bild nicht ausgewertet. Versuch ein anderes Foto oder beschreib das Essen.',
  model: 'Kein passendes Gemini-Modell gefunden. Prüf den Schlüssel in den Einstellungen.',
  parse: 'Die Antwort war unvollständig. Versuch es noch einmal.',
  timeout: 'Gemini hat zu lange gebraucht. Vielleicht ist das Netz gerade schwach, versuch es noch einmal.',
  cancel: 'Abgebrochen.',
  unknown: 'Die Schätzung hat nicht geklappt. Versuch es noch einmal.',
};
export const errorText = (e) => (e instanceof GeminiError ? e.message : MESSAGES.unknown);
const fail = (kind) => new GeminiError(kind, MESSAGES[kind]);

// Mit Zeitlimit; signal bricht ab, wenn das Sheet geschlossen wird
async function call(url, opts, key, { signal = null, timeout = 45000 } = {}) {
  const ctrl = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    ctrl.abort();
  }, timeout);
  const cancel = () => ctrl.abort();
  if (signal?.aborted) cancel();
  signal?.addEventListener('abort', cancel);
  let res;
  let body;
  try {
    res = await fetch(url, { ...opts, signal: ctrl.signal, headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key, ...(opts.headers || {}) } });
    body = await res.json().catch(() => null);
    if (ctrl.signal.aborted) throw new Error('abgebrochen');
  } catch {
    throw fail(timedOut ? 'timeout' : ctrl.signal.aborted ? 'cancel' : 'offline');
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', cancel);
  }
  if (res.ok) {
    if (!body) throw fail('parse');
    return body;
  }
  const msg = body?.error?.message || '';
  if (res.status === 400 && /api key/i.test(msg)) throw fail('key');
  if (res.status === 401 || res.status === 403) throw fail('key');
  if (res.status === 404) throw fail('model');
  if (res.status === 429) throw fail('quota');
  if (res.status >= 500) throw fail('busy');
  console.warn('Gemini', res.status, msg);
  throw fail('unknown');
}

/* Bestes verfügbares Flash-Modell aussuchen: „flash-latest“ wenn vorhanden, sonst die höchste stabile Flash-Version. */
export async function findModel(key, signal = null) {
  const data = await call(`${BASE}/models?pageSize=1000`, { method: 'GET' }, key, { signal, timeout: 20000 });
  const models = (data.models || [])
    .filter((m) => (m.supportedGenerationMethods || []).includes('generateContent'))
    .map((m) => m.name.replace(/^models\//, ''))
    .filter((n) => /flash/.test(n) && !/(lite|tts|image|live|audio|embed|thinking|8b|exp|computer)/.test(n));
  if (!models.length) throw fail('model');
  if (models.includes('gemini-flash-latest')) return 'gemini-flash-latest';
  const score = (n) => {
    const v = parseFloat((n.match(/gemini-(\d+(?:\.\d+)?)/) || [])[1] || '0');
    return v * 10 - (/preview/.test(n) ? 1 : 0) - (/-\d{3}$/.test(n) ? 0.5 : 0);
  };
  return models.sort((a, b) => score(b) - score(a))[0];
}

export async function connect(key) {
  const model = await findModel(key.trim());
  await saveNutrition({ geminiKey: key.trim(), geminiModel: model });
  return model;
}

const SCHEMA = {
  type: 'OBJECT',
  properties: {
    dish: { type: 'STRING', description: 'kurzer deutscher Name der ganzen Mahlzeit' },
    items: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          name: { type: 'STRING' },
          amount: { type: 'STRING', description: 'geschätzte Menge, z. B. "ca. 250 g" oder "2 Scheiben"' },
          grams: { type: 'NUMBER' },
          kcal: { type: 'NUMBER' },
          protein: { type: 'NUMBER' },
          carbs: { type: 'NUMBER' },
          fat: { type: 'NUMBER' },
        },
        required: ['name', 'amount', 'kcal', 'protein', 'carbs', 'fat'],
      },
    },
    confidence: { type: 'STRING', enum: ['hoch', 'mittel', 'niedrig'] },
    hint: { type: 'STRING', description: 'kurzer Hinweis auf Deutsch, z. B. was unsicher ist; leer wenn nichts' },
  },
  required: ['dish', 'items', 'confidence'],
};

function prompt({ image, text, note }) {
  return [
    'Du bist Ernährungsberater und schätzt Nährwerte für eine Kalorien-App. Der Nutzer ist ein junger Mann, der zunehmen möchte, und will realistische Werte, nicht vorsichtige.',
    image
      ? 'Schätze, was auf dem Foto gegessen wird. Erkenne die einzelnen Bestandteile und schätze die Portionsgrößen anhand von Teller, Besteck, Händen oder Verpackung.'
      : `Schätze die Nährwerte dieser Beschreibung: "${text}".`,
    'Rechne typische unsichtbare Zutaten realistisch mit ein (Öl zum Braten, Butter, Soßen, Dressing, Zucker in Getränken).',
    'Gib für jeden Bestandteil Menge, kcal, Eiweiß, Kohlenhydrate und Fett in Gramm an (nur Zahlen). Fasse sehr kleine Dinge sinnvoll zusammen, höchstens 8 Bestandteile.',
    note ? `Zusatzinfo vom Nutzer, die Vorrang hat: "${note}".` : '',
    image ? 'Ist auf dem Foto kein Essen oder Getränk zu erkennen, gib eine leere Liste zurück und erkläre es im Hinweis.' : '',
    'Antworte auf Deutsch.',
  ]
    .filter(Boolean)
    .join('\n');
}

const num = (v) => (Number.isFinite(+v) ? Math.max(0, Math.round(+v * 10) / 10) : 0);

export async function estimate({ image = null, mime = 'image/jpeg', text = '', note = '', signal = null }) {
  const n = S.settings.nutrition;
  if (!n.geminiKey) throw fail('key');
  let model = n.geminiModel || (await findModel(n.geminiKey, signal));
  const body = {
    contents: [
      {
        role: 'user',
        parts: [...(image ? [{ inline_data: { mime_type: mime, data: image } }] : []), { text: prompt({ image, text, note }) }],
      },
    ],
    generationConfig: { temperature: 0.2, responseMimeType: 'application/json', responseSchema: SCHEMA },
  };
  const send = (m) => call(`${BASE}/models/${m}:generateContent`, { method: 'POST', body: JSON.stringify(body) }, n.geminiKey, { signal });
  let data;
  try {
    data = await send(model);
  } catch (e) {
    // Modell inzwischen abgeschaltet? Einmal neu suchen.
    if (!(e instanceof GeminiError) || e.kind !== 'model') throw e;
    model = await findModel(n.geminiKey, signal);
    await saveNutrition({ geminiModel: model });
    data = await send(model);
  }
  if (!n.geminiModel) saveNutrition({ geminiModel: model });
  if (data?.promptFeedback?.blockReason) throw fail('blocked');
  const raw = (data?.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('');
  let out;
  try {
    out = JSON.parse(raw.replace(/^```(?:json)?\s*|\s*```$/g, ''));
  } catch {
    throw fail('parse');
  }
  const items = (Array.isArray(out.items) ? out.items : []).map((it) => ({
    name: String(it.name || 'Unbekannt').slice(0, 60),
    amount: String(it.amount || '').slice(0, 60),
    grams: num(it.grams),
    kcal: num(it.kcal),
    p: num(it.protein),
    c: num(it.carbs),
    f: num(it.fat),
  }));
  return {
    dish: String(out.dish || items[0]?.name || 'Mahlzeit').slice(0, 60),
    items,
    confidence: ['hoch', 'mittel', 'niedrig'].includes(out.confidence) ? out.confidence : 'mittel',
    hint: String(out.hint || '').slice(0, 200),
    model,
  };
}
