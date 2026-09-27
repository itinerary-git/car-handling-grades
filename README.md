# car-handling-grades

Static page ranking cars by KM77 moose test (maniobra de esquiva) speed within 36 grades:
wheelbase (<2600, 2600–2699, …, ≥3000 mm) × ground clearance (<150, 150–159, …, ≥190 mm).
Cars at 77 km/h or below are excluded. Deployed to Vercel from `public/`.

## Update (incremental)

```bash
node scripts/update.mjs        # collect only data newer than data/state.json lastUpdated -> data/pending_review.md
# review pending_review.md: fill data/gc_manual.json, data/qr_expected.json, data/peer_mentions.json
node scripts/build_all.mjs     # dedup -> grade -> public/index.html, changelog, lastUpdated = today
```

`CLAUDE.md` has the full procedure and rules.

## Initial collection (already done)

```bash
MSYS_NO_PATHCONV=1 node scripts/crawl_km77.mjs <seed mediciones-propias paths...>
MSYS_NO_PATHCONV=1 node scripts/discover_km77.mjs <brand slugs...> > data/discovered.txt
node scripts/enrich_specs.mjs
```

- Crawling skips paths disallowed in km77's robots.txt (`/buscador`, `/coches/mediciones-propias/`).
- `MSYS_NO_PATHCONV=1` stops Git Bash from rewriting `/coches/...` arguments into Windows paths.
