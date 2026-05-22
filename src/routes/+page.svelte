<script lang="ts">
	import { untrack } from 'svelte';
	import { page } from '$app/state';
	import Toolbar from '$lib/components/Toolbar.svelte';
	import MarketList from '$lib/components/MarketList.svelte';
	import PriceChart from '$lib/components/PriceChart.svelte';
	import StatsPanel from '$lib/components/StatsPanel.svelte';
	import ForecastPanel from '$lib/components/ForecastPanel.svelte';
	import StatusBar from '$lib/components/StatusBar.svelte';
	import type { Forecast, Horizon, Market } from '$lib/types';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	let market = $state<Market>(untrack(() => data.market));

	function pickDefault(m: Market): number {
		const q = page.url.searchParams.get('c');
		if (q) {
			const byApi = m.currencies.find((c) => c.apiId === q || String(c.id) === q);
			if (byApi) return byApi.id;
		}
		return (m.currencies.find((c) => c.apiId === 'divine') ?? m.currencies[0])?.id ?? 0;
	}
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
	$effect(() => {
		const id = setInterval(refresh, 5 * 60 * 1000);
		return () => clearInterval(id);
	});

	// ---- forecast (per selected currency) ----
	let forecast = $state<Forecast | null>(null);
	let activeHorizon = $state<Horizon>('day');

	async function loadForecast(apiId: string) {
		try {
			const res = await fetch(`/api/forecast?currency=${encodeURIComponent(apiId)}`);
			forecast = res.ok ? await res.json() : null;
		} catch {
			forecast = null;
		}
	}
	$effect(() => {
		const c = selected;
		if (c) loadForecast(c.apiId);
	});

	async function submitCall(name: string, predicted: number) {
		const c = selected;
		if (!c) return { ok: false, error: 'No currency.' };
		try {
			const res = await fetch('/api/forecast', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ currency: c.apiId, horizon: activeHorizon, name, predicted })
			});
			const next = await res.json();
			if (!res.ok) return { ok: false, error: next.error ?? 'Failed.' };
			forecast = next;
			return { ok: true };
		} catch {
			return { ok: false, error: 'Network error.' };
		}
	}
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
				<PriceChart currency={selected} base={market.base} {forecast} {activeHorizon} />
			{:else}
				<p class="term-empty">No market data available.</p>
			{/if}
		</main>

		{#if selected}
			<div class="term-right">
				<StatsPanel currency={selected} {market} />
				<ForecastPanel
					{forecast}
					active={activeHorizon}
					base={market.base}
					onhorizon={(h) => (activeHorizon = h)}
					onsubmit={submitCall}
				/>
			</div>
		{/if}
	</div>

	<StatusBar source={market.source} league={market.league} asOf={market.asOf} />
</div>
