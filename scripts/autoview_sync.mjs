// Two-way sync of Autoview ratings between the site's Blob store (entered on moose-grade.vercel.app/autoview)
// and data/autoview_ratings.json (entered on the local preview). Newer updatedAt wins per entry.
//   node scripts/autoview_sync.mjs
// Needs BLOB_READ_WRITE_TOKEN and ADMIN_KEY in .env.local (`npx vercel env pull` refreshes the token).
import fs from 'node:fs';
import { mergeRatings } from './autoview_lib.mjs';

const root = new URL('../', import.meta.url);
const envFile = new URL('.env.local', root);
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*"?([^"\r\n]*)"?/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}
if (!process.env.BLOB_READ_WRITE_TOKEN || !process.env.ADMIN_KEY) throw new Error('BLOB_READ_WRITE_TOKEN / ADMIN_KEY missing in .env.local');
const { GET, POST } = await import('../api/ratings.js');
const headers = { 'x-admin-key': process.env.ADMIN_KEY, 'Content-Type': 'application/json' };

const FILE = new URL('data/autoview_ratings.json', root);
const local = fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, 'utf8')) : {};
const remote = (await (await GET(new Request('http://local/api/ratings', { headers }))).json()).ratings;

const toRemote = Object.fromEntries(Object.entries(local).filter(([k, r]) => !remote[k] || Date.parse(r.updatedAt) > Date.parse(remote[k].updatedAt)));
if (Object.keys(toRemote).length) {
  const res = await POST(new Request('http://local/api/ratings', { method: 'POST', headers, body: JSON.stringify({ bulk: toRemote }) }));
  if (!res.ok) throw new Error('upload failed: ' + (await res.text()));
}
const fromRemote = Object.keys(remote).filter((k) => !local[k] || Date.parse(remote[k].updatedAt) > Date.parse(local[k].updatedAt));
fs.writeFileSync(FILE, JSON.stringify(mergeRatings(local, remote), null, 1));
console.log(`autoview sync: site -> local ${fromRemote.length}, local -> site ${Object.keys(toRemote).length}, total ${Object.keys(mergeRatings(local, remote)).length}`);
