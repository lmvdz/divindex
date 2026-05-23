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
		league,
		divineId,
		fxRate,
		forecast,
		dispPrice,
		dispChange,
		premium = false,
		ontimeframe
	}: {
		currency: Currency;
		quote: Quote;
		league: string;
		divineId: number;
		fxRate: number;
		forecast: Forecast | null;
		dispPrice?: number; // canonical (converted) headline price — matches sidebar/stats
		dispChange?: number; // canonical 24h change
		premium?: boolean; // unlocks Pro indicators (VWAP)
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
	let bb = $state(false);
	let vwap = $state(false);
	let cone = $state(false);
	let fc = $state(true);
	const intraday = $derived(timeframe === '1h' || timeframe === '4h');
	const kindFor = (tf: Timeframe): 'line' | 'candle' => (tf === '1h' ? 'line' : 'candle');
	const quoteLabel = $derived(QUOTE_LABEL[effectiveQuote(currency.apiId, quote)]);

	let el = $state<HTMLDivElement>();
	let ready = $state(false);
	let failed = $state(false);
	let loading = $state(false);
	let candles = $state<Candle[]>([]);
	// lazy history paging (TradingView-style): keep the raw (Exalted) candles we've
	// loaded so far and pull older pages from the server's cached set on scroll-back.
	let rawItem: Candle[] = [];
	let rawDivine: Candle[] = [];
	let oldestTime = Infinity;
	let hasMore = false;
	let pageLoading = false;
	const RECENT = 1500; // initial window (covers daily/weekly fully; 1h pages back)
	const PAGE = 1500; // older candles fetched per scroll-back

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
	let bbSeries: LineApi[] = [];
	let vwapSeries: LineApi | undefined;
	let coneLines: LineApi[] = [];

	function fmtTime(sec: number): string {
		const iso = new Date(sec * 1000).toISOString();
		return intraday ? iso.slice(5, 16).replace('T', ' ') : iso.slice(0, 10);
	}

	function resetLegend() {
		// Headline price/change use the canonical currency value (same source as the
		// sidebar/screener/stats) so they always agree across the app. Candles are the
		// detailed hourly history; the crosshair shows per-bar values on hover.
		legPrice = dispPrice ?? currency.price / fxRate;
		legChg = dispChange ?? currency.change1dPct;
		if (candles.length) {
			legDate = fmtTime(candles[candles.length - 1].time);
			legVol = candles[candles.length - 1].volume;
		} else {
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

	function paint(fit = true) {
		if (!ready || !series) return;
		const data = seriesKind === 'line' ? candles.map((c) => ({ time: c.time, value: c.close })) : candles;
		series.setData(data as never);
		if (fit) chart?.timeScale().fitContent();
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

	function bollinger(cs: Candle[], period = 20, mult = 2) {
		const out: { time: number; upper: number; mid: number; lower: number }[] = [];
		for (let i = period - 1; i < cs.length; i++) {
			let sum = 0;
			for (let j = i - period + 1; j <= i; j++) sum += cs[j].close;
			const mean = sum / period;
			let v = 0;
			for (let j = i - period + 1; j <= i; j++) {
				const d = cs[j].close - mean;
				v += d * d;
			}
			const sd = Math.sqrt(v / period);
			out.push({ time: cs[i].time, upper: mean + mult * sd, mid: mean, lower: mean - mult * sd });
		}
		return out;
	}

	function drawBB() {
		if (!ready || !chart || !lcRef) return;
		for (const s of bbSeries) {
			try {
				chart.removeSeries(s);
			} catch {
				/* gone */
			}
		}
		bbSeries = [];
		if (!bb || candles.length < 20) return;
		const data = bollinger(candles, 20, 2);
		const band = (vals: { time: number; value: number }[], width: 1 | 2, dashed: boolean, alpha: number) => {
			const s = chart!.addSeries(lcRef!.LineSeries, {
				color: `rgba(176,138,255,${alpha})`,
				lineWidth: width,
				lineStyle: dashed ? lcRef!.LineStyle.Dashed : lcRef!.LineStyle.Solid,
				priceLineVisible: false,
				lastValueVisible: false,
				crosshairMarkerVisible: false
			});
			s.setData(vals as never);
			bbSeries.push(s);
		};
		band(data.map((d) => ({ time: d.time, value: d.upper })), 1, true, 0.55);
		band(data.map((d) => ({ time: d.time, value: d.mid })), 1, false, 0.3);
		band(data.map((d) => ({ time: d.time, value: d.lower })), 1, true, 0.55);
	}

	// Anchored VWAP — cumulative (typical price × volume) / cumulative volume.
	function vwapData(cs: Candle[]) {
		const out: { time: number; value: number }[] = [];
		let pv = 0;
		let vol = 0;
		for (const c of cs) {
			const tp = (c.high + c.low + c.close) / 3;
			pv += tp * (c.volume || 0);
			vol += c.volume || 0;
			out.push({ time: c.time, value: vol ? pv / vol : tp });
		}
		return out;
	}

	function drawVWAP() {
		if (!ready || !chart || !lcRef) return;
		if (vwapSeries) {
			try {
				chart.removeSeries(vwapSeries);
			} catch {
				/* gone */
			}
			vwapSeries = undefined;
		}
		if (!vwap || !premium || candles.length < 2) return;
		vwapSeries = chart.addSeries(lcRef.LineSeries, {
			color: '#d98fe0',
			lineWidth: 2,
			priceLineVisible: false,
			lastValueVisible: false,
			crosshairMarkerVisible: false
		});
		vwapSeries.setData(vwapData(candles) as never);
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

	// Plot prediction history as its own time-series. Each prediction is SNAPPED to
	// the candle bucket containing its settlement time so it lands on an existing
	// candle instead of inserting a phantom time slot (which would gap the candles).
	// Future (open-epoch) predictions keep their real time and extend the axis right.
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
		if (!forecast || !fc) return;

		const times = candles.map((c) => c.time);
		const last = times.length ? times[times.length - 1] : 0;
		const snap = (t: number): number => {
			if (!times.length || t >= last) return t; // future → keep (forward projection)
			let b = times[0];
			for (const ct of times) {
				if (ct <= t) b = ct;
				else break;
			}
			return b;
		};

		const addSeries = (pts: PredPoint[], color: string, dashed: boolean, width: 1 | 2) => {
			if (!chart || !lcRef || pts.length === 0) return;
			const byTime = new Map<number, number>();
			for (const p of pts) byTime.set(snap(p.t), p.v); // snap to bucket, dedupe (last wins)
			const data = [...byTime.entries()]
				.sort((a, b) => a[0] - b[0])
				.map(([t, v]) => ({ time: t, value: v / fxRate }));
			const s = chart.addSeries(lcRef.LineSeries, {
				color,
				lineWidth: width,
				lineStyle: dashed ? lcRef.LineStyle.Dashed : lcRef.LineStyle.Solid,
				lastValueVisible: false,
				priceLineVisible: false,
				crosshairMarkerVisible: false,
				pointMarkersVisible: true,
				autoscaleInfoProvider: () => null
			});
			s.setData(data as never);
			fcLines.push(s);
		};

		for (const h of ['hour', 'day', 'week'] as Horizon[]) {
			const col = HORIZON_COLORS[h];
			addSeries(forecast.series[h].consensus, col.base, true, 1);
			addSeries(forecast.series[h].you, col.you, false, 2);
		}
		chart.timeScale().fitContent();
	}

	// Forward forecast cone (Pro): from the last price to each horizon's open-epoch
	// prediction band (p25/p75) + consensus. Premium toggle, off by default; uses
	// the same safe 2-point line-series pattern as the forecast lines.
	function drawCone() {
		if (!ready || !chart || !lcRef) return;
		for (const s of coneLines) {
			try {
				chart.removeSeries(s);
			} catch {
				/* gone */
			}
		}
		coneLines = [];
		if (!cone || !premium || !forecast || candles.length === 0) return;
		const last = candles[candles.length - 1];
		const anchor = { time: last.time, value: last.close };
		const edge = (endSec: number, value: number, color: string, width: 1 | 2, dashed: boolean) => {
			if (!chart || !lcRef || endSec <= last.time) return;
			const s = chart.addSeries(lcRef.LineSeries, {
				color,
				lineWidth: width,
				lineStyle: dashed ? lcRef.LineStyle.Dashed : lcRef.LineStyle.Solid,
				priceLineVisible: false,
				lastValueVisible: false,
				crosshairMarkerVisible: false
			});
			s.setData([anchor, { time: endSec, value }] as never);
			coneLines.push(s);
		};
		for (const h of ['hour', 'day', 'week'] as Horizon[]) {
			const hz = forecast.horizons[h];
			const col = HORIZON_COLORS[h];
			const endSec = Math.floor(hz.end / 1000);
			if (hz.lo != null) edge(endSec, hz.lo / fxRate, col.base, 1, true);
			if (hz.hi != null) edge(endSec, hz.hi / fxRate, col.base, 1, true);
			if (hz.consensus != null) edge(endSec, hz.consensus / fxRate, col.you, 2, false);
		}
		chart.timeScale().fitContent();
	}

	// Conversion to Divine is needed when viewing Exalted itself (inverse of Divine)
	// or any non-Divine currency quoted in Divine — both join against Divine candles.
	const needsDivine = (c: Currency, q: Quote) =>
		c.apiId === 'exalted' || (effectiveQuote(c.apiId, q) === 'divine' && c.apiId !== 'divine');

	async function fetchPage(
		id: number,
		tf: Timeframe,
		before: number | null,
		limit: number
	): Promise<{ candles: Candle[]; hasMore: boolean }> {
		try {
			const qs = new URLSearchParams({ tf, league, limit: String(limit) });
			if (before != null && Number.isFinite(before)) qs.set('before', String(before));
			const r = await fetch(`/api/history/${id}?${qs.toString()}`);
			if (!r.ok) return { candles: [], hasMore: false };
			const d = (await r.json()) as { candles?: Candle[]; hasMore?: boolean };
			return { candles: d.candles ?? [], hasMore: !!d.hasMore };
		} catch {
			return { candles: [], hasMore: false };
		}
	}

	// Convert the accumulated raw (Exalted) candles to the active quote, then run the
	// gapless pass over the WHOLE set so prepended older pages stitch seamlessly.
	function convertCandles(itemRaw: Candle[], divRaw: Candle[], c: Currency, q: Quote): Candle[] {
		let cs = itemRaw;
		if (c.apiId === 'exalted') {
			// Exalted is flat 1.0 in Exalted; its real movement vs Divine is the inverse
			// of Divine's candle (high/low swap on inversion) — render real candles.
			if (divRaw.length) {
				const inv = (x: number) => (x ? 1 / x : 0);
				const volByT = new Map(itemRaw.map((k) => [k.time, k.volume]));
				cs = divRaw.map((d) => ({
					time: d.time,
					open: inv(d.open),
					high: inv(d.low),
					low: inv(d.high),
					close: inv(d.close),
					volume: volByT.get(d.time) ?? d.volume
				}));
			}
		} else if (effectiveQuote(c.apiId, q) === 'divine' && c.apiId !== 'divine') {
			const byT = new Map(divRaw.map((k) => [k.time, k.close]));
			const fallback = divRaw.length ? divRaw[divRaw.length - 1].close : fxRate || 1;
			cs = itemRaw.map((k) => {
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
		// gapless (clone first so we never mutate the cached raw arrays)
		const out = cs.map((k) => ({ ...k }));
		for (let i = 1; i < out.length; i++) {
			const o = out[i - 1].close;
			out[i].open = o;
			if (o > out[i].high) out[i].high = o;
			if (o < out[i].low) out[i].low = o;
		}
		return out;
	}

	async function loadHistory(c: Currency, q: Quote, tf: Timeframe) {
		const kind = kindFor(tf);
		if (ready && seriesKind !== kind) setupSeries(kind);
		loading = true;
		try {
			const item = await fetchPage(c.id, tf, null, RECENT);
			let itemRaw = item.candles;
			let div = { candles: [] as Candle[], hasMore: false };
			if (needsDivine(c, q) && itemRaw.length) div = await fetchPage(divineId, tf, null, RECENT);
			if (!itemRaw.length) itemRaw = synth(c);
			rawItem = itemRaw;
			rawDivine = div.candles;
			candles = convertCandles(rawItem, rawDivine, c, q);
			oldestTime = candles.length ? candles[0].time : Infinity;
			hasMore = c.apiId === 'exalted' ? div.hasMore : item.hasMore;
		} finally {
			loading = false;
		}
		chart?.applyOptions({ timeScale: { timeVisible: intraday, secondsVisible: false } });
		paint(true);
		drawVolume();
		drawEMA();
		drawForecast();
		drawBB();
		drawVWAP();
		drawCone();
		// large series: show the recent window so we don't auto-page; older loads on scroll
		if (hasMore && candles.length > 400) {
			chart?.timeScale().setVisibleLogicalRange({ from: candles.length - 400, to: candles.length });
		}
	}

	// Pull the next older page and prepend it, keeping the same bars in view (shift
	// the visible logical range by however many older bars we added).
	async function loadOlder() {
		if (pageLoading || !hasMore || !ready || !chart) return;
		pageLoading = true;
		const c = currency;
		const q = quote;
		const tf = timeframe;
		const before = oldestTime;
		try {
			const item = await fetchPage(c.id, tf, before, PAGE);
			let div = { candles: [] as Candle[], hasMore: false };
			if (needsDivine(c, q)) div = await fetchPage(divineId, tf, before, PAGE);
			if (!item.candles.length && !div.candles.length) {
				hasMore = false;
				return;
			}
			rawItem = [...item.candles, ...rawItem];
			rawDivine = [...div.candles, ...rawDivine];
			const range = chart.timeScale().getVisibleLogicalRange();
			const prevLen = candles.length;
			candles = convertCandles(rawItem, rawDivine, c, q);
			oldestTime = candles.length ? candles[0].time : oldestTime;
			hasMore = c.apiId === 'exalted' ? div.hasMore : item.hasMore;
			const added = candles.length - prevLen;
			paint(false);
			drawVolume();
			drawEMA();
			drawForecast();
			drawBB();
			drawVWAP();
			drawCone();
			if (range && added > 0) {
				chart.timeScale().setVisibleLogicalRange({ from: range.from + added, to: range.to + added });
			}
		} finally {
			pageLoading = false;
		}
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
				// lazy history: when the user scrolls near the left edge, pull older bars
				chart.timeScale().subscribeVisibleLogicalRangeChange((range) => {
					if (range && range.from < 8) loadOlder();
				});
				ready = true;
				paint();
				drawVolume();
				drawEMA();
				drawForecast();
				drawBB();
				drawVWAP();
				drawCone();
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
		league;
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
		drawCone();
	});
	$effect(() => {
		bb;
		drawBB();
	});
	$effect(() => {
		vwap;
		premium;
		drawVWAP();
	});
	$effect(() => {
		cone;
		premium;
		drawCone();
	});
	$effect(() => {
		fc;
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
		<div class="tf-tabs" role="group" aria-label="Indicators">
			<button class:active={fc} onclick={() => (fc = !fc)} title="Forecast overlay (your + consensus calls)">FC</button>
			<button class:active={bb} onclick={() => (bb = !bb)} title="Bollinger Bands (20, 2σ)">BB</button>
			{#if premium}
				<button class:active={vwap} onclick={() => (vwap = !vwap)} title="VWAP (anchored) — Pro">VWAP</button>
				<button class:active={cone} onclick={() => (cone = !cone)} title="Forecast cone (crowd p25–p75) — Pro">Cone</button>
			{/if}
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
