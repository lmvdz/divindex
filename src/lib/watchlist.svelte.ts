// Client-side watchlist of currency apiIds, persisted to localStorage.
// Module-level $state so every component shares one reactive source.
const KEY = 'dx_watchlist';

function loadInit(): string[] {
	if (typeof localStorage === 'undefined') return [];
	try {
		const v = JSON.parse(localStorage.getItem(KEY) ?? '[]');
		return Array.isArray(v) ? (v as string[]) : [];
	} catch {
		return [];
	}
}

let ids = $state<string[]>(loadInit());

function persist() {
	if (typeof localStorage === 'undefined') return;
	try {
		localStorage.setItem(KEY, JSON.stringify(ids));
	} catch {
		/* storage full / disabled */
	}
}

export const watchlist = {
	get ids() {
		return ids;
	},
	get count() {
		return ids.length;
	},
	has(apiId: string) {
		return ids.includes(apiId);
	},
	toggle(apiId: string) {
		ids = ids.includes(apiId) ? ids.filter((x) => x !== apiId) : [...ids, apiId];
		persist();
	}
};
