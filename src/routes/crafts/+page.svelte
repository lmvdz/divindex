<script lang="ts">
	import { fmt } from '$lib/format';
	import Nav from '$lib/components/Nav.svelte';
	import type { PageData } from './$types';

	interface Craft {
		id: string;
		name: string;
		type: string;
		inputCost: number;
		expectedValue: number;
		ev: number;
		evPct: number;
		confidence: string;
		detail: string;
	}
	interface Report {
		generatedAt: string | null;
		league: string | null;
		crafts: Craft[];
		note: string;
		sources: string[];
	}

	let { data }: { data: PageData } = $props();
	const report = $derived(data.report as Report | null);
	const crafts = $derived(report?.crafts ?? []);
	const pct = (x: number) => `${x >= 0 ? '+' : ''}${x.toFixed(1)}%`;
	const cls = (x: number) => (x > 0 ? 'pos' : x < 0 ? 'neg' : '');
	const confCls = (c: string) => (c === 'high' ? 'cf-high' : c === 'med' ? 'cf-med' : 'cf-low');
</script>

<svelte:head>
	<title>Most profitable crafts — Divindex</title>
	<meta name="description" content="The most profitable Path of Exile 2 crafts right now — live prices × crafting mechanics." />
</svelte:head>

<div class="scr">
	<header class="scr-top">
		<a class="brand" href="/" aria-label="Divindex home">
			<span class="orb" aria-hidden="true"></span>
			<span class="brand-word">Divindex</span>
		</a>
		<Nav current="/crafts" />
	</header>

	<main class="scr-body" id="main">
		<div class="scr-meta">
			<span class="eyebrow">Most profitable crafts</span>
			<span class="muted">
				live prices × crafting mechanics{#if report?.league} · {report.league}{/if}{#if report?.generatedAt} · updated {new Date(report.generatedAt).toLocaleDateString()}{/if}
			</span>
		</div>

		{#if crafts.length}
			<div class="scr-table-wrap">
				<table class="scr-table">
					<thead>
						<tr>
							<th>Craft</th>
							<th class="hide-sm">Type</th>
							<th class="num">Cost</th>
							<th class="num">Exp. value</th>
							<th class="num">EV</th>
							<th class="num">EV %</th>
							<th>Conf.</th>
						</tr>
					</thead>
					<tbody>
						{#each crafts as c (c.id)}
							<tr>
								<td><b>{c.name}</b>{#if c.detail}<div class="craft-detail">{c.detail}</div>{/if}</td>
								<td class="hide-sm"><span class="cat-tag">{c.type}</span></td>
								<td class="num mono">{fmt(c.inputCost)}</td>
								<td class="num mono">{fmt(c.expectedValue)}</td>
								<td class="num mono {cls(c.ev)}">{fmt(c.ev)}</td>
								<td class="num mono {cls(c.evPct)}">{pct(c.evPct)}</td>
								<td><span class="conf {confCls(c.confidence)}">{c.confidence}</span></td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
			<p class="muted">Prices in Exalted Orbs. EV = expected output value − input cost. {report?.note}</p>
		{:else}
			<section class="upsell">
				<h1>Crafting profitability — coming online</h1>
				<p class="muted">{report?.note ?? 'Report pending.'}</p>
			</section>
		{/if}

		<section class="an-card wide craft-sims">
			<h3>Plan a specific craft</h3>
			<p class="muted">We rank profitability from live prices; for step-by-step crafting simulation use these community tools:</p>
			<div class="craft-links">
				<a class="btn btn-ghost" href="https://pathofcrafting.net/" target="_blank" rel="noopener">Path of Crafting ↗</a>
				<a class="btn btn-ghost" href="https://www.craftofexile.com/?game=poe2" target="_blank" rel="noopener">Craft of Exile ↗</a>
			</div>
		</section>
	</main>

	<footer class="scr-foot">
		Crafting mechanics via <a href="https://pathofcrafting.net/" target="_blank" rel="noopener">Path of Crafting</a> (MIT) and
		<a href="https://poe2db.tw/" target="_blank" rel="noopener">poe2db.tw</a>; prices via poe2scout. Not affiliated with Grinding Gear Games.
	</footer>
</div>
