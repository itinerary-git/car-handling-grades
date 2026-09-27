// Version-level km77 crawl. A generation page shows only one tested version, so other tested versions
// (e.g. Civic Type R inside the Civic generation) were missed. Each .../mediciones-propias/detalle page
// lists the tested versions it compares as hidden "ve:car:make:model:year:body:trim:version" ids.
// Snowball over those ids and read each version's own mediciones page.
// Usage: node scripts/crawl_versions.mjs [minYear=2015]   -> data/km77_versions.json
// Comparison pages already read are kept in data/km77_detalle_done.json, so later runs only read new ones.
import fs from 'node:fs';

const KM = 'https://www.km77.com';
const H = { 'User-Agent': 'Mozilla/5.0' };
const OUT = new URL('../data/km77_versions.json', import.meta.url);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const minYear = Number(process.argv[2] || 2015);
const strip = (h) => h.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ');

const meas = JSON.parse(fs.readFileSync(new URL('../data/km77_measurements.json', import.meta.url), 'utf8'));
const out = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : {};
const seen = new Set(Object.keys(out));
const queue = [];
const yearOf = (p) => Number(p.split('/')[4]);
for (const k of Object.keys(meas)) if (yearOf(k) >= minYear) queue.push({ detalle: k + '/detalle' });

async function get(p) {
  for (let i = 0; i < 2; i++) {
    try {
      const r = await fetch(KM + p, { headers: H, signal: AbortSignal.timeout(20000) });
      if (r.status === 404) return '';
      if (r.ok) return await r.text();
    } catch {}
    await sleep(1500);
  }
  return '';
}
const DONE = new URL('../data/km77_detalle_done.json', import.meta.url);
const doneDetalle = new Set(fs.existsSync(DONE) ? JSON.parse(fs.readFileSync(DONE, 'utf8')) : []);
let n = 0;
function enqueueIds(html) {
  for (const m of html.matchAll(/value="ve:car:([a-z0-9-]+):([a-z0-9-]+):(\d{4}):([a-z0-9-]+):([a-z0-9-]+):([a-z0-9-]+)"/g)) {
    const p = `/coches/${m[1]}/${m[2]}/${m[3]}/${m[4]}/${m[5]}/${m[6]}/mediciones-propias`;
    if (Number(m[3]) >= minYear && !seen.has(p)) { seen.add(p); queue.push({ version: p }); }
  }
}
let active = 0;
async function worker() {
  while (queue.length || active) {
    if (!queue.length) { await sleep(400); continue; }
    const job = queue.shift();
    active++;
    if (job.detalle) {
      if (!doneDetalle.has(job.detalle)) {
        doneDetalle.add(job.detalle);
        enqueueIds(await get(job.detalle));
        await sleep(300);
      }
    } else {
      const html = await get(job.version);
      await sleep(300);
      const t = strip(html);
      const esq = t.match(/Velocidad prueba de esquiva\s*(\d+)\s*km\/h/);
      const ver = t.match(/Otros datos de la prueba \| (.+?) Errores/);
      out[job.version] = {
        version: ver ? ver[1].trim() : null,
        moose_kmh: esq ? Number(esq[1]) : null,
        datos: [...new Set([...html.matchAll(/href="(\/coches\/[^"]+\/datos)"/g)].map((m) => m[1]))],
      };
      enqueueIds(html);
      queue.push({ detalle: job.version + '/detalle' });
      if (++n % 50 === 0) { fs.writeFileSync(OUT, JSON.stringify(out, null, 1)); fs.writeFileSync(DONE, JSON.stringify([...doneDetalle])); console.log('versions', n, 'queue', queue.length); }
    }
    active--;
  }
}
await Promise.all([worker(), worker(), worker(), worker()]);
fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
fs.writeFileSync(DONE, JSON.stringify([...doneDetalle]));
const withMoose = Object.values(out).filter((v) => v.moose_kmh).length;
console.log('done versions', Object.keys(out).length, 'with moose', withMoose);
