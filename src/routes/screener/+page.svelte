<script lang="ts">
	import { goto } from '$app/navigation';
	import { fmt, compact, signStr, signClass, ticker } from '$lib/format';
	import {
		convertMarket,
		divineRate,
		effectiveQuote,
		QUOTE_LABEL,
		QUOTE_SHORT,
		type Quote
	} from '$lib/convert';
	import ItemIcon from '$lib/components/ItemIcon.svelte';
	import PriceChart from '$lib/components/PriceChart.svelte';
	import { showTip, moveTip, hideTip } from '$lib/tooltip.svelte';
	import type { Currency } from '$lib/types';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	let quote = $state<Quote>('exalted');
	const market = $derived(convertMarket(data.market, quote));
	const QUOTES: Quote[] = ['exalted', 'divine'];

	// raw (Exalted) lookups for the inline chart, which converts itself
	const rawById = $derived(new Map(data.market.currencies.map((c) => [c.id, c])));
	const divineId = $derived(data.market.currencies.find((c) => c.apiId === 'divine')?.id ?? 0);
	const dRate = $derived(divineRate(data.market));

	type SortKey = 'name' | 'price' | 'change1dPct' | 'changePct' | 'high' | 'low' | 'volume';
	let sortKey = $state<SortKey>('price');
	let dir = $state<1 | -1>(-1);
	let q = $state('');
	let cat = $state('all');
	let expandedId = $state<number | null>(null);

	const cats = $derived(['all', ...data.market.categories]);

	const rows = $derived.by(() => {
		const term = q.trim().toLowerCase();
		const list = market.currencies.filter((c) => {
			if (cat !== 'all' && c.category !== cat) return false;
			if (!term) return true;
			return c.name.toLowerCase().includes(term) || ticker(c.apiId).toLowerCase().includes(term);
		});
		list.sort((a, b) => {
			const av = a[sortKey];
			const bv = b[sortKey];
			if (typeof av === 'string' || typeof bv === 'string') {
				return String(av).localeCompare(String(bv)) * dir;
			}
			return ((av as number) - (bv as number)) * dir;
		});
		return list;
	});

	function setSort(k: SortKey) {
		if (sortKey === k) dir = dir === 1 ? -1 : 1;
		else {
			sortKey = k;
			dir = k === 'name' ? 1 : -1;
		}
	}

	function open(c: Currency) {
		hideTip();
		goto(`/?c=${c.apiId}`);
	}
	function toggle(id: number) {
		expandedId = expandedId === id ? null : id;
		hideTip();
	}
	function fxFor(apiId: string): number {
		return effectiveQuote(apiId, quote) === 'exalted' ? 1 : dRate;
	}

	function spark(c: Currency): string {
		const pts = c.series;
		if (pts.length < 2) return '';
		const w = 80;
		const h = 24;
		const ps = pts.map((p) => p.p);
		const min = Math.min(...ps);
		const max = Math.max(...ps);
		const span = max - min || 1;
		return pts
			.map((p, i) => {
				const x = (i / (pts.length - 1)) * w;
				const y = h - ((p.p - min) / span) * h;
				return `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`;
			})
			.join(' ');
	}
	const arrow = (k: SortKey) => (sortKey === k ? (dir === 1 ? '▲' : '▼') : '');
</script>

<svelte:head>
	<title>Screener — Divindex</title>
</svelte:head>

<div class="scr">
	<header class="scr-top">
		<a class="brand" href="/" aria-label="Divindex home">
			<span class="orb" aria-hidden="true"></span>
			<span class="brand-word">Divindex</span>
		</a>
		<nav class="tb-nav">
			<a href="/">Terminal</a>
			<a href="/screener" aria-current="page" class="active">Screener</a>
		</nav>
		<span class="tb-spacer"></span>
		<div class="quote-toggle" role="group" aria-label="Quote currency">
			<span class="qt-label">Quote</span>
			{#each QUOTES as qq (qq)}
				<button class:active={quote === qq} onclick={() => (quote = qq)} aria-pressed={quote === qq}>
					{QUOTE_SHORT[qq]}
				</button>
			{/each}
		</div>
		<label class="sr-only" for="scr-cat">Category</label>
		<select id="scr-cat" class="field scr-cat" bind:value={cat}>
			{#each cats as c (c)}
				<option value={c}>{c === 'all' ? 'All categories' : c}</option>
			{/each}
		</select>
		<input class="field scr-search" type="search" placeholder="Search currency…" bind:value={q}
			aria-label="Search currency" />
	</header>

	<main class="scr-body" id="main">
		<div class="scr-meta">
			<span class="eyebrow">Currency screener</span>
			<span class="muted">{rows.length} of {market.currencies.length} · {market.league} · priced in {QUOTE_LABEL[quote]} (Exalt &amp; Divine quote in each other)</span>
		</div>

		<div class="scr-table-wrap">
			<table class="scr-table">
				<thead>
					<tr>
						<th class="chev-col"></th>
						<th class="num">#</th>
						<th><button onclick={() => setSort('name')}>Market {arrow('name')}</button></th>
						<th class="hide-sm">Type</th>
						<th class="num"><button onclick={() => setSort('price')}>Price {arrow('price')}</button></th>
						<th class="num"><button onclick={() => setSort('change1dPct')}>24h {arrow('change1dPct')}</button></th>
						<th class="num"><button onclick={() => setSort('changePct')}>7d {arrow('changePct')}</button></th>
						<th class="num hide-sm"><button onclick={() => setSort('high')}>High {arrow('high')}</button></th>
						<th class="num hide-sm"><button onclick={() => setSort('low')}>Low {arrow('low')}</button></th>
						<th class="num hide-sm"><button onclick={() => setSort('volume')}>Vol {arrow('volume')}</button></th>
						<th class="hide-sm">7d</th>
					</tr>
				</thead>
				<tbody>
					{#each rows as c, i (c.id)}
						<tr
							class="scr-row"
							class:expanded={expandedId === c.id}
							role="button"
							tabindex="0"
							onclick={() => open(c)}
							onkeydown={(e) => {
								if (e.key === 'Enter' || e.key === ' ') {
									e.preventDefault();
									open(c);
								}
							}}
							onmouseenter={(e) =>
								showTip(c, e.clientX, e.clientY, QUOTE_SHORT[effectiveQuote(c.apiId, quote)])}
							onmousemove={(e) => moveTip(e.clientX, e.clientY)}
							onmouseleave={hideTip}
						>
							<td class="chev-col">
								<button
									class="chev"
									class:open={expandedId === c.id}
									aria-label="Toggle inline chart"
									aria-expanded={expandedId === c.id}
									onclick={(e) => {
										e.stopPropagation();
										toggle(c.id);
									}}
								>
									<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
										<path d="M6 9l6 6 6-6" stroke-linecap="round" stroke-linejoin="round" />
									</svg>
								</button>
							</td>
							<td class="num idx">{i + 1}</td>
							<td>
								<span class="scr-name">
									<ItemIcon apiId={c.apiId} icon={c.icon} size={22} chip="sym" />
									<span class="nm">{c.name}</span>
								</span>
							</td>
							<td class="hide-sm"><span class="cat-tag">{c.category}</span></td>
							<td class="num pr">{fmt(c.price)}{#if effectiveQuote(c.apiId, quote) !== quote}<small
										class="unit">{QUOTE_SHORT[effectiveQuote(c.apiId, quote)]}</small
									>{/if}</td>
							<td class="num cell {signClass(c.change1dPct)}">{signStr(c.change1dPct)}</td>
							<td class="num cell {signClass(c.changePct)}">{signStr(c.changePct)}</td>
							<td class="num hide-sm">{fmt(c.high)}</td>
							<td class="num hide-sm">{fmt(c.low)}</td>
							<td class="num hide-sm">{compact(c.volume)}</td>
							<td class="hide-sm">
								{#if spark(c)}
									<svg class="spark" viewBox="0 0 80 24" preserveAspectRatio="none" aria-hidden="true">
										<path d={spark(c)} class={c.changePct >= 0 ? 'sp-up' : 'sp-down'} />
									</svg>
								{/if}
							</td>
						</tr>
						{#if expandedId === c.id}
							{@const raw = rawById.get(c.id) ?? c}
							<tr class="expand-row">
								<td colspan="11">
									<div class="expand-chart">
										<PriceChart
											currency={raw}
											{quote}
											{divineId}
											fxRate={fxFor(raw.apiId)}
											forecast={null}
											activeHorizon="day"
										/>
									</div>
								</td>
							</tr>
						{/if}
					{:else}
						<tr><td colspan="11" class="scr-empty">No currency matches “{q}”.</td></tr>
					{/each}
				</tbody>
			</table>
		</div>
	</main>

	<footer class="scr-foot">
		Data via poe2scout · Divindex is not affiliated with or endorsed by Grinding Gear Games.
	</footer>
</div>
