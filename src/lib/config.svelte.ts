const STORAGE_KEY = 'solbox_config';
const MAX_HISTORY = 100;

export type WalletEntry = {
	publicKey: string;
	privateKey: string;
	mnemonic?: string;
	byteArray?: string;
	label?: string;
	prefix?: string;
	suffix?: string;
};

export type Config = {
	wallets: WalletEntry[];
	lastModified: string;
	lastAction: string;
};

function emptyConfig(): Config {
	return { wallets: [], lastModified: new Date().toISOString(), lastAction: '' };
}

function cloneConfig(c: Config): Config {
	return JSON.parse(JSON.stringify(c));
}

function loadFromStorage(): Config {
	if (typeof localStorage === 'undefined') return emptyConfig();
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return emptyConfig();
		const parsed = JSON.parse(raw);
		if (!parsed || !Array.isArray(parsed.wallets)) return emptyConfig();
		return {
			wallets: parsed.wallets
				.filter((w: any) => typeof w.publicKey === 'string' && typeof w.privateKey === 'string')
				.map((w: any) => ({
					publicKey: w.publicKey,
					privateKey: w.privateKey,
					mnemonic: w.mnemonic || undefined,
					byteArray: w.byteArray || undefined,
					label: w.label || undefined,
					prefix: w.prefix || undefined,
					suffix: w.suffix || undefined,
				})),
			lastModified: parsed.lastModified || new Date().toISOString(),
			lastAction: parsed.lastAction || '',
		};
	} catch {
		return emptyConfig();
	}
}

function saveToStorage(config: Config): void {
	if (typeof localStorage === 'undefined') return;
	localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

// --- Migrate old format ---
function migrateOldWallets(): Config | null {
	if (typeof localStorage === 'undefined') return null;
	const oldRaw = localStorage.getItem('solbox_wallets');
	if (!oldRaw) return null;
	// Only migrate if new key doesn't exist yet
	if (localStorage.getItem(STORAGE_KEY)) return null;
	try {
		const parsed = JSON.parse(oldRaw);
		if (!Array.isArray(parsed)) return null;
		const wallets: WalletEntry[] = parsed
			.filter((w: any) => typeof w.publicKey === 'string' && typeof w.privateKey === 'string')
			.map((w: any) => ({
				publicKey: w.publicKey,
				privateKey: w.privateKey,
				label: w.label || undefined,
			}));
		const config: Config = {
			wallets,
			lastModified: new Date().toISOString(),
			lastAction: 'Migrated from old format',
		};
		saveToStorage(config);
		localStorage.removeItem('solbox_wallets');
		return config;
	} catch {
		return null;
	}
}

// --- Init ---
const migrated = migrateOldWallets();
const initial = migrated ?? loadFromStorage();

let config = $state<Config>(cloneConfig(initial));
let history = $state<Config[]>([cloneConfig(initial)]);
let historyIndex = $state(0);

// --- Exports ---

export function getConfig(): Config {
	return config;
}

export function getWallets(): WalletEntry[] {
	return config.wallets;
}

export function getLastAction(): string {
	return config.lastAction;
}

export function canUndo(): boolean {
	return historyIndex > 0;
}

export function canRedo(): boolean {
	return historyIndex < history.length - 1;
}

export function updateConfig(wallets: WalletEntry[], actionName: string): void {
	// Truncate forward history
	if (historyIndex < history.length - 1) {
		history = history.slice(0, historyIndex + 1);
	}

	const newConfig: Config = {
		wallets: JSON.parse(JSON.stringify(wallets)),
		lastModified: new Date().toISOString(),
		lastAction: actionName,
	};

	history.push(cloneConfig(newConfig));
	if (history.length > MAX_HISTORY) {
		history = history.slice(history.length - MAX_HISTORY);
	}
	historyIndex = history.length - 1;

	config = newConfig;
	saveToStorage(config);
}

export function undo(): void {
	if (historyIndex <= 0) return;
	historyIndex--;
	config = cloneConfig(history[historyIndex]);
	saveToStorage(config);
}

export function redo(): void {
	if (historyIndex >= history.length - 1) return;
	historyIndex++;
	config = cloneConfig(history[historyIndex]);
	saveToStorage(config);
}

export function resetConfig(): void {
	const count = config.wallets.length;
	updateConfig([], `Reset — removed ${count} wallet${count !== 1 ? 's' : ''}`);
}

export function importConfig(json: string): { ok: boolean; message: string } {
	try {
		const parsed = JSON.parse(json);
		if (!Array.isArray(parsed)) {
			return { ok: false, message: 'JSON must be an array.' };
		}
		const wallets: WalletEntry[] = [];
		for (const item of parsed) {
			if (typeof item.publicKey !== 'string' || typeof item.privateKey !== 'string') {
				return { ok: false, message: 'Each item must have publicKey and privateKey strings.' };
			}
			wallets.push({
				publicKey: item.publicKey,
				privateKey: item.privateKey,
				mnemonic: item.mnemonic || undefined,
				byteArray: item.byteArray || undefined,
				label: item.label || undefined,
				prefix: item.prefix || undefined,
				suffix: item.suffix || undefined,
			});
		}
		updateConfig(wallets, `Import ${wallets.length} wallet${wallets.length !== 1 ? 's' : ''}`);
		return { ok: true, message: `Imported ${wallets.length} wallet${wallets.length !== 1 ? 's' : ''}.` };
	} catch {
		return { ok: false, message: 'Invalid JSON.' };
	}
}

export function exportConfig(): string {
	return JSON.stringify(config.wallets, null, 2);
}
