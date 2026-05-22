import { SvelteKitAuth, type SvelteKitAuthConfig } from '@auth/sveltekit';
import Discord from '@auth/sveltekit/providers/discord';
import { env as devEnv } from '$env/dynamic/private';
import type { OAuthConfig } from '@auth/core/providers';

type Env = Record<string, string | undefined>;

// On Cloudflare Workers, runtime secrets/vars live on platform.env (the same
// place KV bindings come from). $env/dynamic/private doesn't reliably surface
// dashboard secrets there, so prefer platform.env and fall back to .env in dev.
function readEnv(platform: App.Platform | undefined): Env {
	const pe = (platform?.env ?? {}) as unknown as Env;
	return { ...(devEnv as Env), ...pe };
}

interface PoeProfile {
	uuid?: string;
	name: string;
}

function poeProvider(e: Env): OAuthConfig<PoeProfile> {
	return {
		id: 'poe',
		name: 'Path of Exile',
		type: 'oauth',
		clientId: e.AUTH_POE_ID,
		clientSecret: e.AUTH_POE_SECRET,
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

export function providerIds(platform?: App.Platform): string[] {
	const e = readEnv(platform);
	const ids: string[] = [];
	if (e.AUTH_DISCORD_ID) ids.push('discord');
	if (e.AUTH_POE_ID) ids.push('poe');
	return ids;
}
export function authConfigured(platform?: App.Platform): boolean {
	return providerIds(platform).length > 0;
}

export const { handle, signIn, signOut } = SvelteKitAuth(async (event): Promise<SvelteKitAuthConfig> => {
	const e = readEnv(event?.platform);
	const providers: SvelteKitAuthConfig['providers'] = [];
	if (e.AUTH_DISCORD_ID) {
		providers.push(Discord({ clientId: e.AUTH_DISCORD_ID, clientSecret: e.AUTH_DISCORD_SECRET }));
	}
	if (e.AUTH_POE_ID) providers.push(poeProvider(e));
	return {
		trustHost: true,
		secret: e.AUTH_SECRET || 'divindex-dev-secret-override-in-production',
		providers,
		callbacks: {
			session({ session, token }) {
				if (session.user && token.sub) session.user.id = token.sub;
				return session;
			}
		}
	};
});
