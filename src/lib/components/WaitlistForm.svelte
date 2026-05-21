<script lang="ts">
	// Set FORM_ENDPOINT (e.g. a Formspree URL) to collect emails.
	// Empty -> we show the contact address instead of silently dropping signups.
	const FORM_ENDPOINT = '';
	const CONTACT = 'hello@divindex.com';

	let { id, cta = 'Get early access' }: { id: string; cta?: string } = $props();

	let email = $state('');
	let msg = $state('');
	let msgClass = $state<'' | 'ok' | 'err'>('');
	let busy = $state(false);

	async function submit(e: SubmitEvent) {
		e.preventDefault();
		msgClass = '';
		const value = email.trim();
		if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
			msg = 'Enter a valid email address.';
			msgClass = 'err';
			return;
		}
		if (!FORM_ENDPOINT) {
			msg = `Thanks — email ${CONTACT} to lock your spot.`;
			msgClass = 'ok';
			return;
		}
		busy = true;
		msg = 'Adding you…';
		try {
			const res = await fetch(FORM_ENDPOINT, {
				method: 'POST',
				headers: { 'content-type': 'application/json', accept: 'application/json' },
				body: JSON.stringify({ email: value })
			});
			if (!res.ok) throw new Error(String(res.status));
			email = '';
			msg = "You're on the list. See you next league.";
			msgClass = 'ok';
		} catch {
			msg = `Something broke — email ${CONTACT} instead.`;
			msgClass = 'err';
		} finally {
			busy = false;
		}
	}
</script>

<form class="cta-form" onsubmit={submit} novalidate>
	<label class="sr-only" for={`email-${id}`}>Email address</label>
	<input
		class="field"
		id={`email-${id}`}
		name="email"
		type="email"
		inputmode="email"
		autocomplete="email"
		placeholder="you@example.com"
		bind:value={email}
		required
	/>
	<button class="btn btn-primary" type="submit" disabled={busy}>{cta}</button>
	<p class="form-msg {msgClass}" role="status" aria-live="polite">{msg}</p>
</form>
