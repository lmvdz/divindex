<script lang="ts">
	import { signIn } from '@auth/sveltekit/client';
	import { page } from '$app/state';
	import { fmt } from '$lib/format';
	import Nav from '$lib/components/Nav.svelte';
	import type { Horizon } from '$lib/types';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const calls = $derived(data.calls);

	const signedIn = $derived(!!(page.data.session as { user?: unknown } | null)?.user);
	const authConfigured = $derived((page.data.authConfigured as boolean | undefined) ?? false);
	const providers = $derived((page.data.providers as string[] | undefined) ?? []);
	const PROVIDER_LABEL: Record<string, string> = { discord: 'Discord', poe: 'Path of Exile' };

	const hz = (h: Horizon) => (h === 'hour' ? '1H' : h === 'day' ? '1D' : '1W');
	const pct = (x: number) => `${Math.round(x * 100)}%`;
	const dir = (predicted: number, base: number | null) =>
		base == null ? '' : predicted > base ? '↑' : predicted < base ? '↓' : '→';

	let now = $state(Date.now());
	$effect(() => {
		const id = setInterval(() => (now = Date.now()), 1000);
		return () => clearInterval(id);
	});
	function cd(ms: number): string {
		const s = Math.max(0, Math.floor(ms / 1000));
		const d = Math.floor(s / 86400);
		const h = Math.floor((s % 86400) / 3600);
		const m = Math.floor((s % 3600) / 60);
		if (d > 0) return `${d}d ${h}h`;
		if (h > 0) return `${h}h ${m}m`;
		return `${m}m`;
	}
</script>

<svelte:head>
	<title>My calls — Divindex</title>
	<meta name="description" content="Your Path of Exile 2 price forecasts — active calls and settled results." />
</svelte:head>

<div class="scr">
	<header class="scr-top">
		<a class="brand" href="/" aria-label="Divindex home">
			<span class="orb" aria-hidden="true"></span>
			<span class="brand-word">Divindex</span>
		</a>
		<Nav current="/me" />
	</header>

	<main class="scr-body" id="main">
		{#if !signedIn}
			<section class="me-signin">
				<span class="eyebrow">My calls</span>
				<h1>Track your forecasts</h1>
				<p class="muted">
					Sign in to see your active calls counting down to settlement and how your settled
					predictions scored.
				</p>
				{#if authConfigured}
					{#each providers as p (p)}
						<button class="btn btn-primary" onclick={() => signIn(p)}>
							Sign in with {PROVIDER_LABEL[p] ?? p}
						</button>
					{/each}
				{/if}
			</section>
		{:else}
			<div class="scr-meta">
				<span class="eyebrow">My calls</span>
				<span class="muted">{calls.league}</span>
			</div>

			<div class="me-stats">
				<div><span class="st-label">Rank</span><b class="mono">{calls.rank ? `#${calls.rank}` : '—'}</b></div>
				<div><span class="st-label">Omens</span><b class="mono">{calls.points}</b></div>
				<div><span class="st-label">Streak</span><b class="mono">{calls.streak}🔥</b></div>
				<div>
					<span class="st-label">Last 24h</span>
					<b class="mono">
						{#if calls.recap.settled > 0}
							{calls.recap.hits}/{calls.recap.settled} dir · {pct(calls.recap.accAvg)} acc
						{:else}—{/if}
					</b>
				</div>
			</div>

			<section class="me-block">
				<h2>Active <span class="muted">({calls.active.length})</span></h2>
				{#if calls.active.length === 0}
					<p class="muted">No open calls. <a href="/">Make one on the terminal →</a></p>
				{:else}
					<ul class="me-list">
						{#each calls.active as c (c.currencyApiId + c.horizon)}
							<li>
								<span class="me-hz">{hz(c.horizon)}</span>
								<a class="me-name" href="/?c={c.currencyApiId}">{c.name}</a>
								<span class="me-pred mono">{dir(c.predicted, c.base)} {fmt(c.predicted)} ex</span>
								<span class="me-now mono muted">now {c.current != null ? fmt(c.current) : '—'}</span>
								<span class="me-cd mono">{cd(c.end - now)}</span>
							</li>
						{/each}
					</ul>
				{/if}
			</section>

			<section class="me-block">
				<h2>Recent results <span class="muted">({calls.settled.length})</span></h2>
				{#if calls.settled.length === 0}
					<p class="muted">Nothing settled yet — your calls show up here once their window closes.</p>
				{:else}
					<ul class="me-list">
						{#each calls.settled as c (c.currencyApiId + c.horizon + c.end)}
							<li class:hit={c.dirHit === true} class:miss={c.dirHit === false}>
								<span class="me-hz">{hz(c.horizon)}</span>
								<a class="me-name" href="/?c={c.currencyApiId}">{c.name}</a>
								<span class="me-pred mono">{fmt(c.predicted)} → {fmt(c.actual ?? 0)} ex</span>
								<span class="me-acc mono">{pct(c.accuracy ?? 0)} acc</span>
								<span class="me-flag">
									{#if c.dirHit === true}<span class="pos">✓ dir</span>
									{:else if c.dirHit === false}<span class="neg">✗ dir</span>
									{:else}<span class="muted">—</span>{/if}
								</span>
							</li>
						{/each}
					</ul>
				{/if}
			</section>
		{/if}
	</main>
</div>

<style>
	.me-signin {
		max-width: 480px;
		margin: 48px auto;
		text-align: center;
		display: flex;
		flex-direction: column;
		gap: 12px;
		align-items: center;
	}
	.me-stats {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
		gap: 10px;
		margin: 12px 0 24px;
	}
	.me-stats > div {
		display: flex;
		flex-direction: column;
		gap: 3px;
		padding: 10px 12px;
		border: 1px solid var(--border-2);
		border-radius: 10px;
		background: rgba(255, 255, 255, 0.02);
	}
	.st-label {
		font-size: 0.7rem;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--muted);
	}
	.me-block {
		margin-bottom: 28px;
	}
	.me-block h2 {
		font-size: 0.95rem;
		margin: 0 0 10px;
	}
	.me-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.me-list li {
		display: grid;
		grid-template-columns: 36px minmax(120px, 1fr) auto auto auto;
		align-items: center;
		gap: 12px;
		padding: 8px 12px;
		border: 1px solid var(--border-2);
		border-left: 3px solid var(--border-2);
		border-radius: 8px;
		font-size: 0.84rem;
	}
	.me-list li.hit {
		border-left-color: var(--up, #4ec9a0);
	}
	.me-list li.miss {
		border-left-color: var(--down, #e06c75);
	}
	.me-hz {
		font-size: 0.7rem;
		font-weight: 600;
		color: var(--muted);
	}
	.me-name {
		color: var(--text);
		text-decoration: none;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.me-name:hover {
		color: var(--gold-soft, var(--gold));
	}
	@media (max-width: 620px) {
		.me-list li {
			grid-template-columns: 30px 1fr auto;
		}
		.me-now,
		.me-acc {
			display: none;
		}
	}
</style>
