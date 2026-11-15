// Two-way sync of the Quattroruote / Teknikens Värld speeds between the site's Blob store
// (entered on moose-grade.vercel.app/quattroruote, /teknikens) and data/qr_ratings.json, data/tv_ratings.json
// (entered on the local preview or written by Claude). Newer updatedAt wins per entry; a removal on the site
// (Teknikens comparison row deleted) removes the local entry when it is newer.
//   node scripts/input_sync.mjs
// Needs BLOB_READ_WRITE_TOKEN and ADMIN_KEY in .env.local (`npx vercel env pull` refreshes the token).
import fs from 'node:fs';

const root = new URL('../', import.meta.url);
const envFile = new URL('.env.local', root);
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*"?([^"\r\n]*)"?/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}
if (!process.env.BLOB_READ_WRITE_TOKEN || !process.env.ADMIN_KEY) throw new Error('BLOB_READ_WRITE_TOKEN / ADMIN_KEY missing in .env.local');
const headers = { 'x-admin-key': process.env.ADMIN_KEY, 'Content-Type': 'application/json' };
const time = (r) => Date.parse(r?.updatedAt || 0) || 0;

for (const { name, api, file } of [
  { name: 'quattroruote', api: '../api/qr.js', file: 'data/qr_ratings.json' },
  { name: 'teknikens', api: '../api/tv.js', file: 'data/tv_ratings.json' },
]) {
  const { GET, POST } = await import(api);
  const FILE = new URL(file, root);
  const local = fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, 'utf8')) : {};
  const got = await (await GET(new Request('http://local/api', { headers }))).json();
  const remote = got.ratings || {}, removed = got.removed || {};

  const toRemote = Object.fromEntries(Object.entries(local).filter(([k, r]) => time(r) > Math.max(time(remote[k]), time(removed[k]))));
  if (Object.keys(toRemote).length) {
    const res = await POST(new Request('http://local/api', { method: 'POST', headers, body: JSON.stringify({ bulk: toRemote }) }));
    if (!res.ok) throw new Error(`${name} upload failed: ${await res.text()}`);
  }
  let fromRemote = 0, dropped = 0;
  for (const [k, r] of Object.entries(remote)) if (time(r) > time(local[k])) { local[k] = r; fromRemote++; }
  for (const [k, r] of Object.entries(removed)) if (local[k] && time(r) > time(local[k])) { delete local[k]; dropped++; }
  fs.writeFileSync(FILE, JSON.stringify(local, null, 1));
  console.log(`${name} sync: site -> local ${fromRemote}, removed ${dropped}, local -> site ${Object.keys(toRemote).length}, total ${Object.keys(local).length}`);
}
