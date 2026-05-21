export interface PricePoint {
	t: string; // yyyy-mm-dd
	p: number; // price in base currency (Exalted)
	q?: number; // daily quantity (listings) — volume proxy
}

export interface Currency {
	id: number;
	apiId: string;
	name: string;
	price: number;
	changePct: number; // over full window
	change1dPct: number; // last vs previous day
	volume: number; // latest daily quantity
	high: number;
	low: number;
	series: PricePoint[];
}

export interface Market {
	league: string;
	base: string; // 'Exalted Orb'
	asOf: string; // ISO date of latest point
	fetchedAt: number; // epoch ms
	currencies: Currency[];
	note: string;
	source: string;
}
