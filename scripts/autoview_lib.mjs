// Shared Autoview helpers: rating scale, title -> car names, video list -> rating entries.
// Used by build_autoview.mjs (input page), build_page.mjs (blue marks) and serve.mjs / api/ratings.js.

// 9-step scale, index = order (0 = not entered)
export const LEVELS = ['', '나쁨', '나쁨~부족', '부족', '부족~보통', '보통', '보통~좋음', '좋음', '좋음~훌륭함', '훌륭함'];
export const level = (s) => Math.max(0, LEVELS.indexOf(s || ''));

const BRANDS = ['포르쉐', '마세라티', '페라리', '람보르기니', '벤틀리', '롤스로이스', '애스턴마틴', '맥라렌', '로터스',
  '메르세데스-벤츠', '벤츠', '메르세데스-AMG', 'BMW', '미니', '아우디', '폭스바겐', '볼보', '폴스타', '푸조', '시트로엥', 'DS',
  '르노', '테슬라', 'BYD', '현대', '기아', '제네시스', 'KGM', '쉐보레', '캐딜락', 'GMC', '포드', '링컨', '지프', '랜드로버',
  '레인지로버', '재규어', '토요타', '렉서스', '혼다', '닛산', '인피니티', '마쯔다', '스바루', '알파로메오', '피아트', '지커', '쌍용', 'RAM'];
const isBrand = (w) => BRANDS.some((b) => w === b || w.startsWith(b + ' '));

// Not a single-car road test (tire comparisons etc.)
export const isCarTest = (title) => !/타이어|비교\]/.test(title);

// "[리뷰] 2026 포르쉐 마칸4 & 마세라티 그레칼레 폴고레 / 오토뷰 로드테스트"
//   -> ['2026 포르쉐 마칸4', '2026 마세라티 그레칼레 폴고레']
// A part without a year takes the first part's year; without a brand, the first part's brand
// ("2025 마세라티 그란투리스모 & 그란카브리오" -> "2025 마세라티 그란카브리오").
const TAIL = /\s+(리뷰|이야기|시승기|비교)$/;
export function splitTitle(title) {
  let core = title.split(/\s*\/\s|\/\s*오토뷰|\s-\s*오토뷰/)[0]
    .replace(/\[[^\]]*\]/g, '')
    .replace(/\(feat[^)]*\)|\(\s*[A-Za-z][\x20-\x7e]*\s[\x20-\x7e]*\)/g, '') // "(feat. …)", "(Porsche Panamera 4)", "(… roadtest)"
    .replace(/\s+/g, ' ');
  core = core.split(/\.\.\.|…|\?|,/).pop().trim(); // drop teaser text ("387마력, …", "진실... 2027 …")
  const y = core.match(/(?:^|\s)((?:19|20)\d\d)(?:년형)?\s/);
  if (y) core = (y[1] + core.slice(y.index + y[0].length - 1)).trim(); // start at the model year, "2027년형" -> "2027"
  else {
    const b = BRANDS.map((w) => core.indexOf(w)).filter((i) => i >= 0).sort((a, c) => a - c)[0];
    if (b > 0) core = core.slice(b);
  }
  core = core.replace(TAIL, '').trim();
  // "A & B" is always two cars; "A vs B" only when B names a brand (else it is a variant comparison of one car)
  const parts = [];
  for (const [i, p] of core.split(/\s+(&|vs)\s+/i).entries()) {
    if (i % 2) continue;
    const sep = i ? core.split(/\s+(&|vs)\s+/i)[i - 1] : '&';
    if (i && sep.toLowerCase() === 'vs' && !isBrand(p.replace(/^(?:19|20)\d\d\s+/, ''))) parts[parts.length - 1] += ` vs ${p}`;
    else parts.push(p.replace(TAIL, '').trim());
  }
  const year = parts[0].match(/^((?:19|20)\d\d)\s+/)?.[1] || '';
  const rest0 = parts[0].replace(/^(?:19|20)\d\d\s+/, '');
  const brand = BRANDS.filter((b) => rest0 === b || rest0.startsWith(b + ' ')).sort((a, b) => b.length - a.length)[0] || '';
  return parts.map((p, i) => {
    if (i === 0) return p;
    let body = p.replace(/^(?:19|20)\d\d\s+/, '');
    const ownYear = p !== body;
    if (brand && !isBrand(body)) body = `${brand} ${body}`;
    return ownYear ? p.replace(/^((?:19|20)\d\d)\s+.*$/, `$1 ${body}`) : `${year ? year + ' ' : ''}${body}`;
  });
}

// One entry per car: key = video id, or "<id>.<n>" (n from 1) when the title has several cars.
export function expandVideos(videos) {
  const out = [];
  for (const v of videos) {
    if (!isCarTest(v.title)) continue;
    const cars = splitTitle(v.title);
    cars.forEach((car, i) => out.push({ key: cars.length > 1 ? `${v.id}.${i + 1}` : v.id, vid: v.id, car, title: v.title, date: v.date, handling: v.handling, stability: v.stability }));
  }
  return out;
}

// Merge rating maps ({key: {handling, avoidance, updatedAt, ...}}): newer updatedAt wins per key.
const t = (r) => Date.parse(r?.updatedAt || '') || 0;
export function mergeRatings(...maps) {
  const out = {};
  for (const m of maps) for (const [k, r] of Object.entries(m || {})) if (!out[k] || t(r) > t(out[k])) out[k] = r;
  return out;
}
