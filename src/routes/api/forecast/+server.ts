import { json } from '@sveltejs/kit';
import { randomUUID } from 'node:crypto';
import { getMarket } from '$lib/server/poe2scout';
import { addCall, getForecast } from '$lib/server/forecast';
import type { Horizon, Market } from '$lib/types';
import type { RequestHandler } from './$types';

function pick(market: Market, apiId: string | null) {
	return market.currencies.find((c) => c.apiId === apiId) ?? market.currencies[0];
}

export const GET: RequestHandler = async ({ url, cookies }) => {
	const pid = cookies.get('dx_pid');
	const market = await getMarket();
	const c = pick(market, url.searchParams.get('currency'));
	if (!c) return json({ error: 'No market' }, { status: 503 });
	return json(getForecast(pid, c.apiId, c.name, c.price));
};

export const POST: RequestHandler = async ({ request, cookies }) => {
	let pid = cookies.get('dx_pid');
	if (!pid) {
		pid = randomUUID();
		cookies.set('dx_pid', pid, {
			path: '/',
			maxAge: 60 * 60 * 24 * 365,
			httpOnly: true,
			sameSite: 'lax'
		});
	}
	const body = (await request.json().catch(() => ({}))) as {
		currency?: string;
		horizon?: Horizon;
		name?: string;
		predicted?: unknown;
	};
	const name = String(body.name ?? '').trim().slice(0, 24);
	const predicted = Number(body.predicted);
	const horizon = body.horizon;
	if (
		!name ||
		!body.currency ||
		!horizon ||
		!Number.isFinite(predicted) ||
		predicted <= 0
	) {
		return json({ error: 'Enter a name and a positive price.' }, { status: 400 });
	}
	addCall(pid, name, body.currency, horizon, predicted);
	const market = await getMarket();
	const c = pick(market, body.currency);
	return json(getForecast(pid, c.apiId, c.name, c.price));
};
