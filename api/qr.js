// Quattroruote speed store for the owner-only input page (/quattroruote), same design as api/ratings.js.
// Storage: private Vercel Blob store. Each save writes one tiny blob whose pathname carries the values
//   qr/<videoId>/<updatedAt ms>_<dry or n>_<wet or n>_<u|c>_<base64url(car name)>.json
// so reading everything is a single list() call. Older blobs of the same id are deleted after a save.
// Auth: header x-admin-key must equal the ADMIN_KEY env var.
import { list, put, del } from '@vercel/blob';

const ID_RE = /^[\w-]{11}$/;
const json = (body, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
const authed = (req) => !!process.env.ADMIN_KEY && req.headers.get('x-admin-key') === process.env.ADMIN_KEY;
const b64 = (s) => Buffer.from(s, 'utf8').toString('base64url');
const unb64 = (s) => Buffer.from(s, 'base64url').toString('utf8');
const cleanSpeed = (v) => {
  if (v === '' || v == null) return null;
  const n = Number(v);
  return Number.isInteger(n) && n >= 40 && n <= 200 ? n : undefined;
};

async function readAll() {
  const latest = {};
  let cursor;
  do {
    const page = await list({ prefix: 'qr/', limit: 1000, cursor });
    for (const b of page.blobs) {
      const m = b.pathname.match(/^qr\/([\w-]{11})\/(\d+)_(\d+|n)_(\d+|n)_([uc])_([\w-]*)\.json$/);
      if (!m) continue;
      const [, id, ts, dry, wet, by, car] = m;
      if (latest[id] && Number(ts) <= latest[id].ts) continue;
      latest[id] = { ts: Number(ts), path: b.pathname, dry: dry === 'n' ? null : Number(dry), wet: wet === 'n' ? null : Number(wet), by: by === 'c' ? 'claude' : 'user', car: car ? unb64(car) : '' };
    }
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  return latest;
}

const view = (r) => ({ dry: r.dry, wet: r.wet, ...(r.car ? { car: r.car } : {}), by: r.by, updatedAt: new Date(r.ts).toISOString() });

export async function GET(req) {
  if (!authed(req)) return json({ error: 'unauthorized' }, 401);
  const latest = await readAll();
  return json({ ratings: Object.fromEntries(Object.entries(latest).map(([k, r]) => [k, view(r)])) });
}

// body: { id, dry, wet, car, by?, updatedAt? }  or  { bulk: { id: {...} } }  (full state of the row)
export async function POST(req) {
  if (!authed(req)) return json({ error: 'unauthorized' }, 401);
  const body = await req.json().catch(() => null);
  const items = body?.bulk ? Object.entries(body.bulk) : body?.id ? [[body.id, body]] : [];
  if (!items.length) return json({ error: 'empty' }, 400);
  const latest = await readAll();
  const saved = {};
  for (const [id, r] of items) {
    if (!ID_RE.test(id)) return json({ error: `bad id ${id}` }, 400);
    const ts = r.updatedAt ? Date.parse(r.updatedAt) : Date.now();
    if (!Number.isFinite(ts)) return json({ error: `bad time ${id}` }, 400);
    if (latest[id] && latest[id].ts >= ts) continue; // stored value is newer (sync)
    const dry = cleanSpeed(r.dry), wet = cleanSpeed(r.wet);
    if (dry === undefined || wet === undefined) return json({ error: 'speed must be 40-200' }, 400);
    const car = String(r.car || '').trim().slice(0, 80);
    const by = r.by === 'claude' ? 'c' : 'u';
    const rec = { ts, dry, wet, car, by: by === 'c' ? 'claude' : 'user' };
    await put(`qr/${id}/${ts}_${dry ?? 'n'}_${wet ?? 'n'}_${by}_${b64(car)}.json`, JSON.stringify({ id, ...rec }), {
      access: 'private', contentType: 'application/json', addRandomSuffix: false, allowOverwrite: true,
    });
    if (latest[id]) await del(latest[id].path).catch(() => {});
    saved[id] = view(rec);
  }
  return json({ saved });
}
