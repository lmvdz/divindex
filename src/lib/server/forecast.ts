import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import type { Forecast, Horizon, HorizonState } from '$lib/types';

// JSON-file store for the free per-currency, multi-horizon forecast game.
// Swap for a real DB when it grows; the shape is stable.
const DIR = '.data';
const FILE = `${DIR}/forecast.json`;
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

function load(): DB {
	try {
		return JSON.parse(readFileSync(FILE, 'utf8')) as DB;
	} catch {
		return { epochs: [] };
	}
}
function save(db: DB) {
	mkdirSync(DIR, { recursive: true });
	// keep the file bounded: drop the oldest settled epochs
	if (db.epochs.length > 2000) {
		db.epochs.sort((a, b) => b.end - a.end);
		db.epochs = db.epochs.slice(0, 2000);
	}
	writeFileSync(FILE, JSON.stringify(db));
}

// Settlement target = end of the *next full* epoch, never the in-progress one.
// The current period is already partly known (you could watch it near the close),
// so we skip it: forecasts always resolve a period that hasn't started yet.
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
	base.setUTCDate(base.getUTCDate() + (day === 0 ? 7 : 7 - day) + 7); // Sunday after next
	return base.getTime();
}

function median(xs: number[]): number | null {
	if (!xs.length) return null;
	const s = [...xs].sort((a, b) => a - b);
	const m = Math.floor(s.length / 2);
	return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export function getForecast(
	pid: string | undefined,
	currencyApiId: string,
	currencyName: string,
	price: number
): Forecast {
	const db = load();
	let changed = false;

	// lazily settle this currency's past epochs against the latest known price
	for (const e of db.epochs) {
		if (e.currencyApiId === currencyApiId && !e.settled && e.end < Date.now()) {
			e.settled = { actual: price, at: Date.now() };
			changed = true;
		}
	}

	// read-only: do NOT create empty epochs here (only addCall creates them),
	// otherwise merely viewing currencies bloats the store with empties.
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
	if (changed) save(db);

	return { currencyApiId, currencyName, price, horizons };
}

export function addCall(
	pid: string,
	name: string,
	currencyApiId: string,
	horizon: Horizon,
	predicted: number
): void {
	if (!HORIZONS.includes(horizon)) return;
	const db = load();
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
	save(db);
}
