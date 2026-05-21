# Divindex — Visual Design Brief

_For: graphic / visual designer · Scope: website visualizations, key art, icon & data-viz system, social cards._

---

## 1. What Divindex is

A real-time **economy index and free forecasting game** for the Path of Exile 2 in-game
economy. Think "a markets terminal for a game's currency" — live currency rates, deep
price history, and a weekly game where players predict where prices land.

- **One-liner:** The Path of Exile 2 economy, as an index.
- **Tagline:** Track every orb. Forecast every move.
- **Name logic:** _Divine_ (the game's premium currency) + _index_. It should read like a
  market index (S&P / Nasdaq energy), not like a game mod or a casino.

## 2. Audience

Path of Exile 2 players who already trade in-game currency — a finance-literate, chart-reading,
arbitrage-minded crowd. They respect TradingView, spreadsheets, and clean data. Talk to them
like traders, not like a kids' game. Skews desktop, dark-mode-native, design-aware.

## 3. The core idea (creative tension to express)

**An ancient economy, read like a modern market.** Divindex lives at the seam of two worlds:

- the **arcane / old-world** flavor of the game — alchemical orbs, engraved ledgers, antique gold;
- the **clean modern data terminal** — charts, indices, tabular numbers, restraint.

Every visualization should feel like that fusion: _an illuminated ledger meets a Bloomberg
terminal._ Premium, dark, considered. Never cartoonish, never crypto-bro, never casino.

## 4. The central visual concept — "The Orb Index"

The brand's atom is the **orb**. The game's currencies are orbs; our name is an orb. Build the
visual system around it:

- **Hero key visual:** a single luminous **antique-gold orb** suspended in near-black space,
  with a **market living inside or around it** — a faint candlestick / line chart refracted
  within the glass, or a thin orbital ring of price ticks and a subtle radial "gauge" sweep.
  "An orb that holds a market inside it."
- **System extension:** multiple orbs (the tracked currencies) as **nodes in an exchange
  network** — connected by thin flowing lines representing trading pairs. The economy as a
  living graph.
- **Texture layer:** subtle engraved / alchemical line-work and grain, used sparingly behind
  sections, so the modern UI sits on an old-world substrate.

Deliver the hero concept first; the orb + network system should scale to icons, spot art,
section backgrounds, and social cards.

## 5. Voice & tone (for any words in the visuals)

Concise, confident, trader-literate. Active voice. We say **markets, rates, indices, forecasts**
— never **bets, odds, wagers**. No exclamation marks. No hype words ("elevate", "seamless",
"unleash", "next-gen"). Sentence case for headings.

## 6. Design system (already live — match it exactly)

The website is built; assets must be consistent with these tokens.

**Color (dark-first):**

| Role | Hex |
|------|-----|
| Background (off-black, blue-tinted) | `#0a0c12` |
| Surface / raised surface | `#11141d` / `#161a25` |
| Hairline border | `#232838` |
| Text | `#eef0f6` |
| Muted text | `#98a1b6` |
| Faint text | `#69728a` |
| **Accent — antique Divine gold** (the ONLY accent) | `#e0b465` (soft `#ecca8e`, deep `#c2913f`) |
| Positive / up | `#66cf8a` |
| Negative / down | `#e57170` |

- **One accent only (gold).** Do not introduce a second brand color. No purple, no neon, no
  rainbow. Saturation stays below ~80% — antique, expensive, not bright.
- Shadows are **tinted toward the dark base**, never pure black; there is no pure `#000`.

**Typography:**

- **Display / headlines / wordmark:** _Fraunces_ (serif) — the old-world, editorial character.
- **UI / body:** _Geist_ (sans).
- **All numbers / data:** _Geist Mono_, tabular figures.

**Logo / mark:** the **orb** — a radial-gradient sphere: highlight `#fff4d6` → `#e0b465` →
`#c2913f` → deep `#6f4a17`, with a soft gold glow. Pairs left of the "Divindex" wordmark in
Fraunces. (A basic favicon exists; you may elevate the mark, keeping this gradient identity.)

**Texture / depth:** a fine film grain overlays the whole site at low opacity; ambient gold
radial gradients glow from the top-right. Surfaces have a 1px top inner-highlight. Keep this
restrained, premium feel.

**Motion (if you spec any):** subtle and physical — slow orb shimmer/rotation, scroll-reveal
fades with slight upward drift, cursor-tracked spotlight on cards. Easing `cubic-bezier(0.16, 1,
0.3, 1)`. Nothing flashy or bouncy.

## 7. Deliverables (prioritized)

1. **Hero key visual** — the Orb Index concept. Provide: full-bleed dark version, transparent
   PNG/SVG of the orb alone, and a cropped mobile version.
2. **Logo system** — orb + "Divindex" lockups (horizontal, stacked, mark-only), clear-space &
   min-size rules, favicon/app-icon refinement, monochrome fallback.
3. **Icon set** — cohesive line icons (1.5px stroke, gold or currentColor) for: live index,
   history, the Forecast, currency exchange, leaderboard, alerts. Must match the existing
   inline-SVG icons' weight.
4. **Data-viz style** — how charts look: line/area + candlesticks, gridlines, crosshair, the
   gold line, up/down colors, and the "index gauge" radial motif. A short spec sheet others can
   implement against (we use TradingView lightweight-charts under the hood).
5. **Currency orb set** — original orb illustrations for the tracked currencies (a Divine-style,
   an Exalted-style, Chaos, Mirror, Annul, etc.) in our gold/dark style. **Original
   interpretations only — see §9.**
6. **Section backgrounds / ambient art** — subtle engraved textures, mesh/radial glows, the orb
   network graph as a faint backdrop.
7. **Social / OG cards** — 1200×630 template + 2–3 variants (launch, "the index", "the Forecast").
8. **Spot illustrations** — small graphics for the feature tiles and the Forecast steps.

## 8. Art direction — do / don't

**Do**
- Dark-first, antique-gold single accent, lots of considered negative space.
- Asymmetric, editorial compositions (the site uses a bento, not equal card rows).
- Real depth: grain, tinted shadows, soft glows, glass refraction.
- Fuse arcane (engraving, alchemy, gold leaf) with terminal (charts, mono numbers, grids).
- Treat data as the hero — make price/charts beautiful and legible.

**Don't**
- No "AI purple/blue" gradients, neon glows, or oversaturated color.
- No generic crypto/web3 imagery — no 3D coins, blockchains, glossy tokens, hex grids.
- No casino/gambling imagery — **no dice, slot machines, roulette, poker chips, jackpots, neon
  "WIN".** (Critical — see §9.)
- No stock "diverse team" photos, no emojis, no clip-art, no pure black.
- No three-equal-card layouts, no centered-everything symmetry.

## 9. Hard constraints (legal — read first)

These are non-negotiable; they protect the Grinding Gear Games relationship and our legal posture.

1. **Not affiliated with GGG.** Do **not** use the Path of Exile logo, GGG's logo, or any GGG
   brand assets. Do **not** reproduce or trace in-game item artwork (their orb art is GGG's IP).
   Currency orbs must be **original interpretations** — generic alchemical/arcane spheres that
   evoke, not copy.
2. **"Path of Exile 2" is descriptive only.** Do not build it into our logo/marks. Avoid GGG's
   coined proper nouns (Wraeclast, Kalandra, Vaal, Oriath, etc.) in brand assets.
3. **The Forecast is a free game of skill — never gambling.** Visuals must not evoke betting or
   casinos in any way. No money-falling, no chips, no odds. Frame it as a leaderboard / forecast /
   skill contest.
4. **No crypto framing.** Divindex's public brand is a markets/analytics product. No tokens,
   coins, wallets, or blockchain motifs.
5. Every shipped surface carries (in small print): _"Divindex is an independent project and is
   not affiliated with or endorsed by Grinding Gear Games."_

## 10. Technical delivery

- **Dark-first.** Design on `#0a0c12`. Provide transparent versions where relevant.
- **Formats:** SVG for logo/icons/line art; PNG/WebP (and AVIF if possible) for raster key art,
  @1x and @2x. Layered source files (Figma preferred; AI/PSD acceptable).
- **OG/social:** 1200×630 PNG. Favicon: SVG + 512/192/32 PNG.
- **Color:** sRGB. Keep text/UI contrast ≥ 4.5:1 (this is a real product, accessibility matters).
- **Site context:** content max-width ~1200px, responsive; key art must crop gracefully to
  mobile (≤480px) and ultrawide.
- Hand off a one-page **style sheet** (palette, type, icon grid, do/don't) alongside the assets.

## 11. Reference directions (calibration, not to copy)

- **Restraint & data clarity:** Bloomberg Terminal, TradingView, Linear/Vercel dark UI craft.
- **Old-world layer:** illuminated manuscripts, alchemical engravings, antique coin/ledger
  aesthetics, gold-leaf on dark.
- **Premium dark fintech** in general — "expensive, quiet, confident."

## 12. Definition of done

- Hero key visual + logo system + icon set + data-viz spec + OG template delivered in source +
  export formats.
- Everything uses the §6 palette and type, single gold accent, dark-first.
- Passes §8 (no slop) and §9 (legal) checks.
- A new visualization can be produced later by anyone using the delivered style sheet.

---

_Brand source of truth: `brand.md` in this repo. Live site for reference context: divindex.com
(in progress)._
