// Deterministic public handle derived from a pid (FNV-1a → base36). Lets us
// build shareable /u/<handle> URLs without exposing the raw provider id.
export function handleOf(pid: string): string {
	let h = 2166136261;
	for (let i = 0; i < pid.length; i++) {
		h ^= pid.charCodeAt(i);
		h = Math.imul(h, 16777619);
	}
	return (h >>> 0).toString(36).padStart(7, '0');
}
