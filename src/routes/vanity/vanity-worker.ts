// Uses @solana/web3.js (tweetnacl) instead of @solana/kit (WebCrypto) for key generation.
// WebCrypto's crypto.subtle shares an internal browser thread pool, so multiple workers
// hit the same bottleneck. Tweetnacl is pure JS and truly parallelizes across workers.
import { Keypair } from '@solana/web3.js';
import { getBase58Decoder } from '@solana/kit';

let stopped = false;

function matchScore(address: string, prefix: string, suffix: string): number {
	let score = 0;
	if (prefix) {
		for (let i = 0; i < prefix.length; i++) {
			if (address[i] === prefix[i]) score++;
			else break;
		}
	}
	if (suffix) {
		for (let i = 0; i < suffix.length; i++) {
			if (address[address.length - 1 - i] === suffix[suffix.length - 1 - i]) score++;
			else break;
		}
	}
	return score;
}

self.onmessage = (e: MessageEvent) => {
	if (e.data.type === 'stop') {
		stopped = true;
		return;
	}

	if (e.data.type === 'start') {
		stopped = false;
		const { prefix, suffix } = e.data as { prefix: string; suffix: string };
		const base58Decoder = getBase58Decoder();
		const chunkSize = 500;
		let tries = 0;
		let bestScore = 0;
		let bestAddress = '';
		let bestSecretKey: Uint8Array | null = null;

		function runChunk() {
			if (stopped) {
				postFinal();
				return;
			}

			for (let i = 0; i < chunkSize; i++) {
				const keypair = Keypair.generate();
				const address = keypair.publicKey.toBase58();
				tries++;

				const matchPrefix = !prefix || address.startsWith(prefix);
				const matchSuffix = !suffix || address.endsWith(suffix);

				if (matchPrefix && matchSuffix) {
					self.postMessage({
						type: 'found',
						result: {
							address,
							privateKey: base58Decoder.decode(keypair.secretKey)
						},
						tries
					});
					return;
				}

				const score = matchScore(address, prefix, suffix);
				if (score > bestScore) {
					bestScore = score;
					bestAddress = address;
					bestSecretKey = keypair.secretKey;
				}
			}

			self.postMessage({
				type: 'progress',
				tries,
				bestScore,
				bestAddress
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
