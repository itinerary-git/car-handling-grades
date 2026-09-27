// Print title, channel and description of YouTube watch pages (public metadata only; /watch is allowed by robots.txt).
// Usage: node scripts/yt_meta.mjs <videoId...>
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
for (const id of process.argv.slice(2)) {
  const h = await (await fetch(`https://www.youtube.com/watch?v=${id}`, { headers: { 'User-Agent': 'Mozilla/5.0', 'Accept-Language': 'it' } })).text();
  const pick = (re) => {
    const m = h.match(re);
    return m ? JSON.parse(`"${m[1]}"`) : '';
  };
  const title = pick(/"title":"((?:[^"\\]|\\.)*)","lengthSeconds"/);
  const channel = pick(/"ownerChannelName":"((?:[^"\\]|\\.)*)"/);
  const date = pick(/"publishDate":"((?:[^"\\]|\\.)*)"/);
  const desc = pick(/"shortDescription":"((?:[^"\\]|\\.)*)"/);
  console.log(JSON.stringify({ id, title, channel, date, desc }));
  await sleep(500);
}
