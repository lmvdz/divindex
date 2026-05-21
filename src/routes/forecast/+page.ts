import type { ForecastState } from '$lib/types';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ fetch }) => {
	const res = await fetch('/api/forecast');
	const forecast: ForecastState = await res.json();
	return { forecast };
};
