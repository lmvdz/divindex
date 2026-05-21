export function fmt(n: number): string {
	if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
	if (n >= 1000) return Math.round(n).toLocaleString('en-US');
	if (n >= 100) return n.toFixed(1);
	if (n >= 1) return n.toFixed(2);
	return n.toFixed(3);
}

export function compact(n: number): string {
	if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
	if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
	return String(Math.round(n));
}

export function signStr(v: number): string {
	// clamp illiquid-print artifacts (near-zero prior price -> absurd %)
	if (v > 999) return '>+999%';
	if (v < -999) return '<−999%';
	return `${v > 0 ? '+' : ''}${v.toFixed(2)}%`;
}

export function signClass(v: number): 'up' | 'down' | '' {
	return v > 0 ? 'up' : v < 0 ? 'down' : '';
}

const TICKERS: Record<string, string> = {
	exalted: 'EX',
	divine: 'DIV',
	chaos: 'CHA',
	mirror: 'MIR',
	annul: 'ANN',
	regal: 'REG',
	vaal: 'VAL',
	alch: 'ALC',
	chance: 'CHN'
};

export function ticker(apiId: string): string {
	if (TICKERS[apiId]) return TICKERS[apiId];
	return apiId.replace(/[^a-z]/gi, '').slice(0, 3).toUpperCase() || '—';
}

export function timeOf(epochMs: number): string {
	return new Date(epochMs).toLocaleTimeString('en-US', {
		hour: '2-digit',
		minute: '2-digit'
	});
}
