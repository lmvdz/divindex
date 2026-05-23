<script lang="ts">
	import { signIn, signOut } from '@auth/sveltekit/client';
	import { timeOf } from '$lib/format';
	import { QUOTE_SHORT, type Quote } from '$lib/convert';
	import LeagueSelect from '$lib/components/LeagueSelect.svelte';
	import type { League } from '$lib/types';

	let {
		league,
		leagues,
		onleague,
		fetchedAt,
		quote,
		onquote,
		onrefresh,
		busy,
		signedIn,
		userName,
		authConfigured,
		profileHref = null
	}: {
		league: string;
		leagues: League[];
		onleague: (league: string) => void;
		fetchedAt: number;
		quote: Quote;
		onquote: (q: Quote) => void;
		onrefresh: () => void;
		busy: boolean;
		signedIn: boolean;
		userName: string | null;
		authConfigured: boolean;
		profileHref?: string | null;
	} = $props();

	const QUOTES: Quote[] = ['exalted', 'divine'];
</script>

<header class="toolbar">
	<a class="brand" href="/" aria-label="Divindex home">
		<span class="orb" aria-hidden="true"></span>
		<span class="brand-word">Divindex</span>
	</a>
	<nav class="tb-nav">
		<a href="/" aria-current="page" class="active">Terminal</a>
		<a href="/screener">Screener</a>
		<a href="/ladder">Ladder</a>
		<a href="/me">My calls</a>
		<a href="/crafts">Crafts</a>
		<a href="/analytics">Analytics</a>
	</nav>
	<LeagueSelect {leagues} value={league} onchange={onleague} />
	<span class="tb-spacer"></span>
	<div class="quote-toggle" role="group" aria-label="Quote currency">
		<span class="qt-label">Quote</span>
		{#each QUOTES as q (q)}
			<button class:active={quote === q} onclick={() => onquote(q)} aria-pressed={quote === q}>
				{QUOTE_SHORT[q]}
			</button>
		{/each}
	</div>
	<span class="tb-updated mono">Updated {timeOf(fetchedAt)}</span>
	<button class="btn btn-ghost" onclick={onrefresh} disabled={busy} aria-label="Refresh market data">
		{busy ? 'Refreshing…' : 'Refresh'}
	</button>
	{#if signedIn}
		{#if profileHref}
			<a class="auth-chip link" href={profileHref} title="View your profile">{userName}</a>
		{:else}
			<span class="auth-chip" title={userName ?? ''}>{userName}</span>
		{/if}
		<button class="btn btn-ghost" onclick={() => signOut()}>Sign out</button>
	{:else if authConfigured}
		<button class="btn btn-primary" onclick={() => signIn()}>Sign in</button>
	{/if}
</header>
