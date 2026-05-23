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
	MyAnalytics,
	MyBreakdown,
	MyCall,
	MyCalls,
	PlayerStats,
	PredPoint,
	Profile,
	SignalBacktest,
	SmartMoney,
	SmartSignal
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

const round2 = (n: number) => Math.round(n * 100) / 100;

function quantile(xs: number[], q: number): number | null {
	if (!xs.length) return null;
	const s = [...xs].sort((a, b) => a - b);
	const i = (s.length - 1) * q;
	const lo = Math.floor(i);
	const hi = Math.ceil(i);
	return lo === hi ? s[lo] : s[lo] + (s[hi] - s[lo]) * (i - lo);
}

function pearson(xs: number[], ys: number[]): number {
	const n = Math.min(xs.length, ys.length);
	if (n < 3) return 0;
	let mx = 0;
	let my = 0;
	for (let i = 0; i < n; i++) {
		mx += xs[i];
		my += ys[i];
	}
	mx /= n;
	my /= n;
	let num = 0;
	let dx = 0;
	let dy = 0;
	for (let i = 0; i < n; i++) {
		const a = xs[i] - mx;
		const b = ys[i] - my;
		num += a * b;
		dx += a * a;
		dy += b * b;
	}
	const den = Math.sqrt(dx * dy);
	return den ? num / den : 0;
}

// Per-forecaster skill from settled calls: Information Coefficient (correlation
// of predicted return vs actual return), sample size, and an alpha weight that
// shrinks small samples — separates real edge from luck.
function forecasterSkill(db: DB): Map<string, { name: string; ic: number; n: number; hit: number; weight: number }> {
	const byPid = new Map<string, { name: string; rp: number[]; ra: number[]; hits: number }>();
	for (const e of db.epochs) {
		const actual = e.settled?.actual;
		if (actual == null || !(actual > 0)) continue;
		for (const c of e.calls) {
			if (!(c.base && c.base > 0)) continue;
			const g = byPid.get(c.pid) ?? { name: c.name, rp: [], ra: [], hits: 0 };
			g.name = c.name;
			const rp = c.predicted / c.base - 1;
			const ra = actual / c.base - 1;
			g.rp.push(rp);
			g.ra.push(ra);
			if (Math.sign(rp) !== 0 && Math.sign(rp) === Math.sign(ra)) g.hits++;
			byPid.set(c.pid, g);
		}
	}
	const out = new Map<string, { name: string; ic: number; n: number; hit: number; weight: number }>();
	for (const [pid, g] of byPid) {
		const n = g.rp.length;
		const ic = pearson(g.rp, g.ra);
		const weight = Math.max(0, ic) * Math.min(1, n / 20); // shrink small samples
		out.set(pid, { name: g.name, ic: round2(ic), n, hit: n ? g.hits / n : 0, weight });
	}
	return out;
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
		const preds = calls.map((c) => c.predicted);
		horizons[h] = {
			end,
			consensus: median(preds),
			yourCall: your ? your.predicted : null,
			calls: calls.length,
			lo: quantile(preds, 0.25),
			hi: quantile(preds, 0.75)
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

// Merge a guest (dx_pid cookie) into the signed-in user: reassign live epoch
// calls and fold the guest's standings into the user's aggregate. Fixes the
// split where forecasts made before sign-in (or while auth was misconfigured)
// were stranded under a guest id. Idempotent; returns true if anything moved.
export async function claimGuest(
	platform: Plat,
	guestPid: string,
	userPid: string,
	userName: string
): Promise<boolean> {
	if (!guestPid || guestPid === userPid) return false;
	const kv = kvOf(platform);
	const db = await load(kv);
	let moved = false;

	// 1) reassign live/historical calls from guest → user (one call per pid per
	//    epoch — keep the most recent if both ever called the same epoch)
	for (const e of db.epochs) {
		let touched = false;
		for (const c of e.calls) {
			if (c.pid === guestPid) {
				c.pid = userPid;
				c.name = userName;
				touched = true;
				moved = true;
			}
		}
		if (touched) {
			const latest = new Map<string, Call>();
			for (const c of e.calls) {
				const prev = latest.get(c.pid);
				if (!prev || c.at >= prev.at) latest.set(c.pid, c);
			}
			e.calls = [...latest.values()];
		}
	}

	// 2) fold the guest's settled standings into the user's
	const g = db.users?.[guestPid];
	if (g) {
		const u = ensureUser(db, userPid, userName);
		u.name = userName;
		u.points += g.points;
		u.calls += g.calls;
		u.hits += g.hits;
		u.accSum += g.accSum;
		u.oracleBeats += g.oracleBeats;
		u.bestAcc = Math.max(u.bestAcc, g.bestAcc);
		u.bestStreak = Math.max(u.bestStreak, g.bestStreak);
		u.streak = Math.max(u.streak, g.streak); // same human — approximate on merge
		u.lastAt = Math.max(u.lastAt, g.lastAt);
		for (const m of g.markets) if (!u.markets.includes(m)) u.markets.push(m);
		for (const h of HORIZONS) {
			const a = u.byH[h];
			const b = g.byH[h];
			a.calls += b.calls;
			a.hits += b.hits;
			a.points += b.points;
			a.accSum += b.accSum;
		}
		u.badges = earned(u);
		delete db.users![guestPid];
		moved = true;
	}

	if (moved) await save(kv, db);
	return moved;
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

// Walk-forward backtest of the alpha-weighted Signal: replay settled epochs in
// time order, computing each epoch's signal from ONLY prior-settled data (no
// lookahead), and accumulate the directional return of trading the signal.
function signalBacktest(db: DB): SignalBacktest {
	const settled = db.epochs
		.filter((e) => e.settled && e.settled.actual > 0 && e.calls.some((c) => c.base && c.base > 0))
		.sort((a, b) => (a.settled?.at ?? 0) - (b.settled?.at ?? 0));
	const acc = new Map<string, { rp: number[]; ra: number[] }>();
	const weightOf = (pid: string): number => {
		const g = acc.get(pid);
		if (!g || g.rp.length < 3) return 0;
		return Math.max(0, pearson(g.rp, g.ra)) * Math.min(1, g.rp.length / 20);
	};
	let cum = 0;
	let trades = 0;
	let hits = 0;
	let sumRet = 0;
	const equity: { t: number; cum: number }[] = [];
	for (const e of settled) {
		const actual = e.settled!.actual;
		const withBase = e.calls.filter((c) => c.base && c.base > 0);
		const weighted = withBase.map((c) => ({ p: c.predicted, w: weightOf(c.pid) })).filter((x) => x.w > 0 && x.p > 0);
		if (weighted.length >= 2) {
			const wsum = weighted.reduce((s, x) => s + x.w, 0);
			const smart = weighted.reduce((s, x) => s + x.p * x.w, 0) / wsum;
			const medBase = median(withBase.map((c) => c.base as number)) ?? 0;
			if (medBase > 0) {
				const predRet = smart / medBase - 1;
				const actRet = actual / medBase - 1;
				const tradeRet = Math.sign(predRet) * actRet;
				trades++;
				sumRet += tradeRet;
				cum += tradeRet;
				if (Math.sign(predRet) !== 0 && Math.sign(predRet) === Math.sign(actRet)) hits++;
				equity.push({ t: Math.floor((e.settled?.at ?? 0) / 1000), cum: round2(cum * 100) });
			}
		}
		for (const c of withBase) {
			const g = acc.get(c.pid) ?? { rp: [], ra: [] };
			g.rp.push(c.predicted / (c.base as number) - 1);
			g.ra.push(actual / (c.base as number) - 1);
			acc.set(c.pid, g);
		}
	}
	return {
		trades,
		hitRate: trades ? hits / trades : 0,
		avgReturn: trades ? round2((sumRet / trades) * 100) : 0,
		cumReturn: round2(cum * 100),
		equity
	};
}

// ---- premium: smart-money signals ------------------------------------------
// What the top-ranked diviners are forecasting on the current open epochs,
// vs the whole crowd and the current price. Edge = sharp consensus vs price.
export async function getSmartMoney(platform: Plat, market: Market): Promise<SmartMoney> {
	const kv = kvOf(platform);
	const db = await load(kv);
	if (maybeRollover(db, market.league)) await save(kv, db);
	const pm = new Map(market.currencies.map((c) => [c.apiId, c.price]));
	const nameOf = new Map(market.currencies.map((c) => [c.apiId, c.name]));

	const skill = forecasterSkill(db);

	const now = Date.now();
	const signals: SmartSignal[] = [];
	for (const e of db.epochs) {
		if (e.settled || e.end <= now || e.end !== epochEnd(e.horizon)) continue; // current open epoch only
		const price = pm.get(e.currencyApiId);
		if (price == null || !(price > 0)) continue;
		const weighted = e.calls
			.map((c) => ({ p: c.predicted, w: skill.get(c.pid)?.weight ?? 0 }))
			.filter((x) => x.w > 0 && x.p > 0);
		const crowd = median(e.calls.map((c) => c.predicted));
		if (weighted.length < 2 || crowd == null) continue;
		const wsum = weighted.reduce((s, x) => s + x.w, 0);
		const smart = weighted.reduce((s, x) => s + x.p * x.w, 0) / wsum; // alpha-weighted consensus
		signals.push({
			apiId: e.currencyApiId,
			name: nameOf.get(e.currencyApiId) ?? e.currencyApiId,
			horizon: e.horizon,
			price,
			smart,
			crowd,
			edgePct: round2(((smart - price) / price) * 100),
			divergePct: round2(((smart - crowd) / (crowd || 1)) * 100),
			n: weighted.length
		});
	}
	signals.sort((a, b) => Math.abs(b.edgePct) - Math.abs(a.edgePct));
	const forecasters = [...skill.values()]
		.filter((s) => s.n >= 3)
		.sort((a, b) => b.ic - a.ic)
		.slice(0, 15)
		.map((s) => ({ name: s.name, ic: s.ic, n: s.n }));
	return { league: market.league, updatedAt: Date.now(), signals: signals.slice(0, 40), forecasters, backtest: signalBacktest(db) };
}

// ---- premium: personal performance analytics -------------------------------
// Free per-call results loop: the player's active (awaiting settlement) and
// recently settled forecasts with outcomes, plus a 24h recap. Gives the game a
// visible payoff moment without the premium analytics gate.
export async function getMyCalls(platform: Plat, market: Market, pid: string | undefined): Promise<MyCalls> {
	const kv = kvOf(platform);
	const db = await load(kv);
	const rolled = maybeRollover(db, market.league);
	const pm = new Map(market.currencies.map((c) => [c.apiId, c.price]));
	const nameOf = new Map(market.currencies.map((c) => [c.apiId, c.name]));
	if (settleDue(db, (cid) => pm.get(cid)) || rolled) await save(kv, db);

	const u = pid ? db.users?.[pid] : undefined;
	const active: MyCall[] = [];
	const settled: MyCall[] = [];
	if (pid) {
		for (const e of db.epochs) {
			const c = e.calls.find((x) => x.pid === pid);
			if (!c) continue;
			const name = nameOf.get(e.currencyApiId) ?? e.currencyApiId;
			const base = c.base && c.base > 0 ? c.base : null;
			if (e.settled && e.settled.actual > 0) {
				const actual = e.settled.actual;
				const accuracy = Math.max(0, 1 - Math.min(1, Math.abs(c.predicted - actual) / actual));
				const pd = base != null ? Math.sign(c.predicted - base) : 0;
				const dirHit = base != null && pd !== 0 ? pd === Math.sign(actual - base) : null;
				settled.push({
					currencyApiId: e.currencyApiId,
					name,
					horizon: e.horizon,
					predicted: c.predicted,
					base,
					end: e.end,
					actual,
					accuracy,
					dirHit,
					settledAt: e.settled.at
				});
			} else {
				active.push({
					currencyApiId: e.currencyApiId,
					name,
					horizon: e.horizon,
					predicted: c.predicted,
					base,
					end: e.end,
					current: pm.get(e.currencyApiId)
				});
			}
		}
	}
	active.sort((a, b) => a.end - b.end);
	settled.sort((a, b) => (b.settledAt ?? 0) - (a.settledAt ?? 0));

	const dayAgo = Date.now() - 86_400_000;
	const recent = settled.filter((s) => (s.settledAt ?? 0) >= dayAgo);
	const recap = {
		settled: recent.length,
		hits: recent.filter((s) => s.dirHit).length,
		accAvg: recent.length ? recent.reduce((s, r) => s + (r.accuracy ?? 0), 0) / recent.length : 0
	};

	let rank: number | null = null;
	if (pid && u) {
		const ranked = Object.values(db.users ?? {})
			.filter((x) => x.calls > 0)
			.sort((a, b) => b.points - a.points || b.accSum / (b.calls || 1) - a.accSum / (a.calls || 1));
		const idx = ranked.findIndex((x) => x.pid === pid);
		rank = idx === -1 ? null : idx + 1;
	}

	return {
		league: market.league,
		signedIn: !!pid,
		points: u?.points ?? 0,
		rank,
		streak: u?.streak ?? 0,
		active,
		settled: settled.slice(0, 50),
		recap
	};
}

export async function getMyPerformance(platform: Plat, market: Market, pid: string | undefined): Promise<MyAnalytics> {
	const kv = kvOf(platform);
	const db = await load(kv);
	const rolled = maybeRollover(db, market.league);
	const pm = new Map(market.currencies.map((c) => [c.apiId, c.price]));
	const nameOf = new Map(market.currencies.map((c) => [c.apiId, c.name]));
	if (settleDue(db, (cid) => pm.get(cid)) || rolled) await save(kv, db);

	const u = pid ? db.users?.[pid] : undefined;
	const base: MyAnalytics = {
		league: market.league,
		calls: 0,
		hits: 0,
		accAvg: 0,
		points: u?.points ?? 0,
		pnl: 0,
		calibration: [],
		byCurrency: [],
		byHorizon: []
	};
	if (!pid) return base;

	type Rec = { cur: string; hz: Horizon; acc: number; hit: boolean; rp: number; ra: number };
	const recs: Rec[] = [];
	for (const e of db.epochs) {
		const actual = e.settled?.actual;
		if (actual == null || !(actual > 0)) continue;
		const c = e.calls.find((x) => x.pid === pid);
		if (!c) continue;
		const acc = Math.max(0, 1 - Math.min(1, Math.abs(c.predicted - actual) / actual));
		const cb = c.base && c.base > 0 ? c.base : null;
		const hit = cb != null && Math.sign(c.predicted - cb) !== 0 && Math.sign(c.predicted - cb) === Math.sign(actual - cb);
		recs.push({
			cur: nameOf.get(e.currencyApiId) ?? e.currencyApiId,
			hz: e.horizon,
			acc,
			hit,
			rp: cb != null ? c.predicted / cb - 1 : 0,
			ra: cb != null ? actual / cb - 1 : 0
		});
	}
	if (!recs.length) return base;

	const calls = recs.length;
	const hits = recs.filter((r) => r.hit).length;
	const accAvg = recs.reduce((s, r) => s + r.acc, 0) / calls;
	const pnl = recs.reduce((s, r) => s + Math.sign(r.rp) * r.ra, 0); // sim: trade your own direction

	const group = (key: (r: Rec) => string): MyBreakdown[] => {
		const m = new Map<string, { calls: number; hits: number; acc: number }>();
		for (const r of recs) {
			const k = key(r);
			const g = m.get(k) ?? { calls: 0, hits: 0, acc: 0 };
			g.calls++;
			if (r.hit) g.hits++;
			g.acc += r.acc;
			m.set(k, g);
		}
		return [...m.entries()]
			.map(([k, g]) => ({ key: k, calls: g.calls, hits: g.hits, accAvg: g.acc / g.calls }))
			.sort((a, b) => b.calls - a.calls);
	};

	const hzLabel = (h: Horizon) => (h === 'hour' ? '1H' : h === 'day' ? '1D' : '1W');
	const sorted = recs.filter((r) => Number.isFinite(r.rp)).sort((a, b) => a.rp - b.rp);
	const bins = Math.min(6, sorted.length);
	const calibration: MyAnalytics['calibration'] = [];
	if (bins > 0) {
		const size = Math.ceil(sorted.length / bins);
		for (let i = 0; i < sorted.length; i += size) {
			const slice = sorted.slice(i, i + size);
			calibration.push({
				bucket: calibration.length,
				predicted: round2((slice.reduce((s, r) => s + r.rp, 0) / slice.length) * 100),
				actual: round2((slice.reduce((s, r) => s + r.ra, 0) / slice.length) * 100),
				n: slice.length
			});
		}
	}

	return {
		league: market.league,
		calls,
		hits,
		accAvg,
		points: u?.points ?? 0,
		pnl: round2(pnl * 100),
		calibration,
		byCurrency: group((r) => r.cur).slice(0, 12),
		byHorizon: group((r) => hzLabel(r.hz))
	};
}
