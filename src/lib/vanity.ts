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

// Empirical probability of a Solana address (32-byte ed25519 pubkey, base58) starting with `c`.
// 2^256 / 58^43 ≈ 17.31, so ~94% of addresses are 44 chars with first digit in [1, 17];
// the rest are 43 chars (any digit), and ~0.4% start with "1" via leading zero bytes.
function getFirstCharProb(c: string): number {
	const idx = BASE58_CHARS.indexOf(c);
	if (idx < 0) return 0;
	if (idx === 0) return 0.0039;
	if (idx <= 16) return 0.058;
	if (idx === 17) return 0.021;
	return 0.001;
}

export function getDifficulty(prefix: string, suffix: string): number {
	const len = prefix.length + suffix.length;
	if (len === 0) return 1;
	if (prefix.length === 0) return Math.pow(58, suffix.length);
	return 1 / (getFirstCharProb(prefix[0]) * Math.pow(1 / 58, len - 1));
}

export function formatDifficulty(n: number): string {
	if (n >= 1e15) return `~${(n / 1e15).toFixed(1)}Q`;
	if (n >= 1e12) return `~${(n / 1e12).toFixed(1)}T`;
	if (n >= 1e9) return `~${(n / 1e9).toFixed(1)}B`;
	if (n >= 1e6) return `~${(n / 1e6).toFixed(1)}M`;
	if (n >= 1e3) return `~${(n / 1e3).toFixed(1)}K`;
	return `~${n}`;
}
