import { authConfigured, providerIds } from '../auth';
import { isPremium } from '$lib/server/premium';
import { getCurrentLeague, getLeagues } from '$lib/server/poe2scout';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals, platform }) => {
	const configured = authConfigured(platform);
	const session = configured ? await locals.auth() : null;
	const uid = (session?.user as { id?: string } | undefined)?.id;
	// getCurrentLeague() and getLeagues() share a cached upstream fetch; use the
	// former so currentLeague uses the same (Standard-in-the-gap) pick logic.
	const [leagues, currentLeague] = await Promise.all([getLeagues(), getCurrentLeague()]);
	return {
		session,
		providers: providerIds(platform),
		authConfigured: configured,
		premium: uid ? await isPremium(platform, `u:${uid}`) : false,
		uid: uid ? `u:${uid}` : null,
		leagues,
		currentLeague
	};
};
