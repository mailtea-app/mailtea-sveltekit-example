import { fail } from '@sveltejs/kit';
import { sendContactMessage } from '$lib/server/mailtea';
import type { Actions } from './$types';

export const actions = {
	default: async ({ request }) => {
		const form = await request.formData();
		const input = {
			email: String(form.get('email') ?? ''),
			subject: String(form.get('subject') ?? ''),
			message: String(form.get('message') ?? '')
		};

		const result = await sendContactMessage(input);

		// `fail` re-renders the page with the same `form` prop a success uses, so
		// the visitor keeps what they typed instead of an empty form.
		if (!result.ok) {
			return fail(result.status, { ...input, error: result.error });
		}

		return { id: result.id };
	}
} satisfies Actions;
