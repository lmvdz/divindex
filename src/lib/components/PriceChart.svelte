<script lang="ts">
	import { onMount } from 'svelte';
	import type { Candle, Currency, Forecast, Horizon, Timeframe } from '$lib/types';
	import { fmt, signStr, signClass, ticker } from '$lib/format';
	import { effectiveQuote, QUOTE_LABEL, type Quote } from '$lib/convert';

	let {
		currency,
		quote,
		divineId,
		fxRate,
		forecast,
		activeHorizon
	}: {
		currency: Currency;
		quote: Quote;
		divineId: number;
		fxRate: number;
		forecast: Forecast | null;
		activeHorizon: Horizon;
	} = $props();

	const TFS: { id: Timeframe; label: string }[] = [
		{ id: '1h', label: '1H' },
		{ id: '4h', label: '4H' },
		{ id: '1d', label: '1D' },
		{ id: '1w', label: '1W' }
	];
	let timeframe = $state<Timeframe>('1d');
	const intraday = $derived(timeframe === '1h' || timeframe === '4h');
	const quoteLabel = $derived(QUOTE_LABEL[effectiveQuote(currency.apiId, quote)]);

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

	function fmtTime(sec: number): string {
		const iso = new Date(sec * 1000).toISOString();
		return intraday ? iso.slice(5, 16).replace('T', ' ') : iso.slice(0, 10);
	}

	function resetLegend() {
		if (candles.length) {
			const last = candles[candles.length - 1];
			const prev = candles.length > 1 ? candles[candles.length - 2] : last;
			legPrice = last.close;
			legChg = prev.close ? ((last.close - prev.close) / prev.close) * 100 : 0;
			legDate = fmtTime(last.time);
		} else {
			legPrice = currency.price / fxRate;
			legChg = currency.change1dPct;
			legDate = '';
		}
	}

	function synth(c: Currency): Candle[] {
		return c.series.map((p) => {
			const t = Math.floor(new Date(`${p.t}T00:00:00Z`).getTime() / 1000);
			return { time: t, open: p.p, high: p.p, low: p.p, close: p.p };
		});
	}

	function paint() {
		if (ready && series) {
			// lightweight-charts wants Time; numeric UTCTimestamp is valid
			series.setData(candles as never);
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
						price: c / fxRate,
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
					price: yc / fxRate,
					color: '#ecca8e',
					lineWidth: 2,
					lineStyle: LSEnum.Solid,
					axisLabelVisible: true,
					title: `${HLABEL[activeHorizon]} your call`
				})
			);
		}
	}

	async function loadCandles(id: number, tf: Timeframe): Promise<Candle[]> {
		try {
			const r = await fetch(`/api/history/${id}?tf=${tf}`);
			const d = r.ok ? ((await r.json()) as { candles?: Candle[] }) : { candles: [] };
			return d.candles ?? [];
		} catch {
			return [];
		}
	}

	async function loadHistory(c: Currency, q: Quote, tf: Timeframe) {
		loading = true;
		try {
			let cs = await loadCandles(c.id, tf);
			if (!cs.length) cs = synth(c);
			if (effectiveQuote(c.apiId, q) === 'divine' && c.apiId !== 'divine') {
				const dc = await loadCandles(divineId, tf);
				const byT = new Map(dc.map((k) => [k.time, k.close]));
				const fallback = dc.length ? dc[dc.length - 1].close : fxRate || 1;
				cs = cs.map((k) => {
					const dv = byT.get(k.time) ?? fallback;
					return {
						time: k.time,
						open: k.open / dv,
						high: k.high / dv,
						low: k.low / dv,
						close: k.close / dv
					};
				});
			}
			candles = cs;
		} finally {
			loading = false;
		}
		chart?.applyOptions({ timeScale: { timeVisible: intraday, secondsVisible: false } });
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
					timeScale: { borderColor: '#232838', timeVisible: intraday, secondsVisible: false },
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
					if (pt && param.time != null) {
						legPrice = pt.close;
						legDate = fmtTime(Number(param.time));
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

	// reload candles when currency / quote / timeframe changes
	$effect(() => {
		loadHistory(currency, quote, timeframe);
	});
	// redraw overlay when forecast / horizon / rate changes
	$effect(() => {
		forecast;
		activeHorizon;
		fxRate;
		drawForecast();
	});
</script>

<div class="chart-pane">
	<div class="chart-legend">
		<span class="cl-sym">{ticker(currency.apiId)}</span>
		<span class="cl-name">{currency.name}</span>
		<span class="cl-price">{fmt(legPrice || currency.price / fxRate)} <em>{quoteLabel}</em></span>
		<span class="cl-chg {signClass(legChg)}">{signStr(legChg)}</span>
		{#if loading}
			<span class="cl-date">loading…</span>
		{:else if legDate}
			<span class="cl-date">{legDate}</span>
		{/if}
		<div class="tf-tabs" role="group" aria-label="Timeframe">
			{#each TFS as t (t.id)}
				<button class:active={timeframe === t.id} onclick={() => (timeframe = t.id)}>{t.label}</button>
			{/each}
		</div>
	</div>
	{#if failed}
		<div class="chart-fallback">Chart unavailable — data still listed at right.</div>
	{:else}
		<div
			class="chart-canvas"
			bind:this={el}
			role="img"
			aria-label={`${currency.name} candlestick chart in ${quoteLabel}`}
		></div>
	{/if}
</div>
