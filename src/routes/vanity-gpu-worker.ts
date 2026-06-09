import { Ed25519GPU } from 'webgpu-ed25519';
import { findVanity } from 'webgpu-ed25519/vanity';
import { getBase58Decoder } from '@solana/kit';

let gpu: Ed25519GPU | null = null;
let controller: AbortController | null = null;

Ed25519GPU.create()
	.then((g) => {
		gpu = g;
	})
	.catch(() => {});

self.onmessage = async (e: MessageEvent) => {
	if (e.data.type === 'stop') {
		controller?.abort();
		return;
	}

	if (e.data.type === 'start') {
		controller?.abort();
		controller = new AbortController();
		const { prefix, suffix } = e.data as { prefix: string; suffix: string };

		if (!gpu) {
			try {
				gpu = await Ed25519GPU.create();
			} catch (err) {
				self.postMessage({ type: 'error', message: String(err) });
				return;
			}
		}

		const base58Decoder = getBase58Decoder();
		let tries = 0;
		let found = false;
		const startTime = performance.now();

		try {
			const gen = findVanity(gpu, {
				prefix,
				suffix,
				batchSize: 65536,
				signal: controller.signal,
				onProgress: (keysChecked) => {
					tries = keysChecked;
					self.postMessage({
						type: 'progress',
						tries,
						bestScore: 0,
						bestAddress: '',
						bestPrivateKey: ''
					});
				}
			});

			for await (const hit of gen) {
				found = true;
				// 64-byte keypair: seed || publicKey (Solana secretKey format)
				const secretKey = new Uint8Array(64);
				secretKey.set(hit.seed, 0);
				secretKey.set(hit.publicKey, 32);
				const elapsed = (performance.now() - startTime) / 1000;
			console.log(`[vanity] found — tries: ${tries}, elapsed: ${elapsed.toFixed(1)}s, rate: ${Math.round(tries / elapsed)}/s`);
				self.postMessage({
					type: 'found',
					result: { address: hit.address, privateKey: base58Decoder.decode(secretKey) },
					tries
				});
				controller.abort();
				break;
			}
		} catch (err) {
			self.postMessage({ type: 'error', message: String(err) });
			return;
		}

		if (!found) {
			const elapsed = (performance.now() - startTime) / 1000;
			console.log(`[vanity] stopped — tries: ${tries}, elapsed: ${elapsed.toFixed(1)}s, rate: ${Math.round(tries / elapsed)}/s`);
			self.postMessage({ type: 'stopped', tries, bestScore: 0, preview: null });
		}
	}
};
