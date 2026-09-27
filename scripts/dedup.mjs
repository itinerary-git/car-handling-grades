// Collapse km77_cars.json to one entry per tested version (prefer entries that have specs).
// Output: data/km77_dedup.json
import fs from 'node:fs';

const d = JSON.parse(fs.readFileSync(new URL('../data/km77_cars.json', import.meta.url), 'utf8'));
const by = {};
for (const [k, v] of Object.entries(d)) {
  if (!v.moose_kmh) continue;
  const cur = by[v.version];
  if (!cur || (!cur.wheelbase_mm && v.wheelbase_mm) || (!cur.ground_clearance_mm && v.ground_clearance_mm)) by[v.version] = { k, ...v };
}
const out = Object.values(by);
fs.writeFileSync(new URL('../data/km77_dedup.json', import.meta.url), JSON.stringify(out, null, 1));
console.log('dedup', out.length);
