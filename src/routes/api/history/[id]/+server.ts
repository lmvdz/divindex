import { json } from '@sveltejs/kit';
import { getHistory } from '$lib/server/poe2scout';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, url, setHeaders }) => {
	const id = Number(params.id);
	const league = url.searchParams.get('league') ?? undefined;
	const data = await getHistory(id, league);
	setHeaders({ 'cache-control': 'public, max-age=300' });
	return json(data);
};
