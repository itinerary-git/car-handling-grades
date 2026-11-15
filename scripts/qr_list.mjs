// Find new Quattroruote stability-test videos: the public playlist "Prove di stabilità" plus the channel's own
// search page (some tests, e.g. Renault 4 (2025), are not in the playlist). Only public /watch metadata is read
// (title, date, description); /results is disallowed by robots.txt, the channel search page is not.
//   node scripts/qr_list.mjs      append new videos to data/qr_stab_meta.jsonl and state.qr.seenVideoIds
// update.mjs calls collectQrVideos() as its Quattroruote step.
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const P = (p) => new URL(p, root);
const H = { 'User-Agent': 'Mozilla/5.0', 'Accept-Language': 'it' };
const CHANNEL = 'https://www.youtube.com/@QuattroruoteIt';
const QUERIES = ['prova di stabilità', 'test di stabilità', "manovre d'emergenza", 'quanto è sicura davvero', 'prova del limite'];
export const IS_TEST = /prova di stabilit|test di stabilit|manovre d.emergenza|prova del limite/i;

export async function collectQrVideos(state) {
  const ids = new Set();
  const pl = await (await fetch(`https://www.youtube.com/playlist?list=${state.qr.playlist}`, { headers: H })).text();
  for (const m of pl.matchAll(/"videoId":"([\w-]{11})"/g)) ids.add(m[1]);
  // channel search (relevance order) + latest uploads (newest ~30). Every video id on those pages is checked by its
  // own /watch title below: pairing ids with titles on the search page mislabels videos (2026-11-15: Mazda CX-5 missed).
  const pages = [...QUERIES.map((q) => `${CHANNEL}/search?query=${encodeURIComponent(q)}`), `${CHANNEL}/videos`];
  for (const url of pages) {
    const h = await (await fetch(url, { headers: H })).text();
    for (const m of h.matchAll(/"videoId":"([\w-]{11})"/g)) ids.add(m[1]);
    await new Promise((r) => setTimeout(r, 500));
  }
  const newIds = [...ids].filter((id) => !state.qr.seenVideoIds.includes(id));
  let newVideos = [];
  for (let i = 0; i < newIds.length; i += 20) {
    const out = execFileSync('node', ['scripts/yt_meta.mjs', ...newIds.slice(i, i + 20)], { cwd: root, maxBuffer: 50e6 }).toString().trim();
    // playlist videos are all tests; channel-search hits must look like a test by their real title
    if (out) newVideos.push(...out.split('\n').map(JSON.parse).filter((v) => v.channel === 'Quattroruote' && (IS_TEST.test(v.title) || pl.includes(v.id))));
  }
  if (newVideos.length) fs.appendFileSync(P('data/qr_stab_meta.jsonl'), newVideos.map((v) => JSON.stringify(v)).join('\n') + '\n');
  state.qr.seenVideoIds.push(...newIds);
  return newVideos;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === fs.realpathSync(process.argv[1])) {
  const state = JSON.parse(fs.readFileSync(P('data/state.json'), 'utf8'));
  const nv = await collectQrVideos(state);
  fs.writeFileSync(P('data/state.json'), JSON.stringify(state, null, 1));
  console.log(`new Quattroruote test videos: ${nv.length}`);
  for (const v of nv) console.log(`- ${v.date.slice(0, 10)} ${v.title} https://www.youtube.com/watch?v=${v.id}`);
}
