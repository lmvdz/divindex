<script lang="ts">
	import { tip } from '$lib/tooltip.svelte';
	import { fmt, compact, signStr, signClass } from '$lib/format';

	const W = 292;
	let h = $state(0);

	const pos = $derived.by(() => {
		let x = tip.x + 18;
		let y = tip.y + 18;
		if (typeof window !== 'undefined') {
			if (x + W > window.innerWidth - 8) x = tip.x - W - 18;
			if (x < 8) x = 8;
			const hh = h || 300;
			if (y + hh > window.innerHeight - 8) y = Math.max(8, window.innerHeight - hh - 8);
		}
		return { x, y };
	});
</script>

{#if tip.cur}
	{@const c = tip.cur}
	<div class="poe-tip" style="left:{pos.x}px; top:{pos.y}px; width:{W}px" bind:clientHeight={h}>
		<div class="poe-head">
			<span class="flank"></span>
			<span class="poe-name">{c.name}</span>
			<span class="flank flip"></span>
		</div>
		{#if c.meta?.baseType && c.meta.baseType !== c.name}
			<div class="poe-type">{c.meta.baseType}</div>
		{/if}

		<div class="poe-sep"></div>

		<div class="poe-body">
			{#if c.icon}<img class="poe-icon" src={c.icon} alt="" />{/if}
			{#if c.meta?.stackSize}
				<div class="poe-prop">
					Stack Size: <b>{c.meta.stackSize}{c.meta.maxStackSize ? ` / ${c.meta.maxStackSize}` : ''}</b>
				</div>
			{/if}
			{#if c.meta?.effect?.length}
				{#each c.meta.effect as line, i (i)}
					<div class="poe-effect">{line}</div>
				{/each}
			{/if}
			{#if c.meta?.description}
				<div class="poe-desc">{c.meta.description}</div>
			{/if}
		</div>

		<div class="poe-sep"></div>

		<div class="poe-data">
			<div><span>Price</span><b>{fmt(c.price)} {tip.unit}</b></div>
			<div><span>24h</span><b class={signClass(c.change1dPct)}>{signStr(c.change1dPct)}</b></div>
			<div><span>7d</span><b class={signClass(c.changePct)}>{signStr(c.changePct)}</b></div>
			<div><span>Vol</span><b>{compact(c.volume)}</b></div>
		</div>
	</div>
{/if}

<style>
	.poe-tip {
		position: fixed;
		z-index: 200;
		pointer-events: none;
		background: linear-gradient(180deg, rgba(8, 8, 11, 0.97), rgba(4, 4, 6, 0.97));
		border: 1px solid rgba(150, 126, 78, 0.55);
		box-shadow:
			inset 0 0 0 1px rgba(0, 0, 0, 0.7),
			0 14px 40px -10px rgba(0, 0, 0, 0.75);
		color: #c8c8d0;
		font-family: 'Inter', system-ui, sans-serif;
	}
	.poe-head {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 10px;
		padding: 8px 12px;
		background: linear-gradient(180deg, rgba(46, 38, 24, 0.92), rgba(28, 23, 14, 0.92));
		border-bottom: 1px solid rgba(150, 126, 78, 0.35);
	}
	.poe-name {
		font-family: 'Fraunces', Georgia, serif;
		font-weight: 600;
		font-size: 1.02rem;
		letter-spacing: 0.3px;
		color: #e6c994;
		text-align: center;
	}
	.flank {
		width: 22px;
		height: 1px;
		flex: none;
		background: linear-gradient(90deg, transparent, rgba(214, 184, 120, 0.7));
	}
	.flank.flip {
		transform: scaleX(-1);
	}
	.poe-type {
		text-align: center;
		color: #8a8a96;
		font-size: 0.78rem;
		padding: 6px 12px 0;
	}
	.poe-sep {
		height: 1px;
		margin: 8px 12px;
		background: linear-gradient(90deg, transparent, rgba(150, 126, 78, 0.45), transparent);
	}
	.poe-body {
		padding: 2px 14px 6px;
		text-align: center;
	}
	.poe-icon {
		width: 52px;
		height: 52px;
		object-fit: contain;
		display: block;
		margin: 2px auto 10px;
	}
	.poe-prop {
		color: #9aa0ad;
		font-size: 0.82rem;
		margin: 3px 0;
	}
	.poe-prop b {
		color: #e7e9f0;
		font-weight: 600;
	}
	.poe-effect {
		color: #9b9bff;
		font-size: 0.85rem;
		line-height: 1.45;
		margin: 4px 0;
	}
	.poe-desc {
		color: #7f8090;
		font-size: 0.79rem;
		line-height: 1.45;
		margin: 6px 2px 2px;
	}
	.poe-data {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 4px 14px;
		padding: 8px 14px 11px;
		background: rgba(224, 180, 101, 0.05);
		border-top: 1px solid rgba(150, 126, 78, 0.22);
	}
	.poe-data div {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		gap: 8px;
	}
	.poe-data span {
		color: #7f8090;
		font-size: 0.72rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}
	.poe-data b {
		font-family: 'Geist Mono', ui-monospace, monospace;
		font-size: 0.82rem;
		font-weight: 500;
		color: #eef0f6;
		font-variant-numeric: tabular-nums;
	}
	.poe-data b.up {
		color: #66cf8a;
	}
	.poe-data b.down {
		color: #e57170;
	}
</style>
