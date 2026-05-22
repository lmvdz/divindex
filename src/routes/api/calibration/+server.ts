import { json } from '@sveltejs/kit';
import { getMarket } from '$lib/server/poe2scout';
import { getCalibration } from '$lib/server/forecast';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ platform }) => {
	const market = await getMarket();
	return json(await getCalibration(platform, market));
};
