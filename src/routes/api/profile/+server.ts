import { json } from '@sveltejs/kit';
import { getMarket } from '$lib/server/poe2scout';
import { getProfile } from '$lib/server/forecast';
import { authConfigured } from '../../../auth';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ cookies, locals, platform }) => {
	let pid: string | undefined;
	if (authConfigured(platform)) {
		const s = await locals.auth();
		const u = s?.user as { id?: string } | undefined;
		pid = u?.id ? `u:${u.id}` : undefined;
	} else {
		pid = cookies.get('dx_pid');
	}
	const market = await getMarket();
	return json(await getProfile(platform, market, pid));
};
