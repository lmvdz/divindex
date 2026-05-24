import { json } from '@sveltejs/kit';
import { adminListUsers, adminDeleteUser } from '$lib/server/forecast';
import { authConfigured } from '../../../../auth';
import type { RequestHandler } from './$types';

// Token-gated ladder inspector (reuses ADMIN_TOKEN, falling back to
// DISCORD_DIGEST_TOKEN — same convention as /api/admin/premium):
//   /api/admin/users?token=…                 (list forecasters)
//   /api/admin/users?token=…&delete=<pid>    (prune one, then list)
function envOf(platform: App.Platform | undefined): Record<string, string | undefined> {
	return (platform?.env ?? {}) as unknown as Record<string, string | undefined>;
}

export const GET: RequestHandler = async ({ url, platform }) => {
	const env = envOf(platform);
	const token = env.ADMIN_TOKEN || env.DISCORD_DIGEST_TOKEN;
	if (!token || url.searchParams.get('token') !== token) {
		return json({ ok: false, reason: 'bad token' }, { status: 401 });
	}
	const del = url.searchParams.get('delete');
	let deleted = false;
	if (del) deleted = await adminDeleteUser(platform, del);
	const { league, users } = await adminListUsers(platform);
	// authConfigured=false means guests can still create calls in this env — the
	// same misconfig that strands forecasts under guest ids.
	return json({ ok: true, authConfigured: authConfigured(platform), league, deleted, users });
};
