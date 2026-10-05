import { Mailtea, MailteaError } from 'mailtea-sdk';
import { env } from '$env/dynamic/private';

/** One contact-form submission, from the form action or the JSON endpoint. */
export type ContactInput = {
	email: string;
	subject: string;
	message: string;
};

export type SendResult =
	| { ok: true; id: string }
	| { ok: false; status: number; error: string };

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const HTML_ESCAPES: Record<string, string> = {
	'&': '&amp;',
	'<': '&lt;',
	'>': '&gt;',
	'"': '&quot;',
	"'": '&#39;'
};

/** The visitor's text is untrusted; escape it before it lands in an HTML email. */
function escapeHtml(value: string) {
	return value.replace(/[&<>"']/g, (char) => HTML_ESCAPES[char]);
}

/**
 * Sends one contact message to the inbox in `MAILTEA_TO`.
 *
 * It returns a result rather than throwing so that both callers can map the
 * same failure onto their own shape: the form action into `fail(...)`, the
 * endpoint into a JSON error response.
 */
export async function sendContactMessage(input: ContactInput): Promise<SendResult> {
	const email = input.email.trim();
	const subject = input.subject.trim();
	// A browser submits textarea line breaks as CRLF; normalize so the text part
	// of the email reads the same however the message arrived.
	const message = input.message.replace(/\r\n/g, '\n').trim();

	if (!EMAIL_PATTERN.test(email)) {
		return { ok: false, status: 400, error: 'Enter a valid email address.' };
	}
	if (!subject) {
		return { ok: false, status: 400, error: 'Enter a subject.' };
	}
	if (!message) {
		return { ok: false, status: 400, error: 'Enter a message.' };
	}

	// Read from `$env/dynamic/private` — never `$env/static/public`, which is
	// inlined into the browser bundle. Dynamic also means the values are read
	// per request, so a redeploy can rotate the key without a rebuild.
	const from = env.MAILTEA_FROM;
	const to = env.MAILTEA_TO;
	if (!from || !to) {
		return { ok: false, status: 500, error: 'MAILTEA_FROM and MAILTEA_TO are not configured.' };
	}

	try {
		const mailtea = new Mailtea(env.MAILTEA_API_KEY, {
			// Optional override of the API host. Unset, the SDK uses https://api.mailtea.app.
			// `|| undefined` matters: a host that defines the variable as an empty
			// string would otherwise give the client a base URL of "", and every
			// request would fail on a relative URL instead of hitting the default.
			baseUrl: env.MAILTEA_API_BASE_URL || undefined
		});

		const { id } = await mailtea.emails.send({
			from,
			to,
			subject,
			// The visitor's address is not a domain you have verified, so it goes
			// in reply_to and `from` stays an address you own.
			reply_to: [email],
			text: `From: ${email}\n\n${message}`,
			html: `<p><strong>From:</strong> ${escapeHtml(email)}</p><p>${escapeHtml(message).replace(/\n/g, '<br />')}</p>`
		});

		return { ok: true, id };
	} catch (error) {
		// A rejected send is normal traffic (unverified domain, suppressed
		// recipient, missing key), so surface Mailtea's own message.
		if (error instanceof MailteaError) {
			return { ok: false, status: error.status >= 400 ? error.status : 500, error: error.message };
		}

		// Anything else is a transport failure — DNS, a timeout, a dropped
		// connection. The SDK lets those through as-is, so without this the
		// visitor would lose everything they typed to a blank 500 page. Log the
		// real cause and answer with a 502 the caller can retry.
		console.error('Mailtea send failed', error);
		return { ok: false, status: 502, error: 'Could not reach Mailtea. Please try again.' };
	}
}
