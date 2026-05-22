import { json } from '@sveltejs/kit';
import { getHistory } from '$lib/server/poe2scout';
import type { Timeframe } from '$lib/types';
import type { RequestHandler } from './$types';

const TFS: Timeframe[] = ['1h', '4h', '1d', '1w'];

export const GET: RequestHandler = async ({ params, url, setHeaders }) => {
	const id = Number(params.id);
	const tfParam = url.searchParams.get('tf') as Timeframe | null;
	const tf = tfParam && TFS.includes(tfParam) ? tfParam : '1d';
	const league = url.searchParams.get('league') ?? undefined;
	const data = await getHistory(id, tf, league);
	setHeaders({ 'cache-control': 'public, max-age=300' });
	return json(data);
};
