// Incremental update: look only for data that appeared after the last update.
//   node scripts/update.mjs            collect new data, write data/pending_review.md
//   node scripts/update.mjs --recheck  also re-read recent km77 pages that had no moose value yet
// Then review data/pending_review.md (ground clearance, Quattroruote verdicts) and run scripts/build_all.mjs.
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const root = new URL('../', import.meta.url);
const P = (p) => new URL(p, root);
const rd = (p, dflt) => (fs.existsSync(P(p)) ? JSON.parse(fs.readFileSync(P(p), 'utf8')) : dflt);
const wr = (p, v) => fs.writeFileSync(P(p), JSON.stringify(v, null, 1));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const H = { 'User-Agent': 'Mozilla/5.0' };
const KM = 'https://www.km77.com';
const recheck = process.argv.includes('--recheck');

const state = rd('data/state.json');
const since = state.lastUpdated; // YYYY-MM-DD
const thisYear = new Date().getFullYear();
const log = (...a) => console.log('[update]', ...a);
log('since', since);

const meas = rd('data/km77_measurements.json', {});
const known = new Set([...Object.keys(meas), ...state.km77.probed]);

// 1) km77 magazine posts published since the last update -> car page links as seeds, titles as hints
const seeds = new Set();
const hints = [];
for (let page = 1; page < 10; page++) {
  const url = `${KM}/revista/wp-json/wp/v2/posts?search=esquiva&after=${since}T00:00:00&per_page=50&page=${page}&_fields=date,link,title,content`;
  const r = await fetch(url, { headers: H });
  if (!r.ok) break;
  const posts = await r.json();
  for (const p of posts) {
    const links = [...new Set([...p.content.rendered.matchAll(/km77\.com\/coches\/([a-z0-9-]+)\/([a-z0-9-]+)\/(\d{4})/g)].map((m) => `/coches/${m[1]}/${m[2]}/${m[3]}/mediciones-propias`))];
    links.forEach((l) => seeds.add(l));
    hints.push({ date: p.date.slice(0, 10), title: p.title.rendered, link: p.link, carPages: links });
  }
  if (posts.length < 50) break;
  await sleep(300);
}
log('magazine posts', hints.length, 'seed pages', seeds.size);

// 2) new model generations: probe current models for recent years that were never checked
const brands = state.km77.brands;
const models = new Set(state.km77.extraModels);
for (const b of brands) {
  try {
    const html = await (await fetch(`${KM}/coches/${b}`, { headers: H })).text();
    for (const m of html.matchAll(new RegExp(`href="/coches/${b}/([a-z0-9-]+)"`, 'g'))) models.add(`${b}/${m[1]}`);
  } catch {}
  await sleep(250);
}
const firstYear = Number(since.slice(0, 4)) - 1;
const probes = [];
for (const bm of models) for (let y = firstYear; y <= thisYear + 1; y++) {
  const p = `/coches/${bm}/${y}/mediciones-propias`;
  if (!known.has(p)) probes.push(p);
}
log('models', models.size, 'new probes', probes.length);
const found = [];
await Promise.all([0, 1, 2, 3].map(async () => {
  while (probes.length) {
    const p = probes.shift();
    try {
      const r = await fetch(KM + p, { method: 'HEAD', headers: H });
      if (r.status === 200) found.push(p);
      else state.km77.probed.push(p); // remember misses so the next run skips them
    } catch {}
    await sleep(250);
  }
}));
found.forEach((p) => seeds.add(p));
log('new generation pages', found.length);

// 3) optional: pages from recent years that had no moose value yet
if (recheck) {
  for (const [k, v] of Object.entries(meas)) {
    const y = Number(k.split('/')[4]);
    if (!v.moose_kmh && y >= thisYear - 3) { delete meas[k]; seeds.add(k); }
  }
  wr('data/km77_measurements.json', meas);
}

// 4) crawl seeds (snowball skips everything already known), then read specs for new cars
const before = new Set(Object.keys(rd('data/km77_measurements.json', {})));
const newSeeds = [...seeds].filter((s) => !before.has(s));
if (newSeeds.length) {
  execFileSync('node', ['scripts/crawl_km77.mjs', ...newSeeds], { cwd: root, stdio: 'inherit', env: { ...process.env, MSYS_NO_PATHCONV: '1' } });
}
// other tested versions inside each generation (only comparison pages not read before)
execFileSync('node', ['scripts/crawl_versions.mjs', '2015'], { cwd: root, stdio: 'inherit' });
execFileSync('node', ['scripts/merge_versions.mjs'], { cwd: root, stdio: 'inherit' });
execFileSync('node', ['scripts/enrich_specs.mjs'], { cwd: root, stdio: 'inherit' });
const after = rd('data/km77_measurements.json', {});
const cars = rd('data/km77_cars.json', {});
const manual = rd('data/gc_manual.json', {});
const addedKm77 = Object.keys(after).filter((k) => !before.has(k) && after[k].moose_kmh).map((k) => ({ path: k, ...cars[k] }));
const needGc = addedKm77.filter((c) => c.moose_kmh >= 78 && (!c.ground_clearance_mm || !c.wheelbase_mm) && !manual[c.version]);
log('new km77 moose results', addedKm77.length, 'need clearance', needGc.length);

// 5) Quattroruote public YouTube stability playlist: only videos not seen before
const pl = await (await fetch(`https://www.youtube.com/playlist?list=${state.qr.playlist}`, { headers: { ...H, 'Accept-Language': 'it' } })).text();
const ids = [...new Set([...pl.matchAll(/"videoId":"([\w-]{11})"/g)].map((m) => m[1]))];
const newIds = ids.filter((id) => !state.qr.seenVideoIds.includes(id));
let newVideos = [];
if (newIds.length) {
  const out = execFileSync('node', ['scripts/yt_meta.mjs', ...newIds], { cwd: root }).toString().trim();
  newVideos = out ? out.split('\n').map(JSON.parse).filter((v) => v.channel === 'Quattroruote') : [];
  fs.appendFileSync(P('data/qr_stab_meta.jsonl'), newVideos.map((v) => JSON.stringify(v)).join('\n') + (newVideos.length ? '\n' : ''));
}
log('new Quattroruote videos', newVideos.length);

// 6) review file for Claude / the user
const md = [
  `# 갱신 검토 목록 (${since} 이후)`,
  '',
  `## KM77 새 무스 테스트 결과 (${addedKm77.length}대)`,
  ...addedKm77.map((c) => `- ${c.moose_kmh} km/h · ${c.version} · WB ${c.wheelbase_mm ?? '?'} · GC ${c.ground_clearance_mm ?? '?'} · ${KM}${c.path}`),
  '',
  `## 지상고를 채워야 하는 차 (78km/h 이상, KM77 제원에 없음: ${needGc.length}대)`,
  '`data/gc_manual.json`에 `{"<version>": {"ground_clearance_mm": N, "gc_source": "..."}}` 형식으로 추가.',
  ...needGc.map((c) => `- ${c.version} (WB ${c.wheelbase_mm ?? '?'})`),
  '',
  `## Quattroruote 새 안정성 시험 영상 (${newVideos.length}개)`,
  '평가가 뚜렷하면 `data/qr_expected.json`에 추가 (KM77 값이 77km/h 이하인 같은 세대 차는 제외).',
  ...newVideos.map((v) => `- ${v.date.slice(0, 10)} · ${v.title} · https://www.youtube.com/watch?v=${v.id}\n  > ${v.desc.replace(/\s+/g, ' ').slice(0, 400)}`),
  '',
  `## KM77 매거진 새 글 (${hints.length}개, 참고)`,
  ...hints.map((h) => `- ${h.date} · ${h.title} · ${h.link}${h.carPages.length ? ' · 차량 페이지 ' + h.carPages.join(', ') : ''}`),
  '',
  '## Consumer Reports · 오토뷰 비교 평가',
  '자동 수집하지 않음. 새 1위 차량이 생기면 검색으로 확인해 `data/peer_mentions.json`에 추가.',
];
fs.writeFileSync(P('data/pending_review.md'), md.join('\n'));

state.qr.seenVideoIds.push(...newIds);
state.pending = {
  collectedAt: new Date().toISOString().slice(0, 10),
  km77: addedKm77.map((c) => c.version),
  qr: newVideos.map((v) => v.title),
};
wr('data/state.json', state);
log('wrote data/pending_review.md');
