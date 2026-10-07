// Compare Autoview ratings with each grade's KM77 #1 (the blue marks).
// Inputs: data/autoview_videos.json, data/autoview_ratings.json (entered on /autoview),
//         data/autoview_cars.json (per car name: hint, km77 = same-generation KM77 car, anchor, or wb/gc/src specs).
// A car is blue when some anchor A (a car Autoview rated that KM77 also measured, same model and generation)
// has KM77 speed >= the grade's #1 speed and the car's Autoview handling and stability are both >= A's.
import fs from 'node:fs';
import { expandVideos, level } from './autoview_lib.mjs';

const root = new URL('../', import.meta.url);
const rdj = (p, d) => (fs.existsSync(new URL(p, root)) ? JSON.parse(fs.readFileSync(new URL(p, root), 'utf8')) : d);
const wbBin = (w) => (w < 2600 ? 0 : w >= 3000 ? 5 : Math.floor((w - 2600) / 100) + 1);
const gcBin = (g) => (g < 150 ? 0 : g >= 190 ? 5 : Math.floor((g - 150) / 10) + 1);

// grid: grades.json grid (all cars); minKmh: display threshold
export function compareAutoview(grid, minKmh) {
  const entries = expandVideos(rdj('data/autoview_videos.json', []));
  const ratings = rdj('data/autoview_ratings.json', {});
  const map = rdj('data/autoview_cars.json', {});
  const km77 = new Map(grid.flat(2).map((r) => [r.name, r]));

  // latest complete rating per car name (the same car can come from several videos)
  const byCar = new Map();
  for (const e of entries) {
    const r = ratings[e.key];
    if (!r?.handling || !r?.avoidance) continue;
    const prev = byCar.get(e.car);
    if (!prev || Date.parse(r.updatedAt) > Date.parse(prev.updatedAt)) byCar.set(e.car, { ...r, car: e.car, vid: e.vid, t: e.handling });
  }

  const anchors = [];
  for (const [car, r] of byCar) {
    const m = map[car];
    const k = m?.anchor && km77.get(m.km77);
    if (k) anchors.push({ car, kmh: k.moose_kmh, km77: k.name, h: level(r.handling), a: level(r.avoidance), r });
  }

  // only cars Autoview rated 좋음 or better on handling or stability are shown
  const GOOD = level('좋음');
  const cells = grid.map((row) => row.map(() => []));
  const unmapped = [];
  for (const [car, r] of byCar) {
    if (level(r.handling) < GOOD && level(r.avoidance) < GOOD) continue;
    const m = map[car];
    const k = m?.km77 && km77.get(m.km77);
    const wb = k ? k.wheelbase_mm : m?.wb, gc = k ? k.ground_clearance_mm : m?.gc;
    if (!wb || !gc) { unmapped.push(car); continue; }
    const i = wbBin(wb), j = gcBin(gc);
    const top = grid[i][j].find((x) => x.moose_kmh >= minKmh)?.moose_kmh ?? null;
    const h = level(r.handling), a = level(r.avoidance);
    let status, basis = null;
    if (k) status = 'km77';
    else if (top == null) status = 'nofirst';
    else {
      const usable = anchors.filter((x) => x.kmh >= top).sort((x, y) => x.kmh - y.kmh);
      basis = usable.find((x) => h >= x.h && a >= x.a) || null;
      status = basis ? 'blue' : usable.length ? 'below' : 'nobase';
      if (!basis) basis = usable[0] || null;
    }
    cells[i][j].push({
      car, handling: r.handling, avoidance: r.avoidance, status, top,
      kmh: k?.moose_kmh ?? null,
      basis: basis && { car: basis.car, km77: basis.km77, kmh: basis.kmh, handling: basis.r.handling, avoidance: basis.r.avoidance },
      specs: `WB ${wb.toLocaleString("en-US")} / GC ${gc}mm · ${k ? "KM77 " + k.name : m.src || "제조사 제원"}`,
      url: `https://www.youtube.com/watch?v=${r.vid}${r.t != null ? `&t=${r.t}s` : ''}`,
    });
  }
  for (const c of cells.flat()) c.sort((x, y) => (y.status === 'blue') - (x.status === 'blue') || level(y.handling) - level(x.handling));
  return { cells, anchors, unmapped, rated: byCar.size };
}
