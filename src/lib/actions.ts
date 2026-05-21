import type { Action } from 'svelte/action';

const reduceMotion = () =>
	typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Reveal an element on scroll into view. Markup should carry class="reveal". */
export const reveal: Action<HTMLElement, { delay?: number } | undefined> = (node, params) => {
	node.style.setProperty('--reveal-delay', `${params?.delay ?? 0}ms`);

	if (reduceMotion() || typeof IntersectionObserver === 'undefined') {
		node.classList.add('in');
		return;
	}

	const io = new IntersectionObserver(
		(entries) => {
			for (const entry of entries) {
				if (entry.isIntersecting) {
					node.classList.add('in');
					io.unobserve(node);
				}
			}
		},
		{ threshold: 0.15, rootMargin: '0px 0px -8% 0px' }
	);
	io.observe(node);

	return { destroy: () => io.disconnect() };
};

/** Track the cursor as CSS vars for a spotlight glow. Pair with the `.spot` class. */
export const spotlight: Action<HTMLElement> = (node) => {
	function move(e: PointerEvent) {
		const r = node.getBoundingClientRect();
		node.style.setProperty('--mx', `${e.clientX - r.left}px`);
		node.style.setProperty('--my', `${e.clientY - r.top}px`);
	}
	node.addEventListener('pointermove', move);
	return { destroy: () => node.removeEventListener('pointermove', move) };
};
