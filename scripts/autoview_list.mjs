// Collect Autoview (오토뷰) road-test videos from public YouTube pages only (/playlist and /watch are
// allowed by robots.txt). Sources: the channel uploads list, the channel's brand playlists, and extra
// video ids passed in EXTRA_IDS (comma separated, e.g. found by web search).
// Output: data/autoview_videos.json  (id, title, date, chapter seconds for 핸들링 and 기본 안정성)
import fs from 'node:fs';

const H = { 'User-Agent': 'Mozilla/5.0', 'Accept-Language': 'ko' };
const CH = 'UCfcgDLazgMa1L92Kl3r9ZAA';
const OUT = new URL('../data/autoview_videos.json', import.meta.url);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const get = async (u) => (await fetch(u, { headers: H, signal: AbortSignal.timeout(20000) })).text();
const unq = (s) => JSON.parse('"' + s + '"');
const STR = '((?:[^"\\\\]|\\\\.)*)'; // JSON string body
const MIN_DATE = '2024-05-18'; // records start at the 2024 Honda Accord Hybrid video; older ones are dropped
const isRoadTest = (t) => /로드테스트|\[리뷰\]|roadtest|로드 테스트/i.test(t);

const old = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : [];
const byId = new Map(old.map((v) => [v.id, { ...v, title: null }])); // titles are re-read each run (playlist, else watch page)
for (const id of (process.env.EXTRA_IDS || '').split(',').filter(Boolean)) {
  if (!byId.has(id)) byId.set(id, { id, title: null, source: 'search' });
}

const plPage = await get(`https://www.youtube.com/channel/${CH}/playlists`);
const lists = ['UU' + CH.slice(2), ...new Set([...plPage.matchAll(/list=(PLwM2uSSObhm[\w-]+)/g)].map((m) => m[1]))];
// In the playlist JSON each item's title comes BEFORE its contentId, so pair every id with the nearest preceding title.
const idRe = /"contentId":"([\w-]{11})"/g;
const titleItemRe = new RegExp('"lockupMetadataViewModel":\\{"title":\\{"content":"' + STR + '"', 'g');
for (const list of lists) {
  const h = await get(`https://www.youtube.com/playlist?list=${list}`);
  const titles = [...h.matchAll(titleItemRe)].map((m) => [m.index, unq(m[1])]);
  for (const m of h.matchAll(idRe)) {
    const prev = titles.filter(([i]) => i < m.index).pop();
    if (!prev) continue;
    const [, title] = prev;
    const id = m[1];
    if (byId.has(id)) byId.get(id).title = title; // overwrite titles stored by the old, mis-paired parser
    else if (isRoadTest(title)) byId.set(id, { id, title, source: list });
  }
  await sleep(400);
}

const descRe = new RegExp('"shortDescription":"' + STR + '"');
const titleRe = new RegExp('"title":"' + STR + '","lengthSeconds"');
const dateRe = new RegExp('"publishDate":"' + STR + '"');
const chapter = (desc, re) => {
  const line = desc.split('\n').find((l) => re.test(l) && /^\s*\d{1,2}:\d{2}/.test(l));
  return line ? line.trim().split(/\s+/)[0].split(':').reduce((a, b) => a * 60 + Number(b), 0) : null;
};
for (const v of byId.values()) {
  if (v.date && v.title) continue;
  const h = await get(`https://www.youtube.com/watch?v=${v.id}`);
  const pick = (re) => { const m = h.match(re); return m ? unq(m[1]) : ''; };
  const desc = pick(descRe);
  v.title = v.title || pick(titleRe);
  v.date = pick(dateRe).slice(0, 10);
  v.handling = chapter(desc, /핸들링/);
  v.stability = chapter(desc, /기본 ?안정성|긴급 ?회피/);
  await sleep(350);
}
const all = [...byId.values()].filter((v) => v.title && isRoadTest(v.title) && (v.date || '') >= MIN_DATE).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
fs.writeFileSync(OUT, JSON.stringify(all, null, 1));
console.log('videos', all.length, 'with handling chapter', all.filter((v) => v.handling != null).length);
