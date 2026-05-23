<script lang="ts">
	import { untrack } from 'svelte';
	import { signIn } from '@auth/sveltekit/client';
	import { page } from '$app/state';
	import { fmt, compact } from '$lib/format';
	import { HORIZON_COLORS } from '$lib/horizons';
	import type { AlertRule } from '$lib/types';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const signedIn = $derived(!!(page.data.session as { user?: unknown } | null)?.user);

	type Tab = 'market' | 'smart' | 'me' | 'alerts';
	let tab = $state<Tab>('market');
	const TABS: { id: Tab; label: string }[] = [
		{ id: 'market', label: 'Market intelligence' },
		{ id: 'smart', label: 'Smart money' },
		{ id: 'me', label: 'My performance' },
		{ id: 'alerts', label: 'Alerts' }
	];

	// price alerts (premium)
	let alerts = $state<AlertRule[]>(untrack(() => data.alerts ?? []));
	let aCur = $state('');
	let aDir = $state('above');
	let aPrice = $state<number | null>(null);
	let aHook = $state('');
	let aMsg = $state('');
	let aBusy = $state(false);

	async function createAlert(e: SubmitEvent) {
		e.preventDefault();
		aMsg = '';
		if (!aCur || aPrice == null || !(aPrice > 0)) {
			aMsg = 'Pick a currency and a positive price.';
			return;
		}
		aBusy = true;
		try {
			const res = await fetch('/api/alerts', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ currency: aCur, dir: aDir, price: aPrice, webhook: aHook.trim() || undefined })
			});
			const out = await res.json();
			if (!res.ok) {
				aMsg = out.error ?? 'Failed.';
				return;
			}
			alerts = out.alerts;
			aPrice = null;
			aMsg = 'Alert added.';
		} catch {
			aMsg = 'Network error.';
		} finally {
			aBusy = false;
		}
	}
	async function deleteAlert(id: string) {
		const res = await fetch(`/api/alerts?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
		if (res.ok) alerts = (await res.json()).alerts;
	}

	const pct = (x: number) => `${x >= 0 ? '+' : ''}${x.toFixed(1)}%`;
	const cls = (x: number) => (x > 0 ? 'pos' : x < 0 ? 'neg' : '');
	function corrColor(r: number): string {
		const a = Math.min(1, Math.abs(r));
		return r >= 0 ? `rgba(102,207,138,${a * 0.55})` : `rgba(229,113,112,${a * 0.55})`;
	}
	const hzLabel = (h: string) => (h === 'hour' ? '1H' : h === 'day' ? '1D' : '1W');
	function equitySpark(eq: { t: number; cum: number }[]): string {
		if (eq.length < 2) return '';
		const w = 240;
		const h = 40;
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
	}
</script>

<svelte:head>
	<title>Analytics — Divindex</title>
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
			<a href="/analytics" aria-current="page" class="active">Analytics<span class="pro-pill">PRO</span></a>
		</nav>
	</header>

	<main class="scr-body" id="main">
		{#if !data.premium || !data.market || !data.smart || !data.me || !data.markets}
			<section class="upsell">
				<span class="eyebrow">Divindex Pro</span>
				<h1>Analytics suite</h1>
				<p class="muted">
					Correlations, volatility &amp; liquidity rankings, market breadth, the sharpest forecasters'
					signals, and your personal accuracy &amp; P&amp;L — built on data no other PoE2 tool has.
				</p>
				<ul class="upsell-list">
					<li><b>Market intelligence</b> — correlation matrix, volatility/liquidity, breadth, relative strength</li>
					<li><b>Smart money</b> — what the top-ranked diviners are forecasting vs the crowd and price</li>
					<li><b>My performance</b> — accuracy by market &amp; horizon, calibration, simulated P&amp;L</li>
				</ul>
				{#if signedIn}
					<p class="muted">Pro is in private beta. Your id: <code class="uid">{data.uid}</code></p>
				{:else}
					<button class="btn btn-primary" onclick={() => signIn()}>Sign in to continue</button>
				{/if}
			</section>
		{:else}
			{@const market = data.market}
			{@const smart = data.smart}
			{@const me = data.me}
			{@const markets = data.markets}
			<div class="scr-meta">
				<span class="eyebrow">Analytics <span class="pro-pill">PRO</span></span>
				<span class="muted">{market.league} · live market + crowd intelligence</span>
			</div>

			<div class="quote-toggle an-tabs" role="group" aria-label="Analytics section">
				{#each TABS as t (t.id)}
					<button class:active={tab === t.id} onclick={() => (tab = t.id)} aria-pressed={tab === t.id}>{t.label}</button>
				{/each}
			</div>

			{#if tab === 'market'}
				<div class="an-grid">
					<section class="an-card">
						<h3>Market breadth (24h)</h3>
						<div class="breadth-bar">
							<span class="b-up" style="flex:{market.breadth.up}"></span>
							<span class="b-flat" style="flex:{market.breadth.flat}"></span>
							<span class="b-down" style="flex:{market.breadth.down}"></span>
						</div>
						<p class="muted"><b class="pos">{market.breadth.up} up</b> · {market.breadth.flat} flat · <b class="neg">{market.breadth.down} down</b> — {market.breadth.pct}% advancing</p>
					</section>

					<section class="an-card">
						<h3>Most volatile</h3>
						<ul class="an-list">
							{#each market.volatility.slice(0, 8) as v (v.apiId)}
								<li><a href="/?c={v.apiId}">{v.name}</a><span class="mono">σ {v.vol}%</span><span class="mono {cls(v.change1dPct)}">{pct(v.change1dPct)}</span></li>
							{/each}
						</ul>
					</section>

					<section class="an-card">
						<h3>Most liquid</h3>
						<ul class="an-list">
							{#each market.liquidity.slice(0, 8) as l (l.apiId)}
								<li><a href="/?c={l.apiId}">{l.name}</a><span class="mono">{compact(l.volume)}</span><span class="mono">{fmt(l.price)}</span></li>
							{/each}
						</ul>
					</section>

					<section class="an-card">
						<h3>Relative strength (full league)</h3>
						<ul class="an-list">
							{#each market.movers as mv (mv.apiId)}
								<li><a href="/?c={mv.apiId}">{mv.name}</a><span class="mono {cls(mv.changePct)}">{pct(mv.changePct)}</span></li>
							{/each}
						</ul>
					</section>
				</div>

				<section class="an-card wide">
					<h3>Correlation matrix — top 12 by volume (daily returns)</h3>
					<div class="corr-wrap">
						<table class="corr">
							<thead>
								<tr>
									<th></th>
									{#each market.correlations.ids as c, i (c.apiId)}<th title={c.name}>{i + 1}</th>{/each}
								</tr>
							</thead>
							<tbody>
								{#each market.correlations.matrix as row, i (i)}
									<tr>
										<th class="rowlab" title={market.correlations.ids[i].name}>{i + 1} {market.correlations.ids[i].name}</th>
										{#each row as r, j (j)}
											<td style="background:{corrColor(r)}" title={r.toFixed(2)}>{r.toFixed(2)}</td>
										{/each}
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				</section>
			{:else if tab === 'smart'}
				<section class="an-card wide">
					<h3>Divindex Signal — track record <span class="muted">(walk-forward, no lookahead)</span></h3>
					{#if smart.backtest.trades > 0}
						<div class="prof-stats">
							<div><span class="st-label">Signal trades</span><b class="mono">{smart.backtest.trades}</b></div>
							<div><span class="st-label">Direction</span><b class="mono {cls(smart.backtest.hitRate - 0.5)}">{Math.round(smart.backtest.hitRate * 100)}%</b></div>
							<div><span class="st-label">Avg / trade</span><b class="mono {cls(smart.backtest.avgReturn)}">{pct(smart.backtest.avgReturn)}</b></div>
							<div><span class="st-label">Cumulative</span><b class="mono {cls(smart.backtest.cumReturn)}">{pct(smart.backtest.cumReturn)}</b></div>
						</div>
						{#if equitySpark(smart.backtest.equity)}
							<svg class="equity" viewBox="0 0 240 40" preserveAspectRatio="none" aria-hidden="true">
								<path d={equitySpark(smart.backtest.equity)} class={smart.backtest.cumReturn >= 0 ? 'sp-up' : 'sp-down'} />
							</svg>
						{/if}
					{:else}
						<p class="muted">Track record builds as proven forecasters' calls settle — it replays the alpha-weighted signal against history with no lookahead.</p>
					{/if}
				</section>
				<section class="an-card wide">
					<h3>Smart money — sharpest forecasters vs crowd &amp; price</h3>
					{#if smart.signals.length}
						<div class="scr-table-wrap">
							<table class="scr-table">
								<thead>
									<tr><th>Market</th><th>H</th><th class="num">Price</th><th class="num">Sharp target</th><th class="num">Edge</th><th class="num">vs crowd</th><th class="num">n</th></tr>
								</thead>
								<tbody>
									{#each smart.signals as sig (sig.apiId + sig.horizon)}
										<tr>
											<td><a href="/?c={sig.apiId}">{sig.name}</a></td>
											<td><span class="hdot" style="background:{HORIZON_COLORS[sig.horizon].base}"></span>{hzLabel(sig.horizon)}</td>
											<td class="num mono">{fmt(sig.price)}</td>
											<td class="num mono">{fmt(sig.smart)}</td>
											<td class="num mono {cls(sig.edgePct)}">{pct(sig.edgePct)}</td>
											<td class="num mono {cls(sig.divergePct)}">{pct(sig.divergePct)}</td>
											<td class="num mono">{sig.n}</td>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
						<p class="muted">Edge = alpha-weighted sharp consensus vs current price · vs crowd = sharp vs everyone. Sharp = forecasters weighted by their information coefficient (proven skill, not just rank).</p>
					{:else}
						<p class="muted">No qualifying signals yet — needs ≥2 proven forecasters (positive IC) on an open epoch. Sharpens as the game is played.</p>
					{/if}
				</section>
				{#if smart.forecasters.length}
					<section class="an-card wide">
						<h3>Top forecasters by alpha (information coefficient)</h3>
						<ul class="an-list">
							{#each smart.forecasters as f, i (i)}
								<li><span>{f.name}</span><span class="mono {f.ic >= 0 ? 'pos' : 'neg'}">IC {f.ic.toFixed(2)}</span><span class="muted">{f.n} settled</span></li>
							{/each}
						</ul>
					</section>
				{/if}
			{:else if tab === 'me'}
				{#if me.calls > 0}
					<section class="prof-stats">
						<div><span class="st-label">Settled calls</span><b class="mono">{me.calls}</b></div>
						<div><span class="st-label">Direction</span><b class="mono {cls(me.hits / me.calls - 0.5)}">{Math.round((me.hits / me.calls) * 100)}%</b></div>
						<div><span class="st-label">Accuracy</span><b class="mono">{Math.round(me.accAvg * 100)}%</b></div>
						<div><span class="st-label">Omens</span><b class="mono">{compact(me.points)}</b></div>
						<div><span class="st-label">Sim. P&amp;L</span><b class="mono {cls(me.pnl)}">{pct(me.pnl)}</b></div>
					</section>

					<div class="an-grid">
						<section class="an-card">
							<h3>By horizon</h3>
							<ul class="an-list">
								{#each me.byHorizon as b (b.key)}
									<li><span>{b.key}</span><span class="mono">{b.calls} calls</span><span class="mono">{Math.round(b.accAvg * 100)}%</span></li>
								{/each}
							</ul>
						</section>
						<section class="an-card">
							<h3>By market (top 12)</h3>
							<ul class="an-list">
								{#each me.byCurrency as b (b.key)}
									<li><span>{b.key}</span><span class="mono">{b.calls}</span><span class="mono">{Math.round(b.accAvg * 100)}%</span></li>
								{/each}
							</ul>
						</section>
						<section class="an-card wide">
							<h3>Calibration — your predicted move vs what happened</h3>
							<ul class="an-list">
								{#each me.calibration as c (c.bucket)}
									<li><span class="mono">predicted {pct(c.predicted)}</span><span class="mono {cls(c.actual)}">actual {pct(c.actual)}</span><span class="muted">{c.n} calls</span></li>
								{/each}
							</ul>
						</section>
					</div>
				{:else}
					<p class="muted">No settled calls yet. Make some forecasts on the <a href="/">terminal</a> — your performance shows up here once they settle.</p>
				{/if}
			{:else}
				<section class="an-card wide">
					<h3>Price alerts</h3>
					<form class="alert-form" onsubmit={createAlert}>
						<select class="field" bind:value={aCur} aria-label="Currency">
							<option value="" disabled>Currency…</option>
							{#each markets as m (m.apiId)}<option value={m.apiId}>{m.name}</option>{/each}
						</select>
						<select class="field" bind:value={aDir} aria-label="Direction">
							<option value="above">rises above</option>
							<option value="below">falls below</option>
						</select>
						<input class="field" type="number" step="0.0001" min="0" placeholder="Price (Exalted)" bind:value={aPrice} aria-label="Threshold price" />
						<input class="field" type="url" placeholder="Discord webhook (optional)" bind:value={aHook} aria-label="Discord webhook" />
						<button class="btn btn-primary" type="submit" disabled={aBusy}>Add alert</button>
						<span class="form-msg" role="status" aria-live="polite">{aMsg}</span>
					</form>
					{#if alerts.length}
						<ul class="an-list alert-list">
							{#each alerts as a (a.id)}
								<li>
									<span><a href="/?c={a.apiId}">{a.name}</a> {a.dir} <b class="mono">{a.price}</b> EX</span>
									<span class="muted">{a.webhook ? '🔔 Discord' : 'in-app'}{a.triggeredAt ? ' · fired' : ''}</span>
									<button class="share-btn" onclick={() => deleteAlert(a.id)}>Remove</button>
								</li>
							{/each}
						</ul>
					{:else}
						<p class="muted">No alerts yet. Add one above — it's checked hourly and (optionally) pings your Discord channel.</p>
					{/if}
				</section>
			{/if}
		{/if}
	</main>

	<footer class="scr-foot">
		Divindex Pro · analytics on Path of Exile 2 economy + crowd-forecast data. Not affiliated with Grinding Gear Games.
	</footer>
</div>
