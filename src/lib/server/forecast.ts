import type {
	Calib,
	Calibration,
	Forecast,
	HallEntry,
	Horizon,
	HorizonState,
	HStat,
	Ladder,
	LadderRow,
	Market,
	PlayerStats,
	PredPoint,
	Profile
} from '$lib/types';
import { earned } from '$lib/badges';
import { handleOf } from '$lib/handle';

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
	base?: number; // price at call time — needed to score direction
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
	users?: Record<string, PlayerStats>; // current-season standings
	currentLeague?: string;
	hall?: HallEntry[]; // past league champions
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

// ---- scoring ---------------------------------------------------------------
// Direction + magnitude: a win/loss on calling the move, plus an accuracy bonus
// for how close, scaled by the player's correct-direction streak.
const PARTICIPATION = 10;
const DIRECTION = 40;
const ACCURACY_MAX = 50;
const BEAT = 20; // bonus for beating the consensus's accuracy

function zeroH(): HStat {
	return { calls: 0, hits: 0, points: 0, accSum: 0 };
}
function ensureUser(db: DB, pid: string, name: string): PlayerStats {
	db.users ??= {};
	let u = db.users[pid];
	if (!u) {
		u = {
			pid,
			name,
			points: 0,
			calls: 0,
			hits: 0,
			accSum: 0,
			bestAcc: 0,
			streak: 0,
			bestStreak: 0,
			oracleBeats: 0,
			markets: [],
			badges: [],
			byH: { hour: zeroH(), day: zeroH(), week: zeroH() },
			lastAt: 0
		};
		db.users[pid] = u;
	}
	return u;
}

function scoreInto(db: DB, e: Epoch, c: Call, actual: number, consAcc: number, contested: boolean) {
	const u = ensureUser(db, c.pid, c.name);
	u.name = c.name;
	const hasBase = c.base != null && c.base > 0;
	const predDir = hasBase ? Math.sign(c.predicted - (c.base as number)) : 0;
	const actDir = hasBase ? Math.sign(actual - (c.base as number)) : 0;
	const dirCorrect = hasBase && predDir !== 0 && predDir === actDir;
	const accuracy = actual > 0 ? Math.max(0, 1 - Math.min(1, Math.abs(c.predicted - actual) / actual)) : 0;
	const beat = contested && accuracy > consAcc + 1e-9; // strictly sharper than the crowd

	if (hasBase) {
		u.streak = dirCorrect ? u.streak + 1 : 0;
		if (u.streak > u.bestStreak) u.bestStreak = u.streak;
	}
	if (beat) u.oracleBeats += 1;
	const mult = 1 + 0.05 * Math.min(u.streak, 10); // up to 1.5x at a 10-streak
	const pts = Math.round(
		(PARTICIPATION + (dirCorrect ? DIRECTION : 0) + Math.round(accuracy * ACCURACY_MAX) + (beat ? BEAT : 0)) * mult
	);

	u.points += pts;
	u.calls += 1;
	if (dirCorrect) u.hits += 1;
	u.accSum += accuracy;
	if (accuracy > u.bestAcc) u.bestAcc = accuracy;
	if (!u.markets.includes(e.currencyApiId)) u.markets.push(e.currencyApiId);
	u.lastAt = e.settled?.at ?? Date.now();

	const bh = u.byH[e.horizon];
	bh.calls += 1;
	bh.points += pts;
	bh.accSum += accuracy;
	if (dirCorrect) bh.hits += 1;

	u.badges = earned(u);
}

// Seasons: one active league at a time (PoE's model). When the active league
// changes, archive the champion to the Hall of Fame and reset the standings.
function maybeRollover(db: DB, league: string): boolean {
	if (!db.currentLeague) {
		db.currentLeague = league;
		return true;
	}
	if (db.currentLeague === league) return false;
	const ranked = Object.values(db.users ?? {})
		.filter((u) => u.calls > 0)
		.sort((a, b) => b.points - a.points);
	db.hall ??= [];
	if (ranked.length) {
		db.hall.unshift({
			league: db.currentLeague,
			champion: ranked[0].name,
			points: ranked[0].points,
			players: ranked.length,
			endedAt: Date.now()
		});
		db.hall = db.hall.slice(0, 20);
	}
	db.users = {};
	db.currentLeague = league;
	return true;
}

// Settle every due epoch we have a price for, scoring its calls. Processed in
// settlement-time order so per-player streaks accrue chronologically.
function settleDue(db: DB, priceOf: (cid: string) => number | undefined, now = Date.now()): boolean {
	const due = db.epochs.filter((e) => !e.settled && e.end < now).sort((a, b) => a.end - b.end);
	let changed = false;
	for (const e of due) {
		const actual = priceOf(e.currencyApiId);
		if (actual == null) continue;
		e.settled = { actual, at: now };
		const cp = median(e.calls.map((c) => c.predicted));
		const consAcc = cp != null && actual > 0 ? Math.max(0, 1 - Math.min(1, Math.abs(cp - actual) / actual)) : 0;
		const contested = e.calls.length >= 2;
		for (const c of e.calls) scoreInto(db, e, c, actual, consAcc, contested);
		changed = true;
	}
	return changed;
}

export async function getForecast(
	platform: Plat,
	pid: string | undefined,
	currencyApiId: string,
	currencyName: string,
	price: number,
	league: string
): Promise<Forecast> {
	const kv = kvOf(platform);
	const db = await load(kv);
	const rolled = maybeRollover(db, league);
	// settle (and score) only this currency's due epochs — it's the only price we have here
	const changed = settleDue(db, (cid) => (cid === currencyApiId ? price : undefined)) || rolled;

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

	if (changed) await save(kv, db);
	return { currencyApiId, currencyName, price, horizons, series };
}

export async function addCall(
	platform: Plat,
	pid: string,
	name: string,
	currencyApiId: string,
	horizon: Horizon,
	predicted: number,
	base: number | undefined,
	league: string
): Promise<void> {
	if (!HORIZONS.includes(horizon)) return;
	const kv = kvOf(platform);
	const db = await load(kv);
	maybeRollover(db, league);
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
		existing.base = base;
	} else {
		e.calls.push({ pid, name, predicted, at: Date.now(), base });
	}
	await save(kv, db);
}

// ---- leaderboard / profile -------------------------------------------------
function toRow(u: PlayerStats, horizon?: Horizon): LadderRow {
	const s: HStat = horizon
		? u.byH[horizon]
		: { calls: u.calls, hits: u.hits, points: u.points, accSum: u.accSum };
	return {
		rank: 0,
		name: u.name,
		points: s.points,
		calls: s.calls,
		hits: s.hits,
		accAvg: s.calls ? s.accSum / s.calls : 0,
		streak: u.streak,
		bestStreak: u.bestStreak,
		badges: u.badges.length
	};
}

export async function getLadder(
	platform: Plat,
	market: Market,
	pid: string | undefined,
	horizon?: Horizon
): Promise<Ladder> {
	const kv = kvOf(platform);
	const db = await load(kv);
	const rolled = maybeRollover(db, market.league);
	const pm = new Map(market.currencies.map((c) => [c.apiId, c.price]));
	if (settleDue(db, (cid) => pm.get(cid)) || rolled) await save(kv, db);

	const users = Object.values(db.users ?? {}).filter((u) => u.calls > 0);
	let entries = users.map((u) => ({ pid: u.pid, row: toRow(u, horizon) }));
	if (horizon) entries = entries.filter((e) => e.row.calls > 0);
	entries.sort((a, b) => b.row.points - a.row.points || b.row.accAvg - a.row.accAvg);
	entries.forEach((e, i) => (e.row.rank = i + 1));

	const top = entries.slice(0, 100).map((e) => e.row);
	const youEntry = pid ? entries.find((e) => e.pid === pid) : undefined;
	const you = pid ? (db.users?.[pid] ?? null) : null;
	return {
		updatedAt: Date.now(),
		league: market.league,
		top,
		you,
		yourRank: youEntry?.row.rank ?? null,
		hall: db.hall ?? []
	};
}

export async function getProfile(platform: Plat, market: Market, pid: string | undefined): Promise<Profile> {
	const ladder = await getLadder(platform, market, pid);
	return { you: ladder.you, rank: ladder.yourRank, league: ladder.league };
}

// Public lookup by shareable handle (hash of pid), with the player's rank.
export async function getPlayerByHandle(platform: Plat, market: Market, handle: string): Promise<Profile> {
	const kv = kvOf(platform);
	const db = await load(kv);
	const rolled = maybeRollover(db, market.league);
	const pm = new Map(market.currencies.map((c) => [c.apiId, c.price]));
	if (settleDue(db, (cid) => pm.get(cid)) || rolled) await save(kv, db);

	const ranked = Object.values(db.users ?? {})
		.filter((u) => u.calls > 0)
		.sort((a, b) => b.points - a.points || b.accSum / (b.calls || 1) - a.accSum / (a.calls || 1));
	const idx = ranked.findIndex((u) => handleOf(u.pid) === handle);
	if (idx === -1) return { you: null, rank: null, league: market.league };
	return { you: ranked[idx], rank: idx + 1, league: market.league };
}

// ---- crowd calibration: is the consensus actually predictive? ---------------
interface Acc {
	n: number;
	accSum: number;
	dirN: number; // epochs where a baseline existed (direction denominator)
	dirHits: number;
}
function newAcc(): Acc {
	return { n: 0, accSum: 0, dirN: 0, dirHits: 0 };
}
function rate(a: Acc): Calib {
	return { n: a.n, dir: a.dirN ? a.dirHits / a.dirN : 0, acc: a.n ? a.accSum / a.n : 0 };
}

export async function getCalibration(platform: Plat, market: Market): Promise<Calibration> {
	const kv = kvOf(platform);
	const db = await load(kv);
	const pm = new Map(market.currencies.map((c) => [c.apiId, c.price]));
	if (settleDue(db, (cid) => pm.get(cid))) await save(kv, db);

	const overall = newAcc();
	const byH: Record<Horizon, Acc> = { hour: newAcc(), day: newAcc(), week: newAcc() };
	for (const e of db.epochs) {
		const actual = e.settled?.actual;
		if (actual == null || !(actual > 0)) continue;
		const cp = median(e.calls.map((c) => c.predicted));
		if (cp == null) continue;
		const bases = e.calls.map((c) => c.base).filter((b): b is number => b != null && b > 0);
		const cb = bases.length ? median(bases) : null;
		const a = Math.max(0, 1 - Math.min(1, Math.abs(cp - actual) / actual));
		const dirCorrect = cb != null && Math.sign(cp - cb) !== 0 && Math.sign(cp - cb) === Math.sign(actual - cb);
		for (const t of [overall, byH[e.horizon]]) {
			t.n += 1;
			t.accSum += a;
			if (cb != null) {
				t.dirN += 1;
				if (dirCorrect) t.dirHits += 1;
			}
		}
	}
	return { league: market.league, overall: rate(overall), byH: { hour: rate(byH.hour), day: rate(byH.day), week: rate(byH.week) } };
}
