# Divindex

A trading terminal for the Path of Exile 2 economy — a live currency index with a
searchable market, per-currency charts, stats, and top movers. Centralized web app,
no blockchain.

## Stack

- **SvelteKit** + **Svelte 5** (runes) — SSR, server routes, no virtual DOM
- **Vite 8** · **Bun** runtime · **Biome** · **TypeScript**
- **lightweight-charts** (TradingView) for the price chart
- `@sveltejs/adapter-node` (swap for Vercel/Netlify/Cloudflare to deploy divindex.com)

## Develop

```bash
bun install
bun run dev          # http://localhost:5173
bun run check        # types (0 errors / 0 warnings)
bun run build        # production build -> ./build
bun run start        # run the built server (node build)  [PORT=3000 node build]
```

## How it works

```
src/
  routes/
    +page.svelte           # the terminal (toolbar, market list, chart, stats, status bar)
    +page.ts               # SSR load -> /api/market
    api/market/+server.ts  # market endpoint (the data seam)
  lib/
    server/poe2scout.ts    # live PoE2 currency market client (cached, 10 min TTL)
    components/             # Toolbar, MarketList, PriceChart, StatsPanel, StatusBar
    types.ts  format.ts
    data/series.json        # offline fallback snapshot
  app.css                  # terminal UI (dense, lined, mono numbers)
```

## Data

`/api/market` returns the full currency market for the current league. Source order:

1. **Live** — `src/lib/server/poe2scout.ts` fetches PoE2 currency data from poe2scout's
   open API (proper User-Agent, in-memory cache). poe2scout derives prices from GGG's
   official in-game Currency Exchange.
2. **Fallback** — if poe2scout is unreachable, the bundled `data/series.json` snapshot is
   served so the terminal always renders.

**The seam:** once GGG grants `service:cxapi`, replace the fetch in `poe2scout.ts` (or add
a sibling client) to compute the volume-weighted index directly from GGG's official Currency
Exchange hourly digests. The endpoint and frontend contract (`Market`/`Currency`) don't change.

Sub-1-exalt shards produce noisy percentage swings (near-zero prior prices); the UI clamps
absurd values and excludes them from "top movers."

## Charting

Uses TradingView's open-source **lightweight-charts**. For the full Advanced Charts terminal
(drawing tools, indicators, symbol search) you must apply to TradingView for private-repo
access; the existing data shape can feed its datafeed adapter later.

## Legal

Divindex is an independent project and is **not affiliated with or endorsed by Grinding Gear
Games** in any way. Path of Exile is a trademark of Grinding Gear Games.
