import seed from '$lib/data/series.json';
import type {
	Candle,
	Currency,
	Economy,
	History,
	Market,
	PricePoint,
	Timeframe
} from '$lib/types';

// every currency-style category poe2scout exposes
const CURRENCY_CATEGORIES = [
	'currency',
	'fragments',
	'runes',
	'essences',
	'ultimatum',
	'expedition',
	'ritual',
	'breach',
	'abyss',
	'delirium',
	'incursion',
	'idol',
	'vaultkeys',
	'uncutgems',
	'lineagesupportgems'
];

const UA = 'Divindex/0.1 (+https://divindex.com; contact: hello@divindex.com)';
const BASE = 'https://poe2scout.com/api';
const REALM = 'poe2';
const TTL = 10 * 60 * 1000;

let leagueCache: { value: string; at: number } | null = null;
const marketCache = new Map<string, { data: Market; at: number }>();
const rawCache = new Map<string, { pts: RawPoint[]; at: number }>();

interface RawPoint {
	ms: number;
	price: number;
	q: number;
}

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
	IconUrl?: string;
	ItemMetadata?: { icon?: string };
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

function toCurrency(it: RawItem, category: string): Currency | null {
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
		category,
		icon: it.IconUrl ?? it.ItemMetadata?.icon ?? '',
		price: last.p,
		changePct: first.p ? round(((last.p - first.p) / first.p) * 100) : 0,
		change1dPct: prev.p ? round(((last.p - prev.p) / prev.p) * 100) : 0,
		volume: last.q ?? 0,
		high: Math.max(...prices),
		low: Math.min(...prices),
		series
	};
}

async function fetchCategory(enc: string, category: string): Promise<Currency[]> {
	try {
		const res = (await getJson(
			`${BASE}/${REALM}/Leagues/${enc}/Currencies/ByCategory?Category=${category}&Page=1&PerPage=100`
		)) as { Items?: RawItem[] };
		const out: Currency[] = [];
		for (const it of res.Items ?? []) {
			const c = toCurrency(it, category);
			if (c) out.push(c);
		}
		return out;
	} catch {
		return [];
	}
}

async function getEconomy(enc: string): Promise<Economy | null> {
	try {
		const s = (await getJson(`${BASE}/${REALM}/Leagues/${enc}/ExchangeSnapshot`)) as {
			Volume?: string;
			MarketCap?: string;
		};
		return { marketCap: Number(s.MarketCap) || 0, volume: Number(s.Volume) || 0 };
	} catch {
		return null;
	}
}

export async function getMarket(league?: string): Promise<Market> {
	const lg = league ?? (await getCurrentLeague());
	const cached = marketCache.get(lg);
	if (cached && Date.now() - cached.at < TTL) return cached.data;

	try {
		const enc = encodeURIComponent(lg);
		const [lists, economy] = await Promise.all([
			Promise.all(CURRENCY_CATEGORIES.map((cat) => fetchCategory(enc, cat))),
			getEconomy(enc)
		]);

		const seen = new Set<number>();
		const currencies: Currency[] = [];
		let asOf = '';
		for (const list of lists) {
			for (const c of list) {
				if (seen.has(c.id)) continue;
				seen.add(c.id);
				const last = c.series[c.series.length - 1].t;
				if (last > asOf) asOf = last;
				currencies.push(c);
			}
		}
		if (currencies.length === 0) return fallbackMarket();
		currencies.sort((a, b) => b.price - a.price);
		const categories = CURRENCY_CATEGORIES.filter((cat) =>
			currencies.some((c) => c.category === cat)
		);

		const data: Market = {
			league: lg,
			base: 'Exalted Orb',
			asOf,
			fetchedAt: Date.now(),
			currencies,
			categories,
			economy,
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
			category: 'currency',
			icon: '',
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
				category: 'currency',
				icon: '',
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
		categories: ['currency'],
		economy: null,
		note: 'Snapshot — live feed unavailable.',
		source: 'snapshot'
	};
}

// Pull the full league history (poe2scout returns min(LogCount, available)).
const HISTORY_LOGCOUNT = 5000;

function bucketStart(ms: number, tf: Timeframe): number {
	const sec = Math.floor(ms / 1000);
	if (tf === '1h') return Math.floor(sec / 3600) * 3600;
	if (tf === '4h') return Math.floor(sec / 14400) * 14400;
	if (tf === '1d') return Math.floor(sec / 86400) * 86400;
	const d = new Date(ms);
	const u = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
	u.setUTCDate(u.getUTCDate() - ((u.getUTCDay() + 6) % 7)); // back to Monday
	return Math.floor(u.getTime() / 1000);
}

// Fetch the full raw hourly history once per item (cached); every timeframe
// buckets from it, so we never refetch per timeframe.
async function getRaw(itemId: number, lg: string): Promise<RawPoint[]> {
	const key = `${lg}:${itemId}`;
	const cached = rawCache.get(key);
	if (cached && Date.now() - cached.at < TTL) return cached.pts;

	const enc = encodeURIComponent(lg);
	const res = (await getJson(
		`${BASE}/${REALM}/Leagues/${enc}/Items/${itemId}/History?LogCount=${HISTORY_LOGCOUNT}`
	)) as { PriceHistory?: RawLog[] };

	const pts: RawPoint[] = (res.PriceHistory ?? [])
		.filter((p) => typeof p?.Price === 'number')
		.map((p) => ({ ms: new Date(`${p.Time}Z`).getTime(), price: p.Price, q: p.Quantity ?? 0 }))
		.filter((p) => Number.isFinite(p.ms))
		.sort((a, b) => a.ms - b.ms);

	if (pts.length) rawCache.set(key, { pts, at: Date.now() });
	return pts;
}

// Bucket the full history into OHLC candles at the requested timeframe.
export async function getHistory(
	itemId: number,
	tf: Timeframe = '1d',
	league?: string
): Promise<History> {
	const lg = league ?? (await getCurrentLeague());
	try {
		const pts = await getRaw(itemId, lg);
		const buckets = new Map<number, { o: number; h: number; l: number; c: number; vol: number }>();
		for (const p of pts) {
			const t = bucketStart(p.ms, tf);
			const cur = buckets.get(t);
			if (!cur) buckets.set(t, { o: p.price, h: p.price, l: p.price, c: p.price, vol: p.q });
			else {
				cur.h = Math.max(cur.h, p.price);
				cur.l = Math.min(cur.l, p.price);
				cur.c = p.price;
				cur.vol += p.q;
			}
		}
		const candles: Candle[] = [...buckets.entries()]
			.sort((a, b) => a[0] - b[0])
			.map(([time, v]) => ({
				time,
				open: round(v.o),
				high: round(v.h),
				low: round(v.l),
				close: round(v.c),
				volume: Math.round(v.vol)
			}));
		return { id: itemId, tf, candles };
	} catch {
		return { id: itemId, tf, candles: [] };
	}
}
