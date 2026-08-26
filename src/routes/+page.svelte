<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData } from './$types';

	let { form }: { form: ActionData } = $props();
	let sending = $state(false);
</script>

<main>
	<h1>Contact us</h1>
	<p>Posting this form runs a SvelteKit form action that sends an email with Mailtea.</p>

	<form
		method="POST"
		use:enhance={() => {
			sending = true;
			return async ({ update }) => {
				await update();
				sending = false;
			};
		}}
	>
		<label>
			Your email
			<input name="email" type="email" value={form?.email ?? ''} required />
		</label>

		<label>
			Subject
			<input name="subject" value={form?.subject ?? ''} required />
		</label>

		<label>
			Message
			<textarea name="message" rows="5" required>{form?.message ?? ''}</textarea>
		</label>

		<button disabled={sending}>{sending ? 'Sending...' : 'Send message'}</button>
	</form>

	{#if form?.error}
		<p class="error">{form.error}</p>
	{:else if form?.id}
		<p class="sent">Sent. Mailtea email id: <code>{form.id}</code></p>
	{/if}
</main>

<style>
	main {
		font-family: system-ui, sans-serif;
		margin: 3rem auto;
		max-width: 32rem;
		padding: 0 1rem;
	}

	form {
		display: grid;
		gap: 1rem;
	}

	label {
		display: grid;
		gap: 0.25rem;
	}

	button {
		justify-self: start;
		padding: 0.5rem 1rem;
	}

	.error {
		color: #b00020;
	}

	.sent {
		color: #0b6b3a;
	}
</style>
