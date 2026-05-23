// Deterministic crafts generator (the exactly-priceable subset of the
// poe2-craft-profit skill): fetches live poe2scout currency prices and computes
// shard↔orb arbitrage (10:1) into static/crafts.json. The Claude Code skill
// layers the reasoning-based essence/omen EV crafts on top. Run: bun scripts/gen-crafts.ts
const BASE = 'https://poe2scout.com/api/poe2';
const r4 = (n: number) => Math.round(n * 1e4) / 1e4;

interface Item {
	ApiId: string;
	Text: string;
	CurrentPrice: number;
}

const leagues = (await (await fetch(`${BASE}/Leagues`)).json()) as { Value: string; IsCurrent: boolean }[];
const league = (leagues.find((l) => l.IsCurrent) ?? leagues[0]).Value;
const enc = encodeURIComponent(league);
const res = (await (await fetch(`${BASE}/Leagues/${enc}/Currencies/ByCategory?Category=currency&PerPage=250&Page=1`)).json()) as {
	Items?: Item[];
};
const items = res.Items ?? [];

type Craft = {
	id: string;
	name: string;
	type: string;
	inputCost: number;
	expectedValue: number;
	ev: number;
	evPct: number;
	confidence: string;
	detail: string;
};
const crafts: Craft[] = [];
for (const s of items) {
	if (!/shard$/i.test((s.Text ?? '').trim())) continue;
	const sp = Number(s.CurrentPrice);
	if (!(sp > 0)) continue;
	const root = s.Text.trim().replace(/\s*Shard$/i, '').trim();
	// match the BASE orb exactly ("Regal Orb" / "Orb of Transmutation"), not
	// Perfect/Greater/Lesser variants — shards combine into the base orb only.
	const want = [`${root} orb`, `orb of ${root}`].map((w) => w.toLowerCase());
	const orb = items.find((c) => c.ApiId !== s.ApiId && want.includes(c.Text.trim().toLowerCase()));
	const op = Number(orb?.CurrentPrice);
	if (!orb || !(op > 0)) continue;
	const cost = 10 * sp;
	const ev = op - cost;
	crafts.push({
		id: `shard-${s.ApiId}`,
		name: `${orb.Text} from shards`,
		type: 'arb',
		inputCost: r4(cost),
		expectedValue: r4(op),
		ev: r4(ev),
		evPct: cost ? Math.round((ev / cost) * 1e4) / 100 : 0,
		confidence: 'high',
		detail: `buy 10 ${s.Text}, combine → sell 1 ${orb.Text}`
	});
}
crafts.sort((a, b) => b.ev - a.ev);

const report = {
	generatedAt: new Date().toISOString(),
	league,
	crafts,
	note: 'Exact shard↔orb arbitrage (10:1) from live poe2scout prices. Tier upgrades (essences/runes) are a probabilistic Reforging Bench gamble, not a deterministic recipe — excluded. Guaranteed-mod essence crafts need finished-item valuation (thin in current PoE2 data). Mechanics: Path of Crafting (MIT) + poe2db.tw.',
	sources: ['poe2scout.com', 'Path of Crafting (MIT)', 'poe2db.tw']
};
await Bun.write('static/crafts.json', `${JSON.stringify(report, null, 2)}\n`);
console.log(`wrote ${crafts.length} crafts for "${league}"`);
