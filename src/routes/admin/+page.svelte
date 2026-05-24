<script lang="ts">
	import type { AdminUserRow } from '$lib/types';

	const KEY = 'dx_admin_token';
	let token = $state(typeof localStorage !== 'undefined' ? (localStorage.getItem(KEY) ?? '') : '');
	let loading = $state(false);
	let error = $state('');
	let loaded = $state(false);
	let authConfigured = $state<boolean | null>(null);
	let league = $state<string | null>(null);
	let users = $state<AdminUserRow[]>([]);

	function persist() {
		if (typeof localStorage !== 'undefined') {
			try {
				localStorage.setItem(KEY, token);
			} catch {
				/* storage disabled */
			}
		}
	}

	async function call(qs = '') {
		if (!token) {
			error = 'Enter the admin token.';
			return;
		}
		loading = true;
		error = '';
		try {
			persist();
			const res = await fetch(`/api/admin/users?token=${encodeURIComponent(token)}${qs}`);
			const d = await res.json();
			if (!res.ok || !d.ok) {
				error = d.reason ?? `Failed (${res.status})`;
				return;
			}
			authConfigured = d.authConfigured;
			league = d.league;
			users = d.users;
			loaded = true;
		} catch {
			error = 'Network error.';
		} finally {
			loading = false;
		}
	}

	const load = () => call();
	async function remove(u: AdminUserRow) {
		if (!confirm(`Remove "${u.name}" (${u.pid}) and all their calls? This cannot be undone.`)) return;
		await call(`&delete=${encodeURIComponent(u.pid)}`);
	}

	const guests = $derived(users.filter((u) => u.pidType === 'guest').length);
	const fmtDate = (ms: number) => (ms ? new Date(ms).toISOString().slice(0, 10) : '—');
</script>

<svelte:head>
	<title>Admin — ladder inspector</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<div class="adm">
	<header class="adm-top">
		<a class="brand" href="/" aria-label="Divindex home">
			<span class="orb" aria-hidden="true"></span>
			<span class="brand-word">Divindex</span>
		</a>
		<span class="adm-tag">admin · ladder inspector</span>
	</header>

	<main class="adm-body">
		<div class="adm-auth">
			<input
				class="field"
				type="password"
				placeholder="Admin token"
				bind:value={token}
				onkeydown={(e) => e.key === 'Enter' && load()}
				aria-label="Admin token"
			/>
			<button class="btn btn-primary" onclick={load} disabled={loading}>
				{loading ? 'Loading…' : 'Load'}
			</button>
		</div>
		{#if error}<p class="adm-err">{error}</p>{/if}

		{#if loaded}
			<div class="adm-meta">
				<span>League: <b>{league ?? '—'}</b></span>
				<span>Forecasters: <b>{users.length}</b> ({guests} guest)</span>
				<span class="adm-flag" class:bad={authConfigured === false}>
					auth {authConfigured ? 'configured' : 'NOT configured — guests can still call'}
				</span>
			</div>

			{#if users.length === 0}
				<p class="muted">No forecasters in the current season.</p>
			{:else}
				<table class="adm-table">
					<thead>
						<tr>
							<th>Name</th>
							<th>Type</th>
							<th>pid</th>
							<th class="num">Points</th>
							<th class="num">Calls</th>
							<th class="num">Dir</th>
							<th class="num">Acc</th>
							<th>Last</th>
							<th></th>
						</tr>
					</thead>
					<tbody>
						{#each users as u (u.pid)}
							<tr>
								<td>{u.name}</td>
								<td>
									<span class="badge-type" class:guest={u.pidType === 'guest'}>{u.pidType}</span>
								</td>
								<td class="pid mono">{u.pid}</td>
								<td class="num mono">{u.points}</td>
								<td class="num mono">{u.calls}</td>
								<td class="num mono">{u.calls ? Math.round((u.hits / u.calls) * 100) : 0}%</td>
								<td class="num mono">{Math.round(u.accAvg * 100)}%</td>
								<td class="mono">{fmtDate(u.lastAt)}</td>
								<td><button class="rm" onclick={() => remove(u)} disabled={loading}>Remove</button></td>
							</tr>
						{/each}
					</tbody>
				</table>
			{/if}
		{/if}
	</main>
</div>

<style>
	.adm {
		min-height: 100dvh;
		padding-bottom: 40px;
	}
	.adm-top {
		display: flex;
		align-items: center;
		gap: 14px;
		padding: 14px 18px;
		border-bottom: 1px solid var(--border);
	}
	.adm-tag {
		font-size: 0.78rem;
		color: var(--muted);
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}
	.adm-body {
		max-width: 980px;
		margin: 0 auto;
		padding: 20px 18px;
	}
	.adm-auth {
		display: flex;
		gap: 8px;
		max-width: 460px;
	}
	.adm-auth .field {
		flex: 1;
	}
	.adm-err {
		color: var(--down, #e06c75);
		font-size: 0.85rem;
	}
	.adm-meta {
		display: flex;
		flex-wrap: wrap;
		gap: 8px 18px;
		margin: 18px 0 10px;
		font-size: 0.85rem;
	}
	.adm-flag {
		color: var(--up, #4ec9a0);
	}
	.adm-flag.bad {
		color: var(--down, #e06c75);
		font-weight: 600;
	}
	.adm-table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.84rem;
	}
	.adm-table th,
	.adm-table td {
		text-align: left;
		padding: 7px 10px;
		border-bottom: 1px solid var(--border-2);
	}
	.adm-table th {
		font-size: 0.68rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--muted);
	}
	.adm-table .num {
		text-align: right;
	}
	.pid {
		max-width: 220px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		color: var(--muted);
		font-size: 0.78rem;
	}
	.badge-type {
		font-size: 0.7rem;
		padding: 2px 7px;
		border-radius: 999px;
		border: 1px solid color-mix(in srgb, var(--up, #4ec9a0) 40%, var(--border-2));
		color: var(--up, #4ec9a0);
	}
	.badge-type.guest {
		border-color: color-mix(in srgb, var(--down, #e06c75) 40%, var(--border-2));
		color: var(--down, #e06c75);
	}
	.rm {
		font-size: 0.76rem;
		padding: 4px 10px;
		border-radius: 6px;
		border: 1px solid var(--border-2);
		background: transparent;
		color: var(--down, #e06c75);
		cursor: pointer;
	}
	.rm:hover:not(:disabled) {
		background: color-mix(in srgb, var(--down, #e06c75) 12%, transparent);
	}
	.rm:disabled {
		opacity: 0.5;
		cursor: default;
	}
</style>
