# Divindex

The Path of Exile 2 economy, as an index — real-time currency rates, deep price
history, and a free weekly forecasting game, built on the game's official
in-game Currency Exchange.

## Stack

- **SvelteKit** + **Svelte 5** (runes) — compiler, no virtual DOM, SSR
- **Vite 8** · **Bun** runtime · **Biome** (lint/format) · **TypeScript**
- **lightweight-charts** (TradingView) for financial time-series, with a
  dependency-free SVG sparkline fallback
- `@sveltejs/adapter-node` (portable; swap for Vercel/Netlify/Cloudflare on deploy)

## Develop

```bash
bun install
bun run dev        # http://localhost:5173
bun run check      # svelte-check (types)
bun run build      # production build -> ./build
bun run start      # run the built server (node build)
bun run lint       # biome
```

## Structure

```
src/
  app.html                     # document shell (fonts, meta, OG)
  app.css                      # design tokens + global styles
  lib/
    types.ts  format.ts
    data/series.json           # index snapshot (replace with cxapi feed)
    components/                # Nav, Footer, IndexChart, Ticker, WaitlistForm
  routes/
    +layout.svelte             # Nav + Footer shell
    +page.svelte / +page.ts    # landing + SSR data load
    api/index/+server.ts       # index endpoint (the cxapi oracle seam)
static/                        # favicon.svg, assets/og.svg
```

## The data seam

`src/routes/api/index/+server.ts` currently serves `src/lib/data/series.json`
(a recent snapshot). Once GGG grants `service:cxapi`, compute the volume-weighted
index in that endpoint directly from the official Currency Exchange hourly
digests — the frontend already consumes it via SSR (`+page.ts`), so nothing else
changes.

## Waitlist

`src/lib/components/WaitlistForm.svelte` has `FORM_ENDPOINT` (empty by default).
Point it at a form endpoint (e.g. Formspree) to collect emails; until then it
shows the contact address rather than dropping signups.

## Legal

Divindex is an independent project and is **not affiliated with or endorsed by
Grinding Gear Games** in any way. Path of Exile is a trademark of Grinding Gear
Games.
