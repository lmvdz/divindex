<script lang="ts">
	import { timeOf } from '$lib/format';
	import { QUOTE_SHORT, type Quote } from '$lib/convert';

	let {
		league,
		fetchedAt,
		quote,
		onquote,
		onrefresh,
		busy
	}: {
		league: string;
		fetchedAt: number;
		quote: Quote;
		onquote: (q: Quote) => void;
		onrefresh: () => void;
		busy: boolean;
	} = $props();

	const QUOTES: Quote[] = ['exalted', 'divine'];
</script>

<header class="toolbar">
	<a class="brand" href="/" aria-label="Divindex home">
		<span class="orb" aria-hidden="true"></span>
		<span class="brand-word">Divindex</span>
	</a>
	<nav class="tb-nav">
		<a href="/" aria-current="page" class="active">Terminal</a>
		<a href="/screener">Screener</a>
	</nav>
	<span class="lg-chip" title="Active league">{league}</span>
	<span class="tb-spacer"></span>
	<div class="quote-toggle" role="group" aria-label="Quote currency">
		<span class="qt-label">Quote</span>
		{#each QUOTES as q (q)}
			<button class:active={quote === q} onclick={() => onquote(q)} aria-pressed={quote === q}>
				{QUOTE_SHORT[q]}
			</button>
		{/each}
	</div>
	<span class="tb-updated mono">Updated {timeOf(fetchedAt)}</span>
	<button class="btn btn-ghost" onclick={onrefresh} disabled={busy} aria-label="Refresh market data">
		{busy ? 'Refreshing…' : 'Refresh'}
	</button>
</header>
