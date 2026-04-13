const STORAGE_KEY = 'solbox_wallets';

export type Wallet = {
	publicKey: string;
	privateKey: string;
};

export function loadWallets(): Wallet[] {
	if (typeof localStorage === 'undefined') return [];
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return [];
		const parsed = JSON.parse(raw);
		if (!Array.isArray(parsed)) return [];
		return parsed.filter(
			(w: any) => typeof w.publicKey === 'string' && typeof w.privateKey === 'string'
		);
	} catch {
		return [];
	}
}

export function saveWallets(wallets: Wallet[]): void {
	if (typeof localStorage === 'undefined') return;
	localStorage.setItem(STORAGE_KEY, JSON.stringify(wallets));
}
