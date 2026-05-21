import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import type { ForecastState } from '$lib/types';

// Simple JSON-file store for the free weekly forecast game.
// Swap for a real DB (Postgres/SQLite) when this grows; the shape is stable.
const DIR = '.data';
const FILE = `${DIR}/forecast.json`;

interface Call {
	pid: string;
	name: string;
	predicted: number;
	at: number;
}
interface Round {
	id: string;
	target: number; // settlement time (epoch ms)
	currencyApiId: string;
	calls: Call[];
	settled?: { actual: number; at: number };
}
interface DB {
	rounds: Round[];
}

function load(): DB {
	try {
		return JSON.parse(readFileSync(FILE, 'utf8')) as DB;
	} catch {
		return { rounds: [] };
	}
}
function save(db: DB) {
	mkdirSync(DIR, { recursive: true });
	writeFileSync(FILE, JSON.stringify(db));
}

// next Sunday 00:00 UTC
function nextTarget(from = Date.now()): number {
	const d = new Date(from);
	const u = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
	const day = u.getUTCDay();
	u.setUTCDate(u.getUTCDate() + (day === 0 ? 7 : 7 - day));
	return u.getTime();
}

function ensureCurrent(db: DB, currencyApiId = 'divine'): Round {
	const target = nextTarget();
	let r = db.rounds.find((x) => x.target === target);
	if (!r) {
		r = { id: new Date(target).toISOString().slice(0, 10), target, currencyApiId, calls: [] };
		db.rounds.push(r);
	}
	return r;
}

export function getState(pid: string | undefined, price: number): ForecastState {
	const db = load();
	let changed = false;
	// lazily settle any past rounds against the latest known price
	for (const r of db.rounds) {
		if (!r.settled && r.target < Date.now()) {
			r.settled = { actual: price, at: Date.now() };
			changed = true;
		}
	}
	ensureCurrent(db);
	if (changed) save(db);
	else save(db); // persist any freshly created round too

	const cur = ensureCurrent(db);
	const your = pid ? cur.calls.find((c) => c.pid === pid) : undefined;

	const history = db.rounds
		.filter((r) => r.settled)
		.sort((a, b) => b.target - a.target)
		.slice(0, 8)
		.map((r) => ({
			id: r.id,
			target: r.target,
			actual: r.settled!.actual,
			leaderboard: r.calls
				.map((c) => ({
					name: c.name,
					predicted: c.predicted,
					errorPct: r.settled!.actual
						? (Math.abs(c.predicted - r.settled!.actual) / r.settled!.actual) * 100
						: 0
				}))
				.sort((a, b) => a.errorPct - b.errorPct)
				.slice(0, 10)
		}));

	return {
		current: {
			id: cur.id,
			target: cur.target,
			currencyApiId: cur.currencyApiId,
			price,
			calls: cur.calls.length,
			yourCall: your ? { name: your.name, predicted: your.predicted } : null
		},
		history
	};
}

export function addCall(pid: string, name: string, predicted: number): void {
	const db = load();
	const cur = ensureCurrent(db);
	if (cur.settled) return;
	const existing = cur.calls.find((c) => c.pid === pid);
	if (existing) {
		existing.predicted = predicted;
		existing.name = name;
		existing.at = Date.now();
	} else {
		cur.calls.push({ pid, name, predicted, at: Date.now() });
	}
	save(db);
}
