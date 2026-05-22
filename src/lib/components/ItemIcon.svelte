<script lang="ts">
	import { ticker } from '$lib/format';

	let {
		apiId,
		icon,
		size = 22,
		chip = 'sym'
	}: { apiId: string; icon: string; size?: number; chip?: string } = $props();

	let failed = $state(false);
	// reset the error state when the icon source changes (e.g. switching currency)
	$effect(() => {
		icon;
		failed = false;
	});
</script>

{#if icon && !failed}
	<img
		class="item-icon"
		src={icon}
		alt=""
		style="width:{size}px;height:{size}px"
		loading="lazy"
		onerror={() => (failed = true)}
	/>
{:else}
	<span class={chip}>{ticker(apiId)}</span>
{/if}
