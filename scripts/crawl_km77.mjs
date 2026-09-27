// Snowball crawl of km77 "mediciones-propias" pages (per-car pages only; respects robots.txt disallows).
// Output: data/km77_measurements.json
import fs from 'node:fs';

const BASE = 'https://www.km77.com';
const UA = 'Mozilla/5.0';
const OUT = new URL('../data/km77_measurements.json', import.meta.url);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const seeds = process.argv.slice(2).length
  ? process.argv.slice(2)
  : ['/coches/porsche/911/2019/mediciones-propias'];

const queue = [...seeds];
const seen = new Set();
const results = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : {};
for (const k of Object.keys(results)) seen.add(k);

const strip = (h) => h.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ');

function genUrl(path) {
  // /coches/b/m/YYYY/... -> /coches/b/m/YYYY/mediciones-propias (generation level only)
  const m = path.match(/^\/coches\/([a-z0-9-]+)\/([a-z0-9-]+)\/(\d{4})\//);
  return m ? [`/coches/${m[1]}/${m[2]}/${m[3]}/mediciones-propias`] : [];
}

async function get(path) {
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(BASE + path, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(20000) });
      if (r.status === 404) return null;
      if (r.ok) return await r.text();
    } catch {}
    await sleep(1500);
  }
  return null;
}

let n = 0;
let active = 0;
async function worker() {
while (queue.length || active) {
  if (!queue.length) { await sleep(500); continue; }
  const path = queue.shift();
  if (seen.has(path)) continue;
  seen.add(path);
  active++;
  const html = await get(path);
  await sleep(300);
  if (!html) { active--; continue; }
  const text = strip(html);
  const esq = text.match(/Velocidad prueba de esquiva\s*([\d]+)\s*km\/h/);
  const ver = text.match(/Otros datos de la prueba \| (.+?) Errores/);
  const datosLinks = [...html.matchAll(/href="(\/coches\/[^"]+\/datos)"/g)].map((m) => m[1]);
  const medLinks = [...html.matchAll(/href="(\/coches\/[^"]+\/mediciones-propias)"/g)].map((m) => m[1]);
  // tested version's datos link: the one whose version name matches most closely is hard; keep all, pick later
  if (esq || ver) {
    results[path] = {
      version: ver ? ver[1].trim() : null,
      moose_kmh: esq ? Number(esq[1]) : null,
      datos: [...new Set(datosLinks)],
    };
    n++;
    if (n % 10 === 0) {
      fs.writeFileSync(OUT, JSON.stringify(results, null, 1));
      console.log(`saved ${n}, queue ${queue.length}`);
    }
  }
  const next = [...medLinks.filter((l) => l.split('/').length === 7), ...datosLinks.flatMap(genUrl)];
  for (const l of next) if (!seen.has(l) && !queue.includes(l)) queue.push(l);
  active--;
}
}
await Promise.all([worker(), worker(), worker()]);
fs.writeFileSync(OUT, JSON.stringify(results, null, 1));
console.log('done', Object.keys(results).length);
