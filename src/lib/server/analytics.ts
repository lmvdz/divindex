import { getDailySeries } from './poe2scout';
import type { Arbitrage, FairValue, FairValueRow, Market, MarketAnalytics, PricePoint, ShardArb } from '$lib/types';

const round = (n: number) => Math.round(n * 1e4) / 1e4;

// Divindex Fair Value: a liquidity-weighted recent average + dispersion band, so
// the noisy last tick on thin markets doesn't masquerade as the price. Deviation
// = how far the current tick sits from fair (mispricing signal); confidence
// blends low dispersion with traded volume.
export function getFairValue(market: Market): FairValue {
	const rows: FairValueRow[] = [];
	for (const c of market.currencies) {
		const recent = c.series.slice(-10);
		if (recent.length < 3) continue;
		const prices = recent.map((p) => p.p);
		const totQ = recent.reduce((s, p) => s + (p.q ?? 0), 0);
		const mean = prices.reduce((a, b) => a + b, 0) / prices.length;
		const fair = totQ > 0 ? recent.reduce((s, p) => s + p.p * (p.q ?? 0), 0) / totQ : mean;
		const sd = Math.sqrt(prices.reduce((s, p) => s + (p - mean) ** 2, 0) / prices.length);
		const disp = fair > 0 ? Math.min(1, sd / fair) : 1;
		const liq = Math.min(1, (c.volume || 0) / 100);
		rows.push({
			apiId: c.apiId,
			name: c.name,
			price: round(c.price),
			fair: round(fair),
			low: round(fair * (1 - disp)),
			high: round(fair * (1 + disp)),
			deviationPct: fair > 0 ? round(((c.price - fair) / fair) * 100) : 0,
			confidence: round(Math.max(0, Math.min(1, (1 - disp) * (0.4 + 0.6 * liq))))
		});
	}
	rows.sort((a, b) => Math.abs(b.deviationPct) - Math.abs(a.deviationPct));
	return { updatedAt: Date.now(), rows };
}

// Shard arbitrage: 10 shards = 1 orb in PoE2. Detect shard↔orb pairs by name
// root and price the edge (orb worth more than 10 of its shards ⇒ combine & sell).
export function getArbitrage(market: Market): Arbitrage {
	const SHARDS_PER_ORB = 10;
	const cur = market.currencies;
	const shards: ShardArb[] = [];
	for (const s of cur) {
		if (!/shard$/i.test(s.name.trim()) || !(s.price > 0)) continue;
		const root = s.name.trim().replace(/\s*Shard$/i, '').trim();
		if (!root) continue;
		// match the BASE orb exactly ("Regal Orb" / "Orb of Transmutation"), not
		// Perfect/Greater/Lesser variants — shards combine into the base orb only.
		const want = [`${root} orb`, `orb of ${root}`].map((w) => w.toLowerCase());
		const orb = cur.find((c) => c.apiId !== s.apiId && want.includes(c.name.trim().toLowerCase()));
		if (!orb || !(orb.price > 0)) continue;
		const edge = orb.price - SHARDS_PER_ORB * s.price;
		shards.push({
			shardName: s.name,
			orbName: orb.name,
			shardApiId: s.apiId,
			orbApiId: orb.apiId,
			shardPrice: round(s.price),
			orbPrice: round(orb.price),
			edge: round(edge),
			edgePct: round((edge / orb.price) * 100)
		});
	}
	shards.sort((a, b) => b.edgePct - a.edgePct);
	return { updatedAt: Date.now(), shardsPerOrb: SHARDS_PER_ORB, shards };
}

function dailyReturns(series: PricePoint[]): Map<string, number> {
	const out = new Map<string, number>();
	for (let i = 1; i < series.length; i++) {
		const p0 = series[i - 1].p;
		const p1 = series[i].p;
		if (p0 > 0) out.set(series[i].t, (p1 - p0) / p0);
	}
	return out;
}

function stdev(xs: number[]): number {
	if (xs.length < 2) return 0;
	const m = xs.reduce((a, b) => a + b, 0) / xs.length;
	const v = xs.reduce((a, b) => a + (b - m) * (b - m), 0) / (xs.length - 1);
	return Math.sqrt(v);
}

export async function getMarketAnalytics(market: Market): Promise<MarketAnalytics> {
	const cur = market.currencies.filter((c) => c.series.length >= 5);

	// breadth — 24h advance/decline
	let up = 0;
	let down = 0;
	let flat = 0;
	for (const c of cur) {
		if (c.change1dPct > 0) up++;
		else if (c.change1dPct < 0) down++;
		else flat++;
	}
	const breadth = { up, down, flat, pct: cur.length ? round((up / cur.length) * 100) : 0 };

	// volatility — stdev of daily returns (as %)
	const withVol = cur.map((c) => ({
		apiId: c.apiId,
		name: c.name,
		vol: round(stdev([...dailyReturns(c.series).values()]) * 100),
		price: c.price,
		change1dPct: round(c.change1dPct)
	}));
	const volatility = [...withVol].sort((a, b) => b.vol - a.vol).slice(0, 15);

	// liquidity — by traded volume
	const liquidity = [...cur]
		.sort((a, b) => b.volume - a.volume)
		.slice(0, 15)
		.map((c) => ({ apiId: c.apiId, name: c.name, volume: c.volume, price: c.price }));

	// relative strength — best/worst full-window movers (liquid only)
	const liquid = [...cur].sort((a, b) => b.volume - a.volume).slice(0, 80);
	const ranked = [...liquid].sort((a, b) => b.changePct - a.changePct);
	const movers = [...ranked.slice(0, 8), ...ranked.slice(-8).reverse()].map((c) => ({
		apiId: c.apiId,
		name: c.name,
		changePct: round(c.changePct),
		price: c.price
	}));

	// relative performance — rebased % over the FULL league history (daily) for the
	// top-liquid currencies. The market's per-currency series is only a ~7-day window,
	// so pull the deep History feed and rebase each line to its first point; co-moving
	// lines track, the spread shows leaders vs laggards.
	const top = liquid.slice(0, 16);
	const deep = await Promise.all(top.map((c) => getDailySeries(c.id, market.league)));
	const performance = top
		.map((c, i) => {
			const win = deep[i].filter((p) => p.p > 0);
			const base = win.length ? win[0].p : 0;
			return {
				apiId: c.apiId,
				name: c.name,
				series: base
					? win.map((p) => ({
							t: Math.floor(new Date(`${p.t}T00:00:00Z`).getTime() / 1000),
							pct: round((p.p / base - 1) * 100)
						}))
					: []
			};
		})
		.filter((l) => l.series.length >= 2);

	return { league: market.league, asOf: market.asOf, breadth, volatility, liquidity, movers, performance };
}
