<script lang="ts">
	import IndexChart from '$lib/components/IndexChart.svelte';
	import Ticker from '$lib/components/Ticker.svelte';
	import WaitlistForm from '$lib/components/WaitlistForm.svelte';
	import { fmt, signStr, signClass } from '$lib/format';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const ix = $derived(data.index);
</script>

<main id="main">
	<!-- HERO -->
	<section class="hero" id="index">
		<div class="hero-copy">
			<p class="eyebrow">Path of Exile 2 · Economy Index</p>
			<h1>The Path of Exile&nbsp;2 economy,<br /> as an index.</h1>
			<p class="lede">
				Real-time currency rates, deep price history, and a free forecasting game — built on
				volume-weighted data straight from the game's official Currency Exchange.
			</p>

			<WaitlistForm id="hero" cta="Get early access" />
			<p class="cta-fine">No spam. One email when Divindex opens.</p>
		</div>

		<aside class="card chart-card" aria-labelledby="chart-title">
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

	<!-- FEATURES -->
	<section class="features" aria-label="What Divindex does">
		<article class="card feature">
			<h3>Live currency index</h3>
			<p>
				Every orb priced against Exalted in real time — a volume-weighted rate from the in-game
				Currency Exchange, not listing noise.
			</p>
		</article>
		<article class="card feature">
			<h3>History that goes deep</h3>
			<p>
				Follow each currency and unique across the league. See the pumps, the crashes, and the
				shape of every league launch.
			</p>
		</article>
		<article class="card feature">
			<h3>The Forecast</h3>
			<p>
				Call where the Divine settles each week and climb the leaderboard. Completely free, no
				payouts — just bragging rights.
			</p>
		</article>
	</section>

	<!-- FORECAST -->
	<section class="forecast" id="forecast">
		<div class="section-head">
			<p class="eyebrow">The Forecast</p>
			<h2>A free weekly game of economic foresight.</h2>
			<p class="lede">
				Read the market, make your call, and see who knows the economy best. Skill and bragging
				rights — nothing else on the line.
			</p>
		</div>

		<ol class="steps">
			<li class="card step">
				<span class="step-no" aria-hidden="true">1</span>
				<h3>Make your call</h3>
				<p>Predict Friday's Divine&nbsp;Orb rate before the week opens.</p>
			</li>
			<li class="card step">
				<span class="step-no" aria-hidden="true">2</span>
				<h3>We settle on the real exchange</h3>
				<p>Resolution is the volume-weighted close from the official Currency Exchange — no
					judgment calls.</p>
			</li>
			<li class="card step">
				<span class="step-no" aria-hidden="true">3</span>
				<h3>Climb the leaderboard</h3>
				<p>Closest calls take the week. Points and rank — no entry fee, no prizes, no wagering.</p>
			</li>
		</ol>
		<p class="forecast-note">
			Divindex is a free game of skill. There is no entry fee, no payout, and no wagering of any
			kind.
		</p>
	</section>

	<!-- EARLY ACCESS -->
	<section class="early" id="early-access">
		<div class="card early-card">
			<h2>Get early access</h2>
			<p>Be first in when Divindex opens for the next league.</p>
			<WaitlistForm id="foot" cta="Notify me" />
		</div>
	</section>

	<!-- FAQ -->
	<section class="faq" id="faq" aria-label="Frequently asked questions">
		<h2>FAQ</h2>
		<details class="card qa">
			<summary>Where does the data come from?</summary>
			<p>
				From Path of Exile 2's official in-game Currency Exchange — real, cleared trades
				aggregated into a volume-weighted rate, not scraped listing prices.
			</p>
		</details>
		<details class="card qa">
			<summary>Is the Forecast gambling?</summary>
			<p>
				No. It's a free game of skill. There's no entry fee, no payout, and nothing is wagered —
				you play for rank and bragging rights.
			</p>
		</details>
		<details class="card qa">
			<summary>Are you affiliated with Grinding Gear Games?</summary>
			<p>
				No. Divindex is an independent project and is not affiliated with or endorsed by Grinding
				Gear Games in any way.
			</p>
		</details>
	</section>
</main>
