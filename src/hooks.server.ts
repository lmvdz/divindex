import { sequence } from '@sveltejs/kit/hooks';
import type { Handle } from '@sveltejs/kit';
import { handle as authHandle, authConfigured } from './auth';
import { claimGuest } from '$lib/server/forecast';

// After auth resolves, if a signed-in request still carries a guest cookie,
// merge that guest's forecasts onto the user once and drop the cookie. This
// heals the guest→Discord identity split (forecasts made before sign-in, or
// while auth secrets weren't yet readable, were stranded under a guest id).
const claimHandle: Handle = async ({ event, resolve }) => {
	const guest = event.cookies.get('dx_pid');
	if (guest && authConfigured(event.platform)) {
		const session = await event.locals.auth();
		const u = session?.user as { id?: string; name?: string | null } | undefined;
		if (u?.id) {
			try {
				await claimGuest(event.platform, guest, `u:${u.id}`, u.name ?? 'Exile');
			} catch {
				/* best-effort — never block the request on a merge failure */
			}
			event.cookies.delete('dx_pid', { path: '/' });
		}
	}
	return resolve(event);
};

export const handle = sequence(authHandle, claimHandle);
