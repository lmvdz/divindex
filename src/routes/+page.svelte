<script lang="ts">
	import { untrack } from 'svelte';
	import { page } from '$app/state';
	import Toolbar from '$lib/components/Toolbar.svelte';
	import MarketList from '$lib/components/MarketList.svelte';
	import PriceChart from '$lib/components/PriceChart.svelte';
	import StatsPanel from '$lib/components/StatsPanel.svelte';
	import ForecastPanel from '$lib/components/ForecastPanel.svelte';
	import StatusBar from '$lib/components/StatusBar.svelte';
	import {
		convertMarket,
		divineRate,
		effectiveQuote,
		QUOTE_LABEL,
		type Quote
	} from '$lib/convert';
	import type { Forecast, Horizon, Market } from '$lib/types';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	let market = $state<Market>(untrack(() => data.market));
	let quote = $state<Quote>('exalted');

	function pickDefault(m: Market): number {
		const q = page.url.searchParams.get('c');
		if (q) {
			const hit = m.currencies.find((c) => c.apiId === q || String(c.id) === q);
			if (hit) return hit.id;
		}
		return (m.currencies.find((c) => c.apiId === 'divine') ?? m.currencies[0])?.id ?? 0;
	}
	let selectedId = $state(untrack(() => pickDefault(data.market)));

	const view = $derived(convertMarket(market, quote));
	const selectedRaw = $derived(
		market.currencies.find((c) => c.id === selectedId) ?? market.currencies[0]
	);
	const selectedView = $derived(
		view.currencies.find((c) => c.id === selectedId) ?? view.currencies[0]
	);
	const divineId = $derived(market.currencies.find((c) => c.apiId === 'divine')?.id ?? 0);
	const eff = $derived(selectedRaw ? effectiveQuote(selectedRaw.apiId, quote) : 'exalted');
	const fxRate = $derived(eff === 'exalted' ? 1 : divineRate(market));
	const unit = $derived(QUOTE_LABEL[eff]);

	// ---- auth (from +layout.server.ts) ----
	const session = $derived(page.data.session as { user?: { name?: string | null } } | null);
	const signedIn = $derived(!!session?.user);
	const userName = $derived(session?.user?.name ?? null);
	const providers = $derived((page.data.providers as string[] | undefined) ?? []);
	const authConfigured = $derived((page.data.authConfigured as boolean | undefined) ?? false);

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

	// ---- forecast (per selected currency, stored in Exalted) ----
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
		const c = selectedRaw;
		if (c) loadForecast(c.apiId);
	});

	async function submitCall(name: string | null, predictedExalt: number) {
		const c = selectedRaw;
		if (!c) return { ok: false, error: 'No currency.' };
		try {
			const res = await fetch('/api/forecast', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					currency: c.apiId,
					horizon: activeHorizon,
					name,
					predicted: predictedExalt
				})
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
	<Toolbar
		league={market.league}
		fetchedAt={market.fetchedAt}
		{quote}
		onquote={(q) => (quote = q)}
		onrefresh={refresh}
		{busy}
		{signedIn}
		{userName}
		{authConfigured}
	/>

	<div class="term-body">
		<MarketList
			currencies={view.currencies}
			{selectedId}
			{quote}
			onselect={(id) => (selectedId = id)}
		/>

		<main class="term-main" id="main">
			{#if selectedRaw}
				<PriceChart
					currency={selectedRaw}
					{quote}
					{divineId}
					{fxRate}
					{forecast}
					{activeHorizon}
				/>
			{:else}
				<p class="term-empty">No market data available.</p>
			{/if}
		</main>

		{#if selectedView}
			<div class="term-right">
				<StatsPanel currency={selectedView} {unit} />
				<ForecastPanel
					{forecast}
					active={activeHorizon}
					{unit}
					{fxRate}
					{signedIn}
					{userName}
					{providers}
					{authConfigured}
					onhorizon={(h) => (activeHorizon = h)}
					onsubmit={submitCall}
				/>
			</div>
		{/if}
	</div>

	<StatusBar source={market.source} league={market.league} asOf={market.asOf} />
</div>
