import { json } from '@sveltejs/kit';
import { getMarket } from '$lib/server/poe2scout';
import { getLadder } from '$lib/server/forecast';
import type { Currency } from '$lib/types';
import type { RequestHandler } from './$types';

// Posts a daily economy digest (top movers + Ladder leaders) to a Discord
// channel via webhook. Gated by a token so it can't be spammed; without a
// configured webhook + token it returns a dry-run preview only.

function envOf(platform: App.Platform | undefined): Record<string, string | undefined> {
	return (platform?.env ?? {}) as unknown as Record<string, string | undefined>;
}

const sign = (x: number) => `${x >= 0 ? '+' : ''}${x.toFixed(1)}%`;
const line = (c: Currency) => `**${c.name}** ${sign(c.change1dPct)}`;

function buildPayload(market: { league: string }, gainers: Currency[], losers: Currency[], leaders: string[]) {
	return {
		username: 'Divindex',
		embeds: [
			{
				title: `📊 ${market.league} economy digest`,
				url: 'https://divindex.com',
				color: 0xe0b465,
				fields: [
					{ name: '📈 Top gainers (24h)', value: gainers.map(line).join('\n') || '—', inline: true },
					{ name: '📉 Top losers (24h)', value: losers.map(line).join('\n') || '—', inline: true },
					{ name: '🔮 Ladder leaders', value: leaders.join('\n') || 'No diviners yet', inline: false }
				],
				footer: { text: 'divindex.com — forecast the Path of Exile 2 economy' },
				timestamp: new Date().toISOString()
			}
		]
	};
}

export const GET: RequestHandler = async ({ url, platform }) => {
	const env = envOf(platform);
	const webhook = env.DISCORD_WEBHOOK_URL;
	const token = env.DISCORD_DIGEST_TOKEN;
	const authed = !!token && url.searchParams.get('token') === token;

	const market = await getMarket();
	const ladder = await getLadder(platform, market, undefined);
	const movers = market.currencies.filter((c) => c.volume > 0).sort((a, b) => b.change1dPct - a.change1dPct);
	const gainers = movers.slice(0, 5);
	const losers = movers.slice(-5).reverse();
	const leaders = ladder.top.slice(0, 5).map((r, i) => `**${i + 1}.** ${r.name} — ${Math.round(r.points)} Omens`);
	const payload = buildPayload(market, gainers, losers, leaders);

	if (!webhook || !authed) {
		return json({
			posted: false,
			reason: !webhook ? 'DISCORD_WEBHOOK_URL not set' : 'missing or bad ?token',
			preview: payload
		});
	}

	const r = await fetch(webhook, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(payload)
	});
	return json({ posted: r.ok, status: r.status });
};
