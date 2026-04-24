export const BASE58_CHARS = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

export function formatTime(seconds: number): string {
	if (seconds >= 3600) return `${Math.floor(seconds / 3600)}h ${Math.floor(seconds % 3600 / 60)}m`;
	return `${Math.floor(seconds / 60)}m ${Math.floor(seconds % 60)}s`;
}

export function isValidBase58(str: string): boolean {
	return [...str].every((c) => BASE58_CHARS.includes(c));
}

export function sanitizeBase58(str: string): string {
	return [...str].filter((c) => BASE58_CHARS.includes(c)).join('');
}

export function getDifficulty(prefixLen: number, suffixLen: number): number {
	const len = prefixLen + suffixLen;
	if (len === 0) return 1;
	return Math.pow(58, len);
}

export function formatDifficulty(n: number): string {
	if (n >= 1e15) return `~${(n / 1e15).toFixed(1)}Q`;
	if (n >= 1e12) return `~${(n / 1e12).toFixed(1)}T`;
	if (n >= 1e9) return `~${(n / 1e9).toFixed(1)}B`;
	if (n >= 1e6) return `~${(n / 1e6).toFixed(1)}M`;
	if (n >= 1e3) return `~${(n / 1e3).toFixed(1)}K`;
	return `~${n}`;
}
