// Find km77 generation-level mediciones pages not reached by the snowball crawl:
// list models from brand pages, then probe /coches/b/m/YYYY/mediciones-propias with HEAD.
// Prints found paths (one per line) for use as crawl seeds.
import fs from 'node:fs';

const BASE = 'https://www.km77.com';
const H = { 'User-Agent': 'Mozilla/5.0' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const known = new Set(Object.keys(JSON.parse(fs.readFileSync(new URL('../data/km77_measurements.json', import.meta.url), 'utf8'))));
const knownModels = new Set([...known].map((k) => k.split('/').slice(2, 4).join('/')));

const brands = process.argv.slice(2);
const extraModels = fs.existsSync(new URL('../data/extra_models.txt', import.meta.url))
  ? fs.readFileSync(new URL('../data/extra_models.txt', import.meta.url), 'utf8').split(/\s+/).filter(Boolean)
  : [];

const models = new Set(extraModels);
for (const b of brands) {
  const html = await (await fetch(`${BASE}/coches/${b}`, { headers: H })).text();
  for (const m of html.matchAll(new RegExp(`href="/coches/${b}/([a-z0-9-]+)"`, 'g'))) models.add(`${b}/${m[1]}`);
  await sleep(300);
}
const todo = [];
for (const bm of models) for (let y = 2015; y <= 2026; y++) {
  const p = `/coches/${bm}/${y}/mediciones-propias`;
  if (!known.has(p)) todo.push(p);
}
console.error(`models ${models.size}, probes ${todo.length}`);
async function worker() {
  while (todo.length) {
    const p = todo.shift();
    try {
      const r = await fetch(BASE + p, { method: 'HEAD', headers: H });
      if (r.status === 200) console.log(p);
    } catch {}
    await sleep(250);
  }
}
await Promise.all([worker(), worker(), worker(), worker()]);
