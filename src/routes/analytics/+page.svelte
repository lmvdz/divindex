<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { signIn } from '@auth/sveltekit/client';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { fmt, compact } from '$lib/format';
	import { HORIZON_COLORS } from '$lib/horizons';
	import { dashboard, WIDGETS } from '$lib/dashboard.svelte';
	import { leagueStore } from '$lib/league.svelte';
	import PerfChart from '$lib/components/PerfChart.svelte';
	import LeagueSelect from '$lib/components/LeagueSelect.svelte';
	import type { AiBriefing, AlertRule, Holding, League, Portfolio } from '$lib/types';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const signedIn = $derived(!!(page.data.session as { user?: unknown } | null)?.user);

	// ---- league (browse market analytics per league; navigates with ?league=) ----
	const leagues = $derived((page.data.leagues as League[] | undefined) ?? []);
	const league = $derived((data.league as string | undefined) ?? '');
	function selectLeague(lg: string) {
		if (lg === league) return;
		leagueStore.set(lg);
		goto(`/analytics?league=${encodeURIComponent(lg)}`, { keepFocus: true, noScroll: true });
	}
	onMount(() => {
		const stored = leagueStore.value;
		if (!page.url.searchParams.get('league') && stored && league && stored !== league) {
			goto(`/analytics?league=${encodeURIComponent(stored)}`, { keepFocus: true, noScroll: true });
		}
	});

	type Tab = 'dashboard' | 'market' | 'smart' | 'ai' | 'fair' | 'arb' | 'me' | 'port' | 'alerts';
	let tab = $state<Tab>('dashboard');
	let customizing = $state(false);
	const TABS: { id: Tab; label: string }[] = [
		{ id: 'dashboard', label: 'Dashboard' },
		{ id: 'market', label: 'Market intelligence' },
		{ id: 'smart', label: 'Signal' },
		{ id: 'ai', label: 'AI Analyst' },
		{ id: 'fair', label: 'Fair value' },
		{ id: 'arb', label: 'Arbitrage' },
		{ id: 'me', label: 'My performance' },
		{ id: 'port', label: 'Portfolio' },
		{ id: 'alerts', label: 'Alerts' }
	];

	// AI analyst (premium, on-demand to bound LLM cost)
	let ai = $state<AiBriefing | null>(null);
	let aiBusy = $state(false);
	async function loadAi() {
		aiBusy = true;
		try {
			const r = await fetch('/api/analytics/ai');
			if (r.ok) ai = await r.json();
		} finally {
			aiBusy = false;
		}
	}

	// price alerts (premium)
	let alerts = $state<AlertRule[]>(untrack(() => data.alerts ?? []));
	let aCur = $state('');
	let aKind = $state('price');
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
				body: JSON.stringify({ currency: aCur, kind: aKind, dir: aDir, price: aPrice, webhook: aHook.trim() || undefined })
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

	// portfolio (premium)
	let port = $state<Portfolio | null>(untrack(() => data.port ?? null));
	let pHoldings = $state<Holding[]>(
		untrack(() => (data.port?.holdings ?? []).map((h) => ({ apiId: h.apiId, qty: h.qty, cost: h.cost })))
	);
	let pCur = $state('');
	let pQty = $state<number | null>(null);
	let pCost = $state<number | null>(null);

	async function savePortfolio() {
		const res = await fetch('/api/portfolio', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ holdings: pHoldings })
		});
		if (res.ok) {
			port = await res.json();
			pHoldings = (port?.holdings ?? []).map((h) => ({ apiId: h.apiId, qty: h.qty, cost: h.cost }));
		}
	}
	function addHolding(e: SubmitEvent) {
		e.preventDefault();
		if (!pCur || pQty == null || !(pQty > 0)) return;
		pHoldings = [...pHoldings, { apiId: pCur, qty: pQty, cost: pCost && pCost > 0 ? pCost : undefined }];
		pCur = '';
		pQty = null;
		pCost = null;
		savePortfolio();
	}
	function removeHolding(apiId: string) {
		pHoldings = pHoldings.filter((h) => h.apiId !== apiId);
		savePortfolio();
	}

	// import from PoE's Ctrl+C clipboard text (the only sanctioned client-side export)
	const byName = $derived(new Map((data.markets ?? []).map((m) => [m.name.toLowerCase(), m.apiId])));
	let pPaste = $state('');
	let pPasteMsg = $state('');
	function importPaste() {
		const next = [...pHoldings];
		let added = 0;
		for (const block of pPaste.split(/(?=Item Class:)/i)) {
			const ri = block.search(/Rarity:/i);
			if (ri < 0) continue;
			const name = (block.slice(ri).split('\n')[1] || '').trim();
			const stack = block.match(/Stack Size:\s*([\d,]+)/i);
			const qty = stack ? Number(stack[1].replace(/,/g, '')) : 1;
			const apiId = byName.get(name.toLowerCase());
			if (!apiId || !(qty > 0)) continue;
			const ex = next.find((h) => h.apiId === apiId);
			if (ex) ex.qty = qty;
			else next.push({ apiId, qty });
			added++;
		}
		if (added) {
			pHoldings = next;
			pPaste = '';
			savePortfolio();
			pPasteMsg = `Imported ${added} position${added === 1 ? '' : 's'}.`;
		} else {
			pPasteMsg = 'No currency items found in the paste.';
		}
		setTimeout(() => (pPasteMsg = ''), 3000);
	}
	function lineSpark(vals: number[]): string {
		if (vals.length < 2) return '';
		const w = 240;
		const h = 40;
		const min = Math.min(...vals);
		const max = Math.max(...vals);
		const span = max - min || 1;
		return vals
			.map((v, i) => `${i ? 'L' : 'M'}${((i / (vals.length - 1)) * w).toFixed(1)} ${(h - ((v - min) / span) * h).toFixed(1)}`)
			.join(' ');
	}

	const pct = (x: number) => `${x >= 0 ? '+' : ''}${x.toFixed(1)}%`;
	const cls = (x: number) => (x > 0 ? 'pos' : x < 0 ? 'neg' : '');
	// relative-performance (spaghetti) chart — rendered by PerfChart via lightweight-charts
	const PERF_COLORS = ['#e0b465', '#56b6c2', '#d97aa6', '#66cf8a', '#e57170', '#8aa9c9', '#b08aff', '#d98fe0', '#f3d84a', '#5fd0a8', '#ef9f6a', '#7aa6ff', '#c8cdda', '#9fdfe8', '#f0b3d0', '#a0d995'];
	const perfLines = $derived(
		(data.market?.performance ?? []).map((l, i) => ({ ...l, color: PERF_COLORS[i % PERF_COLORS.length] }))
	);
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
			<a href="/crafts">Crafts</a>
			<a href="/analytics" aria-current="page" class="active">Analytics<span class="pro-pill">PRO</span></a>
		</nav>
		{#if data.premium}
			<span class="tb-spacer"></span>
			<LeagueSelect {leagues} value={league} onchange={selectLeague} />
		{/if}
	</header>

	<main class="scr-body" id="main">
		{#if !data.premium || !data.market || !data.smart || !data.me || !data.markets || !data.arb || !data.fair || !data.port}
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
			{@const arb = data.arb}
			{@const fair = data.fair}
			<div class="scr-meta">
				<span class="eyebrow">Analytics <span class="pro-pill">PRO</span></span>
				<span class="muted">{market.league} · live market + crowd intelligence</span>
			</div>

			<div class="quote-toggle an-tabs" role="group" aria-label="Analytics section">
				{#each TABS as t (t.id)}
					<button class:active={tab === t.id} onclick={() => (tab = t.id)} aria-pressed={tab === t.id}>{t.label}</button>
				{/each}
			</div>

			{#if tab === 'dashboard'}
				<div class="dash-head">
					<span class="muted">Your overview — pick what you watch</span>
					<button class="btn btn-ghost" onclick={() => (customizing = !customizing)}>{customizing ? 'Done' : '⚙ Customize'}</button>
				</div>
				{#if customizing}
					<div class="dash-customize">
						{#each WIDGETS as w (w.id)}
							<button class="dash-chip" class:on={dashboard.has(w.id)} onclick={() => dashboard.toggle(w.id)}>{dashboard.has(w.id) ? '✓' : '+'} {w.label}</button>
						{/each}
					</div>
				{/if}
				<div class="an-grid">
					{#if dashboard.has('standing')}
						<section class="an-card">
							<h3>Your performance</h3>
							{#if me.calls > 0}
								<ul class="an-list">
									<li><span>Settled calls</span><span class="mono">{me.calls}</span></li>
									<li><span>Direction</span><span class="mono {cls(me.hits / me.calls - 0.5)}">{Math.round((me.hits / me.calls) * 100)}%</span></li>
									<li><span>Accuracy</span><span class="mono">{Math.round(me.accAvg * 100)}%</span></li>
									<li><span>Omens</span><span class="mono">{compact(me.points)}</span></li>
									<li><span>Sim. P&amp;L</span><span class="mono {cls(me.pnl)}">{pct(me.pnl)}</span></li>
								</ul>
							{:else}<p class="muted">No settled calls yet.</p>{/if}
						</section>
					{/if}
					{#if dashboard.has('portfolio')}
						<section class="an-card">
							<h3>Portfolio</h3>
							{#if port && port.holdings.length}
								<ul class="an-list">
									<li><span>Total value</span><span class="mono">{fmt(port.total)} EX</span></li>
									<li><span>P&amp;L</span><span class="mono {cls(port.pnl)}">{fmt(port.pnl)} EX</span></li>
									<li><span>Positions</span><span class="mono">{port.holdings.length}</span></li>
								</ul>
							{:else}<p class="muted">No holdings yet — add some on the Portfolio tab.</p>{/if}
						</section>
					{/if}
					{#if dashboard.has('signal')}
						<section class="an-card">
							<h3>Top signal</h3>
							{#if smart.signals.length}
								<ul class="an-list">
									{#each smart.signals.slice(0, 5) as s (s.apiId + s.horizon)}
										<li><a href="/?c={s.apiId}">{s.name}</a><span class="muted">{hzLabel(s.horizon)}</span><span class="mono {cls(s.edgePct)}">{pct(s.edgePct)}</span></li>
									{/each}
								</ul>
							{:else}<p class="muted">No signals yet.</p>{/if}
						</section>
					{/if}
					{#if dashboard.has('fair')}
						<section class="an-card">
							<h3>Fair-value flags</h3>
							<ul class="an-list">
								{#each fair.rows.slice(0, 5) as r (r.apiId)}
									<li><a href="/?c={r.apiId}">{r.name}</a><span class="mono {cls(r.deviationPct)}">{pct(r.deviationPct)}</span></li>
								{/each}
							</ul>
						</section>
					{/if}
					{#if dashboard.has('breadth')}
						<section class="an-card">
							<h3>Market breadth</h3>
							<div class="breadth-bar"><span class="b-up" style="flex:{market.breadth.up}"></span><span class="b-flat" style="flex:{market.breadth.flat}"></span><span class="b-down" style="flex:{market.breadth.down}"></span></div>
							<p class="muted">{market.breadth.pct}% advancing</p>
						</section>
					{/if}
					{#if dashboard.has('movers')}
						<section class="an-card">
							<h3>Biggest movers</h3>
							<ul class="an-list">
								{#each market.movers.slice(0, 6) as mv (mv.apiId)}
									<li><a href="/?c={mv.apiId}">{mv.name}</a><span class="mono {cls(mv.changePct)}">{pct(mv.changePct)}</span></li>
								{/each}
							</ul>
						</section>
					{/if}
				</div>
				{#if !dashboard.enabled.length}
					<p class="muted">No widgets selected — hit Customize to add some.</p>
				{/if}
			{:else if tab === 'market'}
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
					<h3>Relative performance <span class="muted">— top 16 by volume, log-scaled %, full history</span></h3>
					<PerfChart lines={perfLines} />
					<p class="muted">Log-scaled % rebased to each currency's earliest point, so big and small movers share one readable axis. Hover for that day's values; click a name to open it.</p>
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
			{:else if tab === 'ai'}
				<section class="an-card wide">
					<div class="ai-head">
						<h3>AI Analyst <span class="muted">— grounded in Signal + fair value + market</span></h3>
						<button class="btn btn-ghost" onclick={loadAi} disabled={aiBusy}>{aiBusy ? 'Thinking…' : ai ? 'Refresh' : 'Generate briefing'}</button>
					</div>
					{#if ai && ai.configured && ai.recommendations.length}
						<ul class="an-list ai-list">
							{#each ai.recommendations as r, i (i)}
								<li class="ai-rec">
									<div class="ai-row">
										<span class="ai-action {r.action}">{r.action}</span>
										{#if r.apiId}<a href="/?c={r.apiId}">{r.item}</a>{:else}<b>{r.item}</b>{/if}
										{#if r.target}<span class="muted">target {fmt(r.target)}</span>{/if}
										<span class="muted">· {r.horizon} · {Math.round(r.confidence * 100)}% conf</span>
									</div>
									<p class="ai-why">{r.rationale}</p>
								</li>
							{/each}
						</ul>
						<p class="muted">AI analysis of a game economy for entertainment — not financial advice. Updated {new Date(ai.updatedAt).toLocaleString()}.</p>
					{:else if ai && !ai.configured}
						<p class="muted">{ai.note}</p>
					{:else if ai}
						<p class="muted">{ai.note ?? 'No recommendations yet.'}</p>
					{:else}
						<p class="muted">Generate a data-grounded briefing — buy/sell/hold calls with rationale, built from the Signal, fair-value mispricings, and market breadth.</p>
					{/if}
				</section>
			{:else if tab === 'fair'}
				<section class="an-card wide">
					<h3>Divindex Fair Value <span class="muted">— biggest mispricings vs liquidity-weighted fair</span></h3>
					{#if fair.rows.length}
						<div class="scr-table-wrap">
							<table class="scr-table">
								<thead><tr><th>Market</th><th class="num">Price</th><th class="num">Fair</th><th class="num">Deviation</th><th class="num hide-sm">Confidence</th></tr></thead>
								<tbody>
									{#each fair.rows.slice(0, 40) as r (r.apiId)}
										<tr>
											<td><a href="/?c={r.apiId}">{r.name}</a></td>
											<td class="num mono">{fmt(r.price)}</td>
											<td class="num mono">{fmt(r.fair)}</td>
											<td class="num mono {cls(r.deviationPct)}">{pct(r.deviationPct)}</td>
											<td class="num mono hide-sm">{Math.round(r.confidence * 100)}%</td>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
						<p class="muted">Deviation = how far the last tick sits from the liquidity-weighted fair value (positive = trading rich, negative = cheap). Confidence blends low dispersion with traded volume.</p>
					{:else}
						<p class="muted">Not enough history yet.</p>
					{/if}
				</section>
			{:else if tab === 'arb'}
				<section class="an-card wide">
					<h3>Shard arbitrage <span class="muted">— {arb.shardsPerOrb} shards = 1 orb</span></h3>
					{#if arb.shards.length}
						<div class="scr-table-wrap">
							<table class="scr-table">
								<thead><tr><th>Orb</th><th class="num">10× shard</th><th class="num">Orb price</th><th class="num">Edge</th></tr></thead>
								<tbody>
									{#each arb.shards as a (a.shardApiId)}
										<tr>
											<td><a href="/?c={a.orbApiId}">{a.orbName}</a> <span class="muted">({a.shardName})</span></td>
											<td class="num mono">{fmt(a.shardPrice * arb.shardsPerOrb)}</td>
											<td class="num mono">{fmt(a.orbPrice)}</td>
											<td class="num mono {cls(a.edgePct)}">{pct(a.edgePct)}</td>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
						<p class="muted">Positive edge = the orb sells for more than {arb.shardsPerOrb} of its shards — buy shards, combine, sell the orb. Prices in Exalted.</p>
					{:else}
						<p class="muted">No shard↔orb pairs found in the current market data.</p>
					{/if}
				</section>
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
			{:else if tab === 'port'}
				<section class="an-card wide">
					<h3>Portfolio</h3>
					<form class="alert-form" onsubmit={addHolding}>
						<select class="field" bind:value={pCur} aria-label="Currency">
							<option value="" disabled>Currency…</option>
							{#each markets as m (m.apiId)}<option value={m.apiId}>{m.name}</option>{/each}
						</select>
						<input class="field" type="number" step="any" min="0" placeholder="Qty" bind:value={pQty} aria-label="Quantity" />
						<input class="field" type="number" step="any" min="0" placeholder="Avg cost EX (optional)" bind:value={pCost} aria-label="Average cost" />
						<button class="btn btn-primary" type="submit">Add holding</button>
					</form>
					<details class="port-import">
						<summary>Import from game (paste)</summary>
						<p class="muted">In PoE2, hover a currency stack and press <b>Ctrl+C</b>, then paste here (one or more items) — we read the name + stack size. No mod or memory-reading needed; one-click stash sync arrives when GGG exposes the PoE2 stash API.</p>
						<textarea class="field port-paste" rows="4" placeholder="Paste copied item text…" bind:value={pPaste}></textarea>
						<div class="port-import-row">
							<button class="btn btn-primary" onclick={importPaste} disabled={!pPaste.trim()}>Import</button>
							{#if pPasteMsg}<span class="muted">{pPasteMsg}</span>{/if}
						</div>
					</details>
					{#if port && port.holdings.length}
						<div class="prof-stats">
							<div><span class="st-label">Total value</span><b class="mono">{fmt(port.total)} EX</b></div>
							<div><span class="st-label">P&amp;L</span><b class="mono {cls(port.pnl)}">{fmt(port.pnl)} EX</b></div>
							<div><span class="st-label">Positions</span><b class="mono">{port.holdings.length}</b></div>
						</div>
						{#if lineSpark(port.equity.map((e) => e.value))}
							<svg class="equity" viewBox="0 0 240 40" preserveAspectRatio="none" aria-hidden="true"><path d={lineSpark(port.equity.map((e) => e.value))} class={port.pnl >= 0 ? 'sp-up' : 'sp-down'} /></svg>
						{/if}
						<div class="scr-table-wrap">
							<table class="scr-table">
								<thead><tr><th>Market</th><th class="num">Qty</th><th class="num">Price</th><th class="num">Value</th><th class="num hide-sm">P&amp;L</th><th></th></tr></thead>
								<tbody>
									{#each port.holdings as h (h.apiId)}
										<tr>
											<td><a href="/?c={h.apiId}">{h.name}</a></td>
											<td class="num mono">{h.qty}</td>
											<td class="num mono">{fmt(h.price)}</td>
											<td class="num mono">{fmt(h.value)}</td>
											<td class="num mono hide-sm {h.pnl != null ? cls(h.pnl) : ''}">{h.pnlPct != null ? pct(h.pnlPct) : '—'}</td>
											<td><button class="share-btn" onclick={() => removeHolding(h.apiId)} aria-label="Remove">×</button></td>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
					{:else}
						<p class="muted">Add your currency holdings above to track total value, P&amp;L, and your bag's value over the league.</p>
					{/if}
				</section>
			{:else}
				<section class="an-card wide">
					<h3>Price alerts</h3>
					<form class="alert-form" onsubmit={createAlert}>
						<select class="field" bind:value={aCur} aria-label="Currency">
							<option value="" disabled>Currency…</option>
							{#each markets as m (m.apiId)}<option value={m.apiId}>{m.name}</option>{/each}
						</select>
						<select class="field" bind:value={aKind} aria-label="Alert kind">
							<option value="price">price</option>
							<option value="fairdev">fair-value %</option>
						</select>
						<select class="field" bind:value={aDir} aria-label="Direction">
							<option value="above">{aKind === 'fairdev' ? 'rich by ≥' : 'rises above'}</option>
							<option value="below">{aKind === 'fairdev' ? 'cheap by ≥' : 'falls below'}</option>
						</select>
						<input class="field" type="number" step="0.0001" min="0" placeholder={aKind === 'fairdev' ? 'Deviation %' : 'Price (Exalted)'} bind:value={aPrice} aria-label="Threshold" />
						<input class="field" type="url" placeholder="Discord webhook (optional)" bind:value={aHook} aria-label="Discord webhook" />
						<button class="btn btn-primary" type="submit" disabled={aBusy}>Add alert</button>
						<span class="form-msg" role="status" aria-live="polite">{aMsg}</span>
					</form>
					{#if alerts.length}
						<ul class="an-list alert-list">
							{#each alerts as a (a.id)}
								<li>
									<span><a href="/?c={a.apiId}">{a.name}</a> {a.dir} <b class="mono">{a.price}</b>{a.kind === 'fairdev' ? '% vs fair' : ' EX'}</span>
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
