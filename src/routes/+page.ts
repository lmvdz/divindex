import type { Market } from '$lib/types';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ fetch }) => {
	const res = await fetch('/api/market');
	const market: Market = await res.json();
	return { market };
};
