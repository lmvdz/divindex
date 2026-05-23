<script lang="ts">
	import type { Currency } from '$lib/types';
	import { fmt, signStr, signClass, ticker } from '$lib/format';
	import { effectiveQuote, QUOTE_SHORT, type Quote } from '$lib/convert';
	import ItemIcon from '$lib/components/ItemIcon.svelte';
	import { showTip, moveTip, hideTip } from '$lib/tooltip.svelte';
	import { watchlist } from '$lib/watchlist.svelte';
	import { categoryLabel } from '$lib/categories';

	let {
		currencies,
		selectedId,
		quote,
		onselect
	}: {
		currencies: Currency[];
		selectedId: number;
		quote: Quote;
		onselect: (id: number) => void;
	} = $props();

	let q = $state('');
	let sort = $state<'price' | 'name' | 'change'>('price');
	let favOnly = $state(false);

	// category multi-select autocomplete combobox
	let selectedCats = $state<string[]>([]);
	let comboOpen = $state(false);
	let comboQuery = $state('');
	let comboEl = $state<HTMLDivElement>();
	const allCats = $derived(
		[...new Set(currencies.map((c) => c.category))].sort((a, b) => categoryLabel(a).localeCompare(categoryLabel(b)))
	);
	const catOptions = $derived(
		allCats.filter((c) => categoryLabel(c).toLowerCase().includes(comboQuery.trim().toLowerCase()))
	);
	function toggleCat(c: string) {
		selectedCats = selectedCats.includes(c) ? selectedCats.filter((x) => x !== c) : [...selectedCats, c];
	}
	$effect(() => {
		if (!comboOpen) return;
		const onDoc = (e: PointerEvent) => {
			if (comboEl && !comboEl.contains(e.target as Node)) comboOpen = false;
		};
		document.addEventListener('pointerdown', onDoc);
		return () => document.removeEventListener('pointerdown', onDoc);
	});

	const filtered = $derived.by(() => {
		const term = q.trim().toLowerCase();
		const list = currencies.filter((c) => {
			if (favOnly && !watchlist.has(c.apiId)) return false;
			if (selectedCats.length && !selectedCats.includes(c.category)) return false;
			if (!term) return true;
			return c.name.toLowerCase().includes(term) || ticker(c.apiId).toLowerCase().includes(term);
		});
		if (sort === 'name') list.sort((a, b) => a.name.localeCompare(b.name));
		else if (sort === 'change') list.sort((a, b) => b.change1dPct - a.change1dPct);
		else list.sort((a, b) => b.price - a.price);
		return list;
	});

	function onKey(e: KeyboardEvent) {
		if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
		e.preventDefault();
		const list = filtered;
		const idx = list.findIndex((c) => c.id === selectedId);
		const next =
			e.key === 'ArrowDown' ? Math.min(list.length - 1, idx + 1) : Math.max(0, idx - 1);
		if (list[next]) onselect(list[next].id);
	}
</script>

<aside class="panel market" aria-label="Market list">
	<div class="market-search">
		<input
			class="field"
			type="search"
			placeholder="Search currency…"
			bind:value={q}
			aria-label="Search currency"
		/>
		<span class="market-count">{filtered.length}</span>
	</div>
	<div class="market-cat">
		<div class="combo" bind:this={comboEl}>
			<button
				class="field combo-trigger"
				onclick={() => (comboOpen = !comboOpen)}
				aria-expanded={comboOpen}
				aria-label="Filter categories"
			>
				{#if selectedCats.length === 0}
					<span class="combo-ph">All categories</span>
				{:else}
					<span class="combo-chips">
						{#each selectedCats as c (c)}<span class="chip">{categoryLabel(c)}</span>{/each}
					</span>
				{/if}
				<span class="combo-caret">▾</span>
			</button>
			{#if comboOpen}
				<div class="combo-panel">
					<input
						class="field combo-search"
						type="search"
						placeholder="Filter categories…"
						bind:value={comboQuery}
						aria-label="Filter categories"
					/>
					<ul class="combo-list">
						{#each catOptions as c (c)}
							<li>
								<button class="combo-opt" class:on={selectedCats.includes(c)} onclick={() => toggleCat(c)}>
									<span class="combo-check">{selectedCats.includes(c) ? '✓' : ''}</span>{categoryLabel(c)}
								</button>
							</li>
						{:else}
							<li class="combo-empty">No match</li>
						{/each}
						{#if selectedCats.length}
							<li><button class="combo-opt combo-clear" onclick={() => (selectedCats = [])}>Clear selection</button></li>
						{/if}
					</ul>
				</div>
			{/if}
		</div>
		<button
			class="fav-filter"
			class:active={favOnly}
			onclick={() => (favOnly = !favOnly)}
			aria-pressed={favOnly}
			title="Show watchlist only"
		>
			{favOnly ? '★' : '☆'} {watchlist.count}
		</button>
	</div>
	<div class="market-head">
		<button class="mh" class:active={sort === 'name'} onclick={() => (sort = 'name')}>Market</button>
		<button class="mh num" class:active={sort === 'price'} onclick={() => (sort = 'price')}>Price</button>
		<button class="mh num" class:active={sort === 'change'} onclick={() => (sort = 'change')}>24h</button>
	</div>
	<ul class="market-rows" role="listbox" tabindex="0" aria-label="Currencies" onkeydown={onKey}>
		{#each filtered as c (c.id)}
			<li>
				<button
					class="row"
					class:sel={c.id === selectedId}
					role="option"
					aria-selected={c.id === selectedId}
					onclick={() => onselect(c.id)}
					onmouseenter={(e) =>
						showTip(c, e.clientX, e.clientY, QUOTE_SHORT[effectiveQuote(c.apiId, quote)])}
					onmousemove={(e) => moveTip(e.clientX, e.clientY)}
					onmouseleave={hideTip}
				>
					<ItemIcon apiId={c.apiId} icon={c.icon} size={22} chip="sym" />
					<span class="nm">{c.name}</span>
					<span class="pr">
						{fmt(c.price)}{#if effectiveQuote(c.apiId, quote) !== quote}<small class="unit"
								>{QUOTE_SHORT[effectiveQuote(c.apiId, quote)]}</small
							>{/if}
					</span>
					<span class="ch {signClass(c.change1dPct)}">{signStr(c.change1dPct)}</span>
				</button>
			</li>
		{:else}
			<li class="market-empty">No currency matches “{q}”.</li>
		{/each}
	</ul>
</aside>
