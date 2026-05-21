<script lang="ts">
	let { source, league, asOf }: { source: string; league: string; asOf: string } = $props();
</script>

<footer class="statusbar">
	<span>PoE2 Currency Exchange · {source}</span>
	<span class="sb-dot">·</span>
	<span>{league}</span>
	<span class="sb-dot">·</span>
	<span class="mono">as of {asOf}</span>
	<span class="sb-spacer"></span>
	<span class="sb-legal">Not affiliated with or endorsed by Grinding Gear Games.</span>
</footer>
