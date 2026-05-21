<script lang="ts">
	import { onMount } from 'svelte';
	import type { Hero } from '$lib/types';

	let { hero }: { hero: Hero } = $props();

	let el = $state<HTMLDivElement>();
	let failed = $state(false);

	// SVG sparkline geometry — a guaranteed fallback if the chart library fails.
	const W = 520;
	const H = 168;
	const padX = 6;
	const padY = 16;
	const geo = $derived.by(() => {
		const prices = hero.series.map((p) => p.p);
		const min = Math.min(...prices);
		const max = Math.max(...prices);
		const span = max - min || 1;
		const x = (i: number) => padX + (i / Math.max(1, hero.series.length - 1)) * (W - padX * 2);
		const y = (v: number) => padY + (1 - (v - min) / span) * (H - padY * 2);
		const line = hero.series
			.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(p.p).toFixed(1)}`)
			.join(' ');
		const area = `${line} L${x(hero.series.length - 1).toFixed(1)} ${H} L${x(0).toFixed(1)} ${H} Z`;
		return { line, area };
	});
	const summary = $derived(
		`${hero.text} is ${hero.latest} ${hero.unit}, ${hero.changePct}% over ${hero.window} days.`
	);

	onMount(() => {
		let chart: import('lightweight-charts').IChartApi | undefined;
		let ro: ResizeObserver | undefined;

		(async () => {
			try {
				const lc = await import('lightweight-charts');
				if (!el) return;
				chart = lc.createChart(el, {
					height: 168,
					width: el.clientWidth,
					autoSize: false,
					layout: {
						background: { color: 'transparent' },
						textColor: '#99a2b8',
						fontFamily: 'JetBrains Mono, monospace',
						attributionLogo: false
					},
					grid: { vertLines: { visible: false }, horzLines: { color: '#1b2030' } },
					rightPriceScale: { borderVisible: false },
					timeScale: { borderVisible: false, fixLeftEdge: true, fixRightEdge: true },
					crosshair: { mode: lc.CrosshairMode.Magnet, vertLine: { labelVisible: false } },
					handleScroll: false,
					handleScale: false
				});
				const series = chart.addSeries(lc.AreaSeries, {
					lineColor: '#f0c069',
					lineWidth: 2,
					topColor: 'rgba(240,192,105,0.28)',
					bottomColor: 'rgba(240,192,105,0)',
					priceLineVisible: false,
					lastValueVisible: false
				});
				series.setData(hero.series.map((p) => ({ time: p.t, value: p.p })));
				chart.timeScale().fitContent();
				ro = new ResizeObserver(() => {
					if (chart && el) chart.applyOptions({ width: el.clientWidth });
				});
				ro.observe(el);
			} catch {
				failed = true;
			}
		})();

		return () => {
			ro?.disconnect();
			try {
				chart?.remove();
			} catch {
				/* already gone */
			}
		};
	});
</script>

{#if failed}
	<svg
		class="chart-svg"
		viewBox={`0 0 ${W} ${H}`}
		preserveAspectRatio="none"
		role="img"
		aria-label={summary}
	>
		<defs>
			<linearGradient id="divArea" x1="0" y1="0" x2="0" y2="1">
				<stop offset="0%" stop-color="#f0c069" stop-opacity="0.28" />
				<stop offset="100%" stop-color="#f0c069" stop-opacity="0" />
			</linearGradient>
		</defs>
		<path class="chart-area" d={geo.area} />
		<path class="chart-line" d={geo.line} />
	</svg>
{:else}
	<div class="chart-host" bind:this={el} role="img" aria-label={summary}></div>
{/if}
