import { json } from '@sveltejs/kit';
import { getMarket } from '$lib/server/poe2scout';
import { getMyCalls } from '$lib/server/forecast';
import { pidOf } from '$lib/server/session';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals, platform, cookies }) => {
	const pid = await pidOf(locals, platform, cookies.get('dx_pid'));
	const market = await getMarket();
	return json(await getMyCalls(platform, market, pid));
};
