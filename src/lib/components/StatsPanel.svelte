<script lang="ts">
	import type { Currency } from '$lib/types';
	import { fmt, compact, signStr, signClass } from '$lib/format';
	import ItemIcon from '$lib/components/ItemIcon.svelte';
	import { watchlist } from '$lib/watchlist.svelte';

	let { currency, unit }: { currency: Currency; unit: string } = $props();
	const starred = $derived(watchlist.has(currency.apiId));
</script>

<section class="panel stats" aria-label="Currency details">
	<header class="stats-head">
		<ItemIcon apiId={currency.apiId} icon={currency.icon} size={40} chip="sym lg" />
		<div>
			<h2>{currency.name}</h2>
			<p class="muted">in {unit}</p>
		</div>
		<button
			class="star-btn"
			class:on={starred}
			onclick={() => watchlist.toggle(currency.apiId)}
			aria-pressed={starred}
			title={starred ? 'Remove from watchlist' : 'Add to watchlist'}
		>
			{starred ? '★' : '☆'}
		</button>
	</header>

	<div class="stats-price">
		<span class="big">{fmt(currency.price)}</span>
		<span class="chg {signClass(currency.change1dPct)}">{signStr(currency.change1dPct)} · 24h</span>
	</div>

	<dl class="stat-line">
		<div><dt>7D</dt><dd class={signClass(currency.changePct)}>{signStr(currency.changePct)}</dd></div>
		<div><dt>High</dt><dd>{fmt(currency.high)}</dd></div>
		<div><dt>Low</dt><dd>{fmt(currency.low)}</dd></div>
		<div><dt>Vol</dt><dd>{compact(currency.volume)}</dd></div>
	</dl>
</section>
