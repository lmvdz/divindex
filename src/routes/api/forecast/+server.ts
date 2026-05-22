import { json } from '@sveltejs/kit';
import { randomUUID } from 'node:crypto';
import { getMarket } from '$lib/server/poe2scout';
import { addCall, getForecast } from '$lib/server/forecast';
import { authConfigured } from '../../../auth';
import type { Horizon, Market } from '$lib/types';
import type { RequestHandler } from './$types';

function pick(market: Market, apiId: string | null) {
	return market.currencies.find((c) => c.apiId === apiId) ?? market.currencies[0];
}

async function sessionUser(locals: App.Locals, platform: App.Platform | undefined) {
	if (!authConfigured(platform)) return null;
	const session = await locals.auth();
	const user = session?.user as { id?: string; name?: string | null } | undefined;
	return user?.id ? { id: user.id, name: user.name ?? 'Exile' } : null;
}

export const GET: RequestHandler = async ({ url, cookies, locals, platform }) => {
	const user = await sessionUser(locals, platform);
	const pid = user ? `u:${user.id}` : cookies.get('dx_pid');
	const market = await getMarket();
	const c = pick(market, url.searchParams.get('currency'));
	if (!c) return json({ error: 'No market' }, { status: 503 });
	return json(await getForecast(platform, pid, c.apiId, c.name, c.price, market.league));
};

export const POST: RequestHandler = async ({ request, cookies, locals, platform }) => {
	const body = (await request.json().catch(() => ({}))) as {
		currency?: string;
		horizon?: Horizon;
		name?: string;
		predicted?: unknown;
	};
	const predicted = Number(body.predicted);
	if (!body.currency || !body.horizon || !Number.isFinite(predicted) || predicted <= 0) {
		return json({ error: 'Enter a positive price.' }, { status: 400 });
	}

	const user = await sessionUser(locals, platform);
	let pid: string;
	let name: string;
	if (user) {
		pid = `u:${user.id}`;
		name = user.name;
	} else if (!authConfigured(platform)) {
		// dev/guest fallback only when no OAuth providers are configured
		let g = cookies.get('dx_pid');
		if (!g) {
			g = randomUUID();
			cookies.set('dx_pid', g, { path: '/', maxAge: 31_536_000, httpOnly: true, sameSite: 'lax' });
		}
		pid = g;
		name = String(body.name ?? '').trim().slice(0, 24) || 'Guest';
	} else {
		return json({ error: 'Sign in to forecast.' }, { status: 401 });
	}

	const market = await getMarket();
	const c = market.currencies.find((x) => x.apiId === body.currency);
	if (!c) return json({ error: 'Unknown currency.' }, { status: 400 });
	// store the current price as the call's baseline so direction can be scored
	await addCall(platform, pid, name, c.apiId, body.horizon, predicted, c.price, market.league);
	return json(await getForecast(platform, pid, c.apiId, c.name, c.price, market.league));
};
