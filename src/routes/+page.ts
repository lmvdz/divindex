import type { IndexData } from '$lib/types';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ fetch }) => {
	const res = await fetch('/api/index');
	const index: IndexData = await res.json();
	return { index };
};
