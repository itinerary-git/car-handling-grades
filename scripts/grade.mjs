// Assign each km77 moose-tested car to a wheelbase x ground-clearance grade and rank within each grade.
// Output: data/grades.json
import fs from 'node:fs';

const rd = (p) => JSON.parse(fs.readFileSync(new URL(p, import.meta.url), 'utf8'));
const cars = rd('../data/km77_dedup.json');
const manual = rd('../data/gc_manual.json');
const extra = fs.existsSync(new URL('../data/extra_cars.json', import.meta.url)) ? rd('../data/extra_cars.json') : [];

export const WB = ['~2599', '2600~2699', '2700~2799', '2800~2899', '2900~2999', '3000~'];
export const GC = ['~149', '150~159', '160~169', '170~179', '180~189', '190~'];
const wbBin = (w) => (w < 2600 ? 0 : w >= 3000 ? 5 : Math.floor((w - 2600) / 100) + 1);
const gcBin = (g) => (g < 150 ? 0 : g >= 190 ? 5 : Math.floor((g - 150) / 10) + 1);

const rows = [];
for (const c of [...cars, ...extra]) {
  const m = manual[c.version] || {};
  const wb = c.wheelbase_mm || m.wheelbase_mm;
  const gc = c.ground_clearance_mm || m.ground_clearance_mm;
  if (!wb || !gc) continue;
  rows.push({
    name: c.version.replace(/&amp;/g, '&'),
    moose_kmh: c.moose_kmh,
    wheelbase_mm: wb,
    ground_clearance_mm: gc,
    gc_source: c.gc_source || (c.ground_clearance_mm ? 'km77' : m.gc_source),
    km77: c.k ? 'https://www.km77.com' + c.k : c.source,
    wb: wbBin(wb),
    gc: gcBin(gc),
  });
}
const grid = WB.map((_, i) => GC.map((_, j) => rows.filter((r) => r.wb === i && r.gc === j).sort((a, b) => b.moose_kmh - a.moose_kmh)));
fs.writeFileSync(new URL('../data/grades.json', import.meta.url), JSON.stringify({ WB, GC, grid }, null, 1));

if (process.argv.includes("--print")) for (let i = 0; i < 6; i++) for (let j = 0; j < 6; j++) {
  const g = grid[i][j];
  const top = g.slice(0, 3).map((r) => `${r.moose_kmh} ${r.name.slice(0, 45)} [${r.wheelbase_mm}/${r.ground_clearance_mm}${r.gc_source === 'km77' ? '' : '*'}]`);
  console.log(`W${i + 1}G${j + 1} (${WB[i]} / ${GC[j]}) n=${g.length}\n   ${top.join('\n   ')}`);
}
