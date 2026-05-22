import { getMarket } from '$lib/server/poe2scout';
import { getLadder } from '$lib/server/forecast';
import { authConfigured } from '../../auth';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ cookies, locals, platform }) => {
	let pid: string | undefined;
	if (authConfigured(platform)) {
		const s = await locals.auth();
		const u = s?.user as { id?: string } | undefined;
		pid = u?.id ? `u:${u.id}` : undefined;
	} else {
		pid = cookies.get('dx_pid');
	}
	const market = await getMarket();
	const ladder = await getLadder(platform, market, pid);
	return { ladder };
};
