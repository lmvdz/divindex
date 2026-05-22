import adapter from '@sveltejs/adapter-cloudflare';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	compilerOptions: {
		// Project-wide runes mode (Svelte 5), libraries excepted.
		runes: ({ filename }) => (filename.split(/[/\\]/).includes('node_modules') ? undefined : true)
	},
	kit: {
		// Cloudflare Workers/Pages. KV binding (FORECAST_KV) powers the forecast store;
		// see wrangler.jsonc. Falls back to in-memory when KV isn't bound.
		adapter: adapter()
	}
};

export default config;
