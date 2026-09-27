// Rebuild the site after an update: dedup -> grade -> page, record what changed, stamp the update date.
//   node scripts/build_all.mjs            build + record changelog + move lastUpdated to today
//   node scripts/build_all.mjs --dry      build only (no changelog / state change)
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const root = new URL('../', import.meta.url);
const P = (p) => new URL(p, root);
const rd = (p, d) => (fs.existsSync(P(p)) ? JSON.parse(fs.readFileSync(P(p), 'utf8')) : d);
const wr = (p, v) => fs.writeFileSync(P(p), JSON.stringify(v, null, 1));
const dry = process.argv.includes('--dry');
const run = (s) => execFileSync('node', [s], { cwd: root, stdio: 'inherit' });

run('scripts/dedup.mjs');
run('scripts/grade.mjs');

// snapshot of what the page shows, to diff against the previous publish
const { grid } = rd('data/grades.json');
const shown = grid.flat(2).filter((r) => r.moose_kmh >= 78).map((r) => r.name);
const qr = rd('data/qr_expected.json', []).filter((q) => q.chip !== false).map((q) => q.car);
const peers = rd('data/peer_mentions.json', []).map((m) => m.car);
const prev = rd('data/published.json', { cars: [], qr: [], peers: [] });
const today = new Date().toISOString().slice(0, 10);
const diff = {
  date: today,
  initial: !prev.cars.length,
  added: shown.filter((n) => !prev.cars.includes(n)),
  removed: prev.cars.filter((n) => !shown.includes(n)),
  qrAdded: qr.filter((n) => !prev.qr.includes(n)),
  peersAdded: peers.filter((n) => !prev.peers.includes(n)),
};
const changed = diff.added.length || diff.removed.length || diff.qrAdded.length || diff.peersAdded.length;

const state = rd('data/state.json');
if (!dry) {
  const log = rd('data/changelog.json', []);
  if (changed || !log.length) log.unshift(diff);
  wr('data/changelog.json', log);
  wr('data/published.json', { cars: shown, qr, peers });
  state.lastUpdated = today;
  delete state.pending;
  wr('data/state.json', state);
}
process.env.LAST_UPDATED = state.lastUpdated;
run('scripts/build_page.mjs');
console.log(changed ? `changes: +${diff.added.length} -${diff.removed.length} qr+${diff.qrAdded.length} peers+${diff.peersAdded.length}` : 'no changes since last publish');
