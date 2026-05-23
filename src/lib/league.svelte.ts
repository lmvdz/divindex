// Globally selected league, persisted to localStorage so it carries across
// pages (terminal ↔ screener ↔ analytics). Empty string means "follow the live
// league". A URL ?league= still takes precedence on load for shareable links.
const KEY = 'dx_league';

function init(): string {
	if (typeof localStorage === 'undefined') return '';
	return localStorage.getItem(KEY) ?? '';
}

let lg = $state<string>(init());

export const leagueStore = {
	get value(): string {
		return lg;
	},
	set(v: string) {
		lg = v;
		if (typeof localStorage !== 'undefined') {
			try {
				localStorage.setItem(KEY, v);
			} catch {
				/* storage disabled */
			}
		}
	}
};
