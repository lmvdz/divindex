<script lang="ts">
	import '../app.css';
	import Nav from '$lib/components/Nav.svelte';
	import Footer from '$lib/components/Footer.svelte';

	let { children } = $props();
</script>

<a class="skip-link" href="#main">Skip to content</a>
<div class="noise" aria-hidden="true"></div>
<Nav />
{@render children()}
<Footer />
