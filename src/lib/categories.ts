// Human-friendly labels for poe2scout currency categories (some slugs are ugly:
// vaultkeys, uncutgems, lineagesupportgems).
const LABELS: Record<string, string> = {
	currency: 'Currency',
	fragments: 'Fragments',
	runes: 'Runes',
	essences: 'Essences',
	ultimatum: 'Ultimatum',
	expedition: 'Expedition',
	ritual: 'Ritual',
	breach: 'Breach',
	abyss: 'Abyss',
	delirium: 'Delirium',
	incursion: 'Incursion',
	idol: 'Idols',
	vaultkeys: 'Vault Keys',
	uncutgems: 'Uncut Gems',
	lineagesupportgems: 'Lineage Support Gems'
};

export function categoryLabel(c: string): string {
	return LABELS[c] ?? c.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (m) => m.toUpperCase());
}
