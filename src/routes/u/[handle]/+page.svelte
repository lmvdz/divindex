<script lang="ts">
	import { compact } from '$lib/format';
	import { BADGES, RARITY_COLOR, badgeById } from '$lib/badges';
	import { CHALLENGES, completedCount, divinerTitle, isDone, nextTier } from '$lib/challenges';
	import { ladderUrl, shareOrCopy, tweetIntent } from '$lib/share';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const p = $derived(data.player);
	const pct = (x: number) => `${Math.round(x * 100)}%`;
	const acc = $derived(p.calls ? p.accSum / p.calls : 0);
	const dir = $derived(p.calls ? p.hits / p.calls : 0);
	const title = $derived(divinerTitle(p));
	const myBadges = $derived(p.badges.map((id) => badgeById(id)).filter((b) => b != null));
	const chDone = $derived(completedCount(p));
	const chNext = $derived(nextTier(chDone));

	const pageUrl = $derived(`${data.origin}/u/${data.handle}`);
	const ogImg = $derived(`${data.origin}/og/u/${data.handle}`);
	const desc = $derived(
		`${data.rank ? `#${data.rank}` : 'On the board'} on the ${data.league} Ladder · ${pct(dir)} direction · ${pct(acc)} accuracy · ${compact(p.points)} Omens`
	);

	let shareMsg = $state('');
	const brag = $derived(`${p.name} — ${desc} on Divindex 🔮`);
	async function doShare() {
		const r = await shareOrCopy(brag, pageUrl);
		shareMsg = r === 'copied' ? 'Link copied!' : r === 'failed' ? 'Could not share.' : '';
		if (shareMsg) setTimeout(() => (shareMsg = ''), 2000);
	}
</script>

<svelte:head>
	<title>{p.name} — Divindex Diviner</title>
	<meta name="description" content={desc} />
	<meta property="og:type" content="profile" />
	<meta property="og:title" content={`${p.name} — Divindex Diviner`} />
	<meta property="og:description" content={desc} />
	<meta property="og:url" content={pageUrl} />
	<meta property="og:image" content={ogImg} />
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content={`${p.name} — Divindex Diviner`} />
	<meta name="twitter:description" content={desc} />
	<meta name="twitter:image" content={ogImg} />
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
			<a href="/ladder">Ladder</a>
		</nav>
		<span class="lg-chip" title="Active league">{data.league}</span>
	</header>

	<main class="scr-body profile" id="main">
		<section class="prof-hero">
			<div class="prof-id">
				<span class="eyebrow">Diviner</span>
				<h1 class="prof-name">{p.name}</h1>
				{#if title}<span class="sc-title">{title}</span>{/if}
			</div>
			<div class="prof-rank">
				<span class="st-label">Rank</span>
				<b class="st-big mono">{data.rank ? `#${data.rank}` : '—'}</b>
			</div>
		</section>

		<section class="prof-stats">
			<div><span class="st-label">Omens</span><b class="mono">{compact(p.points)}</b></div>
			<div><span class="st-label">Calls</span><b class="mono">{p.calls}</b></div>
			<div><span class="st-label">Direction</span><b class="mono" class:pos={dir >= 0.5}>{pct(dir)}</b></div>
			<div><span class="st-label">Accuracy</span><b class="mono">{pct(acc)}</b></div>
			<div><span class="st-label">Best streak</span><b class="mono">{p.bestStreak}🔥</b></div>
			<div><span class="st-label">Oracle beats</span><b class="mono">{p.oracleBeats}</b></div>
		</section>

		<div class="prof-share">
			<button class="share-btn" onclick={doShare}>↗ Share</button>
			<a class="share-btn x" href={tweetIntent(brag, pageUrl)} target="_blank" rel="noopener">Post on X</a>
			<a class="share-btn" href={ladderUrl()}>View Ladder</a>
			{#if shareMsg}<span class="share-msg">{shareMsg}</span>{/if}
		</div>

		{#if myBadges.length}
			<section class="badge-gallery">
				<h2 class="eyebrow">Badges earned</h2>
				<div class="sc-badges">
					{#each myBadges as b (b!.id)}
						<span class="badge" style="--rc:{RARITY_COLOR[b!.rarity]}" title={`${b!.name} — ${b!.desc}`}>{b!.name}</span>
					{/each}
				</div>
			</section>
		{/if}

		<section class="challenges">
			<h2 class="eyebrow">Challenges — {chDone}/{CHALLENGES.length}</h2>
			<p class="muted ch-sub">{chNext ? `${chNext.count - chDone} more for “${chNext.title}”` : 'Grand Diviner — all challenges complete!'}</p>
			<div class="ch-grid">
				{#each CHALLENGES as c (c.id)}
					{@const prog = c.progress(p)}
					<div class="ch-card" class:done={isDone(p, c)}>
						<div class="ch-head"><b>{c.name}</b>{#if isDone(p, c)}<span class="ch-check">✓</span>{/if}</div>
						<span class="ch-desc">{c.desc}</span>
						<div class="ch-bar"><span style="width:{Math.min(100, (prog / c.goal) * 100)}%"></span></div>
						<span class="ch-prog">{Math.min(Math.round(prog), c.goal)} / {c.goal}</span>
					</div>
				{/each}
			</div>
		</section>

		<p class="prof-cta">
			<a class="btn btn-primary" href="/">Forecast the Path of Exile 2 economy →</a>
		</p>
	</main>

	<footer class="scr-foot">
		Omens are a free, non-redeemable score — a game of skill, no payout. Data via poe2scout · Divindex is not
		affiliated with or endorsed by Grinding Gear Games.
	</footer>
</div>
