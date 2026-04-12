<script lang="ts">
	import { generateKeyPair, getAddressFromPublicKey, getBase58Decoder } from '@solana/kit';

	let prefix = $state('');
	let suffix = $state('');
	let maxTries = $state(1_000_000);
	let running = $state(false);
	let tries = $state(0);
	let result: { address: string; privateKey: string } | null = $state(null);
	let error = $state('');

	const BASE58_CHARS = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
	let abortController: AbortController | null = null;

	function isValidBase58(str: string): boolean {
		return [...str].every((c) => BASE58_CHARS.includes(c));
	}

	function validate(): string | null {
		if (!prefix && !suffix) return 'Enter a prefix or suffix (or both).';
		if (prefix && !isValidBase58(prefix)) return 'Prefix contains invalid base58 characters.';
		if (suffix && !isValidBase58(suffix)) return 'Suffix contains invalid base58 characters.';
		return null;
	}

	async function generate() {
		const validationError = validate();
		if (validationError) {
			error = validationError;
			return;
		}

		error = '';
		result = null;
		tries = 0;
		running = true;
		abortController = new AbortController();

		const batchSize = 32;
		const base58Decoder = getBase58Decoder();

		try {
			while (running) {
				abortController.signal.throwIfAborted();

				const batch = await Promise.all(
					Array.from({ length: batchSize }, () => generateKeyPair(true))
				);

				for (const keyPair of batch) {
					tries++;
					const address = await getAddressFromPublicKey(keyPair.publicKey);

					const matchPrefix = !prefix || address.startsWith(prefix);
					const matchSuffix = !suffix || address.endsWith(suffix);

					if (matchPrefix && matchSuffix) {
						const privateKeyBytes = new Uint8Array(
							await crypto.subtle.exportKey('pkcs8', keyPair.privateKey)
						);
						// PKCS8 Ed25519 wrapping: raw 32-byte seed starts at byte 16
						const seed = privateKeyBytes.slice(16, 48);
						const publicKeyBytes = new Uint8Array(
							await crypto.subtle.exportKey('raw', keyPair.publicKey)
						);
						// Solana CLI format: 64-byte array [seed(32) + pubkey(32)]
						const fullKey = new Uint8Array(64);
						fullKey.set(seed);
						fullKey.set(publicKeyBytes, 32);

						result = {
							address,
							privateKey: base58Decoder.decode(fullKey)
						};
						running = false;
						return;
					}

					if (tries >= maxTries) {
						running = false;
						error = `No match found after ${maxTries.toLocaleString()} tries.`;
						return;
					}
				}

				// Yield to UI
				await new Promise((r) => setTimeout(r, 0));
			}
		} catch (e: unknown) {
			if (e instanceof DOMException && e.name === 'AbortError') {
				error = `Stopped after ${tries.toLocaleString()} tries.`;
			} else {
				error = `Error: ${e instanceof Error ? e.message : String(e)}`;
			}
		} finally {
			running = false;
			abortController = null;
		}
	}

	function stop() {
		abortController?.abort();
	}
</script>

<div class="flex flex-col">
	<h1 class="px-2 py-1 uppercase tracking-widest border-b border-base-300">VANITY ADDRESS</h1>

	<div class="px-2 py-1 border-b border-base-300 text-sm opacity-70">
		Generate a Solana address that starts or ends with specific characters.
		Brute-forces random keypairs until a match is found. Longer patterns take
		exponentially more tries. Valid characters are base58:
		1-9 A-H J-N P-Z a-k m-z (no 0, O, I, l).
	</div>

	<div class="flex border-b border-base-300">
		<label class="px-2 py-1 uppercase tracking-widest border-r border-base-300">PREFIX</label>
		<input
			type="text"
			bind:value={prefix}
			placeholder="SOL"
			disabled={running}
			class="flex-1 px-2 py-1 bg-transparent border-0 focus:outline-none font-mono"
		/>
	</div>

	<div class="flex border-b border-base-300">
		<label class="px-2 py-1 uppercase tracking-widest border-r border-base-300">SUFFIX</label>
		<input
			type="text"
			bind:value={suffix}
			placeholder="BOX"
			disabled={running}
			class="flex-1 px-2 py-1 bg-transparent border-0 focus:outline-none font-mono"
		/>
	</div>

	<div class="flex border-b border-base-300">
		<label class="px-2 py-1 uppercase tracking-widest border-r border-base-300">MAX TRIES</label>
		<input
			type="number"
			bind:value={maxTries}
			min={1000}
			step={1000}
			disabled={running}
			class="flex-1 px-2 py-1 bg-transparent border-0 focus:outline-none font-mono"
		/>
	</div>

	<div class="flex border-b border-base-300">
		{#if running}
			<button onclick={stop} class="px-2 py-1 uppercase tracking-widest hover:bg-base-200 border-r border-base-300 text-error">STOP</button>
			<span class="px-2 py-1 opacity-70">{tries.toLocaleString()} TRIES...</span>
		{:else}
			<button onclick={generate} class="px-2 py-1 uppercase tracking-widest hover:bg-base-200">GENERATE</button>
		{/if}
	</div>

	{#if error}
		<div class="px-2 py-1 border-b border-base-300 text-error">{error}</div>
	{/if}

	{#if result}
		<div class="flex flex-col border-b border-base-300">
			<div class="flex">
				<label class="px-2 py-1 uppercase tracking-widest border-r border-base-300">ADDRESS</label>
				<span class="px-2 py-1 break-all">{result.address}</span>
			</div>
		</div>
		<div class="flex border-b border-base-300">
			<label class="px-2 py-1 uppercase tracking-widest border-r border-base-300">PRIVATE KEY</label>
			<span class="px-2 py-1 break-all">{result.privateKey}</span>
		</div>
		<div class="px-2 py-1 border-b border-base-300 opacity-70">
			FOUND IN {tries.toLocaleString()} TRIES
		</div>
	{/if}
</div>
