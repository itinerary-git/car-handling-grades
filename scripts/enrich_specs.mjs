// For each km77 measurement entry, fetch the tested version's spec page and read wheelbase / ground clearance.
// Output: data/km77_cars.json
import fs from 'node:fs';

const BASE = 'https://www.km77.com';
const IN = new URL('../data/km77_measurements.json', import.meta.url);
const OUT = new URL('../data/km77_cars.json', import.meta.url);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const strip = (h) => h.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ');
const slug = (s) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\(.*?\)/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const meas = JSON.parse(fs.readFileSync(IN, 'utf8'));
const out = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : {};

function pickDatos(path, e) {
  const [, , brand, model, year] = path.split('/');
  const prefix = `/coches/${brand}/${model}/${year}/`;
  const vs = slug(e.version || '');
  const cands = e.datos.filter((d) => d.startsWith(prefix) && d.split('/').length >= 9);
  let best = null, bestScore = -1;
  for (const d of cands) {
    const vslug = d.split('/').at(-2);
    const toks = vslug.split('-');
    const score = toks.filter((t) => vs.includes(t)).length / toks.length + (vs.includes(vslug) ? 1 : 0);
    if (score > bestScore) { best = d; bestScore = score; }
  }
  return best;
}

const num = (s) => (s ? Number(s.replace(/\./g, '').replace(',', '.')) : null);

for (const [path, e] of Object.entries(meas)) {
  if (out[path] || !e.moose_kmh) continue;
  const d = pickDatos(path, e);
  let wb = null, gc = null, len = null, weight = null;
  if (d) {
    try {
      const r = await fetch(BASE + d, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      const t = strip(await r.text());
      wb = num((t.match(/Batalla ([\d.]+) mm/) || [])[1]);
      gc = num((t.match(/Altura libre (?:al suelo )?([\d.]+) mm/) || [])[1]);
      len = num((t.match(/Longitud ([\d.]+) mm/) || [])[1]);
      weight = num((t.match(/Peso (?:en orden de marcha|homologado)?[^\d]{0,30}([\d.]+) kg/) || [])[1]);
    } catch {}
    await sleep(400);
  }
  console.log(e.moose_kmh, wb, gc, e.version);
  out[path] = { version: e.version, moose_kmh: e.moose_kmh, datos: d, wheelbase_mm: wb, ground_clearance_mm: gc, length_mm: len, weight_kg: weight };
  if (Object.keys(out).length % 25 === 0) { fs.writeFileSync(OUT, JSON.stringify(out, null, 1)); console.log('saved', Object.keys(out).length); }
}
fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
console.log('done', Object.keys(out).length);
