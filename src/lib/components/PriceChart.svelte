<script lang="ts">
	import { onMount } from 'svelte';
	import type { Candle, Currency, Forecast, Horizon } from '$lib/types';
	import { fmt, signStr, signClass, ticker } from '$lib/format';

	let {
		currency,
		base,
		forecast,
		activeHorizon
	}: {
		currency: Currency;
		base: string;
		forecast: Forecast | null;
		activeHorizon: Horizon;
	} = $props();

	let el = $state<HTMLDivElement>();
	let ready = $state(false);
	let failed = $state(false);
	let loading = $state(false);
	let candles = $state<Candle[]>([]);

	let legPrice = $state(0);
	let legChg = $state(0);
	let legDate = $state('');

	type ChartApi = import('lightweight-charts').IChartApi;
	type CandleApi = import('lightweight-charts').ISeriesApi<'Candlestick'>;
	type PriceLine = import('lightweight-charts').IPriceLine;
	let chart: ChartApi | undefined;
	let series: CandleApi | undefined;
	let lines: PriceLine[] = [];
	let LSEnum: typeof import('lightweight-charts').LineStyle | undefined;

	const HLABEL: Record<Horizon, string> = { hour: '1H', day: '1D', week: '1W' };

	function resetLegend() {
		if (candles.length) {
			const last = candles[candles.length - 1];
			const prev = candles.length > 1 ? candles[candles.length - 2] : last;
			legPrice = last.close;
			legChg = prev.close ? ((last.close - prev.close) / prev.close) * 100 : 0;
			legDate = last.time;
		} else {
			legPrice = currency.price;
			legChg = currency.change1dPct;
			legDate = '';
		}
	}

	function synth(c: Currency): Candle[] {
		return c.series.map((p) => ({ time: p.t, open: p.p, high: p.p, low: p.p, close: p.p }));
	}

	function paint() {
		if (ready && series) {
			series.setData(candles);
			chart?.timeScale().fitContent();
			resetLegend();
		}
	}

	function drawForecast() {
		if (!ready || !series || !LSEnum) return;
		for (const l of lines) series.removePriceLine(l);
		lines = [];
		if (!forecast) return;
		for (const h of ['hour', 'day', 'week'] as Horizon[]) {
			const c = forecast.horizons[h].consensus;
			if (c != null) {
				lines.push(
					series.createPriceLine({
						price: c,
						color: '#c2913f',
						lineWidth: 1,
						lineStyle: LSEnum.Dashed,
						axisLabelVisible: true,
						title: `${HLABEL[h]} consensus`
					})
				);
			}
		}
		const yc = forecast.horizons[activeHorizon].yourCall;
		if (yc != null) {
			lines.push(
				series.createPriceLine({
					price: yc,
					color: '#ecca8e',
					lineWidth: 2,
					lineStyle: LSEnum.Solid,
					axisLabelVisible: true,
					title: `${HLABEL[activeHorizon]} your call`
				})
			);
		}
	}

	async function loadHistory(c: Currency) {
		loading = true;
		try {
			const r = await fetch(`/api/history/${c.id}`);
			const d = r.ok ? ((await r.json()) as { candles?: Candle[] }) : { candles: [] };
			candles = d.candles?.length ? d.candles : synth(c);
		} catch {
			candles = synth(c);
		} finally {
			loading = false;
		}
		paint();
		drawForecast();
	}

	onMount(() => {
		(async () => {
			try {
				const lc = await import('lightweight-charts');
				if (!el) return;
				LSEnum = lc.LineStyle;
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
					timeScale: { borderColor: '#232838' },
					crosshair: {
						mode: lc.CrosshairMode.Normal,
						vertLine: { color: '#2d3346', labelBackgroundColor: '#1b2030' },
						horzLine: { color: '#2d3346', labelBackgroundColor: '#1b2030' }
					}
				});
				series = chart.addSeries(lc.CandlestickSeries, {
					upColor: '#66cf8a',
					downColor: '#e57170',
					wickUpColor: '#66cf8a',
					wickDownColor: '#e57170',
					borderVisible: false
				});
				chart.subscribeCrosshairMove((param) => {
					const pt = series
						? (param.seriesData.get(series) as { close: number } | undefined)
						: undefined;
					if (pt && param.time) {
						legPrice = pt.close;
						legDate = String(param.time);
					} else {
						resetLegend();
					}
				});
				ready = true;
				paint();
				drawForecast();
			} catch {
				failed = true;
			}
		})();
		return () => {
			try {
				chart?.remove();
			} catch {
				/* disposed */
			}
		};
	});

	// reload candles when the currency changes
	$effect(() => {
		loadHistory(currency);
	});
	// redraw overlay when the forecast or active horizon changes
	$effect(() => {
		forecast;
		activeHorizon;
		drawForecast();
	});
</script>

<div class="chart-pane">
	<div class="chart-legend">
		<span class="cl-sym">{ticker(currency.apiId)}</span>
		<span class="cl-name">{currency.name}</span>
		<span class="cl-price">{fmt(legPrice || currency.price)} <em>{base}</em></span>
		<span class="cl-chg {signClass(legChg)}">{signStr(legChg)}</span>
		{#if loading}
			<span class="cl-date">loading…</span>
		{:else if legDate}
			<span class="cl-date">{legDate}</span>
		{/if}
	</div>
	{#if failed}
		<div class="chart-fallback">Chart unavailable — data still listed at right.</div>
	{:else}
		<div
			class="chart-canvas"
			bind:this={el}
			role="img"
			aria-label={`${currency.name} candlestick chart in ${base}`}
		></div>
	{/if}
</div>
