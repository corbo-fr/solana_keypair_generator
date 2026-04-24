import { describe, it, expect } from 'vitest';
import { solanaPublicKeySchema, solanaPrivateKeySchema, parseWalletArray } from './schemas';

describe('solanaPublicKeySchema', () => {
	it('accepts valid public key', () => {
		const key = '11111111111111111111111111111111'; // 32 chars, valid base58
		expect(solanaPublicKeySchema.safeParse(key).success).toBe(true);
	});

	it('accepts 44-char key', () => {
		const key = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstu'; // 44 chars
		expect(solanaPublicKeySchema.safeParse(key).success).toBe(true);
	});

	it('rejects too short key', () => {
		expect(solanaPublicKeySchema.safeParse('ABC').success).toBe(false);
	});

	it('rejects too long key', () => {
		const key = '1'.repeat(45);
		expect(solanaPublicKeySchema.safeParse(key).success).toBe(false);
	});

	it('rejects invalid base58 characters', () => {
		const key = '0'.repeat(32); // '0' is not in base58
		expect(solanaPublicKeySchema.safeParse(key).success).toBe(false);
	});
});

describe('solanaPrivateKeySchema', () => {
	it('accepts valid private key', () => {
		const key = '1'.repeat(64);
		expect(solanaPrivateKeySchema.safeParse(key).success).toBe(true);
	});

	it('rejects too short key', () => {
		expect(solanaPrivateKeySchema.safeParse('ABC').success).toBe(false);
	});

	it('rejects too long key', () => {
		const key = '1'.repeat(89);
		expect(solanaPrivateKeySchema.safeParse(key).success).toBe(false);
	});
});

describe('parseWalletArray', () => {
	it('parses valid wallet array', () => {
		const json = JSON.stringify([
			{ publicKey: 'abc', privateKey: 'def' }
		]);
		const result = parseWalletArray(json);
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.wallets).toHaveLength(1);
			expect(result.wallets[0].publicKey).toBe('abc');
		}
	});

	it('parses wallet array with optional fields', () => {
		const json = JSON.stringify([
			{ publicKey: 'abc', privateKey: 'def', label: 'my wallet', mnemonic: 'word word', byteArray: '[1,2]', prefix: 'a', suffix: 'z' }
		]);
		const result = parseWalletArray(json);
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.wallets[0].label).toBe('my wallet');
			expect(result.wallets[0].mnemonic).toBe('word word');
		}
	});

	it('parses config object format', () => {
		const json = JSON.stringify({
			wallets: [{ publicKey: 'abc', privateKey: 'def' }],
			lastModified: '2024-01-01',
			lastAction: 'import',
		});
		const result = parseWalletArray(json);
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.wallets).toHaveLength(1);
		}
	});

	it('returns error for invalid JSON', () => {
		const result = parseWalletArray('not json');
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.message).toBe('Invalid JSON.');
		}
	});

	it('returns error for missing required fields', () => {
		const json = JSON.stringify([{ publicKey: 'abc' }]); // missing privateKey
		const result = parseWalletArray(json);
		expect(result.ok).toBe(false);
	});

	it('returns error for wrong type', () => {
		const json = JSON.stringify('just a string');
		const result = parseWalletArray(json);
		expect(result.ok).toBe(false);
	});

	it('parses empty array', () => {
		const result = parseWalletArray('[]');
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.wallets).toHaveLength(0);
		}
	});
});
