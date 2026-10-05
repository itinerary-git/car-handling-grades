// Autoview rating store for the owner-only input page (/autoview).
// Storage: private Vercel Blob store. Each save writes one tiny blob whose pathname carries the values
//   av/<key>/<updatedAt ms>_<handling idx>_<avoidance idx>.json
// so reading everything is a single list() call (no blob downloads, no CDN cache to go stale).
// Older blobs of the same key are deleted after a save.
// Auth: header x-admin-key must equal the ADMIN_KEY env var.
import { list, put, del } from '@vercel/blob';
import { LEVELS } from '../scripts/autoview_lib.mjs';

const KEY_RE = /^[\w-]{11}(\.\d)?$/;
const json = (body, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
const authed = (req) => !!process.env.ADMIN_KEY && req.headers.get('x-admin-key') === process.env.ADMIN_KEY;

async function readAll() {
  const latest = {};
  let cursor;
  do {
    const page = await list({ prefix: 'av/', limit: 1000, cursor });
    for (const b of page.blobs) {
      const m = b.pathname.match(/^av\/([^/]+)\/(\d+)_(\d)_(\d)\.json$/);
      if (!m) continue;
      const [, key, ts, h, a] = m;
      if (!latest[key] || Number(ts) > latest[key].ts) latest[key] = { ts: Number(ts), h: Number(h), a: Number(a), path: b.pathname };
    }
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  return latest;
}

export async function GET(req) {
  if (!authed(req)) return json({ error: 'unauthorized' }, 401);
  const latest = await readAll();
  const ratings = {};
  for (const [k, r] of Object.entries(latest)) ratings[k] = { handling: LEVELS[r.h], avoidance: LEVELS[r.a], updatedAt: new Date(r.ts).toISOString() };
  return json({ ratings });
}

// body: { key, handling, avoidance, updatedAt? }  or  { bulk: { key: {handling, avoidance, updatedAt} } }
export async function POST(req) {
  if (!authed(req)) return json({ error: 'unauthorized' }, 401);
  const body = await req.json().catch(() => null);
  const items = body?.bulk ? Object.entries(body.bulk) : body?.key ? [[body.key, body]] : [];
  if (!items.length) return json({ error: 'empty' }, 400);
  const latest = await readAll();
  const saved = {};
  for (const [key, r] of items) {
    const h = LEVELS.indexOf(r.handling || ''), a = LEVELS.indexOf(r.avoidance || '');
    if (!KEY_RE.test(key) || h < 0 || a < 0) return json({ error: `bad item ${key}` }, 400);
    const ts = r.updatedAt ? Date.parse(r.updatedAt) : Date.now();
    if (!Number.isFinite(ts)) return json({ error: `bad time ${key}` }, 400);
    if (latest[key] && latest[key].ts >= ts) continue; // stored value is newer (sync)
    await put(`av/${key}/${ts}_${h}_${a}.json`, JSON.stringify({ key, handling: r.handling || '', avoidance: r.avoidance || '' }), {
      access: 'private', contentType: 'application/json', addRandomSuffix: false, allowOverwrite: true,
    });
    if (latest[key]) await del(latest[key].path).catch(() => {});
    saved[key] = { handling: LEVELS[h], avoidance: LEVELS[a], updatedAt: new Date(ts).toISOString() };
  }
  return json({ saved });
}
