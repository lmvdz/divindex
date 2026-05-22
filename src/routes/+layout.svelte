<script lang="ts">
	import '../app.css';
	import { beforeNavigate } from '$app/navigation';
	import ItemTooltip from '$lib/components/ItemTooltip.svelte';
	import { hideTip } from '$lib/tooltip.svelte';

	let { children } = $props();

	// the tooltip lives outside the page, so clear it whenever we route
	beforeNavigate(() => hideTip());
</script>

<a class="skip-link" href="#main">Skip to content</a>
<div class="noise" aria-hidden="true"></div>
{@render children()}
<ItemTooltip />
