import type { PageLoad } from './$types';

export const load: PageLoad = async ({ fetch }) => {
	const r = await fetch('/crafts.json');
	return { report: r.ok ? await r.json() : null };
};
