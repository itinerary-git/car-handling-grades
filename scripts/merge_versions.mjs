// Add version-level moose results (data/km77_versions.json) to data/km77_measurements.json
// when that version has no moose value there yet. enrich_specs.mjs then reads their specs.
import fs from 'node:fs';

const P = (p) => new URL(`../data/${p}`, import.meta.url);
const meas = JSON.parse(fs.readFileSync(P('km77_measurements.json'), 'utf8'));
const vers = fs.existsSync(P('km77_versions.json')) ? JSON.parse(fs.readFileSync(P('km77_versions.json'), 'utf8')) : {};
const have = new Set(Object.values(meas).filter((v) => v.moose_kmh).map((v) => v.version));
let added = 0;
for (const [k, v] of Object.entries(vers)) {
  if (!v.moose_kmh || !v.version || have.has(v.version) || meas[k]) continue;
  meas[k] = v;
  have.add(v.version);
  added++;
}
fs.writeFileSync(P('km77_measurements.json'), JSON.stringify(meas, null, 1));
console.log('merged version results', added);
