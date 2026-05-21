<script lang="ts">
	import { fmt, signStr, signClass } from '$lib/format';
	import type { TickerRow } from '$lib/types';

	let { rows }: { rows: TickerRow[] } = $props();
</script>

<ul class="ticker" aria-label="Currency snapshot">
	{#each rows as r (r.api)}
		<li>
			<span class="tk-name">{r.text}</span>
			<span>
				<span class="tk-price">{fmt(r.price)}</span>
				<span class="tk-chg {signClass(r.wkChange)}">{signStr(r.wkChange)}</span>
			</span>
		</li>
	{/each}
</ul>
