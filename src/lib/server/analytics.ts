import type { Arbitrage, Market, MarketAnalytics, PricePoint, ShardArb } from '$lib/types';

const round = (n: number) => Math.round(n * 1e4) / 1e4;

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
		const orb = cur.find((c) => c.apiId !== s.apiId && /orb/i.test(c.name) && c.name.includes(root));
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

function pearson(a: Map<string, number>, b: Map<string, number>): number {
	const xs: number[] = [];
	const ys: number[] = [];
	for (const [t, va] of a) {
		const vb = b.get(t);
		if (vb !== undefined) {
			xs.push(va);
			ys.push(vb);
		}
	}
	const n = xs.length;
	if (n < 3) return 0;
	const mx = xs.reduce((s, v) => s + v, 0) / n;
	const my = ys.reduce((s, v) => s + v, 0) / n;
	let num = 0;
	let dx = 0;
	let dy = 0;
	for (let i = 0; i < n; i++) {
		const ax = xs[i] - mx;
		const by = ys[i] - my;
		num += ax * by;
		dx += ax * ax;
		dy += by * by;
	}
	const den = Math.sqrt(dx * dy);
	return den ? num / den : 0;
}

export function getMarketAnalytics(market: Market): MarketAnalytics {
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

	// correlation matrix — top 12 by volume, pairwise Pearson on daily returns
	const top = liquid.slice(0, 12);
	const rets = top.map((c) => dailyReturns(c.series));
	const matrix = top.map((_, i) => top.map((__, j) => round(i === j ? 1 : pearson(rets[i], rets[j]))));
	const correlations = {
		ids: top.map((c) => ({ apiId: c.apiId, name: c.name })),
		matrix
	};

	return { league: market.league, asOf: market.asOf, breadth, volatility, liquidity, movers, correlations };
}
