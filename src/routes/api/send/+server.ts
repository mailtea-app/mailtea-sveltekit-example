import { json } from '@sveltejs/kit';
import { sendContactMessage } from '$lib/server/mailtea';
import type { RequestHandler } from './$types';

/** The same send as the form action, for callers that speak JSON. */
export const POST: RequestHandler = async ({ request }) => {
	const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
	if (!body) {
		return json({ error: 'Expected a JSON body.' }, { status: 400 });
	}

	const result = await sendContactMessage({
		email: String(body.email ?? ''),
		subject: String(body.subject ?? ''),
		message: String(body.message ?? '')
	});

	if (!result.ok) {
		return json({ error: result.error }, { status: result.status });
	}

	return json({ id: result.id }, { status: 201 });
};
