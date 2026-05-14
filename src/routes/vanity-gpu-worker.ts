import { Ed25519GPU } from 'webgpu-ed25519';
import { findVanity } from 'webgpu-ed25519/vanity';

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

		let tries = 0;
		let found = false;

		try {
			const gen = findVanity(gpu, {
				prefix,
				suffix,
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
				self.postMessage({
					type: 'found',
					result: { address: hit.address, privateKey: secretKey },
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
			self.postMessage({ type: 'stopped', tries, bestScore: 0, preview: null });
		}
	}
};
