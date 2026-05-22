import { json } from '@sveltejs/kit';
import { getMarket } from '$lib/server/poe2scout';
import { getLadder } from '$lib/server/forecast';
import { authConfigured } from '../../../auth';
import type { Horizon } from '$lib/types';
import type { RequestHandler } from './$types';

const HS: Horizon[] = ['hour', 'day', 'week'];

async function piderOf(locals: App.Locals, platform: App.Platform | undefined, cookie?: string) {
	if (authConfigured(platform)) {
		const s = await locals.auth();
		const u = s?.user as { id?: string } | undefined;
		return u?.id ? `u:${u.id}` : undefined;
	}
	return cookie;
}

export const GET: RequestHandler = async ({ url, cookies, locals, platform }) => {
	const pid = await piderOf(locals, platform, cookies.get('dx_pid'));
	const hq = url.searchParams.get('horizon');
	const horizon = HS.includes(hq as Horizon) ? (hq as Horizon) : undefined;
	const market = await getMarket();
	return json(await getLadder(platform, market, pid, horizon));
};
