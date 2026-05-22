// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			auth(): Promise<import('@auth/sveltekit').Session | null>;
		}
		// interface PageData {}
		// interface PageState {}
		interface Platform {
			env?: {
				FORECAST_KV?: {
					get(key: string, type: 'json'): Promise<unknown>;
					put(key: string, value: string): Promise<void>;
				};
			};
		}
	}
}

export {};
