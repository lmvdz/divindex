import { getMarket } from '$lib/server/poe2scout';
import { getMyCalls } from '$lib/server/forecast';
import { pidOf } from '$lib/server/session';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, platform, cookies }) => {
	const pid = await pidOf(locals, platform, cookies.get('dx_pid'));
	const market = await getMarket();
	return { calls: await getMyCalls(platform, market, pid) };
};
