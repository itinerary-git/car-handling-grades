// Build report/index.html (artifact page), public/index.html, public/autoview.html (owner-only Autoview input)
// and data/all_cars.csv from data/grades.json.
import fs from 'node:fs';
import { compareAutoview } from './autoview_compare.mjs';
import { expandVideos, LEVELS } from './autoview_lib.mjs';

const root = new URL('../', import.meta.url);
const MIN_KMH = 78; // user rule: drop cars at or below 77 km/h
const src = JSON.parse(fs.readFileSync(new URL('data/grades.json', root), 'utf8'));
const { WB, GC } = src;
const grid = src.grid.map((row) => row.map((c) => c.filter((r) => r.moose_kmh >= MIN_KMH)));
const mentions = JSON.parse(fs.readFileSync(new URL('data/peer_mentions.json', root), 'utf8'));
const qrExpected = JSON.parse(fs.readFileSync(new URL('data/qr_expected.json', root), 'utf8'));
const av = compareAutoview(src.grid, MIN_KMH);

const SHORT = [
  [/^Porsche 911 Turbo S Coupé \(2025/, 'Porsche 911 Turbo S (992.2)'],
  [/^Porsche 911 Turbo S Coupé \(2015/, 'Porsche 911 Turbo S (991.2)'],
  [/^Ford Puma ST/, 'Ford Puma ST 1.5 EcoBoost'],
  [/^Ford Puma/, 'Ford Puma 1.0 EcoBoost MHEV'],
  [/^Ford Fiesta Active/, 'Ford Fiesta Active 1.5 TDCi'],
  [/^KIA Niro 1.6 GDi HEV/, 'Kia Niro 1.6 HEV (2세대)'],
  [/^Citroën ë-C3/, 'Citroën ë-C3'],
  [/^Toyota Yaris Cross/, 'Toyota Yaris Cross Hybrid'],
  [/^Volkswagen T-Cross/, 'Volkswagen T-Cross 1.0 TSI'],
  [/^SEAT Arona 1.0/, 'SEAT Arona 1.0 TSI'],
  [/^Peugeot 308 5p GT Line/, 'Peugeot 308 GT Line (T9)'],
  [/^Toyota C-HR 180H/, 'Toyota C-HR 2.0 Hybrid'],
  [/^Toyota C-HR Hybrid Advance/, 'Toyota C-HR 1.8 Hybrid'],
  [/^Skoda Karoq Sportline/, 'Skoda Karoq 1.5 TSI Sportline'],
  [/^KIA Sportage GT-line 1.6 T-GDI MHEV/, 'Kia Sportage 1.6 T-GDI 4x4 (NQ5)'],
  [/^Skoda Karoq Style 2.0 TDI/, 'Skoda Karoq 2.0 TDI 4x4'],
  [/^Opel Grandland X/, 'Opel Grandland X 1.2 Turbo'],
  [/^Renault Kadjar/, 'Renault Kadjar TCe 140'],
  [/^Ford Focus Berlina ST-Line 1.0 EcoBoost 92 kW \(125 CV\) \(2018/, 'Ford Focus 1.0 EcoBoost (Mk4)'],
  [/^Nissan LEAF 40/, 'Nissan Leaf 40 kWh (ZE1)'],
  [/^Ebro s800/, 'Ebro s800 PHEV'],
  [/^Renault Rafale/, 'Renault Rafale E-Tech 200'],
  [/^Skoda Kodiaq Selection/, 'Skoda Kodiaq 1.5 TSI mHEV (2세대)'],
  [/^Nissan X-Trail dCi/, 'Nissan X-Trail dCi 130 (T32)'],
  [/^Tesla Model 3 Tracción integral/, 'Tesla Model 3 Long Range AWD'],
  [/^Aiways U5/, 'Aiways U5'],
  [/^Tesla Model Y Gran/, 'Tesla Model Y Long Range AWD'],
  [/^Audi Q6 e-tron/, 'Audi Q6 e-tron quattro'],
  [/^BMW X3 xDrive20d/, 'BMW X3 xDrive20d (G01)'],
  [/^Audi Q5 2.0 TDI 140/, 'Audi Q5 2.0 TDI quattro (FY)'],
  [/^KIA Stinger/, 'Kia Stinger GT 3.3T AWD'],
  [/^Tesla Model S Plaid/, 'Tesla Model S Plaid'],
  [/^Mercedes-Benz E 220 d 4MATIC All-Terrain/, 'Mercedes E 220 d All-Terrain (S213)'],
  [/^KIA EV6/, 'Kia EV6 RWD 77 kWh'],
  [/^Audi e-tron Sportback/, 'Audi e-tron Sportback 50'],
  [/^Audi Q8/, 'Audi Q8 50 TDI'],
  [/^Mercedes-Benz EQE 350/, 'Mercedes EQE 350'],
  [/^Volkswagen Multivan/, 'Volkswagen Multivan eHybrid (T7)'],
  [/^Hyundai IONIQ 5/, 'Hyundai IONIQ 5 RWD 73 kWh'],
  [/^KIA EV9/, 'Kia EV9 AWD'],
  [/^BMW XM/, 'BMW XM'],
];
const short = (n) => (SHORT.find(([re]) => re.test(n)) || [null, n.replace(/\s*\(\d{4}[^)]*\)\s*$/, '')])[1];

const cells = grid.map((row, i) =>
  row.map((c, j) => {
    const top = c[0]?.moose_kmh;
    return {
      n: c.length,
      mentions: mentions.filter((m) => m.cell === `W${i + 1}G${j + 1}`),
      qr: qrExpected.filter((q) => q.cell === `W${i + 1}G${j + 1}`),
      av: av.cells[i][j],
      winners: c.filter((r) => r.moose_kmh === top).map((r) => short(r.name)),
      top: top ?? null,
      list: c.slice(0, 6).map((r) => ({
        name: r.name,
        kmh: r.moose_kmh,
        wb: r.wheelbase_mm,
        gc: r.ground_clearance_mm,
        est: r.gc_source === 'km77' ? '' : r.gc_source.startsWith('verified') ? 'v' : 'e',
        url: r.km77,
      })),
    };
  })
);

// CSV of every car
const esc = (s) => `"${String(s).replace(/"/g, '""')}"`;
const csv = ['grade,wheelbase_bin,clearance_bin,rank,moose_kmh,car,wheelbase_mm,ground_clearance_mm,clearance_source,km77_url'];
grid.forEach((row, i) => row.forEach((c, j) => c.forEach((r, k) => csv.push([`W${i + 1}G${j + 1}`, WB[i], GC[j], k + 1, r.moose_kmh, esc(r.name), r.wheelbase_mm, r.ground_clearance_mm, esc(r.gc_source), r.km77].join(',')))));
fs.writeFileSync(new URL('data/all_cars.csv', root), '﻿' + csv.join('\n'));

const total = grid.flat(2).length;
const filled = cells.flat().filter((c) => c.n).length;
const rdj = (p, d) => (fs.existsSync(new URL(p, root)) ? JSON.parse(fs.readFileSync(new URL(p, root), 'utf8')) : d);
const updated = process.env.LAST_UPDATED || rdj('data/state.json', {}).lastUpdated || '';
const escH = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const changelog = rdj('data/changelog.json', []).slice(0, 12).map((e) => {
  if (e.initial) return `<li><span class="cl-date">${e.date}</span> 첫 공개 · 78km/h 이상 ${e.added.length}대, Quattroruote 예상 ${e.qrAdded.length}대, 비교 평가 ${e.peersAdded.length}건</li>`;
  const parts = [];
  if (e.added.length) parts.push(`추가 ${e.added.length}대: ${e.added.slice(0, 6).map(escH).join(', ')}${e.added.length > 6 ? ' 외' : ''}`);
  if (e.removed.length) parts.push(`제외 ${e.removed.length}대`);
  if (e.qrAdded.length) parts.push(`Quattroruote 예상 추가: ${e.qrAdded.map(escH).join(', ')}`);
  if (e.peersAdded.length) parts.push(`비교 평가 추가: ${e.peersAdded.map(escH).join(', ')}`);
  if (e.avAdded?.length) parts.push(`오토뷰 비교 추가: ${e.avAdded.map(escH).join(', ')}`);
  return `<li><span class="cl-date">${e.date}</span> ${parts.join(' · ') || '첫 공개'}</li>`;
}).join('');
const tpl = fs.readFileSync(new URL('report/template.html', root), 'utf8');
const body = tpl
  .replace('/*DATA*/null', JSON.stringify({ WB, GC, cells }))
  .replaceAll('{{TOTAL}}', total)
  .replaceAll('{{FILLED}}', filled)
  .replaceAll('{{UPDATED}}', updated)
  .replace('{{CHANGELOG}}', changelog || '<li>기록 없음</li>');
fs.writeFileSync(new URL('report/index.html', root), body);
// standalone page for Vercel (public/): the artifact host adds this skeleton itself
fs.mkdirSync(new URL('public/', root), { recursive: true });
const headTags = (body.match(/^(?:\s*<(?:title>[^<]*<\/title|link [^>]*)>)+/) || [''])[0];
const doc = `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="description" content="휠베이스 × 지상고 30개 등급별 KM77 무스 테스트 1위 차량 표">
${headTags.trim()}
<style>body{margin:0}img{max-width:100%}[hidden]{display:none!important}</style>
</head>
<body>
${body.slice(headTags.length).replace(/\s*<!--PRIVATE-->[\s\S]*?<!--\/PRIVATE-->/g, '')}
</body>
</html>
`;
fs.writeFileSync(new URL('public/index.html', root), doc);
fs.copyFileSync(new URL('data/all_cars.csv', root), new URL('public/all_cars.csv', root));

// owner-only Autoview input page: one row per car (titles with "&" give two rows)
const avMap = rdj('data/autoview_cars.json', {});
const entries = expandVideos(rdj('data/autoview_videos.json', [])).map((e) => ({
  ...e,
  split: e.key.includes('.') ? `한 영상 ${e.key.split('.')[1]}번째 차` : '',
  hint: avMap[e.car]?.hint || '',
}));
const avTpl = fs.readFileSync(new URL('report/autoview_template.html', root), 'utf8');
fs.writeFileSync(new URL('public/autoview.html', root), avTpl
  .replace('/*DATA*/[]', () => JSON.stringify(entries).replace(/</g, String.fromCharCode(92) + 'u003c')) // no '</script>' inside the inline JSON
  .replace('/*LEVELS*/[]', () => JSON.stringify(LEVELS)));

const blue = av.cells.flat(2).filter((x) => x.status === 'blue');
console.log('cars', total, 'filled cells', filled, '| autoview rated', av.rated, 'blue', blue.length, blue.length ? '(' + blue.map((x) => x.car).join(', ') + ')' : '');
if (av.unmapped.length) console.log('autoview: no specs in data/autoview_cars.json for', av.unmapped.join(', '));
