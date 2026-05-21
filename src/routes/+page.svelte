<script lang="ts">
	import Toolbar from '$lib/components/Toolbar.svelte';
	import MarketList from '$lib/components/MarketList.svelte';
	import PriceChart from '$lib/components/PriceChart.svelte';
	import StatsPanel from '$lib/components/StatsPanel.svelte';
	import StatusBar from '$lib/components/StatusBar.svelte';
	import { untrack } from 'svelte';
	import type { Market } from '$lib/types';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	function pickDefault(m: Market): number {
		return (m.currencies.find((c) => c.apiId === 'divine') ?? m.currencies[0])?.id ?? 0;
	}

	// seed once from SSR data; both diverge afterwards (refresh / user selection)
	let market = $state<Market>(untrack(() => data.market));
	let selectedId = $state(untrack(() => pickDefault(data.market)));
	const selected = $derived(
		market.currencies.find((c) => c.id === selectedId) ?? market.currencies[0]
	);

	let busy = $state(false);
	async function refresh() {
		if (busy) return;
		busy = true;
		try {
			const res = await fetch('/api/market');
			if (res.ok) market = await res.json();
		} finally {
			busy = false;
		}
	}

	// auto-refresh every 5 minutes (client only)
	$effect(() => {
		const id = setInterval(refresh, 5 * 60 * 1000);
		return () => clearInterval(id);
	});
</script>

<svelte:head>
	<title>Divindex — Path of Exile 2 economy terminal</title>
</svelte:head>

<div class="terminal">
	<Toolbar league={market.league} fetchedAt={market.fetchedAt} onrefresh={refresh} {busy} />

	<div class="term-body">
		<MarketList
			currencies={market.currencies}
			{selectedId}
			onselect={(id) => (selectedId = id)}
		/>

		<main class="term-main" id="main">
			{#if selected}
				<PriceChart currency={selected} base={market.base} />
			{:else}
				<p class="term-empty">No market data available.</p>
			{/if}
		</main>

		{#if selected}
			<StatsPanel currency={selected} {market} />
		{/if}
	</div>

	<StatusBar source={market.source} league={market.league} asOf={market.asOf} />
</div>
