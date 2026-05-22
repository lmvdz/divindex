import type { PlayerStats } from '$lib/types';

// PoE item rarities — badges inherit the same colour language.
export type Rarity = 'normal' | 'magic' | 'rare' | 'unique';

export interface Badge {
	id: string;
	name: string;
	rarity: Rarity;
	desc: string; // how it's earned
	flavor: string; // PoE-style lore line
	test: (s: PlayerStats) => boolean;
}

export const RARITY_COLOR: Record<Rarity, string> = {
	normal: '#c8c8c8',
	magic: '#8aa0ff',
	rare: '#f3d84a',
	unique: '#c08a45'
};

export const RARITY_RANK: Record<Rarity, number> = { normal: 0, magic: 1, rare: 2, unique: 3 };

// Starter set — every condition is computable from PlayerStats aggregates.
export const BADGES: Badge[] = [
	{
		id: 'first-divination',
		name: 'First Divination',
		rarity: 'normal',
		desc: 'Make your first call.',
		flavor: 'The veil parts for the curious.',
		test: (s) => s.calls >= 1
	},
	{
		id: 'marksman',
		name: 'Marksman',
		rarity: 'magic',
		desc: 'Land a call within 5% of settle.',
		flavor: 'Close enough to feel the wind of it.',
		test: (s) => s.bestAcc >= 0.95
	},
	{
		id: 'sharpshooter',
		name: 'Sharpshooter',
		rarity: 'rare',
		desc: 'Land a call within 1% of settle.',
		flavor: 'The number was never in doubt.',
		test: (s) => s.bestAcc >= 0.99
	},
	{
		id: 'oracle',
		name: 'Oracle',
		rarity: 'magic',
		desc: 'Call direction right 10 times.',
		flavor: 'Patterns where others hear only noise.',
		test: (s) => s.hits >= 10
	},
	{
		id: 'prophet',
		name: 'Prophet',
		rarity: 'rare',
		desc: 'Call direction right 50 times.',
		flavor: 'The market leans in to listen.',
		test: (s) => s.hits >= 50
	},
	{
		id: 'hot-streak',
		name: 'Hot Streak',
		rarity: 'magic',
		desc: 'Five correct calls in a row.',
		flavor: 'Momentum is its own kind of sight.',
		test: (s) => s.bestStreak >= 5
	},
	{
		id: 'ascendant',
		name: 'Ascendant',
		rarity: 'unique',
		desc: 'Ten correct calls in a row.',
		flavor: '"I no longer guess. I remember the future."',
		test: (s) => s.bestStreak >= 10
	},
	{
		id: 'centurion',
		name: 'Centurion',
		rarity: 'rare',
		desc: 'Settle one hundred calls.',
		flavor: 'A hundred readings, one ledger.',
		test: (s) => s.calls >= 100
	},
	{
		id: 'cartographer',
		name: 'Cartographer',
		rarity: 'magic',
		desc: 'Forecast ten different markets.',
		flavor: 'Every currency tells a story.',
		test: (s) => s.markets.length >= 10
	},
	{
		id: 'archivist',
		name: 'Archivist',
		rarity: 'rare',
		desc: 'Forecast twenty-five different markets.',
		flavor: 'The whole Atlas, charted by hand.',
		test: (s) => s.markets.length >= 25
	}
];

export function earned(s: PlayerStats): string[] {
	return BADGES.filter((b) => b.test(s)).map((b) => b.id);
}

export function badgeById(id: string): Badge | undefined {
	return BADGES.find((b) => b.id === id);
}
