// Local preview of the site with the owner-only Autoview input page.
//   node scripts/serve.mjs [port]     -> http://localhost:5177  (input page: /autoview)
// Serves public/ like Vercel (clean URLs) and answers /api/ratings from data/autoview_ratings.json,
// so ratings entered locally land in the repo directly. No admin key is needed on localhost.
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { LEVELS, mergeRatings } from './autoview_lib.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const pub = path.join(root, 'public');
const FILE = path.join(root, 'data/autoview_ratings.json');
const port = Number(process.argv[2]) || 5177;
const TYPES = { '.html': 'text/html; charset=utf-8', '.csv': 'text/csv; charset=utf-8', '.json': 'application/json', '.js': 'text/javascript' };
const load = () => (fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, 'utf8')) : {});
const send = (res, status, body, type = 'application/json') => { res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' }); res.end(body); };

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
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
}).listen(port, '127.0.0.1', () => console.log(`http://localhost:${port}  (오토뷰 입력: http://localhost:${port}/autoview)`));
