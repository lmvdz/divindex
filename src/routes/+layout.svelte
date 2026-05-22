<script lang="ts">
	import '../app.css';
	import ItemTooltip from '$lib/components/ItemTooltip.svelte';

	let { children } = $props();
</script>

<a class="skip-link" href="#main">Skip to content</a>
<div class="noise" aria-hidden="true"></div>
{@render children()}
<ItemTooltip />
