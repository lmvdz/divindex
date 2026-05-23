import { json } from '@sveltejs/kit';
import { getMarket } from '$lib/server/poe2scout';
import { addAlert, isDiscordWebhook, listAlerts, removeAlert } from '$lib/server/alerts';
import { isPremium } from '$lib/server/premium';
import { pidOf } from '$lib/server/session';
import type { RequestHandler } from './$types';

async function gate(locals: App.Locals, platform: App.Platform | undefined, cookie?: string) {
	const pid = await pidOf(locals, platform, cookie);
	return (await isPremium(platform, pid)) ? pid! : null;
}

export const GET: RequestHandler = async ({ locals, platform, cookies }) => {
	const pid = await gate(locals, platform, cookies.get('dx_pid'));
	if (!pid) return json({ error: 'Premium required' }, { status: 403 });
	return json({ alerts: await listAlerts(platform, pid) });
};

export const POST: RequestHandler = async ({ request, locals, platform, cookies }) => {
	const pid = await gate(locals, platform, cookies.get('dx_pid'));
	if (!pid) return json({ error: 'Premium required' }, { status: 403 });

	const body = (await request.json().catch(() => ({}))) as {
		currency?: string;
		kind?: string;
		dir?: string;
		price?: unknown;
		webhook?: string;
	};
	const price = Number(body.price);
	const dir = body.dir === 'below' ? 'below' : 'above';
	const kind = body.kind === 'fairdev' ? 'fairdev' : 'price';
	if (!body.currency || !Number.isFinite(price) || price <= 0) {
		return json({ error: 'Pick a currency and a positive price.' }, { status: 400 });
	}
	const market = await getMarket();
	const c = market.currencies.find((x) => x.apiId === body.currency);
	if (!c) return json({ error: 'Unknown currency.' }, { status: 400 });
	const webhook = body.webhook?.trim() || undefined;
	if (webhook && !isDiscordWebhook(webhook)) {
		return json({ error: 'Webhook must be a discord.com webhook URL.' }, { status: 400 });
	}

	const rule = await addAlert(platform, { pid, apiId: c.apiId, name: c.name, kind, dir, price, webhook });
	if (!rule) return json({ error: 'Alert limit reached (50).' }, { status: 400 });
	return json({ alerts: await listAlerts(platform, pid) });
};

export const DELETE: RequestHandler = async ({ url, locals, platform, cookies }) => {
	const pid = await gate(locals, platform, cookies.get('dx_pid'));
	if (!pid) return json({ error: 'Premium required' }, { status: 403 });
	const id = url.searchParams.get('id');
	if (id) await removeAlert(platform, pid, id);
	return json({ alerts: await listAlerts(platform, pid) });
};
