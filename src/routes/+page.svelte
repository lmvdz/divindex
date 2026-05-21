<script lang="ts">
	import IndexChart from '$lib/components/IndexChart.svelte';
	import Ticker from '$lib/components/Ticker.svelte';
	import WaitlistForm from '$lib/components/WaitlistForm.svelte';
	import { fmt, signStr, signClass } from '$lib/format';
	import { reveal, spotlight } from '$lib/actions';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const ix = $derived(data.index);

	// Lead-tile bar motif (static, decorative).
	const bars = [38, 52, 44, 63, 57, 72, 66, 81, 74, 90, 83, 97];
</script>

<main id="main">
	<!-- HERO -->
	<section class="hero" id="index">
		<div class="hero-copy reveal" use:reveal>
			<p class="eyebrow">Path of Exile 2 · Economy Index</p>
			<h1>The Path of Exile&nbsp;2 economy,<br /> as an index.</h1>
			<p class="lede">
				Real-time currency rates, deep price history, and a free forecasting game — built on
				volume-weighted data straight from the game's official Currency Exchange.
			</p>

			<WaitlistForm id="hero" cta="Get early access" />
			<p class="cta-fine">No spam. One email when Divindex opens.</p>
		</div>

		<aside class="card chart-card spot reveal" use:reveal={{ delay: 120 }} use:spotlight
			aria-labelledby="chart-title">
			<div class="chart-head">
				<div>
					<h2 class="chart-title" id="chart-title">{ix.hero.text}</h2>
					<p class="chart-sub">Priced in {ix.hero.unit} · last {ix.hero.window} days</p>
				</div>
				<div class="chart-quote">
					<span class="quote-value">{fmt(ix.hero.latest)}</span>
					<span class="quote-change {signClass(ix.hero.changePct)}">
						{signStr(ix.hero.changePct)} · 7d
					</span>
				</div>
			</div>

			<div class="chart-wrap">
				<IndexChart hero={ix.hero} />
			</div>

			<Ticker rows={ix.ticker} />
			<p class="card-foot">{ix.note} As of {ix.asOf} · {ix.league}.</p>
		</aside>
	</section>

	<!-- FEATURES (bento) -->
	<section class="bento" aria-label="What Divindex does">
		<article class="tile tile-lead spot reveal" use:reveal use:spotlight>
			<span class="tile-icon" aria-hidden="true">
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"
					stroke-linecap="round" stroke-linejoin="round">
					<path d="M3 17l5-6 4 3 5-7 4 4" />
					<path d="M3 21h18" opacity="0.5" />
				</svg>
			</span>
			<h3>Live currency index</h3>
			<p>
				Every orb priced against Exalted in real time — a volume-weighted rate from the in-game
				Currency Exchange, not listing noise.
			</p>
			<div class="bars" aria-hidden="true">
				{#each bars as h (h)}
					<span style="height: {h}%"></span>
				{/each}
			</div>
		</article>

		<article class="tile spot reveal" use:reveal={{ delay: 90 }} use:spotlight>
			<span class="tile-icon" aria-hidden="true">
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"
					stroke-linecap="round" stroke-linejoin="round">
					<path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
					<path d="M3 4v4h4" />
					<path d="M12 8v4l3 2" />
				</svg>
			</span>
			<h3>History that goes deep</h3>
			<p>Follow each currency and unique across the league — the pumps, the crashes, the launch curve.</p>
		</article>

		<article class="tile spot reveal" use:reveal={{ delay: 160 }} use:spotlight>
			<span class="tile-icon" aria-hidden="true">
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"
					stroke-linecap="round" stroke-linejoin="round">
					<circle cx="12" cy="12" r="8" />
					<circle cx="12" cy="12" r="3.5" />
					<path d="M12 2v2M12 20v2M2 12h2M20 12h2" opacity="0.5" />
				</svg>
			</span>
			<h3>The Forecast</h3>
			<p>Call where the Divine settles each week and climb the leaderboard. Free, no payouts.</p>
		</article>
	</section>

	<!-- FORECAST -->
	<section class="forecast" id="forecast">
		<div class="section-head reveal" use:reveal>
			<p class="eyebrow">The Forecast</p>
			<h2>A free weekly game of economic foresight.</h2>
			<p class="lede">
				Read the market, make your call, and see who knows the economy best. Skill and bragging
				rights — nothing else on the line.
			</p>
		</div>

		<ol class="steps">
			<li class="step reveal" use:reveal>
				<span class="step-no" aria-hidden="true">1</span>
				<h3>Make your call</h3>
				<p>Predict Friday's Divine&nbsp;Orb rate before the week opens.</p>
			</li>
			<li class="step reveal" use:reveal={{ delay: 110 }}>
				<span class="step-no" aria-hidden="true">2</span>
				<h3>We settle on the real exchange</h3>
				<p>Resolution is the volume-weighted close from the official Currency Exchange — no
					judgment calls.</p>
			</li>
			<li class="step reveal" use:reveal={{ delay: 220 }}>
				<span class="step-no" aria-hidden="true">3</span>
				<h3>Climb the leaderboard</h3>
				<p>Closest calls take the week. Points and rank — no entry fee, no prizes, no wagering.</p>
			</li>
		</ol>
		<p class="forecast-note reveal" use:reveal>
			Divindex is a free game of skill. There is no entry fee, no payout, and no wagering of any
			kind.
		</p>
	</section>

	<!-- EARLY ACCESS -->
	<section class="early" id="early-access">
		<div class="card early-card spot reveal" use:reveal use:spotlight>
			<h2>Get early access</h2>
			<p>Be first in when Divindex opens for the next league.</p>
			<WaitlistForm id="foot" cta="Notify me" />
		</div>
	</section>

	<!-- FAQ -->
	<section class="faq" id="faq" aria-label="Frequently asked questions">
		<h2 class="reveal" use:reveal>FAQ</h2>
		<details class="card qa reveal" use:reveal>
			<summary>Where does the data come from?</summary>
			<p>
				From Path of Exile 2's official in-game Currency Exchange — real, cleared trades
				aggregated into a volume-weighted rate, not scraped listing prices.
			</p>
		</details>
		<details class="card qa reveal" use:reveal={{ delay: 80 }}>
			<summary>Is the Forecast gambling?</summary>
			<p>
				No. It's a free game of skill. There's no entry fee, no payout, and nothing is wagered —
				you play for rank and bragging rights.
			</p>
		</details>
		<details class="card qa reveal" use:reveal={{ delay: 160 }}>
			<summary>Are you affiliated with Grinding Gear Games?</summary>
			<p>
				No. Divindex is an independent project and is not affiliated with or endorsed by Grinding
				Gear Games in any way.
			</p>
		</details>
	</section>
</main>
