import { authConfigured, providerIds } from '../auth';
import { isPremium } from '$lib/server/premium';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals, platform }) => {
	const configured = authConfigured(platform);
	const session = configured ? await locals.auth() : null;
	const uid = (session?.user as { id?: string } | undefined)?.id;
	return {
		session,
		providers: providerIds(platform),
		authConfigured: configured,
		premium: uid ? await isPremium(platform, `u:${uid}`) : false,
		uid: uid ? `u:${uid}` : null
	};
};
