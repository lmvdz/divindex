# Divindex

The Path of Exile 2 economy, as an index — real-time currency rates, deep price
history, and a free weekly forecasting game, built on the game's official
in-game Currency Exchange.

This repo is the **landing page** (static, dependency-free). It exists so the
product is live and presentable — including the required non-affiliation notice —
before requesting Currency Exchange API access from Grinding Gear Games.

## Run locally

No build step. Serve the folder with any static server:

```bash
python3 -m http.server 5173
# then open http://localhost:5173
```

## Structure

```
index.html        # markup
styles.css        # design tokens + layout (dark, finance-credible)
main.js           # chart render (SVG, no deps), waitlist forms, states
data/series.json  # chart data (currently a recent illustrative snapshot)
assets/           # favicon + social card (SVG)
brand.md          # palette, type, voice, legal rules
```

## Wiring the waitlist

`main.js` has `FORM_ENDPOINT` (empty by default). Set it to a form endpoint
(e.g. Formspree) to collect emails; until then the form falls back to a
`mailto:` link so nothing is silently dropped.

## Data

`data/series.json` currently holds a recent snapshot for illustration. Once GGG
grants `service:cxapi` access, replace the generator so the index is computed
directly from the official Currency Exchange hourly digests (volume-weighted
rate), and serve it from our own backend/oracle.

## Deploy to divindex.com

Any static host works:
- **Vercel / Netlify / Cloudflare Pages:** point at this repo, no build command,
  output dir = root. `vercel.json` is included.
- **GitHub Pages:** enable Pages on the repo and add a `CNAME` file containing
  `divindex.com`.

## Legal

Divindex is an independent project and is **not affiliated with or endorsed by
Grinding Gear Games** in any way. Path of Exile is a trademark of Grinding Gear
Games.
