import initWasm, { run_batch } from './ed25519_cpu.js';

let initialized = false;

export async function initCpuBackend(simd: boolean): Promise<void> {
	if (initialized) return;
	const wasmUrl = simd ? '/wasm/ed25519_cpu_simd.wasm' : '/wasm/ed25519_cpu.wasm';
	await initWasm({ module_or_path: wasmUrl });
	initialized = true;
	console.log(`[cpu-backend] simd: ${simd}`);
}

export type WasmHit = {
	address: string;
	secretKey: Uint8Array; // 64 bytes: seed(32) || pubkey(32), tweetnacl-compatible
	publicKey: Uint8Array;
};

export type BatchResult = {
	hit: WasmHit | null;
	best: WasmHit;
	bestScore: number;
};

/** Single-pass batch: derive keypairs from N×32-byte seeds. Returns first full match + best partial. */
export function runBatch(
	seeds: Uint8Array,
	batchSize: number,
	prefix: string,
	suffix: string
): BatchResult | null {
	const result = run_batch(seeds, batchSize, prefix, suffix);
	if (!result) return null;

	const bestScore = result.best_score;
	const bestWasm = result.best();
	const hitWasm = result.hit();

	const best: WasmHit = {
		address: bestWasm.address,
		secretKey: bestWasm.secret_key,
		publicKey: bestWasm.public_key,
	};
	bestWasm.free();

	let hit: WasmHit | null = null;
	if (hitWasm) {
		hit = {
			address: hitWasm.address,
			secretKey: hitWasm.secret_key,
			publicKey: hitWasm.public_key,
		};
		hitWasm.free();
	}

	result.free();

	return { hit, best, bestScore };
}
