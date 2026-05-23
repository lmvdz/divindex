<script lang="ts">
	// Single source of truth for the primary nav so links/ordering never drift
	// across the terminal toolbar and the standalone page headers.
	let { current = '' }: { current?: string } = $props();

	const LINKS = [
		{ href: '/', label: 'Terminal' },
		{ href: '/screener', label: 'Screener' },
		{ href: '/ladder', label: 'Ladder' },
		{ href: '/me', label: 'My calls' },
		{ href: '/signal', label: 'Signal' },
		{ href: '/crafts', label: 'Crafts' },
		{ href: '/analytics', label: 'Analytics', pro: true }
	];
</script>

<nav class="tb-nav">
	{#each LINKS as l (l.href)}
		<a
			href={l.href}
			class:active={current === l.href}
			aria-current={current === l.href ? 'page' : undefined}
		>
			{l.label}{#if l.pro}<span class="pro-pill">PRO</span>{/if}
		</a>
	{/each}
</nav>
