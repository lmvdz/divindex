<script lang="ts">
	import { untrack } from 'svelte';
	import { compact } from '$lib/format';
	import { HORIZON_COLORS } from '$lib/horizons';
	import { BADGES, RARITY_COLOR, badgeById } from '$lib/badges';
	import type { Horizon, Ladder } from '$lib/types';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	let ladder = $state<Ladder>(untrack(() => data.ladder));
	const calib = $derived(data.calibration);
	let scope = $state<'all' | Horizon>('all');
	let busy = $state(false);

	const SCOPES: { id: 'all' | Horizon; label: string }[] = [
		{ id: 'all', label: 'Overall' },
		{ id: 'hour', label: '1H' },
		{ id: 'day', label: '1D' },
		{ id: 'week', label: '1W' }
	];

	async function pick(s: 'all' | Horizon) {
		if (s === scope || busy) return;
		scope = s;
		busy = true;
		try {
			const qs = s === 'all' ? '' : `?horizon=${s}`;
			const r = await fetch(`/api/leaderboard${qs}`);
			if (r.ok) ladder = await r.json();
		} finally {
			busy = false;
		}
	}

	const pct = (x: number) => `${Math.round(x * 100)}%`;
	const hitRate = (hits: number, calls: number) => (calls ? hits / calls : 0);

	// the signed-in player's earned badges (full metadata), for the standing card
	const myBadges = $derived(
		(ladder.you?.badges ?? []).map((id) => badgeById(id)).filter((b) => b != null)
	);
	const youAcc = $derived(ladder.you && ladder.you.calls ? ladder.you.accSum / ladder.you.calls : 0);
</script>

<svelte:head>
	<title>The Ladder — Divindex</title>
</svelte:head>

<div class="scr">
	<header class="scr-top">
		<a class="brand" href="/" aria-label="Divindex home">
			<span class="orb" aria-hidden="true"></span>
			<span class="brand-word">Divindex</span>
		</a>
		<nav class="tb-nav">
			<a href="/">Terminal</a>
			<a href="/screener">Screener</a>
			<a href="/ladder" aria-current="page" class="active">Ladder</a>
		</nav>
		<span class="lg-chip" title="Active league">{ladder.league}</span>
		<span class="tb-spacer"></span>
		<div class="quote-toggle" role="group" aria-label="Ladder scope">
			{#each SCOPES as s (s.id)}
				<button class:active={scope === s.id} onclick={() => pick(s.id)} aria-pressed={scope === s.id}>
					{#if s.id !== 'all'}<span class="hdot" style="background:{HORIZON_COLORS[s.id].base}"></span>{/if}{s.label}
				</button>
			{/each}
		</div>
	</header>

	<main class="scr-body" id="main">
		<div class="scr-meta">
			<span class="eyebrow">The Ladder</span>
			<span class="muted">
				{ladder.top.length} diviner{ladder.top.length === 1 ? '' : 's'} · {ladder.league} · ranked on
				{scope === 'all' ? 'all calls' : `${SCOPES.find((s) => s.id === scope)?.label} calls`} · settled scores only
			</span>
		</div>

		{#if calib && calib.overall.n > 0}
			<section class="calib" aria-label="Crowd calibration">
				<span class="calib-title">Is the crowd predictive?</span>
				<div class="calib-cells">
					<div><span class="st-label">Direction</span><b class="mono" class:pos={calib.overall.dir >= 0.5}>{pct(calib.overall.dir)}</b></div>
					<div><span class="st-label">Accuracy</span><b class="mono">{pct(calib.overall.acc)}</b></div>
					{#each [{ id: 'hour', label: '1H' }, { id: 'day', label: '1D' }, { id: 'week', label: '1W' }] as h (h.id)}
						<div>
							<span class="st-label"><span class="hdot" style="background:{HORIZON_COLORS[h.id as Horizon].base}"></span>{h.label} dir</span>
							<b class="mono">{calib.byH[h.id as Horizon].n ? pct(calib.byH[h.id as Horizon].dir) : '—'}</b>
						</div>
					{/each}
					<div><span class="st-label">Sample</span><b class="mono">{calib.overall.n}</b></div>
				</div>
			</section>
		{/if}

		{#if ladder.you && ladder.you.calls > 0}
			<section class="standing">
				<div class="st-rank">
					<span class="st-label">Your rank</span>
					<b class="st-big mono">{ladder.yourRank ? `#${ladder.yourRank}` : '—'}</b>
				</div>
				<div class="st-stat"><span class="st-label">Omens</span><b class="mono">{compact(ladder.you.points)}</b></div>
				<div class="st-stat"><span class="st-label">Calls</span><b class="mono">{ladder.you.calls}</b></div>
				<div class="st-stat"><span class="st-label">Direction</span><b class="mono">{pct(hitRate(ladder.you.hits, ladder.you.calls))}</b></div>
				<div class="st-stat"><span class="st-label">Accuracy</span><b class="mono">{pct(youAcc)}</b></div>
				<div class="st-stat"><span class="st-label">Streak</span><b class="mono">{ladder.you.streak}🔥</b></div>
				<div class="st-stat"><span class="st-label">Oracle beats</span><b class="mono">{ladder.you.oracleBeats}</b></div>
				{#if myBadges.length}
					<div class="st-badges">
						{#each myBadges as b (b!.id)}
							<span class="badge" style="--rc:{RARITY_COLOR[b!.rarity]}" title={`${b!.name} — ${b!.desc}`}>{b!.name}</span>
						{/each}
					</div>
				{/if}
			</section>
		{/if}

		<div class="scr-table-wrap">
			<table class="scr-table ladder-table">
				<thead>
					<tr>
						<th class="num">#</th>
						<th>Diviner</th>
						<th class="num">Omens</th>
						<th class="num">Calls</th>
						<th class="num hide-sm">Direction</th>
						<th class="num">Accuracy</th>
						<th class="num hide-sm">Streak</th>
						<th class="num hide-sm">Badges</th>
					</tr>
				</thead>
				<tbody>
					{#each ladder.top as r (r.rank)}
						<tr class:me={ladder.yourRank === r.rank}>
							<td class="num idx">
								{#if r.rank <= 3}<span class="medal medal-{r.rank}">{r.rank}</span>{:else}{r.rank}{/if}
							</td>
							<td><span class="nm">{r.name}</span>{#if ladder.yourRank === r.rank}<span class="you-tag">you</span>{/if}</td>
							<td class="num pr">{compact(r.points)}</td>
							<td class="num">{r.calls}</td>
							<td class="num hide-sm">{pct(hitRate(r.hits, r.calls))}</td>
							<td class="num">{pct(r.accAvg)}</td>
							<td class="num hide-sm">{r.bestStreak}</td>
							<td class="num hide-sm">{r.badges || '—'}</td>
						</tr>
					{:else}
						<tr><td colspan="8" class="scr-empty">No settled calls yet — be the first onto the Ladder.</td></tr>
					{/each}
				</tbody>
			</table>
		</div>

		{#if ladder.hall.length}
			<section class="hall">
				<h2 class="eyebrow">Hall of Fame</h2>
				<div class="hall-grid">
					{#each ladder.hall as h (h.league + h.endedAt)}
						<div class="hall-card">
							<span class="hall-league">{h.league}</span>
							<b class="hall-champ">{h.champion}</b>
							<span class="hall-meta">{compact(h.points)} Omens · {h.players} diviners</span>
						</div>
					{/each}
				</div>
			</section>
		{/if}

		<section class="badge-gallery">
			<h2 class="eyebrow">Divination cards</h2>
			<div class="badge-grid">
				{#each BADGES as b (b.id)}
					{@const got = (ladder.you?.badges ?? []).includes(b.id)}
					<div class="badge-card" class:locked={!got} style="--rc:{RARITY_COLOR[b.rarity]}">
						<span class="bc-rarity">{b.rarity}</span>
						<b class="bc-name">{b.name}</b>
						<span class="bc-desc">{b.desc}</span>
						<span class="bc-flavor">{b.flavor}</span>
						{#if got}<span class="bc-got">earned</span>{/if}
					</div>
				{/each}
			</div>
		</section>
	</main>

	<footer class="scr-foot">
		Omens are a free, non-redeemable score — a game of skill, no payout. Data via poe2scout · Divindex is not
		affiliated with or endorsed by Grinding Gear Games.
	</footer>
</div>
