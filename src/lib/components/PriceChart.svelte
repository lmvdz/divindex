<script lang="ts">
	import { onMount } from 'svelte';
	import type { Candle, Currency, Forecast, Horizon, PredPoint, Timeframe } from '$lib/types';
	import { fmt, compact, signStr, signClass } from '$lib/format';
	import { effectiveQuote, QUOTE_LABEL, type Quote } from '$lib/convert';
	import { HORIZON_COLORS } from '$lib/horizons';
	import ItemIcon from '$lib/components/ItemIcon.svelte';

	let {
		currency,
		quote,
		divineId,
		fxRate,
		forecast,
		ontimeframe
	}: {
		currency: Currency;
		quote: Quote;
		divineId: number;
		fxRate: number;
		forecast: Forecast | null;
		ontimeframe?: (tf: Timeframe) => void;
	} = $props();

	const TFS: { id: Timeframe; label: string }[] = [
		{ id: '1h', label: '1H' },
		{ id: '4h', label: '4H' },
		{ id: '1d', label: '1D' },
		{ id: '1w', label: '1W' }
	];
	const EMA_OPTS: { v: number | null; label: string }[] = [
		{ v: null, label: 'Off' },
		{ v: 9, label: '9' },
		{ v: 21, label: '21' },
		{ v: 50, label: '50' }
	];
	let timeframe = $state<Timeframe>('1d');
	let emaPeriod = $state<number | null>(null);
	const intraday = $derived(timeframe === '1h' || timeframe === '4h');
	const kindFor = (tf: Timeframe): 'line' | 'candle' => (tf === '1h' ? 'line' : 'candle');
	const quoteLabel = $derived(QUOTE_LABEL[effectiveQuote(currency.apiId, quote)]);

	let el = $state<HTMLDivElement>();
	let ready = $state(false);
	let failed = $state(false);
	let loading = $state(false);
	let candles = $state<Candle[]>([]);

	let legPrice = $state(0);
	let legChg = $state(0);
	let legDate = $state('');
	let legVol = $state(0);
	let emaLast = $state<number | null>(null);

	type ChartApi = import('lightweight-charts').IChartApi;
	type AnySeries =
		| import('lightweight-charts').ISeriesApi<'Candlestick'>
		| import('lightweight-charts').ISeriesApi<'Line'>;
	type LineApi = import('lightweight-charts').ISeriesApi<'Line'>;
	let lcRef: typeof import('lightweight-charts') | undefined;
	let chart: ChartApi | undefined;
	let series: AnySeries | undefined;
	let emaSeries: LineApi | undefined;
	let volSeries: import('lightweight-charts').ISeriesApi<'Histogram'> | undefined;
	let seriesKind = $state<'line' | 'candle'>('candle');
	let fcLines: LineApi[] = [];

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
			legVol = last.volume;
		} else {
			legPrice = currency.price / fxRate;
			legChg = currency.change1dPct;
			legDate = '';
			legVol = 0;
		}
	}

	function synth(c: Currency): Candle[] {
		return c.series.map((p) => {
			const t = Math.floor(new Date(`${p.t}T00:00:00Z`).getTime() / 1000);
			return { time: t, open: p.p, high: p.p, low: p.p, close: p.p, volume: p.q ?? 0 };
		});
	}

	function setupSeries(kind: 'line' | 'candle') {
		if (!chart || !lcRef) return;
		for (const s of [series, emaSeries, ...fcLines]) {
			if (s) {
				try {
					chart.removeSeries(s);
				} catch {
					/* gone */
				}
			}
		}
		series = undefined;
		emaSeries = undefined;
		fcLines = [];
		series =
			kind === 'line'
				? chart.addSeries(lcRef.LineSeries, {
						color: '#e0b465',
						lineWidth: 2,
						priceLineVisible: false,
						lastValueVisible: true
					})
				: chart.addSeries(lcRef.CandlestickSeries, {
						upColor: '#66cf8a',
						downColor: '#e57170',
						wickUpColor: '#66cf8a',
						wickDownColor: '#e57170',
						borderVisible: false
					});
		// EMA overlay sits on top so it stays visible over the candles
		emaSeries = chart.addSeries(lcRef.LineSeries, {
			color: '#8aa9c9',
			lineWidth: 1,
			priceLineVisible: false,
			lastValueVisible: false,
			crosshairMarkerVisible: false
		});
		seriesKind = kind;
	}

	function paint() {
		if (!ready || !series) return;
		const data = seriesKind === 'line' ? candles.map((c) => ({ time: c.time, value: c.close })) : candles;
		series.setData(data as never);
		chart?.timeScale().fitContent();
		resetLegend();
	}

	function emaData(cs: Candle[], period: number): { time: number; value: number }[] {
		const k = 2 / (period + 1);
		const out: { time: number; value: number }[] = [];
		let prev = 0;
		let sum = 0;
		for (let i = 0; i < cs.length; i++) {
			const close = cs[i].close;
			if (i < period - 1) {
				sum += close;
				continue;
			}
			if (i === period - 1) {
				sum += close;
				prev = sum / period;
			} else {
				prev = close * k + prev * (1 - k);
			}
			out.push({ time: cs[i].time, value: prev });
		}
		return out;
	}

	function drawEMA() {
		if (!ready || !emaSeries) return;
		if (emaPeriod == null || candles.length < emaPeriod) {
			emaSeries.setData([]);
			emaLast = null;
			return;
		}
		const data = emaData(candles, emaPeriod);
		emaSeries.setData(data as never);
		emaLast = data.length ? data[data.length - 1].value : null;
	}

	function drawVolume() {
		if (!ready || !volSeries) return;
		const data = candles.map((c, i) => {
			const prev = i > 0 ? candles[i - 1].close : c.open;
			return {
				time: c.time,
				value: c.volume,
				color: c.close >= prev ? 'rgba(102,207,138,0.4)' : 'rgba(229,113,112,0.4)'
			};
		});
		volSeries.setData(data as never);
	}

	// Project predictions forward in time: a 2-point line from the last actual
	// Seconds between consecutive epochs, per horizon — used to detect gaps.
	const STEP: Record<Horizon, number> = { hour: 3600, day: 86400, week: 604800 };

	// Plot prediction history as its own time-series: one point per epoch at its
	// settlement time, valued at the predicted price. Point markers flag the real
	// predictions. Where an interval has no forecast we insert a whitespace point
	// so the line BREAKS across the gap instead of drawing a misleading straight
	// bridge — isolated predictions render as standalone dots.
	function drawForecast() {
		if (!ready || !chart || !lcRef) return;
		for (const s of fcLines) {
			try {
				chart.removeSeries(s);
			} catch {
				/* gone */
			}
		}
		fcLines = [];
		if (!forecast) return;

		const addSeries = (pts: PredPoint[], step: number, color: string, dashed: boolean, width: 1 | 2) => {
			if (!chart || !lcRef || pts.length === 0) return;
			const data: ({ time: number; value: number } | { time: number })[] = [];
			for (let i = 0; i < pts.length; i++) {
				data.push({ time: pts[i].t, value: pts[i].v / fxRate });
				const next = pts[i + 1];
				if (next && next.t - pts[i].t > step * 1.5) data.push({ time: pts[i].t + step });
			}
			const s = chart.addSeries(lcRef.LineSeries, {
				color,
				lineWidth: width,
				lineStyle: dashed ? lcRef.LineStyle.Dashed : lcRef.LineStyle.Solid,
				lastValueVisible: true,
				priceLineVisible: false,
				crosshairMarkerVisible: false,
				pointMarkersVisible: true
			});
			s.setData(data as never);
			fcLines.push(s);
		};

		for (const h of ['hour', 'day', 'week'] as Horizon[]) {
			const col = HORIZON_COLORS[h];
			addSeries(forecast.series[h].consensus, STEP[h], col.base, true, 1);
			addSeries(forecast.series[h].you, STEP[h], col.you, false, 2);
		}
		chart.timeScale().fitContent();
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
		const kind = kindFor(tf);
		if (ready && seriesKind !== kind) setupSeries(kind);
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
						close: k.close / dv,
						volume: k.volume
					};
				});
			}
			candles = cs;
		} finally {
			loading = false;
		}
		chart?.applyOptions({ timeScale: { timeVisible: intraday, secondsVisible: false } });
		paint();
		drawVolume();
		drawEMA();
		drawForecast();
	}

	onMount(() => {
		(async () => {
			try {
				lcRef = await import('lightweight-charts');
				if (!el) return;
				chart = lcRef.createChart(el, {
					autoSize: true,
					layout: {
						background: { type: lcRef.ColorType.Solid, color: 'transparent' },
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
						mode: lcRef.CrosshairMode.Normal,
						vertLine: { color: '#2d3346', labelBackgroundColor: '#1b2030' },
						horzLine: { color: '#2d3346', labelBackgroundColor: '#1b2030' }
					}
				});
				setupSeries(kindFor(timeframe));
				volSeries = chart.addSeries(lcRef.HistogramSeries, {
					priceFormat: { type: 'volume' },
					priceScaleId: 'vol',
					color: '#33405a'
				});
				chart.priceScale('vol').applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
				chart.subscribeCrosshairMove((param) => {
					const d = series ? param.seriesData.get(series) : undefined;
					const rec = d as unknown as { close?: number; value?: number } | undefined;
					const v = rec ? (rec.close ?? rec.value) : undefined;
					if (v != null && param.time != null) {
						legPrice = v;
						legDate = fmtTime(Number(param.time));
					} else {
						resetLegend();
					}
				});
				ready = true;
				paint();
				drawVolume();
				drawEMA();
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

	$effect(() => {
		loadHistory(currency, quote, timeframe);
	});
	$effect(() => {
		emaPeriod;
		drawEMA();
	});
	$effect(() => {
		forecast;
		fxRate;
		drawForecast();
	});
</script>

<div class="chart-pane">
	<div class="chart-legend">
		<ItemIcon apiId={currency.apiId} icon={currency.icon} size={20} chip="sym" />
		<span class="cl-name">{currency.name}</span>
		<span class="cl-price">{fmt(legPrice || currency.price / fxRate)} <em>{quoteLabel}</em></span>
		<span class="cl-chg {signClass(legChg)}">{signStr(legChg)}</span>
		{#if legVol > 0}
			<span class="cl-vol">Vol {compact(legVol)}</span>
		{/if}
		{#if emaPeriod != null && emaLast != null}
			<span class="cl-ema">EMA{emaPeriod} {fmt(emaLast)}</span>
		{/if}
		{#if loading}
			<span class="cl-date">loading…</span>
		{:else if legDate}
			<span class="cl-date">{legDate}</span>
		{/if}
		<div class="tf-tabs" role="group" aria-label="EMA">
			<span class="ctl-label">EMA</span>
			{#each EMA_OPTS as o (o.label)}
				<button class:active={emaPeriod === o.v} onclick={() => (emaPeriod = o.v)}>{o.label}</button>
			{/each}
		</div>
		<div class="tf-tabs" role="group" aria-label="Timeframe">
			{#each TFS as t (t.id)}
				<button
					class:active={timeframe === t.id}
					onclick={() => {
						timeframe = t.id;
						ontimeframe?.(t.id);
					}}>{t.label}</button
				>
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
			aria-label={`${currency.name} ${seriesKind === 'line' ? 'price line' : 'candlestick'} chart in ${quoteLabel}`}
		></div>
	{/if}
</div>
