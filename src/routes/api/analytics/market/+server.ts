import { json } from '@sveltejs/kit';
import { getMarket } from '$lib/server/poe2scout';
import { getMarketAnalytics } from '$lib/server/analytics';
import { isPremium } from '$lib/server/premium';
import { pidOf } from '$lib/server/session';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals, platform, cookies }) => {
	const pid = await pidOf(locals, platform, cookies.get('dx_pid'));
	if (!(await isPremium(platform, pid))) return json({ error: 'Premium required' }, { status: 403 });
	return json(getMarketAnalytics(await getMarket()));
};
