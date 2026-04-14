import { z } from 'zod';

const BASE58_REGEX = /^[123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz]+$/;

export const solanaPublicKeySchema = z.string()
	.min(32, 'Public key too short.')
	.max(44, 'Public key too long.')
	.regex(BASE58_REGEX, 'Public key is not valid base58.');

export const solanaPrivateKeySchema = z.string()
	.min(32, 'Private key too short.')
	.max(88, 'Private key too long.')
	.regex(BASE58_REGEX, 'Private key is not valid base58.');

export const walletEntrySchema = z.object({
	publicKey: z.string(),
	privateKey: z.string(),
	mnemonic: z.string().optional(),
	byteArray: z.string().optional(),
	label: z.string().optional(),
	prefix: z.string().optional(),
	suffix: z.string().optional(),
});

export type WalletEntry = z.infer<typeof walletEntrySchema>;

export const walletEntryArraySchema = z.array(walletEntrySchema);

export const configSchema = z.object({
	wallets: z.array(walletEntrySchema),
	lastModified: z.string(),
	lastAction: z.string(),
});

export type Config = z.infer<typeof configSchema>;

/** Parse a JSON string as either a wallet array or a config object. Accepts both formats. */
export function parseWalletArray(json: string): { ok: true; wallets: WalletEntry[] } | { ok: false; message: string } {
	let parsed: unknown;
	try {
		parsed = JSON.parse(json);
	} catch {
		return { ok: false, message: 'Invalid JSON.' };
	}
	// Try wallet array first
	const arrayResult = walletEntryArraySchema.safeParse(parsed);
	if (arrayResult.success) {
		return { ok: true, wallets: arrayResult.data };
	}
	// Try config object (with wallets field)
	const configResult = configSchema.safeParse(parsed);
	if (configResult.success) {
		return { ok: true, wallets: configResult.data.wallets };
	}
	const first = arrayResult.error.issues[0];
	return { ok: false, message: first?.message ?? 'Invalid wallet data.' };
}
