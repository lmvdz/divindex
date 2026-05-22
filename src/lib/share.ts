// Lightweight sharing — Web Share API with a clipboard fallback, plus an
// X/Twitter intent link. No infra, works everywhere.

function origin(): string {
	return typeof location !== 'undefined' ? location.origin : 'https://divindex.com';
}

export function ladderUrl(): string {
	return `${origin()}/ladder`;
}

export function profileUrl(handle: string): string {
	return `${origin()}/u/${handle}`;
}

export function tweetIntent(text: string, url: string): string {
	return `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
}

export async function shareOrCopy(text: string, url: string): Promise<'shared' | 'copied' | 'failed'> {
	try {
		const nav = typeof navigator !== 'undefined' ? navigator : undefined;
		if (nav?.share) {
			await nav.share({ title: 'Divindex', text, url });
			return 'shared';
		}
	} catch {
		// user cancelled or share failed — fall through to copy
	}
	try {
		await navigator.clipboard.writeText(`${text} ${url}`);
		return 'copied';
	} catch {
		return 'failed';
	}
}
