// Teknikens Värld moose-test speeds (the highest speed passed without hitting a cone).
//   data/tv_meta.jsonl    video metadata (id, title, date, desc) from the public "Moose test videos" playlist
//   data/tv_ratings.json  { <videoId>[.<n>]: { kmh, car?, by: 'user'|'claude', updatedAt } }  (local input page /teknikens)
//                         a comparison video with several cars uses extra keys "<videoId>.2", "<videoId>.3"
//   data/tv_cars.json     { <key>: { car, short?, wb, gc, gc_label?, gc_source, km77 } }  (Claude fills on update)
// A car shows on the grade table when it has a speed and specs; build_page.mjs keeps only the top speed per cell.
import fs from 'node:fs';

const root = new URL('../', import.meta.url);
const rd = (p, d) => (fs.existsSync(new URL(p, root)) ? JSON.parse(fs.readFileSync(new URL(p, root), 'utf8')) : d);

export const TV_RATINGS_FILE = new URL('data/tv_ratings.json', root);
export const TV_KEY_RE = /^[\w-]{11}(\.[2-9])?$/;

export function loadTvVideos() {
  const f = new URL('data/tv_meta.jsonl', root);
  if (!fs.existsSync(f)) return [];
  return fs.readFileSync(f, 'utf8').trim().split('\n').filter(Boolean).map((l) => {
    const v = JSON.parse(l);
    const m = (v.desc || '').match(/Achieved max speed:\s*(\d+)\s*km\/h/i);
    return { id: v.id, title: v.title, date: (v.date || '').slice(0, 10), stated: m ? Number(m[1]) : null, test: tvCarFromDesc(v.desc) };
  });
}

// "In this week's test: Volvo V60 B4 Diesel Inscription." -> "Volvo V60 B4 Diesel Inscription"
export const tvCarFromDesc = (d = '') => (d.match(/this week's test:\s*([^\n]+?)\.(\s|$)/i) || [])[1] || '';
// "Moose test of the week: Ford Puma" / "Skoda Superb iV fails the moose test" -> car part of the title
export const tvCarFromTitle = (t = '') =>
  t.replace(/^moose test( of the week)?:\s*/i, '').replace(/\s*(fails|performs|handles|behaving|moose test|\[).*$/i, '').replace(/^(the new|new|revised|electric car)\s+/i, '').trim() || t;

export const cleanKmh = (v) => {
  if (v === '' || v == null) return null;
  const n = Number(v);
  return Number.isInteger(n) && n >= 30 && n <= 150 ? n : undefined;
};

export function loadTv() {
  const videos = loadTvVideos();
  const ratings = rd('data/tv_ratings.json', {});
  const cars = rd('data/tv_cars.json', {});
  const byId = Object.fromEntries(videos.map((v) => [v.id, v]));
  const measured = [], unmapped = [];
  for (const [key, r] of Object.entries(ratings)) {
    if (r.kmh == null) continue;
    const v = byId[key.slice(0, 11)] || {};
    const name = r.car || v.test || tvCarFromTitle(v.title);
    const spec = cars[key];
    if (!spec?.wb || !spec?.gc) { unmapped.push(`${key} ${name}`); continue; }
    measured.push({ ...spec, key, id: key.slice(0, 11), car: spec.car || name, kmh: r.kmh, by: r.by || 'user' });
  }
  return { videos, ratings, cars, measured, unmapped };
}

// rows for the input page (/teknikens): playlist videos newest first, plus extra keys already in the ratings
export function tvInputRows() {
  const { videos, ratings, cars } = loadTv();
  const vids = new Map(videos.map((v) => [v.id, v]));
  const keys = [...new Set([...videos.slice().sort((a, b) => b.date.localeCompare(a.date)).map((v) => v.id), ...Object.keys(ratings)])]
    .sort((a, b) => (vids.get(b.slice(0, 11))?.date || '9').localeCompare(vids.get(a.slice(0, 11))?.date || '9') || a.localeCompare(b));
  return keys.map((key) => {
    const v = vids.get(key.slice(0, 11)) || { title: '', date: '', stated: null, test: '' };
    return { key, id: key.slice(0, 11), title: v.title, date: v.date, stated: key.includes('.') ? null : v.stated, car: cars[key]?.car || (key.includes('.') ? '' : v.test || tvCarFromTitle(v.title)), spec: !!(cars[key]?.wb && cars[key]?.gc) };
  });
}
