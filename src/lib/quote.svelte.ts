import type { Quote } from '$lib/convert';

// Globally selected quote currency, persisted to localStorage so it carries
// across pages (terminal ↔ screener). A URL ?q= still takes precedence on load
// for shareable links.
const KEY = 'dx_quote';

function init(): Quote {
	if (typeof localStorage === 'undefined') return 'exalted';
	return localStorage.getItem(KEY) === 'divine' ? 'divine' : 'exalted';
}

let q = $state<Quote>(init());

export const quoteStore = {
	get value(): Quote {
		return q;
	},
	set(v: Quote) {
		q = v;
		if (typeof localStorage !== 'undefined') {
			try {
				localStorage.setItem(KEY, v);
			} catch {
				/* storage disabled */
			}
		}
	}
};
