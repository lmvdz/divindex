---
name: poe2-craft-profit
description: Compute the most profitable Path of Exile 2 crafts for the current patch by joining live poe2scout prices with open crafting mechanics (Path of Crafting / poe2db), and write a ranked report the Divindex site serves. Run this in Claude Code (uses your subscription, not the API). Re-run each patch or when more market data exists.
---

# PoE2 Craft Profitability

Produce `static/crafts.json` (machine) + `documentation/crafts/report-<YYYY-MM-DD>.md` (human):
a ranked list of the most profitable crafts/arbs **right now**, from live prices ×
crafting mechanics. This runs on the **Claude Code subscription** (you, or a headless CI
run with `CLAUDE_CODE_OAUTH_TOKEN` — never the production API key).

## Inputs (fetch live)
1. **Current league**: `GET https://poe2scout.com/api/poe2/Leagues` → the `IsCurrent` league `Value`.
2. **Live prices** (per item, in **Exalted Orbs**), for each category you need:
   `GET https://poe2scout.com/api/poe2/Leagues/{LEAGUE}/Currencies/ByCategory?Category={cat}&PerPage=250&Page=1`
   Categories: `currency`, `essences`, `runes`, `fragments`, plus others as relevant.
   Each item has `ApiId`, `Text`, `CurrentPrice`, `CurrentQuantity`.
3. **Crafting mechanics** (MIT, reusable — do NOT rebuild): Path of Crafting's source data,
   `https://github.com/frankthetank001/POE2-PathOfCrafting` → `backend/app/source_data/`
   (currencies, essences, 40+ omens, desecration bones, mod pools, exclusion groups), and
   `https://poe2db.tw/` for mod tiers / essence & omen outcomes. Fetch the JSON you need.

## What to compute
For each candidate craft, `EV = Σ(outcome.prob × outcomeValue) − Σ(inputQty × inputPrice)`.
Rank by EV and EV% (`EV / inputCost`). Tag a **confidence**:

- **high** — fully priceable, deterministic:
  - **Shard ↔ orb arb**: `orbPrice − 10 × shardPrice` (PoE2 stacks 10 shards → 1 orb).
  - **Consolidation**: 3 Lesser → 1 (Greater/Normal) for runes/essences via vendor.
  - **Currency cross-rate** mispricings.
- **med** — essence/omen **guaranteed-mod** crafts where the finished item has a roughly
  known market value (use the closest priceable comparable; state the assumption).
- **low** — random-outcome crafts (Chaos/Vaal, multi-mod) where finished-item value is
  uncertain. Include only the best few, clearly flagged.

Skip any craft missing a price on either side. Prefer **high/med**; the **low** tier is
illustrative until PoE2 finished-item market data thickens (sharpen on re-run).

## Output `static/crafts.json`
```json
{
  "generatedAt": "<ISO>",
  "league": "<league>",
  "crafts": [
    { "id": "shard-exalted", "name": "Exalted Shard → Orb", "type": "arb",
      "inputCost": 0, "expectedValue": 0, "ev": 0, "evPct": 0, "confidence": "high",
      "detail": "buy 10 Exalted Shards, combine, sell 1 Exalted Orb" }
  ],
  "note": "<data caveats>",
  "sources": ["poe2scout.com", "Path of Crafting (MIT)", "poe2db.tw"]
}
```
Sort `crafts` by `ev` descending. Keep it to the ~30 best across tiers.

## Rules
- Attribution is mandatory: credit **Path of Crafting (MIT)** + **poe2db.tw** in `note`
  and the report; the `/crafts` page already links them.
- Never invent prices — if an input/output isn't on poe2scout, omit or mark low confidence.
- Verify the JSON parses; the site reads it directly.
- After writing, summarize the top 5 crafts in your final message.

## Automation (optional, still the subscription)
Run headless in CI with `claude -p` + `CLAUDE_CODE_OAUTH_TOKEN` (from `claude setup-token`)
on a schedule → regenerate the report → open a PR. No API spend.
