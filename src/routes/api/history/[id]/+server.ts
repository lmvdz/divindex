import { json } from '@sveltejs/kit';
import { getHistory } from '$lib/server/poe2scout';
import type { Timeframe } from '$lib/types';
import type { RequestHandler } from './$types';

const TFS: Timeframe[] = ['1h', '4h', '1d', '1w'];

// Candles are served in pages so the chart can lazy-load older history on
// scroll-back (TradingView-style). The full per-item history is fetched from
// poe2scout once and cached (getHistory); here we just slice that cached set —
// no extra upstream load. `before`/`limit` are optional; without them the full
// series is returned (backward-compatible).
export const GET: RequestHandler = async ({ params, url, setHeaders }) => {
	const id = Number(params.id);
	const tfParam = url.searchParams.get('tf') as Timeframe | null;
	const tf = tfParam && TFS.includes(tfParam) ? tfParam : '1d';
	const league = url.searchParams.get('league') ?? undefined;
	const full = await getHistory(id, tf, league);

	const beforeRaw = url.searchParams.get('before');
	const before = beforeRaw != null ? Number(beforeRaw) : null;
	const limitRaw = url.searchParams.get('limit');
	const limit = limitRaw != null ? Math.min(Math.max(Number(limitRaw), 1), 20000) : 0;

	let candles = full.candles;
	let hasMore = false;

	// end = exclusive index of the first candle at/after `before` (candles ascending)
	let end = candles.length;
	if (before != null && Number.isFinite(before)) {
		end = candles.findIndex((c) => c.time >= before);
		if (end === -1) end = candles.length;
	}
	if (limit > 0) {
		const start = Math.max(0, end - limit);
		hasMore = start > 0; // older candles remain beyond this page
		candles = candles.slice(start, end);
	} else if (before != null) {
		candles = candles.slice(0, end);
	}

	setHeaders({ 'cache-control': 'public, max-age=300' });
	return json({ id: full.id, tf: full.tf, candles, hasMore });
};
