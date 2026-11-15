// Teknikens Värld speed store for the owner-only input page (/teknikens), same design as api/ratings.js.
// Storage: private Vercel Blob store. Each save writes one tiny blob whose pathname carries the values
//   tv/<key>/<updatedAt ms>_<kmh or n>_<u|c>_<base64url(car name)>.json      (removal: tv/<key>/<ms>_del.json)
// so reading everything is a single list() call. Older blobs of the same key are deleted after a save.
// Auth: header x-admin-key must equal the ADMIN_KEY env var.
import { list, put, del } from '@vercel/blob';

const KEY_RE = /^[\w-]{11}(\.[2-9])?$/;
const json = (body, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
const authed = (req) => !!process.env.ADMIN_KEY && req.headers.get('x-admin-key') === process.env.ADMIN_KEY;
const b64 = (s) => Buffer.from(s, 'utf8').toString('base64url');
const unb64 = (s) => Buffer.from(s, 'base64url').toString('utf8');
const cleanKmh = (v) => {
  if (v === '' || v == null) return null;
  const n = Number(v);
  return Number.isInteger(n) && n >= 30 && n <= 150 ? n : undefined;
};

async function readAll() {
  const latest = {};
  let cursor;
  do {
    const page = await list({ prefix: 'tv/', limit: 1000, cursor });
    for (const b of page.blobs) {
      const m = b.pathname.match(/^tv\/([^/]+)\/(\d+)_(?:(del)|(\d+|n)_([uc])_([\w-]*))\.json$/);
      if (!m) continue;
      const [, key, ts, gone, kmh, by, car] = m;
      if (latest[key] && Number(ts) <= latest[key].ts) continue;
      latest[key] = { ts: Number(ts), path: b.pathname, removed: !!gone, kmh: kmh && kmh !== 'n' ? Number(kmh) : null, by: by === 'c' ? 'claude' : 'user', car: car ? unb64(car) : '' };
    }
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  return latest;
}

const view = (r) => (r.removed ? { removed: true, updatedAt: new Date(r.ts).toISOString() }
  : { kmh: r.kmh, ...(r.car ? { car: r.car } : {}), by: r.by, updatedAt: new Date(r.ts).toISOString() });

export async function GET(req) {
  if (!authed(req)) return json({ error: 'unauthorized' }, 401);
  const latest = await readAll();
  const ratings = {}, removed = {};
  for (const [k, r] of Object.entries(latest)) (r.removed ? removed : ratings)[k] = view(r);
  return json({ ratings, removed });
}

// body: { key, kmh, car, by?, remove?, updatedAt? }  or  { bulk: { key: {...} } }  (full state of the row)
export async function POST(req) {
  if (!authed(req)) return json({ error: 'unauthorized' }, 401);
  const body = await req.json().catch(() => null);
  const items = body?.bulk ? Object.entries(body.bulk) : body?.key ? [[body.key, body]] : [];
  if (!items.length) return json({ error: 'empty' }, 400);
  const latest = await readAll();
  const saved = {};
  for (const [key, r] of items) {
    if (!KEY_RE.test(key)) return json({ error: `bad key ${key}` }, 400);
    const ts = r.updatedAt ? Date.parse(r.updatedAt) : Date.now();
    if (!Number.isFinite(ts)) return json({ error: `bad time ${key}` }, 400);
    if (latest[key] && latest[key].ts >= ts) continue; // stored value is newer (sync)
    let path, rec;
    if (r.remove || r.removed) {
      path = `tv/${key}/${ts}_del.json`;
      rec = { ts, removed: true };
    } else {
      const kmh = cleanKmh(r.kmh);
      if (kmh === undefined) return json({ error: 'speed must be 30-150' }, 400);
      const car = String(r.car || '').trim().slice(0, 80);
      const by = r.by === 'claude' ? 'c' : 'u';
      path = `tv/${key}/${ts}_${kmh ?? 'n'}_${by}_${b64(car)}.json`;
      rec = { ts, kmh, car, by: by === 'c' ? 'claude' : 'user' };
    }
    await put(path, JSON.stringify({ key, ...rec }), { access: 'private', contentType: 'application/json', addRandomSuffix: false, allowOverwrite: true });
    if (latest[key]) await del(latest[key].path).catch(() => {});
    saved[key] = view(rec);
  }
  return json({ saved });
}
