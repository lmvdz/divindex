import adapter from '@sveltejs/adapter-node';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	compilerOptions: {
		// Project-wide runes mode (Svelte 5), libraries excepted.
		runes: ({ filename }) => (filename.split(/[/\\]/).includes('node_modules') ? undefined : true)
	},
	kit: {
		// adapter-node builds a portable server (`node build`) and deploys anywhere.
		// Swap to adapter-vercel / -netlify / -cloudflare for divindex.com if preferred.
		adapter: adapter()
	}
};

export default config;
