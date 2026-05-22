import type { Horizon, Timeframe } from '$lib/types';

// Each forecast horizon gets its own colour; the consensus line uses `base`,
// your own call uses the lighter `you` shade of the same colour.
export const HORIZON_COLORS: Record<Horizon, { base: string; you: string; label: string }> = {
	hour: { base: '#56b6c2', you: '#9fdfe8', label: '1H' },
	day: { base: '#e0b465', you: '#f3d8a3', label: '1D' },
	week: { base: '#d97aa6', you: '#f0b3d0', label: '1W' }
};

// Chart timeframe -> forecast horizon (4h is a zoom only, no forecast horizon)
export const TF_TO_HORIZON: Record<Timeframe, Horizon | null> = {
	'1h': 'hour',
	'4h': null,
	'1d': 'day',
	'1w': 'week'
};
