<script lang="ts">
	import { onMount } from 'svelte';
	import type { Currency } from '$lib/types';
	import { fmt, signStr, signClass, ticker } from '$lib/format';

	let { currency, base }: { currency: Currency; base: string } = $props();

	let el = $state<HTMLDivElement>();
	let ready = $state(false);
	let failed = $state(false);
	let legendPrice = $state(0);
	let legendDate = $state('');

	type ChartApi = import('lightweight-charts').IChartApi;
	type AreaApi = import('lightweight-charts').ISeriesApi<'Area'>;
	let chart: ChartApi | undefined;
	let series: AreaApi | undefined;

	function resetLegend() {
		const s = currency.series;
		if (s.length) {
			legendPrice = s[s.length - 1].p;
			legendDate = s[s.length - 1].t;
		}
	}

	onMount(() => {
		(async () => {
			try {
				const lc = await import('lightweight-charts');
				if (!el) return;
				chart = lc.createChart(el, {
					autoSize: true,
					layout: {
						background: { type: lc.ColorType.Solid, color: 'transparent' },
						textColor: '#98a1b6',
						fontFamily: 'Geist Mono, ui-monospace, monospace',
						attributionLogo: false
					},
					grid: {
						vertLines: { color: 'rgba(35,40,56,0.4)' },
						horzLines: { color: 'rgba(35,40,56,0.4)' }
					},
					rightPriceScale: { borderColor: '#232838' },
					timeScale: { borderColor: '#232838', fixLeftEdge: true, fixRightEdge: true },
					crosshair: {
						mode: lc.CrosshairMode.Normal,
						vertLine: { color: '#2d3346', labelBackgroundColor: '#1b2030' },
						horzLine: { color: '#2d3346', labelBackgroundColor: '#1b2030' }
					}
				});
				series = chart.addSeries(lc.AreaSeries, {
					lineColor: '#e0b465',
					lineWidth: 2,
					topColor: 'rgba(224,180,101,0.22)',
					bottomColor: 'rgba(224,180,101,0)',
					priceLineColor: '#c2913f',
					priceLineStyle: 2,
					lastValueVisible: true
				});
				chart.subscribeCrosshairMove((param) => {
					const point = series
						? (param.seriesData.get(series) as { value: number } | undefined)
						: undefined;
					if (point && param.time) {
						legendPrice = point.value;
						legendDate = String(param.time);
					} else {
						resetLegend();
					}
				});
				ready = true;
			} catch {
				failed = true;
			}
		})();
		return () => {
			try {
				chart?.remove();
			} catch {
				/* already disposed */
			}
		};
	});

	// re-feed whenever the selected currency changes
	$effect(() => {
		const c = currency;
		if (!ready || !series || !chart) return;
		series.setData(c.series.map((p) => ({ time: p.t, value: p.p })));
		chart.timeScale().fitContent();
		resetLegend();
	});
</script>

<div class="chart-pane">
	<div class="chart-legend">
		<span class="cl-sym">{ticker(currency.apiId)}</span>
		<span class="cl-name">{currency.name}</span>
		<span class="cl-price">{fmt(legendPrice || currency.price)} <em>{base}</em></span>
		<span class="cl-chg {signClass(currency.change1dPct)}">{signStr(currency.change1dPct)}</span>
		{#if legendDate}<span class="cl-date">{legendDate}</span>{/if}
	</div>
	{#if failed}
		<div class="chart-fallback">Chart unavailable — data still listed at right.</div>
	{:else}
		<div
			class="chart-canvas"
			bind:this={el}
			role="img"
			aria-label={`${currency.name} price chart in ${base}`}
		></div>
	{/if}
</div>
