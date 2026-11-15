// Quattroruote stability-test speeds: video list, specs and entered speeds.
//   data/qr_stab_meta.jsonl  video metadata (id, title, date, desc) collected by update.mjs
//   data/qr_ratings.json     { <videoId>: { dry, wet, car?, by: 'user'|'claude', updatedAt } }  (local input page /quattroruote)
//   data/qr_cars.json        { <videoId>: { car, short?, wb, gc, gc_label?, gc_source, km77, extra? } }  (Claude fills on update)
// A car shows on the grade table when it has both speeds and specs.
import fs from 'node:fs';

const root = new URL('../', import.meta.url);
const rd = (p, d) => (fs.existsSync(new URL(p, root)) ? JSON.parse(fs.readFileSync(new URL(p, root), 'utf8')) : d);

export const RATINGS_FILE = new URL('data/qr_ratings.json', root);
export const ID_RE = /^[\w-]{11}$/;

export function loadVideos() {
  const f = new URL('data/qr_stab_meta.jsonl', root);
  if (!fs.existsSync(f)) return [];
  return fs.readFileSync(f, 'utf8').trim().split('\n').filter(Boolean).map((l) => {
    const v = JSON.parse(l);
    return { id: v.id, title: v.title, date: (v.date || '').slice(0, 10) };
  });
}

// "Maserati Grecale Trofeo: la prova di stabilità" -> "Maserati Grecale Trofeo"
export const carFromTitle = (t = '') => {
  const parts = t.split(/\s*[|:]\s*/).map((s) => s.trim()).filter(Boolean);
  const noise = /prova d(i|ella) stabilit|test di stabilit|manovre d.emergenza|quanto è sicur|com'è andata|meglio delle|alla prova/i;
  return (parts.find((p) => !noise.test(p)) || parts[0] || t).replace(/^(nuova|nuovo)\s+/i, '');
};

// speeds checked by the input page and the local API: whole km/h, 40-200, or empty
export const cleanSpeed = (v) => {
  if (v === '' || v == null) return null;
  const n = Number(v);
  return Number.isInteger(n) && n >= 40 && n <= 200 ? n : undefined;
};

export function loadQr() {
  const videos = loadVideos();
  const ratings = rd('data/qr_ratings.json', {});
  const cars = rd('data/qr_cars.json', {});
  const title = Object.fromEntries(videos.map((v) => [v.id, v.title]));
  const measured = [], unmapped = [];
  for (const [id, r] of Object.entries(ratings)) {
    if (r.dry == null || r.wet == null) continue;
    const spec = cars[id];
    if (!spec?.wb || !spec?.gc) { unmapped.push(`${id} ${r.car || carFromTitle(title[id])}`); continue; }
    measured.push({ ...spec, id, car: spec.car || r.car || carFromTitle(title[id]), dry_kmh: r.dry, wet_kmh: r.wet, by: r.by || 'user' });
  }
  return { videos, ratings, cars, measured, unmapped };
}

// rows for the input page (/quattroruote): videos newest first, plus ids entered on the page but not in the list yet
export function qrInputRows() {
  const { videos, ratings, cars } = loadQr();
  const known = new Set(videos.map((v) => v.id));
  return [...Object.keys(ratings).filter((id) => !known.has(id)).map((id) => ({ id, title: '', date: '' })), ...videos.slice().sort((a, b) => b.date.localeCompare(a.date))]
    .map((v) => ({ ...v, car: cars[v.id]?.car || carFromTitle(v.title), spec: !!(cars[v.id]?.wb && cars[v.id]?.gc) }));
}
