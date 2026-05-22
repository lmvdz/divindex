<script lang="ts">
	import { compact } from '$lib/format';
	import type { Economy } from '$lib/types';

	let {
		source,
		league,
		asOf,
		economy
	}: { source: string; league: string; asOf: string; economy: Economy | null } = $props();
</script>

<footer class="statusbar">
	<span>PoE2 Currency Exchange · {source}</span>
	<span class="sb-dot">·</span>
	<span>{league}</span>
	{#if economy}
		<span class="sb-dot">·</span>
		<span class="mono">Mkt cap {compact(economy.marketCap)} ex</span>
		<span class="sb-dot">·</span>
		<span class="mono">Vol {compact(economy.volume)} ex</span>
	{/if}
	<span class="sb-spacer"></span>
	<span class="mono">as of {asOf}</span>
	<span class="sb-dot">·</span>
	<span class="sb-legal">Not affiliated with or endorsed by Grinding Gear Games.</span>
</footer>
