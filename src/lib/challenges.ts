import type { PlayerStats } from '$lib/types';

// Season challenges — PoE-style. Twelve goals; reward titles at 3/6/9/12,
// mirroring PoE's 12/24/36 challenge-reward cadence. All derived from
// PlayerStats, so they're season-scoped for free.
export interface Challenge {
	id: string;
	name: string;
	desc: string;
	goal: number;
	progress: (s: PlayerStats) => number;
}

export const CHALLENGES: Challenge[] = [
	{ id: 'calls-25', name: 'Diviner', desc: 'Settle 25 calls', goal: 25, progress: (s) => s.calls },
	{ id: 'hits-15', name: 'Reader', desc: 'Call direction right 15 times', goal: 15, progress: (s) => s.hits },
	{ id: 'streak-5', name: 'Momentum', desc: 'Reach a 5-call streak', goal: 5, progress: (s) => s.bestStreak },
	{ id: 'streak-10', name: 'Unbroken', desc: 'Reach a 10-call streak', goal: 10, progress: (s) => s.bestStreak },
	{ id: 'beats-10', name: 'Contrarian', desc: 'Beat the consensus 10 times', goal: 10, progress: (s) => s.oracleBeats },
	{ id: 'markets-15', name: 'Cartographer', desc: 'Forecast 15 markets', goal: 15, progress: (s) => s.markets.length },
	{ id: 'markets-25', name: 'Archivist', desc: 'Forecast 25 markets', goal: 25, progress: (s) => s.markets.length },
	{ id: 'acc-95', name: 'Marksman', desc: 'Land a call within 5%', goal: 1, progress: (s) => (s.bestAcc >= 0.95 ? 1 : 0) },
	{ id: 'acc-99', name: 'Sharpshooter', desc: 'Land a call within 1%', goal: 1, progress: (s) => (s.bestAcc >= 0.99 ? 1 : 0) },
	{ id: 'badges-6', name: 'Collector', desc: 'Earn 6 badges', goal: 6, progress: (s) => s.badges.length },
	{ id: 'omens-2000', name: 'Hoarder', desc: 'Bank 2,000 Omens', goal: 2000, progress: (s) => s.points },
	{ id: 'omens-5000', name: 'Magnate', desc: 'Bank 5,000 Omens', goal: 5000, progress: (s) => s.points }
];

export const REWARD_TIERS: { count: number; title: string }[] = [
	{ count: 3, title: 'Apprentice Diviner' },
	{ count: 6, title: 'Adept Diviner' },
	{ count: 9, title: 'Master Diviner' },
	{ count: 12, title: 'Grand Diviner' }
];

export function isDone(s: PlayerStats, c: Challenge): boolean {
	return c.progress(s) >= c.goal;
}

export function completedCount(s: PlayerStats | null): number {
	if (!s) return 0;
	return CHALLENGES.filter((c) => isDone(s, c)).length;
}

export function divinerTitle(s: PlayerStats | null): string | null {
	const n = completedCount(s);
	let title: string | null = null;
	for (const t of REWARD_TIERS) if (n >= t.count) title = t.title;
	return title;
}

export function nextTier(count: number): { count: number; title: string } | null {
	return REWARD_TIERS.find((t) => count < t.count) ?? null;
}
