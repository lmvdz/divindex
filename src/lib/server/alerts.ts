import type { AlertRule, Market } from '$lib/types';

// Premium price alerts, stored in KV. Evaluated by the hourly cron; fires to
// the rule's Discord webhook (validated to discord.com to avoid SSRF) at most
// once per cooldown while the condition holds.
type Plat = App.Platform | undefined;
type KV = {
	get(key: string, type: 'json'): Promise<unknown>;
	put(key: string, value: string): Promise<void>;
};
const KEY = 'alerts';
const COOLDOWN = 12 * 3600 * 1000;
const MAX_PER_USER = 50;

function kvOf(p: Plat): KV | undefined {
	return p?.env?.FORECAST_KV as unknown as KV | undefined;
}
async function load(kv: KV | undefined): Promise<AlertRule[]> {
	if (!kv) return [];
	const v = (await kv.get(KEY, 'json')) as { rules?: AlertRule[] } | null;
	return v?.rules ?? [];
}
async function save(kv: KV | undefined, rules: AlertRule[]): Promise<void> {
	if (kv) await kv.put(KEY, JSON.stringify({ rules }));
}

export function isDiscordWebhook(u: string): boolean {
	return /^https:\/\/(canary\.|ptb\.)?discord(app)?\.com\/api\/webhooks\/\d+\/[\w-]+$/.test(u);
}

export async function listAlerts(platform: Plat, pid: string): Promise<AlertRule[]> {
	return (await load(kvOf(platform))).filter((r) => r.pid === pid).sort((a, b) => b.createdAt - a.createdAt);
}

export async function addAlert(platform: Plat, rule: Omit<AlertRule, 'id' | 'createdAt'>): Promise<AlertRule | null> {
	const kv = kvOf(platform);
	const rules = await load(kv);
	if (rules.filter((r) => r.pid === rule.pid).length >= MAX_PER_USER) return null;
	const r: AlertRule = { ...rule, id: crypto.randomUUID(), createdAt: Date.now() };
	rules.push(r);
	await save(kv, rules);
	return r;
}

export async function removeAlert(platform: Plat, pid: string, id: string): Promise<void> {
	const kv = kvOf(platform);
	const rules = (await load(kv)).filter((r) => !(r.id === id && r.pid === pid));
	await save(kv, rules);
}

export async function evalAlerts(
	platform: Plat,
	market: Market,
	devOf?: (apiId: string) => number | undefined // fair-value deviation %, for fairdev alerts
): Promise<number> {
	const kv = kvOf(platform);
	const rules = await load(kv);
	if (!rules.length) return 0;
	const pm = new Map(market.currencies.map((c) => [c.apiId, c.price]));
	const now = Date.now();
	let fired = 0;
	let changed = false;
	for (const r of rules) {
		let met = false;
		let content = '';
		if (r.kind === 'fairdev') {
			const dev = devOf?.(r.apiId);
			if (dev == null) continue;
			met = r.dir === 'above' ? dev >= r.price : dev <= -r.price;
			content = `🔔 **${r.name}** is ${dev >= 0 ? '+' : ''}${dev}% vs fair value.`;
		} else {
			const price = pm.get(r.apiId);
			if (price == null) continue;
			met = r.dir === 'above' ? price >= r.price : price <= r.price;
			content = `🔔 **${r.name}** is ${r.dir} ${r.price} Exalted (now ${price.toFixed(4)}).`;
		}
		if (!met) continue;
		if (r.triggeredAt && now - r.triggeredAt < COOLDOWN) continue;
		r.triggeredAt = now;
		changed = true;
		fired++;
		if (r.webhook && isDiscordWebhook(r.webhook)) {
			try {
				await fetch(r.webhook, {
					method: 'POST',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify({ username: 'Divindex', content: `${content} https://divindex.com/?c=${r.apiId}` })
				});
			} catch {
				/* delivery best-effort */
			}
		}
	}
	if (changed) await save(kv, rules);
	return fired;
}
