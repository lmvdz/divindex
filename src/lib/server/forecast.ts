import type { Forecast, Horizon, HorizonState, PredPoint } from '$lib/types';

// Cloudflare Workers have no filesystem, so the forecast store lives in KV
// (binding FORECAST_KV) when available, with an in-memory fallback for local
// dev / when KV isn't bound. The whole DB is a single JSON blob under one key.
const KEY = 'forecast';
const HORIZONS: Horizon[] = ['hour', 'day', 'week'];

interface Call {
	pid: string;
	name: string;
	predicted: number;
	at: number;
}
interface Epoch {
	key: string;
	currencyApiId: string;
	horizon: Horizon;
	end: number;
	calls: Call[];
	settled?: { actual: number; at: number };
}
interface DB {
	epochs: Epoch[];
}

type KV = {
	get(key: string, type: 'json'): Promise<unknown>;
	put(key: string, value: string): Promise<void>;
};
type Plat = App.Platform | undefined;

let memDB: DB = { epochs: [] };

function kvOf(platform: Plat): KV | undefined {
	return platform?.env?.FORECAST_KV;
}
async function load(kv: KV | undefined): Promise<DB> {
	if (kv) return ((await kv.get(KEY, 'json')) as DB | null) ?? { epochs: [] };
	return memDB;
}
async function save(kv: KV | undefined, db: DB): Promise<void> {
	if (db.epochs.length > 2000) {
		db.epochs.sort((a, b) => b.end - a.end);
		db.epochs = db.epochs.slice(0, 2000);
	}
	if (kv) await kv.put(KEY, JSON.stringify(db));
	else memDB = db;
}

// Settlement target = end of the *next full* epoch, never the in-progress one.
function epochEnd(h: Horizon, now = Date.now()): number {
	const d = new Date(now);
	if (h === 'hour') {
		return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), d.getUTCHours() + 2);
	}
	if (h === 'day') {
		return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 2);
	}
	const base = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
	const day = base.getUTCDay();
	base.setUTCDate(base.getUTCDate() + (day === 0 ? 7 : 7 - day) + 7);
	return base.getTime();
}

function median(xs: number[]): number | null {
	if (!xs.length) return null;
	const s = [...xs].sort((a, b) => a - b);
	const m = Math.floor(s.length / 2);
	return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export async function getForecast(
	platform: Plat,
	pid: string | undefined,
	currencyApiId: string,
	currencyName: string,
	price: number
): Promise<Forecast> {
	const kv = kvOf(platform);
	const db = await load(kv);
	let changed = false;

	for (const e of db.epochs) {
		if (e.currencyApiId === currencyApiId && !e.settled && e.end < Date.now()) {
			e.settled = { actual: price, at: Date.now() };
			changed = true;
		}
	}

	// read-only: do NOT create empty epochs here (only addCall creates them)
	const horizons = {} as Record<Horizon, HorizonState>;
	for (const h of HORIZONS) {
		const end = epochEnd(h);
		const key = `${currencyApiId}:${h}:${end}`;
		const e = db.epochs.find((x) => x.key === key);
		const calls = e?.calls ?? [];
		const your = pid ? calls.find((c) => c.pid === pid) : undefined;
		horizons[h] = {
			end,
			consensus: median(calls.map((c) => c.predicted)),
			yourCall: your ? your.predicted : null,
			calls: calls.length
		};
	}
	if (changed) await save(kv, db);

	// prediction history as a time-series: a point per epoch at its settlement time
	const series = {} as Record<Horizon, { you: PredPoint[]; consensus: PredPoint[] }>;
	for (const h of HORIZONS) {
		const eps = db.epochs
			.filter((x) => x.currencyApiId === currencyApiId && x.horizon === h)
			.sort((a, b) => a.end - b.end);
		const you: PredPoint[] = [];
		const cons: PredPoint[] = [];
		for (const e of eps) {
			const t = Math.floor(e.end / 1000);
			const cm = median(e.calls.map((c) => c.predicted));
			if (cm != null) cons.push({ t, v: cm });
			const yc = pid ? e.calls.find((c) => c.pid === pid) : undefined;
			if (yc) you.push({ t, v: yc.predicted });
		}
		series[h] = { you, consensus: cons };
	}

	return { currencyApiId, currencyName, price, horizons, series };
}

export async function addCall(
	platform: Plat,
	pid: string,
	name: string,
	currencyApiId: string,
	horizon: Horizon,
	predicted: number
): Promise<void> {
	if (!HORIZONS.includes(horizon)) return;
	const kv = kvOf(platform);
	const db = await load(kv);
	const end = epochEnd(horizon);
	const key = `${currencyApiId}:${horizon}:${end}`;
	let e = db.epochs.find((x) => x.key === key);
	if (!e) {
		e = { key, currencyApiId, horizon, end, calls: [] };
		db.epochs.push(e);
	}
	const existing = e.calls.find((c) => c.pid === pid);
	if (existing) {
		existing.predicted = predicted;
		existing.name = name;
		existing.at = Date.now();
	} else {
		e.calls.push({ pid, name, predicted, at: Date.now() });
	}
	await save(kv, db);
}
