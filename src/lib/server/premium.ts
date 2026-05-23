// Premium entitlement. Beta model: an allowlist of user pids, stored in KV
// (editable at runtime via the admin endpoint) plus a static env fallback
// (PREMIUM_IDS, comma-separated) for bootstrapping. Stripe can later flip the
// same KV entitlement from a webhook without touching callers.
type Plat = App.Platform | undefined;
type KV = {
	get(key: string, type: 'json'): Promise<unknown>;
	put(key: string, value: string): Promise<void>;
};

const KEY = 'premium';

function kvOf(p: Plat): KV | undefined {
	return p?.env?.FORECAST_KV as unknown as KV | undefined;
}
function envIds(p: Plat): Set<string> {
	const raw = ((p?.env ?? {}) as Record<string, string | undefined>).PREMIUM_IDS ?? '';
	return new Set(raw.split(',').map((s) => s.trim()).filter(Boolean));
}
async function kvIds(kv: KV | undefined): Promise<Set<string>> {
	if (!kv) return new Set();
	const v = (await kv.get(KEY, 'json')) as { ids?: string[] } | null;
	return new Set(v?.ids ?? []);
}

export async function isPremium(platform: Plat, pid: string | undefined): Promise<boolean> {
	if (!pid) return false;
	if (envIds(platform).has(pid)) return true;
	return (await kvIds(kvOf(platform))).has(pid);
}

export async function grantPremium(platform: Plat, pid: string): Promise<void> {
	const kv = kvOf(platform);
	if (!kv) return;
	const ids = await kvIds(kv);
	ids.add(pid);
	await kv.put(KEY, JSON.stringify({ ids: [...ids] }));
}

export async function revokePremium(platform: Plat, pid: string): Promise<void> {
	const kv = kvOf(platform);
	if (!kv) return;
	const ids = await kvIds(kv);
	ids.delete(pid);
	await kv.put(KEY, JSON.stringify({ ids: [...ids] }));
}

export async function listPremium(platform: Plat): Promise<string[]> {
	return [...new Set([...envIds(platform), ...(await kvIds(kvOf(platform)))])];
}
