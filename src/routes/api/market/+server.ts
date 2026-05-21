import { json } from '@sveltejs/kit';
import { getMarket } from '$lib/server/poe2scout';
import type { RequestHandler } from './$types';

// Live PoE2 currency market via poe2scout (cached). Swap to first-party
// `service:cxapi` here once GGG grants access — the frontend won't change.
export const GET: RequestHandler = async ({ url, setHeaders }) => {
	const league = url.searchParams.get('league') ?? undefined;
	const market = await getMarket(league);
	setHeaders({ 'cache-control': 'public, max-age=120' });
	return json(market);
};
