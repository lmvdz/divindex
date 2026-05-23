import type { Holding, Market, Portfolio, PortHolding } from '$lib/types';

// Premium portfolio tracking. Holdings (currency qty + optional cost basis) are
// stored per pid in KV; valuation + an equity curve are computed live from
// market prices and each currency's daily series.
type Plat = App.Platform | undefined;
type KV = {
	get(key: string, type: 'json'): Promise<unknown>;
	put(key: string, value: string): Promise<void>;
};
const KEY = 'portfolio';
const MAX_HOLDINGS = 100;

function kvOf(p: Plat): KV | undefined {
	return p?.env?.FORECAST_KV as unknown as KV | undefined;
}
async function loadAll(kv: KV | undefined): Promise<Record<string, Holding[]>> {
	if (!kv) return {};
	return ((await kv.get(KEY, 'json')) as Record<string, Holding[]> | null) ?? {};
}

export async function getHoldings(platform: Plat, pid: string): Promise<Holding[]> {
	return (await loadAll(kvOf(platform)))[pid] ?? [];
}

export async function setHoldings(platform: Plat, pid: string, holdings: Holding[]): Promise<void> {
	const kv = kvOf(platform);
	if (!kv) return;
	const all = await loadAll(kv);
	all[pid] = holdings.slice(0, MAX_HOLDINGS);
	await kv.put(KEY, JSON.stringify(all));
}

const round = (n: number) => Math.round(n * 1e4) / 1e4;

export async function getPortfolio(platform: Plat, market: Market, pid: string): Promise<Portfolio> {
	const holdings = await getHoldings(platform, pid);
	const byId = new Map(market.currencies.map((c) => [c.apiId, c]));

	const rows: PortHolding[] = [];
	let total = 0;
	let pnl = 0;
	for (const h of holdings) {
		const c = byId.get(h.apiId);
		if (!c) continue;
		const value = c.price * h.qty;
		total += value;
		const row: PortHolding = {
			apiId: c.apiId,
			name: c.name,
			category: c.category,
			qty: h.qty,
			price: round(c.price),
			value: round(value)
		};
		if (h.cost != null && h.cost > 0) {
			row.cost = h.cost;
			row.pnl = round((c.price - h.cost) * h.qty);
			row.pnlPct = round(((c.price - h.cost) / h.cost) * 100);
			pnl += row.pnl;
		}
		rows.push(row);
	}
	rows.sort((a, b) => b.value - a.value);

	const cat = new Map<string, number>();
	for (const r of rows) cat.set(r.category, (cat.get(r.category) ?? 0) + r.value);
	const byCategory = [...cat.entries()].map(([category, value]) => ({ category, value: round(value) })).sort((a, b) => b.value - a.value);

	// equity curve: union of dates across holdings' series, value = Σ qty × last-known price
	const dates = new Set<string>();
	const priceAt: { qty: number; map: Map<string, number> }[] = [];
	for (const h of holdings) {
		const c = byId.get(h.apiId);
		if (!c) continue;
		const m = new Map<string, number>();
		for (const p of c.series) {
			m.set(p.t, p.p);
			dates.add(p.t);
		}
		priceAt.push({ qty: h.qty, map: m });
	}
	const sortedDates = [...dates].sort();
	const last = priceAt.map(() => 0);
	const equity = sortedDates.map((t) => {
		let v = 0;
		priceAt.forEach((h, i) => {
			const p = h.map.get(t);
			if (p != null) last[i] = p;
			v += h.qty * last[i];
		});
		return { t, value: round(v) };
	});

	return { total: round(total), pnl: round(pnl), holdings: rows, byCategory, equity };
}
