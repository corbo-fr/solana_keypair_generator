import { getBase58Decoder } from '@solana/kit';
import { detectSimd } from '$lib/ed25519/feature-detect';
import { initCpuBackend, runBatch } from '$lib/ed25519/cpu-backend';

let stopped = false;
let wasmReady = false;

const BATCH_SIZE = 512;

self.onmessage = async (e: MessageEvent) => {
	if (e.data.type === 'stop') {
		stopped = true;
		return;
	}

	if (e.data.type === 'start') {
		stopped = false;
		const { prefix, suffix } = e.data as { prefix: string; suffix: string };

		if (!wasmReady) {
			const simd = await detectSimd();
			await initCpuBackend(simd);
			wasmReady = true;
		}

		const base58Decoder = getBase58Decoder();
		let tries = 0;
		let bestScore = 0;
		let bestAddress = '';
		let bestSecretKey: Uint8Array | null = null;

		function runChunk() {
			if (stopped) {
				postFinal();
				return;
			}

			const seeds = new Uint8Array(BATCH_SIZE * 32);
			crypto.getRandomValues(seeds);

			const result = runBatch(seeds, BATCH_SIZE, prefix, suffix);
			if (!result) {
				setTimeout(runChunk, 0);
				return;
			}

			tries += BATCH_SIZE;

			if (result.hit) {
				self.postMessage({
					type: 'found',
					result: {
						address: result.hit.address,
						privateKey: base58Decoder.decode(result.hit.secretKey)
					},
					tries
				});
				return;
			}

			if (result.bestScore >= bestScore && result.best.address) {
				bestScore = result.bestScore;
				bestAddress = result.best.address;
				bestSecretKey = result.best.secretKey;
			}

			self.postMessage({
				type: 'progress',
				tries,
				bestScore,
				bestAddress,
				bestPrivateKey: bestSecretKey ? base58Decoder.decode(bestSecretKey) : ''
			});

			setTimeout(runChunk, 0);
		}

		function postFinal() {
			let preview: { address: string; privateKey: string } | null = null;
			if (bestSecretKey && bestAddress) {
				preview = {
					address: bestAddress,
					privateKey: base58Decoder.decode(bestSecretKey)
				};
			}
			self.postMessage({ type: 'stopped', tries, bestScore, preview });
		}

		runChunk();
	}
};
