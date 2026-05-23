import { json } from '@sveltejs/kit';
import { getMarket } from '$lib/server/poe2scout';
import { getCalibration, getLadder } from '$lib/server/forecast';
import { evalAlerts } from '$lib/server/alerts';
import type { RequestHandler } from './$types';

// Hourly maintenance tick (hit by a scheduler): warms the poe2scout caches so
// the next visitor is fast, and settles/scores any due forecasts so the Ladder
// stays current without needing a human to open it. Token-gated when a token is
// configured (reuses CRON_TOKEN, falling back to DISCORD_DIGEST_TOKEN).
function envOf(platform: App.Platform | undefined): Record<string, string | undefined> {
	return (platform?.env ?? {}) as unknown as Record<string, string | undefined>;
}

export const GET: RequestHandler = async ({ url, platform }) => {
	const env = envOf(platform);
	const token = env.CRON_TOKEN || env.DISCORD_DIGEST_TOKEN;
	if (token && url.searchParams.get('token') !== token) {
		return json({ ok: false, reason: 'bad token' }, { status: 401 });
	}

	const t0 = Date.now();
	const market = await getMarket(); // warm market + poe2scout edge cache
	const [ladder, calib, alertsFired] = await Promise.all([
		getLadder(platform, market, undefined), // settle + score due forecasts
		getCalibration(platform, market),
		evalAlerts(platform, market) // fire any tripped premium price alerts
	]);

	return json({
		ok: true,
		ms: Date.now() - t0,
		league: market.league,
		currencies: market.currencies.length,
		diviners: ladder.top.length,
		settledSample: calib.overall.n,
		alertsFired
	});
};
