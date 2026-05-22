import { json } from '@sveltejs/kit';
import { env as devEnv } from '$env/dynamic/private';
import type { RequestHandler } from './$types';

// TEMP diagnostic: reports which env keys the Worker can see. Returns key
// NAMES + booleans only — never secret values. Remove after debugging.
export const GET: RequestHandler = ({ platform }) => {
	const pe = (platform?.env ?? {}) as Record<string, unknown>;
	const present = (k: string) => Boolean(pe[k]);
	return json({
		hasPlatform: Boolean(platform),
		platformEnvKeys: Object.keys(pe).sort(),
		platform: {
			AUTH_DISCORD_ID: present('AUTH_DISCORD_ID'),
			AUTH_DISCORD_SECRET: present('AUTH_DISCORD_SECRET'),
			AUTH_SECRET: present('AUTH_SECRET'),
			AUTH_URL: present('AUTH_URL'),
			FORECAST_KV: present('FORECAST_KV')
		},
		dynamicPrivate: {
			AUTH_DISCORD_ID: Boolean(devEnv.AUTH_DISCORD_ID),
			AUTH_SECRET: Boolean(devEnv.AUTH_SECRET)
		}
	});
};
