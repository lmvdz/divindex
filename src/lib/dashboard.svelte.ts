// User's customizable analytics dashboard: which overview widgets are shown,
// persisted to localStorage.
export const WIDGETS = [
	{ id: 'standing', label: 'Your performance' },
	{ id: 'portfolio', label: 'Portfolio' },
	{ id: 'signal', label: 'Top signal' },
	{ id: 'fair', label: 'Fair-value flags' },
	{ id: 'breadth', label: 'Market breadth' },
	{ id: 'movers', label: 'Biggest movers' }
] as const;

export type WidgetId = (typeof WIDGETS)[number]['id'];
const ALL = WIDGETS.map((w) => w.id) as WidgetId[];
const KEY = 'dx_dashboard';

function init(): WidgetId[] {
	if (typeof localStorage === 'undefined') return [...ALL];
	try {
		const v = JSON.parse(localStorage.getItem(KEY) ?? 'null');
		return Array.isArray(v) ? v.filter((x: string) => ALL.includes(x as WidgetId)) : [...ALL];
	} catch {
		return [...ALL];
	}
}

let enabled = $state<string[]>(init());

function persist() {
	if (typeof localStorage === 'undefined') return;
	try {
		localStorage.setItem(KEY, JSON.stringify(enabled));
	} catch {
		/* disabled */
	}
}

export const dashboard = {
	get enabled() {
		return enabled;
	},
	has(id: string) {
		return enabled.includes(id);
	},
	toggle(id: string) {
		enabled = enabled.includes(id) ? enabled.filter((x) => x !== id) : [...enabled, id];
		persist();
	}
};
