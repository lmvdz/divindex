import { json } from '@sveltejs/kit';
import { grantPremium, listPremium, revokePremium } from '$lib/server/premium';
import type { RequestHandler } from './$types';

// Token-gated admin: grant/revoke premium by pid (e.g. u:<discordId>).
//   /api/admin/premium?token=…&grant=u:123
//   /api/admin/premium?token=…&revoke=u:123
//   /api/admin/premium?token=…           (list)
// Reuses ADMIN_TOKEN, falling back to DISCORD_DIGEST_TOKEN.
function envOf(platform: App.Platform | undefined): Record<string, string | undefined> {
	return (platform?.env ?? {}) as unknown as Record<string, string | undefined>;
}

export const GET: RequestHandler = async ({ url, platform }) => {
	const env = envOf(platform);
	const token = env.ADMIN_TOKEN || env.DISCORD_DIGEST_TOKEN;
	if (!token || url.searchParams.get('token') !== token) {
		return json({ ok: false, reason: 'bad token' }, { status: 401 });
	}
	const grant = url.searchParams.get('grant');
	const revoke = url.searchParams.get('revoke');
	if (grant) await grantPremium(platform, grant);
	if (revoke) await revokePremium(platform, revoke);
	return json({ ok: true, premium: await listPremium(platform) });
};
