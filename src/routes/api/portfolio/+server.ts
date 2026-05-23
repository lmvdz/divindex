import { json } from '@sveltejs/kit';
import { getMarket } from '$lib/server/poe2scout';
import { getPortfolio, setHoldings } from '$lib/server/portfolio';
import { isPremium } from '$lib/server/premium';
import { pidOf } from '$lib/server/session';
import type { Holding } from '$lib/types';
import type { RequestHandler } from './$types';

async function gate(locals: App.Locals, platform: App.Platform | undefined, cookie?: string) {
	const pid = await pidOf(locals, platform, cookie);
	return (await isPremium(platform, pid)) ? pid! : null;
}

export const GET: RequestHandler = async ({ locals, platform, cookies }) => {
	const pid = await gate(locals, platform, cookies.get('dx_pid'));
	if (!pid) return json({ error: 'Premium required' }, { status: 403 });
	return json(await getPortfolio(platform, await getMarket(), pid));
};

export const POST: RequestHandler = async ({ request, locals, platform, cookies }) => {
	const pid = await gate(locals, platform, cookies.get('dx_pid'));
	if (!pid) return json({ error: 'Premium required' }, { status: 403 });

	const body = (await request.json().catch(() => ({}))) as { holdings?: unknown };
	const market = await getMarket();
	const valid = new Set(market.currencies.map((c) => c.apiId));
	const clean: Holding[] = Array.isArray(body.holdings)
		? (body.holdings as Holding[])
				.filter((h) => h && valid.has(h.apiId) && Number(h.qty) > 0)
				.map((h) => ({
					apiId: h.apiId,
					qty: Number(h.qty),
					cost: h.cost != null && Number(h.cost) > 0 ? Number(h.cost) : undefined
				}))
		: [];
	await setHoldings(platform, pid, clean);
	return json(await getPortfolio(platform, market, pid));
};
