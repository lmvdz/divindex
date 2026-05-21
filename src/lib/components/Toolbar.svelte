<script lang="ts">
	import { timeOf } from '$lib/format';

	let {
		league,
		fetchedAt,
		onrefresh,
		busy
	}: { league: string; fetchedAt: number; onrefresh: () => void; busy: boolean } = $props();
</script>

<header class="toolbar">
	<a class="brand" href="/" aria-label="Divindex home">
		<span class="orb" aria-hidden="true"></span>
		<span class="brand-word">Divindex</span>
	</a>
	<nav class="tb-nav">
		<a href="/" aria-current="page" class="active">Terminal</a>
		<a href="/forecast">Forecast</a>
	</nav>
	<span class="lg-chip" title="Active league">{league}</span>
	<span class="tb-spacer"></span>
	<span class="tb-updated mono">Updated {timeOf(fetchedAt)}</span>
	<button class="btn btn-ghost" onclick={onrefresh} disabled={busy} aria-label="Refresh market data">
		{busy ? 'Refreshing…' : 'Refresh'}
	</button>
</header>
