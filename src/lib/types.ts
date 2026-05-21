export interface PricePoint {
	t: string;
	p: number;
	q: number;
}

export interface Hero {
	key: string;
	text: string;
	unit: string;
	latest: number;
	changePct: number;
	window: number;
	series: PricePoint[];
}

export interface TickerRow {
	api: string;
	text: string;
	price: number;
	wkChange: number;
}

export interface IndexData {
	base: string;
	league: string;
	asOf: string;
	hero: Hero;
	ticker: TickerRow[];
	note: string;
}
