import seed from '$lib/data/series.json';
import type {
	Candle,
	Currency,
	Economy,
	History,
	League,
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
// poe2scout publishes hourly, so cache until just after the next hourly update
// (HH:10 UTC) — at most one upstream pull per resource per hour, instead of
// re-pulling on a flat 10-min timer regardless of whether the data changed.
function nextRefresh(now = Date.now()): number {
	const d = new Date(now);
	let t = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), d.getUTCHours(), 10, 0, 0);
	if (now >= t) t += 3600_000;
	return t;
}
function ttlSeconds(now = Date.now()): number {
	return Math.max(60, Math.floor((nextRefresh(now) - now) / 1000));
}

let leagueCache: { value: string; expires: number } | null = null;
let leaguesCache: { value: League[]; expires: number } | null = null;
const marketCache = new Map<string, { data: Market; expires: number }>();
const rawCache = new Map<string, { pts: RawPoint[]; expires: number }>();

interface RawPoint {
	ms: number;
	price: number;
	q: number;
}

const round = (n: number) => Math.round(n * 1e4) / 1e4;

// Run async tasks with bounded concurrency. poe2scout rate-limits bursts from
// Cloudflare's shared egress IPs, so we fan out a few at a time instead of all
// at once — we only fetch once per hour (cached), so a few serial waves is fine.
export async function mapLimit<T, R>(
	items: readonly T[],
	limit: number,
	fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
	const out = new Array<R>(items.length);
	let next = 0;
	const worker = async () => {
		while (next < items.length) {
			const i = next++;
			out[i] = await fn(items[i], i);
		}
	};
	await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
	return out;
}

// Persistent cross-isolate cache via the Cloudflare Cache API (colo-wide,
// shared across all Worker isolates), layered under the in-memory L1 caches.
// We key by a synthetic same-zone URL so caches.default accepts the external
// response. Falls back to a plain fetch in dev (where `caches` is undefined).
async function getJson(url: string, ttlSec = ttlSeconds()): Promise<unknown> {
	const cache = (globalThis as unknown as { caches?: { default: Cache } }).caches?.default;
	const key = cache ? new Request(`https://divindex.com/__poe2cache?u=${encodeURIComponent(url)}`) : null;
	if (cache && key) {
		const hit = await cache.match(key);
		if (hit) return hit.json();
	}
	// retry transient upstream failures so a single hiccup (or a 429 from a burst)
	// doesn't drop a category — back off harder on rate-limit, honoring Retry-After
	let res: Response | undefined;
	let lastErr: unknown;
	const ATTEMPTS = 4;
	for (let i = 0; i < ATTEMPTS; i++) {
		try {
			res = await fetch(url, { headers: { 'User-Agent': UA, accept: 'application/json' } });
			if (res.ok) break;
			lastErr = new Error(`poe2scout ${res.status} ${url}`);
			if (res.status === 429) {
				const ra = Number(res.headers.get('retry-after'));
				if (Number.isFinite(ra) && ra > 0) {
					await new Promise((r) => setTimeout(r, Math.min(ra * 1000, 5000)));
					continue;
				}
			}
		} catch (e) {
			lastErr = e;
		}
		if (i < ATTEMPTS - 1) {
			const base = res?.status === 429 ? 800 : 250;
			await new Promise((r) => setTimeout(r, base * (i + 1) + Math.random() * 200));
		}
	}
	if (!res || !res.ok) throw lastErr ?? new Error(`poe2scout failed ${url}`);
	if (cache && key) {
		const store = new Response(res.clone().body, {
			status: 200,
			headers: { 'content-type': 'application/json', 'cache-control': `public, max-age=${ttlSec}` }
		});
		await cache.put(key, store);
	}
	return res.json();
}

// Every league poe2scout exposes (current + past + Standard/HC), cached hourly.
export async function getLeagues(): Promise<League[]> {
	if (leaguesCache && Date.now() < leaguesCache.expires) return leaguesCache.value;
	try {
		const leagues = (await getJson(`${BASE}/${REALM}/Leagues`)) as Array<{
			Value: string;
			IsCurrent: boolean;
		}>;
		const out = leagues
			.filter((l) => typeof l?.Value === 'string')
			.map((l) => ({ value: l.Value, isCurrent: !!l.IsCurrent }));
		if (out.length) leaguesCache = { value: out, expires: nextRefresh() };
		return out.length ? out : (leaguesCache?.value ?? [{ value: seed.league, isCurrent: true }]);
	} catch {
		return leaguesCache?.value ?? [{ value: seed.league, isCurrent: true }];
	}
}

export async function getCurrentLeague(): Promise<string> {
	if (leagueCache && Date.now() < leagueCache.expires) return leagueCache.value;
	try {
		const leagues = await getLeagues();
		const current = leagues.find((l) => l.isCurrent) ?? leagues[0];
		const value = current?.value ?? seed.league;
		leagueCache = { value, expires: nextRefresh() };
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
	ItemMetadata?: {
		icon?: string;
		base_type?: string;
		stack_size?: number;
		max_stack_size?: number;
		description?: string;
		effect?: string[];
	};
	PriceLogs?: RawLog[];
	CurrentPrice?: number;
	CurrentQuantity?: number;
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
	let series = buildSeries(it.PriceLogs);
	// Some items (Mirror, or whole categories right after the hourly publish) come
	// back with all-null PriceLogs but a valid CurrentPrice — keep them with a
	// single-point series rather than dropping the currency (and its category).
	if (series.length === 0) {
		if (typeof it.CurrentPrice !== 'number' || !(it.CurrentPrice > 0)) return null;
		series = [
			{ t: new Date().toISOString().slice(0, 10), p: round(it.CurrentPrice), q: it.CurrentQuantity ?? 0 }
		];
	}
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
		meta: it.ItemMetadata
			? {
					baseType: it.ItemMetadata.base_type,
					stackSize: it.ItemMetadata.stack_size,
					maxStackSize: it.ItemMetadata.max_stack_size,
					description: it.ItemMetadata.description,
					effect: it.ItemMetadata.effect
				}
			: undefined,
		price: last.p,
		changePct: first.p ? round(((last.p - first.p) / first.p) * 100) : 0,
		change1dPct: prev.p ? round(((last.p - prev.p) / prev.p) * 100) : 0,
		volume: last.q ?? 0,
		high: Math.max(...prices),
		low: Math.min(...prices),
		series
	};
}

// Returns null when the fetch fails (after retries) so the caller can tell a
// dropped category apart from one that's legitimately empty ([]).
async function fetchCategory(enc: string, category: string): Promise<Currency[] | null> {
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
		return null;
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
	if (cached && Date.now() < cached.expires) return cached.data;

	try {
		const enc = encodeURIComponent(lg);
		const [lists, economy] = await Promise.all([
			mapLimit(CURRENCY_CATEGORIES, 4, (cat) => fetchCategory(enc, cat)),
			getEconomy(enc)
		]);

		const failed = lists.filter((l) => l === null).length;

		const seen = new Set<number>();
		const currencies: Currency[] = [];
		let asOf = '';
		for (const list of lists) {
			if (!list) continue;
			for (const c of list) {
				if (seen.has(c.id)) continue;
				seen.add(c.id);
				const last = c.series[c.series.length - 1].t;
				if (last > asOf) asOf = last;
				currencies.push(c);
			}
		}
		if (currencies.length === 0) return cached?.data ?? fallbackMarket();
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
		// A category fetch can drop out transiently. Treat the pull as incomplete if
		// any category failed OR the staple "currency" category (Mirror, Divine,
		// Exalted, Chaos) is missing. Never let an incomplete pull clobber a complete
		// market for the full hour: keep serving the last good market when it covered
		// more categories, and retry the dropped ones within ~90s instead of HH:10.
		const prev = cached?.data;
		const incomplete = failed > 0 || !categories.includes('currency');
		if (incomplete && prev && prev.categories.length > categories.length) {
			marketCache.set(lg, { data: prev, expires: Date.now() + 90_000 });
			return prev;
		}
		marketCache.set(lg, { data, expires: incomplete ? Date.now() + 90_000 : nextRefresh() });
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
	if (cached && Date.now() < cached.expires) return cached.pts;

	const enc = encodeURIComponent(lg);
	const res = (await getJson(
		`${BASE}/${REALM}/Leagues/${enc}/Items/${itemId}/History?LogCount=${HISTORY_LOGCOUNT}`
	)) as { PriceHistory?: RawLog[] };

	const pts: RawPoint[] = (res.PriceHistory ?? [])
		.filter((p) => typeof p?.Price === 'number')
		.map((p) => ({ ms: new Date(`${p.Time}Z`).getTime(), price: p.Price, q: p.Quantity ?? 0 }))
		.filter((p) => Number.isFinite(p.ms))
		.sort((a, b) => a.ms - b.ms);

	if (pts.length) rawCache.set(key, { pts, expires: nextRefresh() });
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
		for (let i = 1; i < candles.length; i++) {
				const o = candles[i - 1].close;
				candles[i].open = o;
				if (o > candles[i].high) candles[i].high = o;
				if (o < candles[i].low) candles[i].low = o;
			}
			return { id: itemId, tf, candles };
	} catch {
		return { id: itemId, tf, candles: [] };
	}
}

// Daily close points across the FULL league history (from the deep History feed,
// not the ~7-day ByCategory window) — for multi-series charts that want max range.
export async function getDailySeries(itemId: number, league?: string): Promise<PricePoint[]> {
	const lg = league ?? (await getCurrentLeague());
	try {
		const pts = await getRaw(itemId, lg);
		const byDay = new Map<string, { ms: number; p: number; q: number }>();
		for (const p of pts) {
			const day = new Date(p.ms).toISOString().slice(0, 10);
			const cur = byDay.get(day);
			if (!cur || p.ms >= cur.ms) byDay.set(day, { ms: p.ms, p: p.price, q: p.q });
		}
		return [...byDay.entries()]
			.map(([t, v]) => ({ t, p: round(v.p), q: v.q }))
			.sort((a, b) => a.t.localeCompare(b.t));
	} catch {
		return [];
	}
}
