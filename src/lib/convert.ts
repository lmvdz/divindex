import type { Currency, Market } from '$lib/types';

export type Quote = 'exalted' | 'divine';

export const QUOTE_LABEL: Record<Quote, string> = { exalted: 'Exalted', divine: 'Divine' };
export const QUOTE_SHORT: Record<Quote, string> = { exalted: 'EX', divine: 'DIV' };

// A currency can't be quoted in itself, so quote the two base orbs against
// each other: Exalt -> Divine, Divine -> Exalt. Everything else follows `quote`.
export function effectiveQuote(apiId: string, quote: Quote): Quote {
	return apiId === quote ? (quote === 'exalted' ? 'divine' : 'exalted') : quote;
}

export function divineRate(market: Market): number {
	return market.currencies.find((c) => c.apiId === 'divine')?.price ?? 1;
}

// Convert every currency (prices are stored in Exalted) into the chosen quote,
// using Divine's per-day price so historical % changes are correct.
export function convertMarket(market: Market, quote: Quote): Market {
	const divine = market.currencies.find((c) => c.apiId === 'divine');
	const byDate = new Map((divine?.series ?? []).map((p) => [p.t, p.p]));
	const now = divine?.price ?? 1;

	const conv = (c: Currency): Currency => {
		if (effectiveQuote(c.apiId, quote) === 'exalted') return c; // already in Exalted
		const series = c.series.map((p) => ({ ...p, p: p.p / (byDate.get(p.t) ?? now) }));
		const ps = series.map((s) => s.p);
		const last = series[series.length - 1];
		const first = series[0];
		const prev = series.length > 1 ? series[series.length - 2] : first;
		return {
			...c,
			series,
			price: last.p,
			changePct: first.p ? ((last.p - first.p) / first.p) * 100 : 0,
			change1dPct: prev.p ? ((last.p - prev.p) / prev.p) * 100 : 0,
			high: Math.max(...ps),
			low: Math.min(...ps)
		};
	};
	return { ...market, currencies: market.currencies.map(conv) };
}
