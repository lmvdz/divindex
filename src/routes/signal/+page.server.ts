import { getMarket } from '$lib/server/poe2scout';
import { getCalibration, getSmartMoney } from '$lib/server/forecast';
import type { PageServerLoad } from './$types';

// Public credibility surface: the signal's track record + crowd calibration +
// who the skilled forecasters are. The actionable per-currency signals stay
// premium (analytics) — only the proof-of-skill is exposed here.
export const load: PageServerLoad = async ({ platform }) => {
	const market = await getMarket();
	const [calibration, smart] = await Promise.all([
		getCalibration(platform, market),
		getSmartMoney(platform, market)
	]);
	return {
		league: market.league,
		updatedAt: smart.updatedAt,
		backtest: smart.backtest,
		calibration,
		forecasters: smart.forecasters.slice(0, 10) // IC leaderboard (social proof, not signals)
	};
};
