import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { getPublicKeyAsync } from '@noble/ed25519';
import { initSync, run_batch } from './ed25519_cpu.js';

// RFC 8032 test vectors: [seed_hex, expected_pubkey_hex]
const RFC8032_VECTORS: [string, string][] = [
	[
		'9d61b19deffd5a60ba844af492ec2cc44449c5697b326919703bac031cae3d55',
		'700e2ce7c4b674427eab27ba820bcf6f0faebe68e09fe8564292114e41dc6a41'
	],
	[
		'4ccd089b28ff96da9db6c346ec114e0f5b8a319f35aba624da8cf6ed4d0bd6d7',
		'b07fb5605f2201d2f41d4fd4f55bcf043503edeb0b606f29152fd3aef42efeee'
	],
	[
		'c5aa8df43f9f837bedb7442f31dcb7b166d38535076f094b85ce3a2e0b4458f7',
		'fc51cd8e6218a1a38da47ed00230f0580816ed13ba3303ac5deb911548908025'
	],
	[
		'f5e5767cf153319517630f226876b86c8160cc583bc013744c6bf255f5cc0ee5',
		'278117fc144c72340f67d0f2316e8386ceffbf2b2428c9c51fef7c597f1d426e'
	],
];

function hexToBytes(hex: string): Uint8Array {
	return new Uint8Array(hex.match(/.{2}/g)!.map((b) => parseInt(b, 16)));
}

function bytesToHex(bytes: Uint8Array): string {
	return Array.from(bytes)
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('');
}

function deriveOne(seed: Uint8Array): { publicKey: Uint8Array; secretKey: Uint8Array; address: string } {
	const seeds = new Uint8Array(32);
	seeds.set(seed);
	const r = run_batch(seeds, 1, '', '');
	if (!r) throw new Error('run_batch returned null');
	const hit = r.hit();
	r.free();
	if (!hit) throw new Error('no hit for empty prefix/suffix');
	const result = { publicKey: hit.public_key, secretKey: hit.secret_key, address: hit.address };
	hit.free();
	return result;
}

beforeAll(() => {
	const wasmBytes = readFileSync(resolve('static/wasm/ed25519_cpu.wasm'));
	initSync({ module: wasmBytes });
});

describe('RFC 8032 vectors', () => {
	it.each(RFC8032_VECTORS)('seed %s → pubkey %s', (seedHex, expectedPubkeyHex) => {
		const seed = hexToBytes(seedHex);
		const { publicKey } = deriveOne(seed);
		expect(bytesToHex(publicKey)).toBe(expectedPubkeyHex);
	});
});

describe('noble/ed25519 equivalence', () => {
	it('10 000 random seeds produce matching pubkeys', async () => {
		const TOTAL = 10_000;
		let mismatches = 0;

		for (let i = 0; i < TOTAL; i++) {
			const seed = crypto.getRandomValues(new Uint8Array(32));
			const { publicKey: wasmPub } = deriveOne(seed);
			const noblePub = await getPublicKeyAsync(seed);
			if (bytesToHex(wasmPub) !== bytesToHex(noblePub)) mismatches++;
		}

		expect(mismatches).toBe(0);
	});

	it('edge: all-zero seed', async () => {
		const seed = new Uint8Array(32);
		const { publicKey: wasmPub } = deriveOne(seed);
		const noblePub = await getPublicKeyAsync(seed);
		expect(bytesToHex(wasmPub)).toBe(bytesToHex(noblePub));
	});

	it('edge: all-0xff seed', async () => {
		const seed = new Uint8Array(32).fill(0xff);
		const { publicKey: wasmPub } = deriveOne(seed);
		const noblePub = await getPublicKeyAsync(seed);
		expect(bytesToHex(wasmPub)).toBe(bytesToHex(noblePub));
	});

	it('prefix match returns a valid keypair verified by noble', async () => {
		const PREFIX = 'a';
		let found = false;

		for (let attempts = 0; attempts < 2_000_000 && !found; attempts += 512) {
			const seeds = new Uint8Array(512 * 32);
			crypto.getRandomValues(seeds);
			const r = run_batch(seeds, 512, PREFIX, '');
			if (!r) continue;

			const hit = r.hit();
			r.free();

			if (hit) {
				expect(hit.address.startsWith(PREFIX)).toBe(true);
				const seed = hit.secret_key.slice(0, 32);
				const noblePub = await getPublicKeyAsync(seed);
				expect(bytesToHex(hit.public_key)).toBe(bytesToHex(noblePub));
				hit.free();
				found = true;
			}
		}

		expect(found).toBe(true);
	});
});

describe('secretKey format', () => {
	it('is 64 bytes: seed(32) || pubkey(32)', () => {
		const seed = crypto.getRandomValues(new Uint8Array(32));
		const { publicKey, secretKey } = deriveOne(seed);

		expect(secretKey.length).toBe(64);
		expect(bytesToHex(secretKey.slice(0, 32))).toBe(bytesToHex(seed));
		expect(bytesToHex(secretKey.slice(32))).toBe(bytesToHex(publicKey));
	});
});
