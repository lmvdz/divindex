import { getCurrentLeague, getMarket } from '$lib/server/poe2scout';
import { getArbitrage, getFairValue, getMarketAnalytics } from '$lib/server/analytics';
import { getMyPerformance, getSmartMoney } from '$lib/server/forecast';
import { listAlerts } from '$lib/server/alerts';
import { getPortfolio } from '$lib/server/portfolio';
import { isPremium } from '$lib/server/premium';
import { pidOf } from '$lib/server/session';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, platform, cookies, url }) => {
	const pid = await pidOf(locals, platform, cookies.get('dx_pid'));
	const premium = await isPremium(platform, pid);
	const current = await getCurrentLeague();
	if (!premium) {
		return {
			premium: false,
			uid: pid ?? null,
			league: current,
			currentLeague: current,
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

	// Browse any league's MARKET analytics; keep the forecast game (smart money, your
	// performance, portfolio) pinned to the live league so a switch never trips the
	// single-active-league ladder rollover.
	const browse = url.searchParams.get('league') || current;
	const market = await getMarket(browse);
	const gameMarket = browse === current ? market : await getMarket(current);
	const [smart, me, alerts, port, marketAnalytics] = await Promise.all([
		getSmartMoney(platform, gameMarket),
		getMyPerformance(platform, gameMarket, pid),
		listAlerts(platform, pid ?? ''),
		getPortfolio(platform, gameMarket, pid ?? ''),
		getMarketAnalytics(market)
	]);
	return {
		premium: true,
		uid: pid ?? null,
		league: browse,
		currentLeague: current,
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
