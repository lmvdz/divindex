<script lang="ts">
	import { untrack } from 'svelte';
	import { fmt } from '$lib/format';
	import type { ForecastState } from '$lib/types';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	let fc = $state<ForecastState>(untrack(() => data.forecast));

	let name = $state(untrack(() => fc.current.yourCall?.name ?? ''));
	let predicted = $state<number | null>(untrack(() => fc.current.yourCall?.predicted ?? null));
	let msg = $state('');
	let msgClass = $state<'' | 'ok' | 'err'>('');
	let busy = $state(false);

	// live countdown
	let now = $state(Date.now());
	$effect(() => {
		const id = setInterval(() => (now = Date.now()), 1000);
		return () => clearInterval(id);
	});
	const remaining = $derived(Math.max(0, fc.current.target - now));
	function fmtCountdown(ms: number): string {
		const s = Math.floor(ms / 1000);
		const d = Math.floor(s / 86400);
		const h = Math.floor((s % 86400) / 3600);
		const m = Math.floor((s % 3600) / 60);
		return `${d}d ${h}h ${m}m`;
	}
	const targetLabel = $derived(
		new Date(fc.current.target).toLocaleString('en-US', {
			weekday: 'short',
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit',
			timeZoneName: 'short'
		})
	);

	async function submit(e: SubmitEvent) {
		e.preventDefault();
		msgClass = '';
		if (!name.trim() || predicted == null || !(predicted > 0)) {
			msg = 'Enter a name and a positive price.';
			msgClass = 'err';
			return;
		}
		busy = true;
		try {
			const res = await fetch('/api/forecast', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ name: name.trim(), predicted })
			});
			const next = (await res.json()) as ForecastState & { error?: string };
			if (!res.ok) {
				msg = next.error ?? 'Could not submit your call.';
				msgClass = 'err';
				return;
			}
			fc = next;
			msg = 'Call locked in. Good luck.';
			msgClass = 'ok';
		} catch {
			msg = 'Network error — try again.';
			msgClass = 'err';
		} finally {
			busy = false;
		}
	}
</script>

<svelte:head>
	<title>The Forecast — Divindex</title>
</svelte:head>

<div class="fc">
	<header class="fc-top">
		<a class="brand" href="/" aria-label="Divindex home">
			<span class="orb" aria-hidden="true"></span>
			<span class="brand-word">Divindex</span>
		</a>
		<nav class="fc-nav">
			<a href="/">Terminal</a>
			<a href="/forecast" aria-current="page" class="active">Forecast</a>
		</nav>
	</header>

	<main class="fc-body" id="main">
		<section class="fc-intro">
			<p class="eyebrow">The Forecast</p>
			<h1>Call where the Divine settles.</h1>
			<p class="fc-lede">
				A free weekly game of skill. Predict the Divine&nbsp;Orb's price for Sunday's settlement,
				then climb the leaderboard. No entry fee, no payout, no wagering — rank and bragging
				rights only.
			</p>
		</section>

		<section class="fc-round card">
			<div class="fc-round-head">
				<div>
					<span class="fc-label">This week's round</span>
					<h2>Divine Orb · settles {targetLabel}</h2>
				</div>
				<div class="fc-countdown">
					<span class="fc-cd">{fmtCountdown(remaining)}</span>
					<span class="fc-label">to settlement</span>
				</div>
			</div>

			<div class="fc-stats">
				<div><span class="fc-label">Current</span><b>{fmt(fc.current.price)} <em>Exalted</em></b></div>
				<div><span class="fc-label">Calls in</span><b>{fc.current.calls}</b></div>
				<div>
					<span class="fc-label">Your call</span>
					<b>{fc.current.yourCall ? fmt(fc.current.yourCall.predicted) : '—'}</b>
				</div>
			</div>

			<form class="fc-form" onsubmit={submit} novalidate>
				<label class="sr-only" for="fc-name">Display name</label>
				<input
					class="field"
					id="fc-name"
					placeholder="Display name"
					maxlength="24"
					autocomplete="nickname"
					bind:value={name}
				/>
				<label class="sr-only" for="fc-price">Predicted price in Exalted</label>
				<input
					class="field"
					id="fc-price"
					type="number"
					step="0.01"
					min="0"
					placeholder="Predicted price (ex)"
					bind:value={predicted}
				/>
				<button class="btn btn-primary" type="submit" disabled={busy}>
					{fc.current.yourCall ? 'Update call' : 'Make the call'}
				</button>
				<p class="form-msg {msgClass}" role="status" aria-live="polite">{msg}</p>
			</form>
		</section>

		<section class="fc-history">
			<h2>Past rounds</h2>
			{#if fc.history.length === 0}
				<p class="fc-empty">No settled rounds yet. The first leaderboard lands after Sunday.</p>
			{:else}
				{#each fc.history as round (round.id)}
					<div class="fc-result card">
						<div class="fc-result-head">
							<h3>{round.id}</h3>
							<span class="fc-actual">Settled at <b>{fmt(round.actual)}</b> ex</span>
						</div>
						{#if round.leaderboard.length}
							<ol class="fc-board">
								{#each round.leaderboard as row, i (row.name + i)}
									<li>
										<span class="fc-rank">{i + 1}</span>
										<span class="fc-name">{row.name}</span>
										<span class="fc-pred mono">{fmt(row.predicted)}</span>
										<span class="fc-err mono">{row.errorPct.toFixed(2)}% off</span>
									</li>
								{/each}
							</ol>
						{:else}
							<p class="fc-empty">No calls were made this round.</p>
						{/if}
					</div>
				{/each}
			{/if}
		</section>
	</main>

	<footer class="fc-foot">
		Divindex is an independent project and is not affiliated with or endorsed by Grinding Gear
		Games. The Forecast is a free game of skill — no entry fee, no payout, no wagering.
	</footer>
</div>
