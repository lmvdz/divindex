import type { Currency } from '$lib/types';

export const tip = $state<{ cur: Currency | null; x: number; y: number; unit: string }>({
	cur: null,
	x: 0,
	y: 0,
	unit: ''
});

export function showTip(cur: Currency, x: number, y: number, unit: string) {
	tip.cur = cur;
	tip.x = x;
	tip.y = y;
	tip.unit = unit;
}

export function moveTip(x: number, y: number) {
	if (tip.cur) {
		tip.x = x;
		tip.y = y;
	}
}

export function hideTip() {
	tip.cur = null;
}
