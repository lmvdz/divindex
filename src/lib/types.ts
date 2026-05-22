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
