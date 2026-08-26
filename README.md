# Mailtea + SvelteKit Example

This example shows how to use [Mailtea](https://mailtea.app) with SvelteKit to
send a contact form submission as an email, from both a form action and a JSON
endpoint.

## Prerequisites

To get the most out of this guide, you'll need to:

- [Create an API key](https://studio.mailtea.app/api-keys)
- [Verify your domain](https://docs.mailtea.app/docs/documentation/domains)

## Instructions

1. Install dependencies:
   ```bash
   npm install
   ```
2. Copy `.env.example` to `.env` and add your API key:
   ```bash
   cp .env.example .env
   ```
3. Run it:
   ```bash
   npm run dev
   ```

Open http://localhost:5173 and submit the form, or post to the endpoint
directly:

```bash
curl -X POST http://localhost:5173/api/send \
  -H 'content-type: application/json' \
  -d '{"email":"reader@acme.com","subject":"Hello","message":"Sent with Mailtea."}'
```

## What this example covers

- Sending with the `mailtea-sdk` client from a SvelteKit form action
  (`src/routes/+page.server.ts`)
- The same send from a JSON endpoint (`src/routes/api/send/+server.ts`), both
  going through one server module in `src/lib/server/mailtea.ts`
- Reading the API key from `$env/dynamic/private`, which keeps it on the server
  and out of the client bundle
- Progressive enhancement with `use:enhance` and Svelte 5 runes (`$props`,
  `$state`) for the pending state
- Surfacing a `MailteaError` as a form error instead of a 500, and replying to
  the visitor safely with `reply_to`
- Keeping a transport failure (Mailtea unreachable, a timeout) a form error too,
  so the visitor keeps what they typed — the SDK only wraps HTTP responses
- Escaping the visitor's text before it goes into the HTML part of the email

## Tests

```bash
npm test
```

The tests run against a bundled mock Mailtea server, so they need no API key
and make no network calls.

They call the form action and the endpoint the way SvelteKit does — with a
`RequestEvent` carrying a real `Request` — and substitute `$env/dynamic/private`
with the mock server's address. Vitest is used rather than `node --test`
because `$env/dynamic/private` is a Vite virtual module that only resolves
inside SvelteKit's own toolchain.

## Learn more

- [Documentation](https://docs.mailtea.app)
- [API reference](https://docs.mailtea.app/docs/api-reference)
- [Node.js SDK](https://github.com/mailtea-app/mailtea-node) ·
  [Python SDK](https://github.com/mailtea-app/mailtea-python) ·
  [MCP server](https://github.com/mailtea-app/mailtea-mcp)
