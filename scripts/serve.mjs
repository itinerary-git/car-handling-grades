// Local preview of the site with the owner-only input pages.
//   node scripts/serve.mjs [port]     -> http://localhost:5177  (input pages: /autoview, /quattroruote, /teknikens)
// /quattroruote and /teknikens exist only here (never deployed): speeds go to data/qr_ratings.json / data/tv_ratings.json.
// Serves public/ like Vercel (clean URLs) and answers /api/ratings from data/autoview_ratings.json,
// so ratings entered locally land in the repo directly. No admin key is needed on localhost.
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { LEVELS, mergeRatings } from './autoview_lib.mjs';
import { loadQr, carFromTitle, cleanSpeed, ID_RE, RATINGS_FILE } from './qr_lib.mjs';
import { loadTv, tvCarFromTitle, cleanKmh, TV_KEY_RE, TV_RATINGS_FILE } from './tv_lib.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const pub = path.join(root, 'public');
const FILE = path.join(root, 'data/autoview_ratings.json');
const port = Number(process.argv[2]) || 5177;
const TYPES = { '.html': 'text/html; charset=utf-8', '.csv': 'text/csv; charset=utf-8', '.json': 'application/json', '.js': 'text/javascript' };
const load = () => (fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, 'utf8')) : {});
const send = (res, status, body, type = 'application/json') => { res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' }); res.end(body); };

const readBody = async (req) => { let raw = ''; for await (const c of req) raw += c; return JSON.parse(raw || '{}'); };
const QR_TPL = path.join(root, 'report/qr_input_template.html');
const TV_TPL = path.join(root, 'report/tv_input_template.html');
const safe = (o) => JSON.stringify(o).replaceAll('<', String.fromCharCode(92) + 'u003c'); // no '</script>' in inline JSON

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/quattroruote' || url.pathname === '/quattroruote.html') {
    const { videos, ratings, cars } = loadQr();
    const known = new Set(videos.map((v) => v.id));
    const list = [...Object.keys(ratings).filter((id) => !known.has(id)).map((id) => ({ id, title: '', date: '' })), ...videos.slice().sort((a, b) => b.date.localeCompare(a.date))]
      .map((v) => ({ ...v, car: cars[v.id]?.car || carFromTitle(v.title), spec: !!(cars[v.id]?.wb && cars[v.id]?.gc) }));
    const html = fs.readFileSync(QR_TPL, 'utf8').replace('/*DATA*/[]', () => safe(list)).replace('/*RATINGS*/{}', () => safe(ratings));
    return send(res, 200, html, TYPES['.html']);
  }
  if (url.pathname === '/teknikens' || url.pathname === '/teknikens.html') {
    const { videos, ratings, cars } = loadTv();
    const vids = new Map(videos.map((v) => [v.id, v]));
    const keys = [...new Set([...videos.slice().sort((a, b) => b.date.localeCompare(a.date)).map((v) => v.id), ...Object.keys(ratings)])]
      .sort((a, b) => (vids.get(b.slice(0, 11))?.date || '9').localeCompare(vids.get(a.slice(0, 11))?.date || '9') || a.localeCompare(b));
    const list = keys.map((key) => {
      const v = vids.get(key.slice(0, 11)) || { title: '', date: '', stated: null, test: '' };
      return { key, id: key.slice(0, 11), title: v.title, date: v.date, stated: key.includes('.') ? null : v.stated, car: cars[key]?.car || (key.includes('.') ? '' : v.test || tvCarFromTitle(v.title)), spec: !!(cars[key]?.wb && cars[key]?.gc) };
    });
    const html = fs.readFileSync(TV_TPL, 'utf8').replace('/*DATA*/[]', () => safe(list)).replace('/*RATINGS*/{}', () => safe(ratings));
    return send(res, 200, html, TYPES['.html']);
  }
  if (url.pathname === '/api/tv') {
    if (req.method === 'GET') return send(res, 200, JSON.stringify({ ratings: loadTv().ratings }));
    if (req.method !== 'POST') return send(res, 405, '{}');
    const body = await readBody(req);
    if (!TV_KEY_RE.test(body.key || '')) return send(res, 400, '{"error":"bad key"}');
    const all = fs.existsSync(TV_RATINGS_FILE) ? JSON.parse(fs.readFileSync(TV_RATINGS_FILE, 'utf8')) : {};
    if (body.remove) { delete all[body.key]; fs.writeFileSync(TV_RATINGS_FILE, JSON.stringify(all, null, 1)); return send(res, 200, '{"removed":true}'); }
    const cur = { ...(all[body.key] || {}) };
    if ('kmh' in body) {
      const v = cleanKmh(body.kmh);
      if (v === undefined) return send(res, 400, '{"error":"speed must be 30-150"}');
      if (v !== cur.kmh) cur.by = 'user';
      cur.kmh = v;
    }
    if ('car' in body) {
      const c = String(body.car || '').trim().slice(0, 80);
      if (c) cur.car = c; else delete cur.car;
    }
    cur.kmh ??= null; cur.by ||= 'user';
    cur.updatedAt = new Date().toISOString();
    all[body.key] = cur;
    fs.writeFileSync(TV_RATINGS_FILE, JSON.stringify(all, null, 1));
    return send(res, 200, JSON.stringify({ saved: cur }));
  }
  if (url.pathname === '/api/qr') {
    if (req.method === 'GET') return send(res, 200, JSON.stringify({ ratings: loadQr().ratings }));
    if (req.method !== 'POST') return send(res, 405, '{}');
    const body = await readBody(req);
    if (!ID_RE.test(body.id || '')) return send(res, 400, '{"error":"bad id"}');
    const all = fs.existsSync(RATINGS_FILE) ? JSON.parse(fs.readFileSync(RATINGS_FILE, 'utf8')) : {};
    const cur = { ...(all[body.id] || {}) };
    for (const k of ['dry', 'wet']) if (k in body) {
      const v = cleanSpeed(body[k]);
      if (v === undefined) return send(res, 400, '{"error":"speed must be 40-200"}');
      if (v !== cur[k]) cur.by = 'user';
      cur[k] = v;
    }
    if ('car' in body) {
      const c = String(body.car || '').trim().slice(0, 80);
      if (c) cur.car = c; else delete cur.car;
    }
    cur.dry ??= null; cur.wet ??= null; cur.by ||= 'user';
    cur.updatedAt = new Date().toISOString();
    all[body.id] = cur;
    fs.writeFileSync(RATINGS_FILE, JSON.stringify(all, null, 1));
    return send(res, 200, JSON.stringify({ saved: cur }));
  }
  if (url.pathname === '/api/ratings') {
    if (req.method === 'GET') return send(res, 200, JSON.stringify({ ratings: load() }));
    if (req.method !== 'POST') return send(res, 405, '{}');
    let raw = '';
    for await (const c of req) raw += c;
    const body = JSON.parse(raw || '{}');
    const items = body.bulk || (body.key ? { [body.key]: body } : {});
    const clean = {};
    for (const [k, r] of Object.entries(items)) {
      if (!LEVELS.includes(r.handling || '') || !LEVELS.includes(r.avoidance || '')) return send(res, 400, '{"error":"bad level"}');
      clean[k] = { handling: r.handling || '', avoidance: r.avoidance || '', updatedAt: r.updatedAt || new Date().toISOString() };
    }
    const merged = mergeRatings(load(), clean);
    fs.writeFileSync(FILE, JSON.stringify(merged, null, 1));
    return send(res, 200, JSON.stringify({ saved: Object.fromEntries(Object.keys(clean).map((k) => [k, merged[k]])) }));
  }
  let p = path.normalize(path.join(pub, decodeURIComponent(url.pathname)));
  if (!p.startsWith(pub)) return send(res, 403, 'forbidden', 'text/plain');
  if (fs.existsSync(p) && fs.statSync(p).isDirectory()) p = path.join(p, 'index.html');
  else if (!path.extname(p) && fs.existsSync(p + '.html')) p += '.html';
  if (!fs.existsSync(p)) return send(res, 404, 'not found', 'text/plain');
  send(res, 200, fs.readFileSync(p), TYPES[path.extname(p)] || 'application/octet-stream');
}).listen(port, '127.0.0.1', () => console.log(`http://localhost:${port}  (오토뷰 입력: http://localhost:${port}/autoview · Quattroruote 입력: http://localhost:${port}/quattroruote · Teknikens Värld 입력: http://localhost:${port}/teknikens)`));
