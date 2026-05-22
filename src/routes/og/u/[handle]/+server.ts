import { ImageResponse } from '@cf-wasm/og';
import { compact } from '$lib/format';
import { divinerTitle } from '$lib/challenges';
import { getMarket } from '$lib/server/poe2scout';
import { getPlayerByHandle } from '$lib/server/forecast';
import type { PlayerStats } from '$lib/types';
import type { RequestHandler } from './$types';

const pct = (x: number) => `${Math.round(x * 100)}%`;

// minimal satori VNode helpers (no JSX needed)
type Style = Record<string, string | number>;
type Node = { type: string; props: { style: Style; children?: unknown } };
const h = (style: Style, children?: unknown): Node => ({ type: 'div', props: { style, children } });

function stat(label: string, value: string): Node {
	return h({ display: 'flex', flexDirection: 'column', marginRight: 56 }, [
		h({ fontSize: 24, color: '#69728a' }, label),
		h({ fontSize: 52, fontWeight: 700, color: '#eef0f6' }, value)
	]);
}

function card(p: PlayerStats | null, rank: number | null, league: string): Node {
	const dir = p && p.calls ? p.hits / p.calls : 0;
	const acc = p && p.calls ? p.accSum / p.calls : 0;
	const title = divinerTitle(p);

	const header = h({ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }, [
		h({ display: 'flex', alignItems: 'center', fontSize: 38, fontWeight: 700, color: '#e0b465' }, '◆ Divindex'),
		h({ fontSize: 28, color: '#98a1b6' }, league)
	]);

	const idChildren: Node[] = [
		h({ fontSize: 30, color: '#98a1b6' }, 'Diviner'),
		h({ fontSize: 88, fontWeight: 700, color: '#eef0f6' }, p ? p.name : 'Forecast the economy')
	];
	if (title) idChildren.push(h({ fontSize: 30, color: '#e0b465', marginTop: 10 }, title));
	const middle = h({ display: 'flex', flexDirection: 'column' }, idChildren);

	const stats = h({ display: 'flex' }, [
		stat('Rank', rank ? `#${rank}` : '—'),
		stat('Omens', p ? compact(p.points) : '0'),
		stat('Direction', pct(dir)),
		stat('Accuracy', pct(acc)),
		stat('Streak', p ? `${p.bestStreak}` : '0')
	]);

	const footer = h({ fontSize: 26, color: '#69728a' }, 'Forecast the Path of Exile 2 economy · divindex.com');

	return h(
		{
			width: 1200,
			height: 630,
			display: 'flex',
			flexDirection: 'column',
			justifyContent: 'space-between',
			padding: 70,
			backgroundColor: '#0a0c12',
			borderTop: '10px solid #e0b465',
			color: '#eef0f6',
			fontFamily: 'sans serif'
		},
		[header, middle, stats, footer]
	);
}

export const GET: RequestHandler = async ({ params, platform }) => {
	const market = await getMarket();
	const p = await getPlayerByHandle(platform, market, params.handle);
	return new ImageResponse(card(p.you, p.rank, p.league) as never, {
		width: 1200,
		height: 630,
		headers: { 'cache-control': 'public, max-age=300' }
	});
};
