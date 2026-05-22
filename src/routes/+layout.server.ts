import { authConfigured, providerIds } from '../auth';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals, platform }) => {
	const configured = authConfigured(platform);
	return {
		session: configured ? await locals.auth() : null,
		providers: providerIds(platform),
		authConfigured: configured
	};
};
