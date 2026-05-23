import { authConfigured } from '../../auth';

// Resolve the caller's pid: u:<provider-id> when signed in, else the guest
// cookie (only used when auth isn't configured, i.e. local dev).
export async function pidOf(
	locals: App.Locals,
	platform: App.Platform | undefined,
	cookie?: string
): Promise<string | undefined> {
	if (authConfigured(platform)) {
		const s = await locals.auth();
		const u = s?.user as { id?: string } | undefined;
		return u?.id ? `u:${u.id}` : undefined;
	}
	return cookie;
}
