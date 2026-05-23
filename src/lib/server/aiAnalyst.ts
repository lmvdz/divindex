import type { AiBriefing, FairValue, MarketAnalytics, SmartMoney } from '$lib/types';

// AI economy analyst (capstone). Calls the Anthropic API with a financial-analyst
// prompt grounded in our market + Signal + fair-value data and forces structured
// output via tool use. No-ops gracefully (configured:false) when ANTHROPIC_API_KEY
// is absent, so the feature lights up the moment the key is added. Result is cached
// in KV for 6h to bound LLM cost. (Sentiment ingestion — Reddit/forums — is the
// next layer; see documentation/analytics-roadmap.md.)
type Plat = App.Platform | undefined;
type KV = { get(k: string, t: 'json'): Promise<unknown>; put(k: string, v: string): Promise<void> };
const CACHE_KEY = 'ai_briefing';
const TTL = 6 * 3600 * 1000;

const SYSTEM = `You are a markets analyst for the Path of Exile 2 in-game currency economy. Analyze ONLY the data provided in the user message. Produce 3-8 actionable recommendations via the emit_recommendations tool. For each, cite the specific data point (signal edge, fair-value deviation, mover, breadth) in the rationale. Prices are in Exalted Orbs. This is analysis of a video-game economy for entertainment — not financial advice. If the data is insufficient for a currency, prefer "hold".`;

const REC_TOOL = {
	name: 'emit_recommendations',
	description: 'Emit the trading recommendations.',
	input_schema: {
		type: 'object',
		properties: {
			recommendations: {
				type: 'array',
				items: {
					type: 'object',
					properties: {
						item: { type: 'string' },
						apiId: { type: 'string' },
						action: { type: 'string', enum: ['buy', 'sell', 'hold'] },
						target: { type: 'number' },
						confidence: { type: 'number' },
						horizon: { type: 'string' },
						rationale: { type: 'string' }
					},
					required: ['item', 'action', 'confidence', 'rationale']
				}
			}
		},
		required: ['recommendations']
	}
};

function buildContext(a: MarketAnalytics, signal: SmartMoney, fair: FairValue): string {
	const movers = a.movers.slice(0, 10).map((m) => `${m.name} ${m.changePct}%`).join(', ');
	const vol = a.volatility.slice(0, 6).map((v) => `${v.name} σ${v.vol}%`).join(', ');
	const sigs = signal.signals.slice(0, 12).map((s) => `${s.name} ${s.horizon}: signal edge ${s.edgePct}% (n=${s.n})`).join('\n');
	const mis = fair.rows.slice(0, 12).map((r) => `${r.name}: ${r.deviationPct}% vs fair (conf ${Math.round(r.confidence * 100)}%)`).join('\n');
	return [
		`League: ${a.league}. Market breadth: ${a.breadth.pct}% advancing (${a.breadth.up} up / ${a.breadth.down} down).`,
		`Top movers (full league): ${movers}`,
		`Most volatile: ${vol}`,
		`\nForecaster Signal (alpha-weighted edge vs price):\n${sigs || 'none yet'}`,
		`\nFair-value mispricings (last tick vs liquidity-weighted fair):\n${mis || 'none'}`
	].join('\n');
}

export async function getAiBriefing(
	platform: Plat,
	analytics: MarketAnalytics,
	signal: SmartMoney,
	fair: FairValue
): Promise<AiBriefing> {
	const env = (platform?.env ?? {}) as unknown as Record<string, string | undefined>;
	const key = env.ANTHROPIC_API_KEY;
	if (!key) {
		return {
			configured: false,
			updatedAt: Date.now(),
			recommendations: [],
			note: 'Add ANTHROPIC_API_KEY (Cloudflare secret) to enable the AI analyst.'
		};
	}

	const kv = platform?.env?.FORECAST_KV as unknown as KV | undefined;
	if (kv) {
		const cached = (await kv.get(CACHE_KEY, 'json')) as { at: number; data: AiBriefing } | null;
		if (cached && Date.now() - cached.at < TTL) return cached.data;
	}

	const model = env.ANTHROPIC_MODEL || 'claude-sonnet-4-6';
	try {
		const res = await fetch('https://api.anthropic.com/v1/messages', {
			method: 'POST',
			headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
			body: JSON.stringify({
				model,
				max_tokens: 1500,
				system: SYSTEM,
				tools: [REC_TOOL],
				tool_choice: { type: 'tool', name: 'emit_recommendations' },
				messages: [{ role: 'user', content: buildContext(analytics, signal, fair) }]
			})
		});
		if (!res.ok) {
			return { configured: true, updatedAt: Date.now(), recommendations: [], note: `AI error ${res.status}` };
		}
		const out = (await res.json()) as { content?: { type: string; input?: { recommendations?: AiBriefing['recommendations'] } }[] };
		const tool = out.content?.find((c) => c.type === 'tool_use');
		const briefing: AiBriefing = {
			configured: true,
			updatedAt: Date.now(),
			model,
			recommendations: tool?.input?.recommendations ?? []
		};
		if (kv) await kv.put(CACHE_KEY, JSON.stringify({ at: Date.now(), data: briefing }));
		return briefing;
	} catch {
		return { configured: true, updatedAt: Date.now(), recommendations: [], note: 'AI request failed.' };
	}
}
