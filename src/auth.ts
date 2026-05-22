import { SvelteKitAuth, type SvelteKitAuthConfig } from '@auth/sveltekit';
import Discord from '@auth/sveltekit/providers/discord';
import { env } from '$env/dynamic/private';
import type { OAuthConfig } from '@auth/core/providers';

interface PoeProfile {
	uuid?: string;
	name: string;
}

// GGG has no off-the-shelf Auth.js provider — wire its OAuth 2.1 endpoints
// directly. One GGG account covers PoE1 + PoE2, so this is "Sign in with PoE".
function poeProvider(): OAuthConfig<PoeProfile> {
	return {
		id: 'poe',
		name: 'Path of Exile',
		type: 'oauth',
		clientId: env.AUTH_POE_ID,
		clientSecret: env.AUTH_POE_SECRET,
		authorization: {
			url: 'https://www.pathofexile.com/oauth/authorize',
			params: { scope: 'account:profile' }
		},
		token: 'https://www.pathofexile.com/oauth/token',
		userinfo: {
			url: 'https://api.pathofexile.com/profile',
			async request({ tokens }: { tokens: { access_token?: string } }) {
				const res = await fetch('https://api.pathofexile.com/profile', {
					headers: {
						Authorization: `Bearer ${tokens.access_token}`,
						'User-Agent': 'OAuth divindex/0.1 (contact: hello@divindex.com)'
					}
				});
				return (await res.json()) as PoeProfile;
			}
		},
		checks: ['state', 'pkce'],
		profile(p) {
			return { id: p.uuid ?? p.name, name: p.name, email: null, image: null };
		}
	};
}

export function providerIds(): string[] {
	const ids: string[] = [];
	if (env.AUTH_DISCORD_ID) ids.push('discord');
	if (env.AUTH_POE_ID) ids.push('poe');
	return ids;
}
export function authConfigured(): boolean {
	return providerIds().length > 0;
}

const providers: SvelteKitAuthConfig['providers'] = [];
if (env.AUTH_DISCORD_ID) providers.push(Discord);
if (env.AUTH_POE_ID) providers.push(poeProvider());

export const { handle, signIn, signOut } = SvelteKitAuth({
	trustHost: true,
	secret: env.AUTH_SECRET || 'divindex-dev-secret-override-in-production',
	providers,
	callbacks: {
		session({ session, token }) {
			if (session.user && token.sub) session.user.id = token.sub;
			return session;
		}
	}
});
