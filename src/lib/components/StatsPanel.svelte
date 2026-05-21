<script lang="ts">
	import type { Currency, Market } from '$lib/types';
	import { fmt, compact, signStr, signClass, ticker } from '$lib/format';

	let { currency, market }: { currency: Currency; market: Market } = $props();

	const movers = $derived.by(() => {
		// exclude sub-1-exalt shards and illiquid prints (>100%/day = artifact, not signal)
		const meaningful = market.currencies.filter(
			(c) => c.change1dPct !== 0 && c.price >= 1 && Math.abs(c.change1dPct) <= 100
		);
		const up = [...meaningful].sort((a, b) => b.change1dPct - a.change1dPct).slice(0, 3);
		const down = [...meaningful].sort((a, b) => a.change1dPct - b.change1dPct).slice(0, 3);
		return [...up, ...down];
	});
</script>

<aside class="panel stats" aria-label="Currency details">
	<header class="stats-head">
		<span class="sym lg">{ticker(currency.apiId)}</span>
		<div>
			<h2>{currency.name}</h2>
			<p class="muted">in {market.base}</p>
		</div>
	</header>

	<div class="stats-price">
		<span class="big">{fmt(currency.price)}</span>
		<span class="chg {signClass(currency.change1dPct)}">{signStr(currency.change1dPct)} · 24h</span>
	</div>

	<dl class="stat-grid">
		<div><dt>7d change</dt><dd class={signClass(currency.changePct)}>{signStr(currency.changePct)}</dd></div>
		<div><dt>High</dt><dd>{fmt(currency.high)}</dd></div>
		<div><dt>Low</dt><dd>{fmt(currency.low)}</dd></div>
		<div><dt>Volume</dt><dd>{compact(currency.volume)}</dd></div>
	</dl>

	{#if movers.length}
		<section class="movers">
			<h3>Top movers · 24h</h3>
			<ul>
				{#each movers as m (m.id)}
					<li>
						<span class="sym sm">{ticker(m.apiId)}</span>
						<span class="mv-nm">{m.name}</span>
						<span class="ch {signClass(m.change1dPct)}">{signStr(m.change1dPct)}</span>
					</li>
				{/each}
			</ul>
		</section>
	{/if}
</aside>
