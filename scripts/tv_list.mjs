// Find new Teknikens Värld moose-test videos in the public playlist "Moose test videos" (state.tv.playlist).
// Only public /watch metadata is read (title, date, description).
//   node scripts/tv_list.mjs      append new videos to data/tv_meta.jsonl and state.tv.seenVideoIds
// update.mjs calls collectTvVideos() as its Teknikens Värld step.
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const P = (p) => new URL(p, root);
const H = { 'User-Agent': 'Mozilla/5.0', 'Accept-Language': 'en' };

export async function collectTvVideos(state) {
  state.tv ||= { playlist: 'PLubnNYiL3c4A-eHxarmLZHfszMp7lXaxC', seenVideoIds: [] };
  const pl = await (await fetch(`https://www.youtube.com/playlist?list=${state.tv.playlist}`, { headers: H })).text();
  const ids = [...new Set([...pl.matchAll(/"videoId":"([\w-]{11})"/g)].map((m) => m[1]))];
  const newIds = ids.filter((id) => !state.tv.seenVideoIds.includes(id));
  let newVideos = [];
  if (newIds.length) {
    const out = execFileSync('node', ['scripts/yt_meta.mjs', ...newIds], { cwd: root }).toString().trim();
    newVideos = out ? out.split('\n').map(JSON.parse).filter((v) => v.channel === 'Teknikens Värld') : [];
    if (newVideos.length) fs.appendFileSync(P('data/tv_meta.jsonl'), newVideos.map((v) => JSON.stringify(v)).join('\n') + '\n');
  }
  state.tv.seenVideoIds.push(...newIds);
  return newVideos;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === fs.realpathSync(process.argv[1])) {
  const state = JSON.parse(fs.readFileSync(P('data/state.json'), 'utf8'));
  const nv = await collectTvVideos(state);
  fs.writeFileSync(P('data/state.json'), JSON.stringify(state, null, 1));
  console.log(`new Teknikens Värld moose-test videos: ${nv.length}`);
  for (const v of nv) console.log(`- ${v.date.slice(0, 10)} ${v.title} https://www.youtube.com/watch?v=${v.id}`);
}
