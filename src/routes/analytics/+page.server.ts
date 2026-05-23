import { getMarket } from '$lib/server/poe2scout';
import { getArbitrage, getFairValue, getMarketAnalytics } from '$lib/server/analytics';
import { getMyPerformance, getSmartMoney } from '$lib/server/forecast';
import { listAlerts } from '$lib/server/alerts';
import { getPortfolio } from '$lib/server/portfolio';
import { isPremium } from '$lib/server/premium';
import { pidOf } from '$lib/server/session';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, platform, cookies }) => {
	const pid = await pidOf(locals, platform, cookies.get('dx_pid'));
	const premium = await isPremium(platform, pid);
	if (!premium) {
		return {
			premium: false,
			uid: pid ?? null,
			market: null,
			smart: null,
			me: null,
			alerts: null,
			markets: null,
			arb: null,
			fair: null,
			port: null
		};
	}

	const market = await getMarket();
	const [smart, me, alerts, port, marketAnalytics] = await Promise.all([
		getSmartMoney(platform, market),
		getMyPerformance(platform, market, pid),
		listAlerts(platform, pid ?? ''),
		getPortfolio(platform, market, pid ?? ''),
		getMarketAnalytics(market)
	]);
	return {
		premium: true,
		uid: pid ?? null,
		market: marketAnalytics,
		smart,
		me,
		alerts,
		markets: market.currencies.map((c) => ({ apiId: c.apiId, name: c.name })),
		arb: getArbitrage(market),
		fair: getFairValue(market),
		port
	};
};
