<script lang="ts">
	import { page } from '$app/state';
	import Nav from '$lib/components/Nav.svelte';
	import type { Horizon } from '$lib/types';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const bt = $derived(data.backtest);
	const cal = $derived(data.calibration);
	const fc = $derived(data.forecasters);
	const premium = $derived((page.data.premium as boolean | undefined) ?? false);

	const pct = (x: number) => `${x >= 0 ? '+' : ''}${x.toFixed(1)}%`;
	const rate = (x: number) => `${Math.round(x * 100)}%`;
	const cls = (x: number) => (x > 0 ? 'pos' : x < 0 ? 'neg' : '');
	const HZ: { id: Horizon; label: string }[] = [
		{ id: 'hour', label: '1H' },
		{ id: 'day', label: '1D' },
		{ id: 'week', label: '1W' }
	];

	// cumulative-return sparkline
	const spark = $derived.by(() => {
		const eq = bt.equity;
		if (eq.length < 2) return '';
		const w = 280;
		const h = 60;
		const vals = eq.map((p) => p.cum);
		const min = Math.min(...vals, 0);
		const max = Math.max(...vals, 0);
		const span = max - min || 1;
		return eq
			.map((p, i) => {
				const x = (i / (eq.length - 1)) * w;
				const y = h - ((p.cum - min) / span) * h;
				return `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`;
			})
			.join(' ');
	});
</script>

<svelte:head>
	<title>Signal track record — Divindex</title>
	<meta
		name="description"
		content="How well Divindex's crowd-forecasting signal predicts the Path of Exile 2 economy — walk-forward, no lookahead."
	/>
</svelte:head>

<div class="scr">
	<header class="scr-top">
		<a class="brand" href="/" aria-label="Divindex home">
			<span class="orb" aria-hidden="true"></span>
			<span class="brand-word">Divindex</span>
		</a>
		<Nav current="/signal" />
	</header>

	<main class="scr-body" id="main">
		<div class="scr-meta">
			<span class="eyebrow">Signal track record</span>
			<span class="muted">{data.league} · walk-forward, no lookahead</span>
		</div>

		<section class="sig-card">
			<h2>Divindex Signal</h2>
			{#if bt.trades > 0}
				<div class="sig-stats">
					<div><span class="st-label">Signal trades</span><b class="mono">{bt.trades}</b></div>
					<div>
						<span class="st-label">Direction</span>
						<b class="mono {cls(bt.hitRate - 0.5)}">{rate(bt.hitRate)}</b>
					</div>
					<div>
						<span class="st-label">Avg / trade</span>
						<b class="mono {cls(bt.avgReturn)}">{pct(bt.avgReturn)}</b>
					</div>
					<div>
						<span class="st-label">Cumulative</span>
						<b class="mono {cls(bt.cumReturn)}">{pct(bt.cumReturn)}</b>
					</div>
				</div>
				{#if spark}
					<svg class="sig-equity" viewBox="0 0 280 60" preserveAspectRatio="none" aria-label="Cumulative return">
						<path d={spark} class={bt.cumReturn >= 0 ? 'sp-up' : 'sp-down'} />
					</svg>
				{/if}
				<p class="muted sig-note">
					The signal replays the alpha-weighted consensus of proven forecasters against history with
					no lookahead — every trade is scored only on data available before it.
				</p>
			{:else}
				<p class="muted">
					The track record builds as forecasters' calls settle. Make calls on the
					<a href="/">terminal</a> to feed it.
				</p>
			{/if}
		</section>

		<section class="sig-card">
			<h2>Is the crowd right? <span class="muted">— consensus calibration</span></h2>
			<div class="sig-cal">
				<div class="cal-row cal-head">
					<span>Horizon</span><span>Direction</span><span>Accuracy</span><span>Settled</span>
				</div>
				<div class="cal-row">
					<span><b>Overall</b></span>
					<span class="mono {cls(cal.overall.dir - 0.5)}">{rate(cal.overall.dir)}</span>
					<span class="mono">{rate(cal.overall.acc)}</span>
					<span class="mono muted">{cal.overall.n}</span>
				</div>
				{#each HZ as h (h.id)}
					{@const c = cal.byH[h.id]}
					<div class="cal-row">
						<span>{h.label}</span>
						<span class="mono {cls(c.dir - 0.5)}">{c.n ? rate(c.dir) : '—'}</span>
						<span class="mono">{c.n ? rate(c.acc) : '—'}</span>
						<span class="mono muted">{c.n}</span>
					</div>
				{/each}
			</div>
		</section>

		{#if fc.length}
			<section class="sig-card">
				<h2>Sharpest forecasters <span class="muted">— by information coefficient</span></h2>
				<ul class="sig-fc">
					{#each fc as f, i (f.name + i)}
						<li>
							<span class="fc-rank mono">{i + 1}</span>
							<span class="fc-name">{f.name}</span>
							<span class="fc-ic mono {cls(f.ic)}">IC {f.ic.toFixed(2)}</span>
							<span class="fc-n mono muted">{f.n} calls</span>
						</li>
					{/each}
				</ul>
			</section>
		{/if}

		<section class="sig-cta">
			{#if premium}
				<a class="btn btn-primary" href="/analytics">See live signals →</a>
			{:else}
				<p class="muted">Live per-currency signals — what the smart money is forecasting right now — are part of Divindex Pro.</p>
				<a class="btn btn-primary" href="/analytics">Divindex Pro →</a>
			{/if}
		</section>
	</main>
</div>

<style>
	.sig-card {
		border: 1px solid var(--border-2);
		border-radius: 12px;
		padding: 16px 18px;
		margin-bottom: 18px;
		background: rgba(255, 255, 255, 0.02);
	}
	.sig-card h2 {
		font-size: 1rem;
		margin: 0 0 12px;
	}
	.sig-stats {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));
		gap: 10px;
		margin-bottom: 14px;
	}
	.sig-stats > div {
		display: flex;
		flex-direction: column;
		gap: 3px;
	}
	.st-label {
		font-size: 0.7rem;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--muted);
	}
	.sig-stats b {
		font-size: 1.3rem;
	}
	.sig-equity {
		width: 100%;
		height: 60px;
		display: block;
	}
	.sig-equity path {
		fill: none;
		stroke-width: 1.5;
		vector-effect: non-scaling-stroke;
	}
	.sp-up {
		stroke: var(--up, #4ec9a0);
	}
	.sp-down {
		stroke: var(--down, #e06c75);
	}
	.sig-note {
		font-size: 0.78rem;
		margin: 8px 0 0;
	}
	.sig-cal {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.cal-row {
		display: grid;
		grid-template-columns: 1fr 1fr 1fr 1fr;
		gap: 8px;
		padding: 7px 4px;
		border-bottom: 1px solid var(--border-2);
		font-size: 0.86rem;
		align-items: center;
	}
	.cal-head {
		font-size: 0.68rem;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--muted);
		border-bottom-color: transparent;
	}
	.cal-row span:not(:first-child) {
		text-align: right;
	}
	.sig-fc {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 3px;
	}
	.sig-fc li {
		display: grid;
		grid-template-columns: 28px 1fr auto auto;
		gap: 12px;
		align-items: center;
		padding: 6px 4px;
		font-size: 0.86rem;
	}
	.fc-name {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.sig-cta {
		display: flex;
		flex-direction: column;
		gap: 10px;
		align-items: flex-start;
		margin: 8px 0 32px;
	}
</style>
