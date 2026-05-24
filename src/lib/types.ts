export interface PricePoint {
	t: string; // yyyy-mm-dd
	p: number; // price in base currency (Exalted)
	q?: number; // daily quantity (listings) — volume proxy
}

export interface ItemMeta {
	baseType?: string;
	stackSize?: number;
	maxStackSize?: number;
	description?: string;
	effect?: string[];
}

export interface Currency {
	id: number;
	apiId: string;
	name: string;
	category: string;
	icon: string;
	meta?: ItemMeta;
	price: number;
	changePct: number; // over full window
	change1dPct: number; // last vs previous day
	volume: number; // latest daily quantity
	high: number;
	low: number;
	series: PricePoint[];
}

export type Timeframe = '1h' | '4h' | '1d' | '1w';

export interface Candle {
	time: number; // UTC timestamp, seconds (bucket start)
	open: number;
	high: number;
	low: number;
	close: number;
	volume: number; // summed quantity in the bucket
}

export interface History {
	id: number;
	tf: Timeframe;
	candles: Candle[];
}

export type Horizon = 'hour' | 'day' | 'week';

export interface HorizonState {
	end: number; // epoch end (ms)
	consensus: number | null; // median of all calls this epoch
	yourCall: number | null;
	calls: number;
	lo: number | null; // p25 of this epoch's predictions (Exalted) — cone band
	hi: number | null; // p75
}

export interface PredPoint {
	t: number; // settlement time, seconds (UTCTimestamp)
	v: number; // predicted value, in Exalted (client converts to quote)
}

export interface Forecast {
	currencyApiId: string;
	currencyName: string;
	price: number;
	horizons: Record<Horizon, HorizonState>;
	// prediction history over time, per horizon, for charting as a series
	series: Record<Horizon, { you: PredPoint[]; consensus: PredPoint[] }>;
}

export interface HStat {
	calls: number;
	hits: number; // correct-direction calls
	points: number;
	accSum: number; // sum of accuracy (avg = accSum/calls)
}

export interface PlayerStats {
	pid: string;
	name: string;
	points: number;
	calls: number; // settled, scored calls
	hits: number; // correct-direction calls
	accSum: number;
	bestAcc: number; // best single-call accuracy (0..1)
	streak: number; // current correct-direction streak
	bestStreak: number;
	oracleBeats: number; // calls that beat the consensus accuracy
	markets: string[]; // distinct currencies forecasted
	badges: string[]; // earned badge ids
	byH: Record<Horizon, HStat>;
	lastAt: number; // last settlement scored
}

export interface LadderRow {
	rank: number;
	name: string;
	points: number;
	calls: number;
	hits: number;
	accAvg: number; // 0..1
	streak: number;
	bestStreak: number;
	badges: number; // count of earned badges
}

export interface HallEntry {
	league: string;
	champion: string;
	points: number;
	players: number;
	endedAt: number;
}

export interface Ladder {
	updatedAt: number;
	league: string;
	top: LadderRow[];
	you: PlayerStats | null;
	yourRank: number | null;
	hall: HallEntry[];
}

export interface Profile {
	you: PlayerStats | null;
	rank: number | null;
	league: string;
}

export interface Calib {
	n: number; // settled epochs sampled (accuracy denominator)
	dir: number; // consensus direction hit-rate 0..1
	acc: number; // consensus avg accuracy 0..1
}

export interface Calibration {
	league: string;
	overall: Calib;
	byH: Record<Horizon, Calib>;
}

export interface MarketAnalytics {
	league: string;
	asOf: string;
	breadth: { up: number; down: number; flat: number; pct: number };
	volatility: { apiId: string; name: string; vol: number; price: number; change1dPct: number }[];
	liquidity: { apiId: string; name: string; volume: number; price: number }[];
	movers: { apiId: string; name: string; changePct: number; price: number }[];
	// rebased % performance (full history) for the top-liquid currencies — a readable
	// alternative to a correlation matrix (co-moving lines track; spread = leaders/laggards)
	performance: { apiId: string; name: string; series: { t: number; pct: number }[] }[];
}

export interface FairValueRow {
	apiId: string;
	name: string;
	price: number; // current (last tick)
	fair: number; // liquidity-weighted model value
	low: number; // band
	high: number;
	deviationPct: number; // (price − fair) / fair × 100
	confidence: number; // 0..1 (dispersion × liquidity)
}

export interface FairValue {
	updatedAt: number;
	rows: FairValueRow[];
}

export interface ShardArb {
	shardName: string;
	orbName: string;
	shardApiId: string;
	orbApiId: string;
	shardPrice: number; // per shard, Exalted
	orbPrice: number; // per orb, Exalted
	edge: number; // orbPrice − 10 × shardPrice
	edgePct: number; // edge / orbPrice × 100 (positive ⇒ combine shards → sell orb)
}

export interface Arbitrage {
	updatedAt: number;
	shardsPerOrb: number;
	shards: ShardArb[];
}

export interface SmartSignal {
	apiId: string;
	name: string;
	horizon: Horizon;
	price: number; // current, Exalted
	smart: number; // top-forecaster consensus target, Exalted
	crowd: number; // all-forecaster consensus target, Exalted
	edgePct: number; // smart vs current price (signed %)
	divergePct: number; // smart vs crowd (signed %)
	n: number; // top forecasters contributing
}

export interface SignalBacktest {
	trades: number;
	hitRate: number; // 0..1 directional
	avgReturn: number; // mean per-trade signed return, %
	cumReturn: number; // cumulative, %
	equity: { t: number; cum: number }[]; // cumulative return % over time
}

export interface SmartMoney {
	league: string;
	updatedAt: number;
	signals: SmartSignal[];
	forecasters: { name: string; ic: number; n: number }[]; // top by information coefficient
	backtest: SignalBacktest;
}

export interface MyBreakdown {
	key: string; // currency name or horizon label
	calls: number;
	hits: number;
	accAvg: number;
}

export interface MyAnalytics {
	league: string;
	calls: number;
	hits: number;
	accAvg: number;
	points: number;
	pnl: number; // simulated: sum of directional return if you'd traded each call
	calibration: { bucket: number; predicted: number; actual: number; n: number }[];
	byCurrency: MyBreakdown[];
	byHorizon: MyBreakdown[];
}

// A single forecast the player made — active (awaiting settlement) or settled
// with its outcome. Powers the free "My calls" results loop.
export interface MyCall {
	currencyApiId: string;
	name: string;
	horizon: Horizon;
	predicted: number; // Exalted
	base: number | null; // price when the call was made
	end: number; // settlement time (ms)
	current?: number; // current market price (active calls)
	actual?: number; // settled price
	accuracy?: number; // 0..1 (settled)
	dirHit?: boolean | null; // direction correct (null if no base) (settled)
	settledAt?: number;
}

export interface MyCalls {
	league: string;
	signedIn: boolean;
	points: number;
	rank: number | null;
	streak: number;
	active: MyCall[]; // soonest settlement first
	settled: MyCall[]; // most recently settled first
	recap: { settled: number; hits: number; accAvg: number }; // last 24h
}

// Admin-only ladder inspector row — distinguishes signed-in (u:<id>) from guest
// (raw uuid) forecasters so test/guest entries can be spotted and pruned.
export interface AdminUserRow {
	pid: string;
	pidType: 'auth' | 'guest';
	name: string;
	points: number;
	calls: number;
	hits: number;
	accAvg: number;
	streak: number;
	lastAt: number;
}

export interface Holding {
	apiId: string;
	qty: number;
	cost?: number; // avg buy price, Exalted (optional, for P&L)
}

export interface PortHolding {
	apiId: string;
	name: string;
	category: string;
	qty: number;
	price: number; // current, Exalted
	value: number; // qty × price
	cost?: number;
	pnl?: number; // (price − cost) × qty
	pnlPct?: number;
}

export interface Portfolio {
	total: number; // total value, Exalted
	pnl: number; // total P&L where cost is known
	holdings: PortHolding[];
	byCategory: { category: string; value: number }[];
	equity: { t: string; value: number }[]; // portfolio value over time (carry-forward)
}

export interface AlertRule {
	id: string;
	pid: string;
	apiId: string;
	name: string;
	kind?: 'price' | 'fairdev'; // price threshold (Exalted) | fair-value deviation (%) — default price
	dir: 'above' | 'below';
	price: number; // threshold: Exalted for price, percent for fairdev
	webhook?: string; // optional Discord webhook for delivery
	createdAt: number;
	triggeredAt?: number;
}

export interface AiRec {
	item: string;
	apiId?: string;
	action: 'buy' | 'sell' | 'hold';
	target?: number;
	confidence: number; // 0..1
	horizon: string;
	rationale: string;
}

export interface AiBriefing {
	configured: boolean;
	updatedAt: number;
	model?: string;
	recommendations: AiRec[];
	note?: string;
}

export interface Economy {
	marketCap: number;
	volume: number;
}

export interface League {
	value: string; // league name, e.g. 'Fate of the Vaal'
	isCurrent: boolean; // the live league (where forecasting runs)
}

export interface Market {
	league: string;
	base: string; // 'Exalted Orb'
	asOf: string; // ISO date of latest point
	fetchedAt: number; // epoch ms
	currencies: Currency[];
	categories: string[];
	economy: Economy | null;
	note: string;
	source: string;
}
