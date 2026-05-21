export function fmt(n: number): string {
	if (n >= 1000) return Math.round(n).toLocaleString('en-US');
	if (n >= 100) return n.toFixed(1);
	return n.toFixed(2);
}

export function signStr(v: number): string {
	return `${v > 0 ? '+' : ''}${v.toFixed(2)}%`;
}

export function signClass(v: number): 'up' | 'down' | '' {
	return v > 0 ? 'up' : v < 0 ? 'down' : '';
}
