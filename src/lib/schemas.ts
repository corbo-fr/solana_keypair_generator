import { z } from 'zod';

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

/** Parse a JSON string as an array of WalletEntry. Returns parsed wallets or an error message. */
export function parseWalletArray(json: string): { ok: true; wallets: WalletEntry[] } | { ok: false; message: string } {
	let parsed: unknown;
	try {
		parsed = JSON.parse(json);
	} catch {
		return { ok: false, message: 'Invalid JSON.' };
	}
	const result = walletEntryArraySchema.safeParse(parsed);
	if (!result.success) {
		const first = result.error.issues[0];
		return { ok: false, message: first?.message ?? 'Invalid wallet data.' };
	}
	return { ok: true, wallets: result.data };
}
