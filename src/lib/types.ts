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
	correlations: { ids: { apiId: string; name: string }[]; matrix: number[][] };
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

export interface SmartMoney {
	league: string;
	updatedAt: number;
	signals: SmartSignal[];
	forecasters: { name: string; ic: number; n: number }[]; // top by information coefficient
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

export interface AlertRule {
	id: string;
	pid: string;
	apiId: string;
	name: string;
	dir: 'above' | 'below';
	price: number; // threshold, Exalted
	webhook?: string; // optional Discord webhook for delivery
	createdAt: number;
	triggeredAt?: number;
}

export interface Economy {
	marketCap: number;
	volume: number;
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
