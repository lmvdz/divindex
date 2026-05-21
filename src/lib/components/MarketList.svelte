<script lang="ts">
	import type { Currency } from '$lib/types';
	import { fmt, signStr, signClass, ticker } from '$lib/format';

	let {
		currencies,
		selectedId,
		onselect
	}: { currencies: Currency[]; selectedId: number; onselect: (id: number) => void } = $props();

	let q = $state('');
	let sort = $state<'price' | 'name' | 'change'>('price');

	const filtered = $derived.by(() => {
		const term = q.trim().toLowerCase();
		const list = term
			? currencies.filter(
					(c) =>
						c.name.toLowerCase().includes(term) || ticker(c.apiId).toLowerCase().includes(term)
				)
			: [...currencies];
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
				>
					<span class="sym">{ticker(c.apiId)}</span>
					<span class="nm">{c.name}</span>
					<span class="pr">{fmt(c.price)}</span>
					<span class="ch {signClass(c.change1dPct)}">{signStr(c.change1dPct)}</span>
				</button>
			</li>
		{:else}
			<li class="market-empty">No currency matches “{q}”.</li>
		{/each}
	</ul>
</aside>
