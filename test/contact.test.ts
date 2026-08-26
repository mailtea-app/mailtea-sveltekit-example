import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { actions } from '../src/routes/+page.server';
import { POST } from '../src/routes/api/send/+server';
import { startMockMailtea } from './mock-mailtea.mjs';

// `$env/dynamic/private` is a SvelteKit virtual module, so tests substitute a
// plain object for it. Mutating that object between tests works because the app
// reads the values per request rather than once at import time.
const env = vi.hoisted(() => ({
	MAILTEA_API_KEY: 'mt_pat_test_key',
	MAILTEA_API_BASE_URL: '',
	MAILTEA_FROM: 'Acme <hello@acme.test>',
	MAILTEA_TO: 'inbox@acme.test'
}));
vi.mock('$env/dynamic/private', () => ({ env }));

let mailtea: Awaited<ReturnType<typeof startMockMailtea>>;

beforeAll(async () => {
	mailtea = await startMockMailtea();
	env.MAILTEA_API_BASE_URL = mailtea.url;
});

afterAll(async () => {
	await mailtea.close();
});

/** The slice of `RequestEvent` these handlers actually touch. */
function formPost(fields: Record<string, string>) {
	const body = new FormData();
	for (const [name, value] of Object.entries(fields)) body.append(name, value);
	const request = new Request('http://localhost/', { method: 'POST', body });
	return { request } as unknown as Parameters<typeof actions.default>[0];
}

function jsonPost(body: unknown) {
	const request = new Request('http://localhost/api/send', {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(body)
	});
	return { request } as unknown as Parameters<typeof POST>[0];
}

describe('the form action', () => {
	it('sends the message with Mailtea and returns the email id', async () => {
		const result = await actions.default(
			formPost({
				email: 'reader@acme.test',
				subject: 'Hello from the form',
				message: 'Line one\nLine two'
			})
		);

		expect(result).toEqual({ id: 'txemail_00000000000000000000000000000000' });

		const sent = mailtea.last!;
		expect(sent.method).toBe('POST');
		expect(sent.path).toBe('/v1/emails');
		expect(sent.authorization).toBe('Bearer mt_pat_test_key');
		expect(sent.body).toMatchObject({
			from: 'Acme <hello@acme.test>',
			to: 'inbox@acme.test',
			subject: 'Hello from the form',
			reply_to: ['reader@acme.test'],
			text: 'From: reader@acme.test\n\nLine one\nLine two'
		});
	});

	it("escapes the visitor's text in the HTML part", async () => {
		await actions.default(
			formPost({
				email: 'reader@acme.test',
				subject: 'Hello',
				message: '<script>alert(1)</script>\n"quoted" & \'apostrophed\''
			})
		);

		const html = mailtea.last!.body.html as string;
		expect(html).not.toContain('<script>');
		expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
		expect(html).toContain('&quot;quoted&quot; &amp; &#39;apostrophed&#39;');
		// Escaping runs before newlines become <br />, so the break survives.
		expect(html).toContain('<br />');
	});

	it('fails the submission without calling Mailtea when the email is invalid', async () => {
		const before = mailtea.requests.length;

		const result = await actions.default(
			formPost({ email: 'not-an-email', subject: 'Hello', message: 'Hi' })
		);

		expect(result).toMatchObject({
			status: 400,
			data: { error: 'Enter a valid email address.', subject: 'Hello' }
		});
		expect(mailtea.requests).toHaveLength(before);
	});

	it("surfaces Mailtea's error when the API rejects the send", async () => {
		const baseUrl = env.MAILTEA_API_BASE_URL;
		env.MAILTEA_API_BASE_URL = `${baseUrl}/wrong-base`;

		try {
			const result = await actions.default(
				formPost({ email: 'reader@acme.test', subject: 'Hello', message: 'Hi' })
			);

			expect(result).toMatchObject({ status: 404 });
			expect(mailtea.last!.path).toBe('/wrong-base/v1/emails');
		} finally {
			env.MAILTEA_API_BASE_URL = baseUrl;
		}
	});

	it('answers 502 when Mailtea is unreachable instead of throwing', async () => {
		// Start a server only to claim a port, then close it — nothing is
		// listening there, so the send fails the way a DNS or network fault does.
		const offline = await startMockMailtea();
		await offline.close();

		const baseUrl = env.MAILTEA_API_BASE_URL;
		env.MAILTEA_API_BASE_URL = offline.url;
		const logged = vi.spyOn(console, 'error').mockImplementation(() => {});

		try {
			const result = await actions.default(
				formPost({ email: 'reader@acme.test', subject: 'Hello', message: 'Hi' })
			);

			// A transport failure must still come back as `fail(...)`, so the
			// visitor keeps what they typed rather than losing it to a 500 page.
			expect(result).toMatchObject({
				status: 502,
				data: { error: 'Could not reach Mailtea. Please try again.', subject: 'Hello' }
			});
			// The real cause is not shown to the visitor, so it has to reach the log.
			expect(logged).toHaveBeenCalledWith('Mailtea send failed', expect.any(Error));
		} finally {
			logged.mockRestore();
			env.MAILTEA_API_BASE_URL = baseUrl;
		}
	});
});

describe('the JSON endpoint', () => {
	it('returns 201 and the email id', async () => {
		const response = await POST(
			jsonPost({ email: 'reader@acme.test', subject: 'Hello from JSON', message: 'Hi' })
		);

		expect(response.status).toBe(201);
		expect(await response.json()).toEqual({ id: 'txemail_00000000000000000000000000000000' });

		const sent = mailtea.last!;
		expect(sent.path).toBe('/v1/emails');
		expect(sent.authorization).toBe('Bearer mt_pat_test_key');
		expect(sent.body).toMatchObject({ subject: 'Hello from JSON', to: 'inbox@acme.test' });
	});

	it('returns 400 for a message with no subject', async () => {
		const response = await POST(jsonPost({ email: 'reader@acme.test', message: 'Hi' }));

		expect(response.status).toBe(400);
		expect(await response.json()).toEqual({ error: 'Enter a subject.' });
	});
});
