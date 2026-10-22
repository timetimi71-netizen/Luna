// Luna · Diagramme als SVG (Balken für Schlaf, Linie für Smiley-Verläufe)
import { esc, fmtNum } from './util.js';
import { faceInner } from './ui.js';

const W = 340;

/* Balken: items = [{ label, value|null, cls, hl }] */
export function barChart({ items, max, target = null, height = 160, targetLabel = '' }) {
  const H = height;
  const padT = 20;
  const padB = 24;
  const padX = 4;
  const n = items.length;
  const slot = (W - padX * 2) / n;
  const bw = Math.min(20, slot * 0.6);
  const inner = H - padT - padB;
  const y = (v) => padT + inner * (1 - Math.min(v, max) / max);
  let s = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Balkendiagramm">`;
  s += `<line class="base" x1="${padX}" x2="${W - padX}" y1="${y(0)}" y2="${y(0)}"/>`;
  items.forEach((it, i) => {
    const cx = padX + slot * i + slot / 2;
    if (it.value != null && it.value > 0) {
      const h = Math.max(4, inner * (Math.min(it.value, max) / max));
      s += `<rect class="bar-r ${it.cls || ''}" style="--i:${i}" x="${(cx - bw / 2).toFixed(1)}" y="${(y(0) - h).toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" rx="${Math.min(6, bw / 2).toFixed(1)}"><title>${esc(it.title || '')}</title></rect>`;
    } else {
      s += `<rect class="bar-empty" x="${(cx - bw / 2).toFixed(1)}" y="${(y(0) - 3).toFixed(1)}" width="${bw.toFixed(1)}" height="3" rx="1.5"/>`;
    }
    if (it.label) s += `<text x="${cx.toFixed(1)}" y="${H - 7}" text-anchor="middle" class="${it.hl ? 'hl' : ''}">${esc(it.label)}</text>`;
  });
  if (target != null) {
    const ty = y(target).toFixed(1);
    s += `<line class="target" x1="${padX}" x2="${W - padX}" y1="${ty}" y2="${ty}"/>`;
    s += `<text class="target-t" x="${W - padX}" y="${(y(target) - 6).toFixed(1)}" text-anchor="end">${esc(targetLabel)}</text>`;
  }
  return `${s}</svg>`;
}

/* Monotone Kurve (Steffen): bleibt zwischen den Punkten, schießt nicht über 1–5 hinaus */
function monotonePath(p) {
  const n = p.length;
  if (!n) return '';
  if (n === 1) return `M${p[0][0]},${p[0][1]}`;
  const dx = [];
  const m = [];
  for (let i = 0; i < n - 1; i++) {
    dx[i] = p[i + 1][0] - p[i][0];
    m[i] = (p[i + 1][1] - p[i][1]) / dx[i];
  }
  const t = [m[0]];
  for (let i = 1; i < n - 1; i++) {
    const pp = (m[i - 1] * dx[i] + m[i] * dx[i - 1]) / (dx[i - 1] + dx[i]);
    t[i] = (Math.sign(m[i - 1]) + Math.sign(m[i])) * Math.min(Math.abs(m[i - 1]), Math.abs(m[i]), 0.5 * Math.abs(pp)) || 0;
  }
  t[n - 1] = m[n - 2];
  let d = `M${p[0][0].toFixed(1)},${p[0][1].toFixed(1)}`;
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i] / 3;
    d += `C${(p[i][0] + h).toFixed(1)},${(p[i][1] + h * t[i]).toFixed(1)} ${(p[i + 1][0] - h).toFixed(1)},${(p[i + 1][1] - h * t[i + 1]).toFixed(1)} ${p[i + 1][0].toFixed(1)},${p[i + 1][1].toFixed(1)}`;
  }
  return d;
}

let gid = 0;
/* Linie: values = Zahlen 1–5 oder null, labels = [{ i, text, hl }] */
export function lineChart({ values, labels = [], height = 176 }) {
  const H = height;
  const padL = 30;
  const padR = 8;
  const padT = 12;
  const padB = 24;
  const n = values.length;
  const x = (i) => padL + (n === 1 ? (W - padL - padR) / 2 : ((W - padL - padR) * i) / (n - 1));
  const y = (v) => padT + (H - padT - padB) * (1 - (v - 1) / 4);
  const pts = [];
  values.forEach((v, i) => {
    if (v != null) pts.push([x(i), y(v), v]);
  });
  const id = `lg${++gid}`;
  let s = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Verlauf">`;
  s += `<defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(--accent);stop-opacity:.32"/><stop offset="1" style="stop-color:var(--accent);stop-opacity:0"/></linearGradient></defs>`;
  for (let l = 1; l <= 5; l++) {
    const yy = y(l).toFixed(1);
    s += `<line class="gridl" x1="${padL - 4}" x2="${W - padR}" y1="${yy}" y2="${yy}"/>`;
    s += `<svg x="2" y="${(y(l) - 9).toFixed(1)}" width="18" height="18" viewBox="0 0 48 48" style="opacity:.9">${faceInner(l)}</svg>`;
  }
  if (pts.length) {
    const d = monotonePath(pts);
    const base = y(1).toFixed(1);
    if (pts.length > 1) {
      s += `<path class="line-area" d="${d}L${pts[pts.length - 1][0].toFixed(1)},${base}L${pts[0][0].toFixed(1)},${base}Z" fill="url(#${id})"/>`;
      s += `<path class="line-path" d="${d}" pathLength="1"/>`;
    }
    const showDots = pts.length <= 40;
    pts.forEach(([px, py, v], i) => {
      if (showDots || i === pts.length - 1) {
        s += `<circle class="line-dot lv${Math.round(v)}" style="--i:${i}" cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="${pts.length > 20 ? 3.2 : 4.5}"><title>${fmtNum(v, 1)}</title></circle>`;
      }
    });
  }
  labels.forEach((l) => {
    s += `<text x="${x(l.i).toFixed(1)}" y="${H - 6}" text-anchor="middle" class="${l.hl ? 'hl' : ''}">${esc(l.text)}</text>`;
  });
  return `${s}</svg>`;
}
