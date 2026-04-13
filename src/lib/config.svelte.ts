import { configSchema, parseWalletArray, type Config, type WalletEntry } from '$lib/schemas';

export type { WalletEntry, Config };

const STORAGE_KEY = 'solbox_config';
const MAX_HISTORY = 100;

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
		const result = configSchema.safeParse(JSON.parse(raw));
		if (!result.success) return emptyConfig();
		return result.data;
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
	if (localStorage.getItem(STORAGE_KEY)) return null;
	const parsed = parseWalletArray(oldRaw);
	if (!parsed.ok) return null;
	const config: Config = {
		wallets: parsed.wallets,
		lastModified: new Date().toISOString(),
		lastAction: 'Migrated from old format',
	};
	saveToStorage(config);
	localStorage.removeItem('solbox_wallets');
	return config;
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
	const parsed = parseWalletArray(json);
	if (!parsed.ok) return parsed;
	const { wallets } = parsed;
	updateConfig(wallets, `Import ${wallets.length} wallet${wallets.length !== 1 ? 's' : ''}`);
	return { ok: true, message: `Imported ${wallets.length} wallet${wallets.length !== 1 ? 's' : ''}.` };
}

export function exportConfig(): string {
	return JSON.stringify(config.wallets, null, 2);
}
