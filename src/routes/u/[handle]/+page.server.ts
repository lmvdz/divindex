import { error } from '@sveltejs/kit';
import { getMarket } from '$lib/server/poe2scout';
import { getPlayerByHandle } from '$lib/server/forecast';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, url, platform }) => {
	const market = await getMarket();
	const p = await getPlayerByHandle(platform, market, params.handle);
	if (!p.you) throw error(404, 'Diviner not found');
	// redact the raw provider id — this public page is keyed by the anonymized handle
	const player = { ...p.you, pid: '' };
	return { player, rank: p.rank, league: p.league, handle: params.handle, origin: url.origin };
};
