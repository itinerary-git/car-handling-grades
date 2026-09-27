// For km77 generations whose measurement table has no moose value, read km77's own review articles
// (/coches/b/m/YYYY[/body]/informacion/...) and pull sentences mentioning "esquiva" with a km/h figure.
// Usage: node scripts/find_article_moose.mjs data/raw/null_recent.json > data/article_moose.jsonl
import fs from 'node:fs';

const KM = 'https://www.km77.com';
const H = { 'User-Agent': 'Mozilla/5.0' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const decode = (s) => s.replace(/&aacute;/g, 'á').replace(/&eacute;/g, 'é').replace(/&iacute;/g, 'í').replace(/&oacute;/g, 'ó').replace(/&uacute;/g, 'ú').replace(/&ntilde;/g, 'ñ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&[a-z]+;/g, ' ');
const text = (h) => decode(h.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<style[\s\S]*?<\/style>/g, ' ').replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ');
async function get(p) {
  try {
    const r = await fetch(KM + p, { headers: H, signal: AbortSignal.timeout(20000) });
    return r.ok ? await r.text() : '';
  } catch { return ''; }
}

const items = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const queue = [...items];
async function worker() {
  while (queue.length) {
    const { k, version } = queue.shift();
    const gen = k.replace(/\/mediciones-propias$/, '');
    const idx = await get(gen + '/informacion');
    await sleep(300);
    const esc = gen.replace(/[/-]/g, (c) => '\\' + c);
    const bodyIdx = [...new Set([...idx.matchAll(new RegExp(`href="(${esc}/[a-z0-9-]+/informacion)"`, 'g'))].map((m) => m[1]))];
    let arts = [...idx.matchAll(new RegExp(`href="(${esc}(?:/[a-z0-9-]+)?/informacion/[a-z0-9-]+)"`, 'g'))].map((m) => m[1]);
    for (const b of bodyIdx.slice(0, 3)) {
      const bi = await get(b);
      await sleep(300);
      arts.push(...[...bi.matchAll(new RegExp(`href="(${esc}(?:/[a-z0-9-]+){0,2}/informacion/[a-z0-9-]+)"`, 'g'))].map((m) => m[1]));
    }
    arts = [...new Set(arts)].slice(0, 12);
    const hits = [];
    for (const a of arts) {
      const t = text(await get(a));
      await sleep(300);
      for (const m of t.matchAll(/[^.]{0,220}esquiva[^.]{0,220}\.?/gi)) {
        const kmh = [...m[0].matchAll(/(\d{2})\s?km\/h/g)].map((x) => +x[1]).filter((n) => n >= 55 && n <= 95);
        if (kmh.length) hits.push({ article: a, kmh, text: m[0].trim().slice(0, 440) });
      }
    }
    console.log(JSON.stringify({ k, version, articles: arts.length, hits }));
  }
}
await Promise.all([worker(), worker(), worker()]);
