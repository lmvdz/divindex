# Divindex Analytics — Moat Roadmap

## Thesis
Prices are a commodity (anyone can read poe2scout). The moat is the **crowd-prediction
layer**: a scored, ranked population of forecasters with *settled track records*.

- **Data network effect** — more players → more forecasts → sharper signal → more traders → more players.
- **Time-accrued track records can't be back-filled** — a competitor cloning us starts at zero history.

Build everything as a derivative of the prediction data; use high-utility tools as
traffic magnets that *feed* that data.

## Status (shipped)
- Gating (KV allowlist, `/api/admin/premium`), premium flag in layout.
- `/analytics` (Pro): Market Intelligence, Smart Money, My Performance.
- VWAP indicator; price alerts (KV + hourly cron + Discord delivery).

## Layers & order (dependency-driven)

### Phase 1 — Forecast Layer (the moat core; no external deps)
1. **Forecaster alpha/IC scoring** — per-forecaster Information Coefficient (corr of
   predicted vs actual returns), sample size, significance. Separates skill from luck.
2. **Probability distributions** — aggregate crowd predictions into a distribution per
   currency/horizon (not a point).
3. **The Divindex Signal** — alpha-weighted top-forecaster consensus + edge vs price.
4. **Backtest / public track record** — replay the Signal vs actuals over history; publish
   an auditable performance scorecard. (The credibility magnet.)
5. **Forecast cones** — render the distribution forward on the chart (fan/cone) + a running
   accuracy scorecard of past cones.
6. **Copy-a-forecaster** — follow sharp diviners; their calls become a feed/portfolio.
7. **Play-money prediction market** — Omen-denominated odds on outcomes; implied prob = signal.

### Phase 2 — Profit Layer (utility; mostly buildable, some curated data)
8. **Divindex Fair Value** — model price + confidence band that filters thin-market noise.
9. **Crafting profitability** — live expected-profit ranking per craft (recipe cost → outcome).
10. **Arbitrage / shard scanner** — shard-sum vs whole orb, vendor recipes, cross-category.

### Phase 3 — Intelligence Layer (retention + AI inputs)
11. **Patch/event annotations** — overlay GGG patches/league events; quantify economic shock.
12. **Portfolio / stash tracking** — net worth over time, P&L, exposure by category.
13. **Semantic alerts** — "crowd flipped bearish on Divine", "a craft turned profitable".

### Phase 4 — Sentiment ingestion (start in parallel with 1–2)
14. Pull **r/PathOfExile2** (Reddit API) + **pathofexile.com PoE2 forums**; extract
    economy-relevant posts; score sentiment per currency/topic; store + index.

### Phase 5 — AI Analyst (capstone; consumes 1–4)
15. **Claude API** agent with a financial-analyst prompt + tool access to prices, forecasts,
    Signal, fair value, and sentiment retrieval → structured `{item, action, target, entry,
    confidence, horizon, rationale + sources}`.
16. **Surface** — Pro "AI Analyst" tab: daily recs with sources, per-currency view, NL Q&A.
17. **Guardrails** — grounded in retrieved data only; cite sources; confidence; game-economy
    framing (not financial advice). Pro-gated; cached briefings (LLM cost).

## External dependencies (need from owner)
- Phase 5: **Anthropic API key**, **Reddit API credentials**, decision on forum scraping.
- Phases 2/9–10: curated **crafting recipe + shard↔orb** dataset (see research).

## Execution model
Features share `types.ts` / `forecast.ts` / the `/analytics` page → built in **sequenced
waves**, each type-checked + built + committed. Parallelism reserved for **research** and
**independent new-file modules**.
