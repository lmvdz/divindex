import type { Market } from '$lib/types';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ fetch, url }) => {
	const league = url.searchParams.get('league');
	const qs = league ? `?league=${encodeURIComponent(league)}` : '';
	const res = await fetch(`/api/market${qs}`);
	const market: Market = await res.json();
	return { market };
};
