<script lang="ts">
	import { signIn } from '@auth/sveltekit/client';
	import { fmt } from '$lib/format';
	import { HORIZON_COLORS } from '$lib/horizons';
	import type { Forecast, Horizon } from '$lib/types';

	let {
		forecast,
		active,
		unit,
		fxRate,
		signedIn,
		userName,
		providers,
		authConfigured,
		onhorizon,
		onsubmit
	}: {
		forecast: Forecast | null;
		active: Horizon;
		unit: string;
		fxRate: number;
		signedIn: boolean;
		userName: string | null;
		providers: string[];
		authConfigured: boolean;
		onhorizon: (h: Horizon) => void;
		onsubmit: (name: string | null, predictedExalt: number) => Promise<{ ok: boolean; error?: string }>;
	} = $props();

	const TABS: { id: Horizon; label: string; long: string }[] = [
		{ id: 'hour', label: '1H', long: 'hour' },
		{ id: 'day', label: '1D', long: 'day' },
		{ id: 'week', label: '1W', long: 'week' }
	];
	const PROVIDER_LABEL: Record<string, string> = { discord: 'Discord', poe: 'Path of Exile' };

	let name = $state('');
	let predicted = $state<number | null>(null);
	let msg = $state('');
	let msgClass = $state<'' | 'ok' | 'err'>('');
	let busy = $state(false);

	let now = $state(Date.now());
	$effect(() => {
		const id = setInterval(() => (now = Date.now()), 1000);
		return () => clearInterval(id);
	});

	const cur = $derived(forecast ? forecast.horizons[active] : null);
	const longLabel = $derived(TABS.find((t) => t.id === active)?.long ?? 'epoch');
	const showSignIn = $derived(authConfigured && !signedIn);
	const needName = $derived(!signedIn);

	$effect(() => {
		active;
		fxRate;
		const yc = forecast ? forecast.horizons[active].yourCall : null;
		predicted = yc != null ? Math.round((yc / fxRate) * 1e4) / 1e4 : null;
	});

	function fmtCd(ms: number): string {
		const s = Math.max(0, Math.floor(ms / 1000));
		const d = Math.floor(s / 86400);
		const h = Math.floor((s % 86400) / 3600);
		const m = Math.floor((s % 3600) / 60);
		const sec = s % 60;
		if (d > 0) return `${d}d ${h}h ${m}m`;
		if (h > 0) return `${h}h ${m}m ${sec}s`;
		return `${m}m ${sec}s`;
	}

	async function submit(e: SubmitEvent) {
		e.preventDefault();
		msgClass = '';
		if ((needName && !name.trim()) || predicted == null || !(predicted > 0)) {
			msg = needName ? 'Enter a name and a positive price.' : 'Enter a positive price.';
			msgClass = 'err';
			return;
		}
		busy = true;
		const r = await onsubmit(needName ? name.trim() : null, predicted * fxRate);
		busy = false;
		msg = r.ok ? 'Call locked in.' : (r.error ?? 'Failed.');
		msgClass = r.ok ? 'ok' : 'err';
	}
</script>

<section class="panel forecast" aria-label="Forecast">
	<header class="fx-head">
		<h3>Forecast</h3>
		<div class="fx-tabs" role="tablist" aria-label="Horizon">
			{#each TABS as t (t.id)}
				<button
					role="tab"
					class:active={active === t.id}
					aria-selected={active === t.id}
					style={active === t.id ? `color:${HORIZON_COLORS[t.id].base}` : ''}
					onclick={() => onhorizon(t.id)}
				>
					<span class="hdot" style="background:{HORIZON_COLORS[t.id].base}"></span>{t.label}
				</button>
			{/each}
		</div>
	</header>

	{#if forecast && cur}
		<p class="fx-q">Where will <b>{forecast.currencyName}</b> settle next {longLabel}? <em>({unit})</em></p>

		<div class="fx-grid">
			<div><span class="fc-label">Settles in</span><b class="mono">{fmtCd(cur.end - now)}</b></div>
			<div>
				<span class="fc-label">Consensus</span>
				<b class="mono" style={cur.consensus != null ? `color:${HORIZON_COLORS[active].base}` : ''}>
					{cur.consensus != null ? fmt(cur.consensus / fxRate) : '—'}
				</b>
			</div>
			<div>
				<span class="fc-label">Your call</span>
				<b class="mono" style={cur.yourCall != null ? `color:${HORIZON_COLORS[active].you}` : ''}>
					{cur.yourCall != null ? fmt(cur.yourCall / fxRate) : '—'}
				</b>
			</div>
			<div><span class="fc-label">Calls</span><b class="mono">{cur.calls}</b></div>
		</div>

		{#if showSignIn}
			<div class="fx-signin">
				<p>Sign in to make a call and join the leaderboard.</p>
				{#each providers as p (p)}
					<button class="btn btn-primary signin-btn" onclick={() => signIn(p)}>
						Sign in with {PROVIDER_LABEL[p] ?? p}
					</button>
				{/each}
			</div>
		{:else}
			<form class="fx-form" onsubmit={submit} novalidate>
				{#if needName}
					<input class="field" placeholder="Name" maxlength="24" bind:value={name} aria-label="Display name" />
				{/if}
				<input
					class="field"
					type="number"
					step="0.0001"
					min="0"
					placeholder="Predicted ({unit})"
					bind:value={predicted}
					aria-label="Predicted price"
				/>
				<button class="btn btn-primary" type="submit" disabled={busy}>
					{cur.yourCall != null ? 'Update' : 'Call it'}
				</button>
				<p class="form-msg {msgClass}" role="status" aria-live="polite">{msg}</p>
			</form>
			{#if signedIn}
				<p class="fx-note">Calling as <b>{userName}</b> · free game of skill, no payout.</p>
			{:else}
				<p class="fx-note">Guest mode — free game of skill, no payout.</p>
			{/if}
		{/if}
	{:else}
		<p class="fc-empty">Loading forecast…</p>
	{/if}
</section>
