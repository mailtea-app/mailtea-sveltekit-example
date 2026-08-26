import { defineConfig } from 'vitest/config';
import adapter from '@sveltejs/adapter-auto';
import { sveltekit } from '@sveltejs/kit/vite';

export default defineConfig({
	plugins: [sveltekit({ adapter: adapter() })],
	test: {
		// The tests exercise server code (a form action and an endpoint), so they
		// run in Node rather than a browser environment.
		environment: 'node',
		include: ['test/**/*.test.ts']
	}
});
