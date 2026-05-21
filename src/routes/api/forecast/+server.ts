import { json } from '@sveltejs/kit';
import { randomUUID } from 'node:crypto';
import { getMarket } from '$lib/server/poe2scout';
import { addCall, getState } from '$lib/server/forecast';
import type { Market } from '$lib/types';
import type { RequestHandler } from './$types';

const divinePrice = (m: Market) => m.currencies.find((c) => c.apiId === 'divine')?.price ?? 0;

export const GET: RequestHandler = async ({ cookies }) => {
	const pid = cookies.get('dx_pid');
	const market = await getMarket();
	return json(getState(pid, divinePrice(market)));
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
	const body = (await request.json().catch(() => ({}))) as { name?: string; predicted?: unknown };
	const name = String(body.name ?? '').trim().slice(0, 24);
	const predicted = Number(body.predicted);
	if (!name || !Number.isFinite(predicted) || predicted <= 0) {
		return json({ error: 'Enter a name and a positive price.' }, { status: 400 });
	}
	addCall(pid, name, predicted);
	const market = await getMarket();
	return json(getState(pid, divinePrice(market)));
};
