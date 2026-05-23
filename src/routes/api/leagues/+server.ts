import { json } from '@sveltejs/kit';
import { getLeagues } from '$lib/server/poe2scout';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ setHeaders }) => {
	const leagues = await getLeagues();
	setHeaders({ 'cache-control': 'public, max-age=300' });
	return json(leagues);
};
