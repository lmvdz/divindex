<script lang="ts">
	import { untrack } from 'svelte';
	import { page } from '$app/state';
	import { replaceState } from '$app/navigation';
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
	import { TF_TO_HORIZON } from '$lib/horizons';
	import type { Calibration, Forecast, Horizon, Market, Profile } from '$lib/types';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	let market = $state<Market>(untrack(() => data.market));
	let quote = $state<Quote>(untrack(() => (page.url.searchParams.get('q') === 'divine' ? 'divine' : 'exalted')));

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

	// keep the URL in sync (?c=<currency>&q=<quote>) so a reload or shared link
	// restores the exact pair. replaceState avoids polluting back-button history.
	// Skip the very first run: on mount the URL already reflects the loaded state
	// and SvelteKit's router isn't initialized yet (replaceState would throw).
	let lastSync = '';
	let synced = false;
	$effect(() => {
		const apiId = selectedRaw?.apiId;
		if (!apiId) return;
		const next = `?c=${encodeURIComponent(apiId)}&q=${quote}`;
		if (next === lastSync) return;
		const first = !synced;
		synced = true;
		lastSync = next;
		if (first) return;
		replaceState(next, {});
	});

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

	// ---- player profile (rank, points, streak, badges) ----
	let profile = $state<Profile | null>(null);
	async function loadProfile() {
		try {
			const res = await fetch('/api/profile');
			profile = res.ok ? await res.json() : null;
		} catch {
			profile = null;
		}
	}
	$effect(() => {
		signedIn;
		loadProfile();
	});

	// ---- crowd calibration (is the consensus predictive?) ----
	let calibration = $state<Calibration | null>(null);
	$effect(() => {
		fetch('/api/calibration')
			.then((r) => (r.ok ? r.json() : null))
			.then((c) => (calibration = c))
			.catch(() => (calibration = null));
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
			loadProfile();
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
					dispPrice={selectedView.price}
					dispChange={selectedView.change1dPct}
					ontimeframe={(tf) => {
						const h = TF_TO_HORIZON[tf];
						if (h) activeHorizon = h;
					}}
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
					stats={profile?.you ?? null}
					rank={profile?.rank ?? null}
					calib={calibration}
					onhorizon={(h) => (activeHorizon = h)}
					onsubmit={submitCall}
				/>
			</div>
		{/if}
	</div>

	<StatusBar
		source={market.source}
		league={market.league}
		asOf={market.asOf}
		economy={market.economy}
	/>
</div>
