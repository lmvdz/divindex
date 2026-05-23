<script lang="ts">
	import type { League } from '$lib/types';

	let {
		leagues,
		value,
		onchange
	}: {
		leagues: League[];
		value: string;
		onchange: (league: string) => void;
	} = $props();
</script>

<label class="sr-only" for="lg-select">League</label>
<select
	id="lg-select"
	class="field lg-select"
	{value}
	onchange={(e) => onchange((e.currentTarget as HTMLSelectElement).value)}
	title="Browse another league (read-only outside the live league)"
>
	{#each leagues as l (l.value)}
		<option value={l.value}>{l.value}{l.isCurrent ? ' • live' : ''}</option>
	{/each}
</select>
