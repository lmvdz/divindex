import { authConfigured, providerIds } from '../auth';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
	const configured = authConfigured();
	return {
		session: configured ? await locals.auth() : null,
		providers: providerIds(),
		authConfigured: configured
	};
};
