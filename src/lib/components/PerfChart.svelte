<script lang="ts">
	import { onMount } from 'svelte';

	interface PerfLine {
		apiId: string;
		name: string;
		color: string;
		series: { t: number; pct: number }[];
	}
	let { lines }: { lines: PerfLine[] } = $props();

	let el = $state<HTMLDivElement>();
	let lcRef: typeof import('lightweight-charts') | undefined;
	let chart: import('lightweight-charts').IChartApi | undefined;
	let seriesList: import('lightweight-charts').ISeriesApi<'Line'>[] = [];
	let ready = $state(false);
	let failed = $state(false);

	// live crosshair readout: name → % at the hovered time (falls back to final %)
	let hoverPct = $state<Record<string, number>>({});
	let hovering = $state(false);
	let hoverDate = $state('');

	const fmtPct = (pct: number) =>
		`${pct >= 0 ? '+' : ''}${Math.abs(pct) >= 100 ? pct.toFixed(0) : pct.toFixed(1)}%`;

	const legend = $derived(
		[...lines]
			.map((l) => ({ ...l, final: l.series.length ? l.series[l.series.length - 1].pct : 0 }))
			.sort((a, b) => b.final - a.final)
	);

	function draw() {
		if (!ready || !chart || !lcRef) return;
		for (const s of seriesList) {
			try {
				chart.removeSeries(s);
			} catch {
				/* gone */
			}
		}
		seriesList = lines.map((l) => {
			const s = chart!.addSeries(lcRef!.LineSeries, {
				color: l.color,
				lineWidth: 2,
				priceLineVisible: false,
				lastValueVisible: false,
				crosshairMarkerVisible: true,
				crosshairMarkerRadius: 3
			});
			// plot the rebased ratio (1 + pct/100) so a Logarithmic price scale can
			// render it (log needs positive values); the axis formatter and legend
			// convert the ratio back into a percentage.
			s.setData(l.series.map((p) => ({ time: p.t as never, value: 1 + p.pct / 100 })));
			return s;
		});
		chart.timeScale().fitContent();
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
					rightPriceScale: {
						borderColor: '#232838',
						mode: lcRef.PriceScaleMode.Logarithmic
					},
					timeScale: { borderColor: '#232838', timeVisible: false, secondsVisible: false },
					crosshair: {
						mode: lcRef.CrosshairMode.Normal,
						vertLine: { color: '#2d3346', labelBackgroundColor: '#1b2030' },
						horzLine: { color: '#2d3346', labelBackgroundColor: '#1b2030' }
					},
					localization: { priceFormatter: (v: number) => fmtPct((v - 1) * 100) }
				});
				chart.subscribeCrosshairMove((param) => {
					if (param.time == null) {
						hovering = false;
						return;
					}
					hovering = true;
					hoverDate = new Date(Number(param.time) * 1000).toISOString().slice(0, 10);
					const m: Record<string, number> = {};
					for (let i = 0; i < seriesList.length; i++) {
						const d = param.seriesData.get(seriesList[i]) as { value?: number } | undefined;
						if (d?.value != null) m[lines[i].apiId] = (d.value - 1) * 100;
					}
					hoverPct = m;
				});
				ready = true;
				draw();
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
		lines;
		draw();
	});
</script>

<div class="perf-lc-wrap">
	{#if failed}
		<p class="muted">Chart failed to load.</p>
	{/if}
	<div class="perf-lc" bind:this={el}></div>
	<div class="perf-legend-head">
		<span class="muted">{hovering ? hoverDate : 'latest'}</span>
	</div>
	<ul class="perf-legend">
		{#each legend as l (l.apiId)}
			{@const v = hovering && hoverPct[l.apiId] != null ? hoverPct[l.apiId] : l.final}
			<li>
				<span class="perf-dot" style="background:{l.color}"></span>
				<a href="/?c={l.apiId}">{l.name}</a>
				<span class="mono {v > 0 ? 'pos' : v < 0 ? 'neg' : ''}">{fmtPct(v)}</span>
			</li>
		{/each}
	</ul>
</div>

<style>
	.perf-lc-wrap {
		width: 100%;
	}
	.perf-lc {
		width: 100%;
		height: 300px;
	}
	.perf-legend-head {
		display: flex;
		justify-content: flex-end;
		font-size: 11px;
		margin-top: 6px;
	}
</style>
