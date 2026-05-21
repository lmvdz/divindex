import seed from '$lib/data/series.json';
import type { Currency, Market, PricePoint } from '$lib/types';

const UA = 'Divindex/0.1 (+https://divindex.com; contact: hello@divindex.com)';
const BASE = 'https://poe2scout.com/api';
const REALM = 'poe2';
const TTL = 10 * 60 * 1000;

let leagueCache: { value: string; at: number } | null = null;
const marketCache = new Map<string, { data: Market; at: number }>();

const round = (n: number) => Math.round(n * 1e4) / 1e4;

async function getJson(url: string): Promise<unknown> {
	const res = await fetch(url, { headers: { 'User-Agent': UA, accept: 'application/json' } });
	if (!res.ok) throw new Error(`poe2scout ${res.status} ${url}`);
	return res.json();
}

export async function getCurrentLeague(): Promise<string> {
	if (leagueCache && Date.now() - leagueCache.at < TTL) return leagueCache.value;
	try {
		const leagues = (await getJson(`${BASE}/${REALM}/Leagues`)) as Array<{
			Value: string;
			IsCurrent: boolean;
		}>;
		const current = leagues.find((l) => l.IsCurrent) ?? leagues[0];
		const value = current?.Value ?? seed.league;
		leagueCache = { value, at: Date.now() };
		return value;
	} catch {
		return leagueCache?.value ?? seed.league;
	}
}

interface RawLog {
	Price: number;
	Time: string;
	Quantity?: number;
}
interface RawItem {
	ItemId: number;
	ApiId: string;
	Text: string;
	PriceLogs?: RawLog[];
}

function buildSeries(logs: RawLog[] | undefined): PricePoint[] {
	const seen = new Map<string, PricePoint>();
	for (const l of logs ?? []) {
		if (typeof l?.Price !== 'number') continue;
		const t = String(l.Time).slice(0, 10);
		seen.set(t, { t, p: round(l.Price), q: l.Quantity ?? 0 });
	}
	return [...seen.values()].sort((a, b) => a.t.localeCompare(b.t));
}

function toCurrency(it: RawItem): Currency | null {
	const series = buildSeries(it.PriceLogs);
	if (series.length === 0) return null;
	const last = series[series.length - 1];
	const first = series[0];
	const prev = series.length > 1 ? series[series.length - 2] : first;
	const prices = series.map((s) => s.p);
	return {
		id: it.ItemId,
		apiId: it.ApiId,
		name: it.Text,
		price: last.p,
		changePct: first.p ? round(((last.p - first.p) / first.p) * 100) : 0,
		change1dPct: prev.p ? round(((last.p - prev.p) / prev.p) * 100) : 0,
		volume: last.q ?? 0,
		high: Math.max(...prices),
		low: Math.min(...prices),
		series
	};
}

export async function getMarket(league?: string): Promise<Market> {
	const lg = league ?? (await getCurrentLeague());
	const cached = marketCache.get(lg);
	if (cached && Date.now() - cached.at < TTL) return cached.data;

	try {
		const enc = encodeURIComponent(lg);
		const res = (await getJson(
			`${BASE}/${REALM}/Leagues/${enc}/Currencies/ByCategory?Category=currency&Page=1&PerPage=100`
		)) as { Items?: RawItem[] };

		const currencies: Currency[] = [];
		let asOf = '';
		for (const it of res.Items ?? []) {
			const c = toCurrency(it);
			if (!c) continue;
			const last = c.series[c.series.length - 1].t;
			if (last > asOf) asOf = last;
			currencies.push(c);
		}
		if (currencies.length === 0) return fallbackMarket();
		currencies.sort((a, b) => b.price - a.price);

		const data: Market = {
			league: lg,
			base: 'Exalted Orb',
			asOf,
			fetchedAt: Date.now(),
			currencies,
			note: 'Live Path of Exile 2 Currency Exchange data via poe2scout.',
			source: 'poe2scout.com'
		};
		marketCache.set(lg, { data, at: Date.now() });
		return data;
	} catch {
		return cached?.data ?? fallbackMarket();
	}
}

function fallbackMarket(): Market {
	const h = seed.hero;
	const currencies: Currency[] = [
		{
			id: 0,
			apiId: h.key,
			name: h.text,
			price: h.latest,
			changePct: h.changePct,
			change1dPct: 0,
			volume: 0,
			high: Math.max(...h.series.map((s) => s.p)),
			low: Math.min(...h.series.map((s) => s.p)),
			series: h.series
		},
		...seed.ticker
			.filter((t) => t.api !== h.key)
			.map((t, i) => ({
				id: -1 - i,
				apiId: t.api,
				name: t.text,
				price: t.price,
				changePct: t.wkChange,
				change1dPct: 0,
				volume: 0,
				high: t.price,
				low: t.price,
				series: [{ t: seed.asOf, p: t.price }]
			}))
	];
	currencies.sort((a, b) => b.price - a.price);
	return {
		league: seed.league,
		base: seed.base,
		asOf: seed.asOf,
		fetchedAt: Date.now(),
		currencies,
		note: 'Snapshot — live feed unavailable.',
		source: 'snapshot'
	};
}
