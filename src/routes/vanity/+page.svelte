<script lang="ts">
	import { generateKeyPair, getAddressFromPublicKey, getBase58Decoder } from '@solana/kit';

	let prefix = $state('');
	let suffix = $state('');
	let maxTries = $state(1_000_000);
	let running = $state(false);
	let tries = $state(0);
	let result: { address: string; privateKey: string } | null = $state(null);
	let preview: { address: string; privateKey: string } | null = $state(null);
	let bestScore = $state(0);
	let status: { message: string; type: 'error' | 'warning' | 'success' } | null = $state(null);
	let showMatchColors = $state(false);

	const BASE58_CHARS = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
	let abortController: AbortController | null = null;

	function clearMatchColors() {
		showMatchColors = false;
	}

	function matchScore(address: string): number {
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
			status = { message: validationError, type: 'error' };
			return;
		}

		status = null;
		result = null;
		preview = null;
		bestScore = 0;
		tries = 0;
		running = true;
		showMatchColors = true;
		abortController = new AbortController();

		const batchSize = 32;
		const base58Decoder = getBase58Decoder();

		async function extractPrivateKey(keyPair: CryptoKeyPair): Promise<string> {
			const privateKeyBytes = new Uint8Array(
				await crypto.subtle.exportKey('pkcs8', keyPair.privateKey)
			);
			const seed = privateKeyBytes.slice(16, 48);
			const publicKeyBytes = new Uint8Array(
				await crypto.subtle.exportKey('raw', keyPair.publicKey)
			);
			const fullKey = new Uint8Array(64);
			fullKey.set(seed);
			fullKey.set(publicKeyBytes, 32);
			return base58Decoder.decode(fullKey);
		}

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
						result = {
							address,
							privateKey: await extractPrivateKey(keyPair)
						};
						status = { message: `Found in ${tries.toLocaleString()} tries`, type: 'success' };
						running = false;
						return;
					}

					const score = matchScore(address);
					if (score >= bestScore) {
						bestScore = score;
						preview = {
							address,
							privateKey: await extractPrivateKey(keyPair)
						};
					}

					if (tries >= maxTries) {
						running = false;
						status = { message: `No match after ${maxTries.toLocaleString()} tries`, type: 'error' };
						return;
					}
				}

				// Yield to UI
				await new Promise((r) => setTimeout(r, 0));
			}
		} catch (e: unknown) {
			if (e instanceof DOMException && e.name === 'AbortError') {
				status = { message: `Stopped after ${tries.toLocaleString()} tries`, type: 'warning' };
			} else {
				status = { message: `${e instanceof Error ? e.message : String(e)}`, type: 'error' };
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
	<h1 class="px-2 py-1 uppercase tracking-widest border-b border-base-300 font-bold">VANITY ADDRESS</h1>

	<div class="px-2 py-1 border-b border-base-300 text-sm opacity-70">
		Generate a Solana address that starts or ends with specific characters.
		Brute-forces random keypairs until a match is found. Longer patterns take
		exponentially more tries. Valid characters are base58:
		1-9 A-H J-N P-Z a-k m-z (no 0, O, I, l).
	</div>

	<div class="flex border-b border-base-300">
		<label class="w-40 shrink-0 px-2 py-1 uppercase tracking-widest border-r border-base-300">PREFIX</label>
		{#if showMatchColors && prefix}
			<span class="flex-1 px-2 py-1 font-mono">{#each prefix.split('') as char, i}{@const addr = result?.address ?? preview?.address}{#if addr && addr[i] === char}<span class="text-success">{char}</span>{:else}{char}{/if}{/each}</span>
		{:else}
			<input
				type="text"
				bind:value={prefix}
				oninput={clearMatchColors}
				placeholder="SOL"
				disabled={running}
				class="flex-1 px-2 py-1 bg-transparent border-0 focus:outline-none font-mono"
			/>
		{/if}
		<button onclick={() => { prefix = ''; clearMatchColors(); }} disabled={running} class="w-40 shrink-0 px-2 py-1 uppercase tracking-widest border-l border-base-300 text-primary hover:bg-base-200 disabled:opacity-40 disabled:pointer-events-none">CLEAN</button>
	</div>

	<div class="flex border-b border-base-300">
		<label class="w-40 shrink-0 px-2 py-1 uppercase tracking-widest border-r border-base-300">SUFFIX</label>
		{#if showMatchColors && suffix}
			<span class="flex-1 px-2 py-1 font-mono">{#each suffix.split('') as char, i}{@const addr = result?.address ?? preview?.address}{#if addr && addr[addr.length - suffix.length + i] === char}<span class="text-success">{char}</span>{:else}{char}{/if}{/each}</span>
		{:else}
			<input
				type="text"
				bind:value={suffix}
				oninput={clearMatchColors}
				placeholder="BOX"
				disabled={running}
				class="flex-1 px-2 py-1 bg-transparent border-0 focus:outline-none font-mono"
			/>
		{/if}
		<button onclick={() => { suffix = ''; clearMatchColors(); }} disabled={running} class="w-40 shrink-0 px-2 py-1 uppercase tracking-widest border-l border-base-300 text-primary hover:bg-base-200 disabled:opacity-40 disabled:pointer-events-none">CLEAN</button>
	</div>

	<div class="flex border-b border-base-300">
		<label class="w-40 shrink-0 px-2 py-1 uppercase tracking-widest border-r border-base-300">MAX TRIES</label>
		<input
			type="number"
			bind:value={maxTries}
			min={1000}
			step={1000}
			disabled={running}
			class="flex-1 px-2 py-1 bg-transparent border-0 focus:outline-none font-mono"
		/>
		<button onclick={() => maxTries = 1_000_000} disabled={running} class="w-40 shrink-0 px-2 py-1 uppercase tracking-widest border-l border-base-300 text-primary hover:bg-base-200 disabled:opacity-40 disabled:pointer-events-none">DEFAULT</button>
	</div>

	<div class="flex border-b border-base-300">
		{#if running}
			<button onclick={stop} class="w-40 shrink-0 px-2 py-1 uppercase tracking-widest hover:bg-base-200 border-r border-base-300 text-error">STOP</button>
			<span class="flex-1 px-2 py-1 flex justify-between"><span class="opacity-70">{tries.toLocaleString()} TRIES...</span><span class="opacity-70">{bestScore}/{prefix.length + suffix.length}</span></span>
			<button onclick={stop} class="w-40 shrink-0 px-2 py-1 uppercase tracking-widest border-l border-base-300 text-error hover:bg-base-200">STOP</button>
		{:else}
			<button onclick={generate} class="w-40 shrink-0 px-2 py-1 uppercase tracking-widest hover:bg-base-200 border-r border-base-300 text-primary">GENERATE</button>
			<span class="flex-1 px-2 py-1 {status ? (status.type === 'error' ? 'text-error' : status.type === 'warning' ? 'text-warning' : 'text-success') : ''}">{status?.message ?? ''}</span>
			<button disabled class="w-40 shrink-0 px-2 py-1 uppercase tracking-widest border-l border-base-300 text-error opacity-40 pointer-events-none">STOP</button>
		{/if}
	</div>

	<div class="flex border-b border-base-300">
		<label class="w-40 shrink-0 px-2 py-1 uppercase tracking-widest border-r border-base-300">PUBLIC KEY</label>
		<span class="flex-1 px-2 py-1 break-all {running && !result ? 'opacity-40' : ''}">{result?.address ?? preview?.address ?? ''}</span>
		<button onclick={() => navigator.clipboard.writeText(result?.address ?? preview?.address ?? '')} disabled={!result && (running || !preview)} class="w-40 shrink-0 px-2 py-1 uppercase tracking-widest border-l border-base-300 text-primary hover:bg-base-200 disabled:opacity-40 disabled:pointer-events-none">COPY</button>
	</div>
	<div class="flex border-b border-base-300">
		<label class="w-40 shrink-0 px-2 py-1 uppercase tracking-widest border-r border-base-300">PRIVATE KEY</label>
		<span class="flex-1 px-2 py-1 break-all {running && !result ? 'opacity-40' : ''}">{result?.privateKey ?? preview?.privateKey ?? ''}</span>
		<button onclick={() => navigator.clipboard.writeText(result?.privateKey ?? preview?.privateKey ?? '')} disabled={!result && (running || !preview)} class="w-40 shrink-0 px-2 py-1 uppercase tracking-widest border-l border-base-300 text-primary hover:bg-base-200 disabled:opacity-40 disabled:pointer-events-none">COPY</button>
	</div>
</div>
