import { error } from '@sveltejs/kit';
import { getMarket } from '$lib/server/poe2scout';
import { getPlayerByHandle } from '$lib/server/forecast';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, url, platform }) => {
	const market = await getMarket();
	const p = await getPlayerByHandle(platform, market, params.handle);
	if (!p.you) throw error(404, 'Diviner not found');
	return { player: p.you, rank: p.rank, league: p.league, handle: params.handle, origin: url.origin };
};
