<script lang="ts">
	import { fmt, compact, signStr, signClass, ticker } from '$lib/format';
	import {
		convertMarket,
		effectiveQuote,
		QUOTE_LABEL,
		QUOTE_SHORT,
		type Quote
	} from '$lib/convert';
	import type { Currency } from '$lib/types';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	let quote = $state<Quote>('exalted');
	const market = $derived(convertMarket(data.market, quote));
	const QUOTES: Quote[] = ['exalted', 'divine'];

	type SortKey = 'name' | 'price' | 'change1dPct' | 'changePct' | 'high' | 'low' | 'volume';
	let sortKey = $state<SortKey>('price');
	let dir = $state<1 | -1>(-1);
	let q = $state('');

	const rows = $derived.by(() => {
		const term = q.trim().toLowerCase();
		const list = term
			? market.currencies.filter(
					(c) =>
						c.name.toLowerCase().includes(term) || ticker(c.apiId).toLowerCase().includes(term)
				)
			: [...market.currencies];
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
						<th class="num">#</th>
						<th><button onclick={() => setSort('name')}>Market {arrow('name')}</button></th>
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
						<tr>
							<td class="num idx">{i + 1}</td>
							<td>
								<a class="scr-name" href={`/?c=${c.apiId}`}>
									<span class="sym">{ticker(c.apiId)}</span>
									<span class="nm">{c.name}</span>
								</a>
							</td>
							<td class="num pr">{fmt(c.price)}{#if effectiveQuote(c.apiId, quote) !== quote}<small
										class="unit">{QUOTE_SHORT[effectiveQuote(c.apiId, quote)]}</small
									>{/if}</td>
							<td class="num {signClass(c.change1dPct)}">{signStr(c.change1dPct)}</td>
							<td class="num {signClass(c.changePct)}">{signStr(c.changePct)}</td>
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
					{:else}
						<tr><td colspan="9" class="scr-empty">No currency matches “{q}”.</td></tr>
					{/each}
				</tbody>
			</table>
		</div>
	</main>

	<footer class="scr-foot">
		Data via poe2scout · Divindex is not affiliated with or endorsed by Grinding Gear Games.
	</footer>
</div>
