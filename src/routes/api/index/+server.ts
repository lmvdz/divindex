import { json } from '@sveltejs/kit';
import series from '$lib/data/series.json';
import type { RequestHandler } from './$types';

// Snapshot for now. Once GGG grants `service:cxapi`, compute the volume-weighted
// index here directly from the official Currency Exchange hourly digests.
export const GET: RequestHandler = () =>
	json(series, { headers: { 'cache-control': 'public, max-age=300' } });
