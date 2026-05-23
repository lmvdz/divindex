import { getMarket } from '$lib/server/poe2scout';
import { getMarketAnalytics } from '$lib/server/analytics';
import { getMyPerformance, getSmartMoney } from '$lib/server/forecast';
import { isPremium } from '$lib/server/premium';
import { pidOf } from '$lib/server/session';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, platform, cookies }) => {
	const pid = await pidOf(locals, platform, cookies.get('dx_pid'));
	const premium = await isPremium(platform, pid);
	if (!premium) return { premium: false, uid: pid ?? null, market: null, smart: null, me: null };

	const market = await getMarket();
	const [smart, me] = await Promise.all([
		getSmartMoney(platform, market),
		getMyPerformance(platform, market, pid)
	]);
	return { premium: true, uid: pid ?? null, market: getMarketAnalytics(market), smart, me };
};
