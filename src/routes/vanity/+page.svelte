<script lang="ts">
	import { onDestroy } from 'svelte';
	import { shortKey } from '$lib/format';

	let prefix = $state('');
	let suffix = $state('');
	let maxTries = $state(10_000_000);
	const defaultThreads = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 8 : 8;
	let threads = $state(defaultThreads);
	let running = $state(false);
	let tries = $state(0);
	let result: { address: string; privateKey: string } | null = $state(null);
	let preview: { address: string; privateKey: string } | null = $state(null);
	let bestScore = $state(0);
	let status: { message: string; type: 'error' | 'warning' | 'success' } | null = $state(null);
	let showMatchColors = $state(false);
	let displayAddress = $derived(result?.address ?? preview?.address ?? '');
	let displayPrivateKey = $derived(result?.privateKey ?? preview?.privateKey ?? '');
	let addrStartLen = $derived(Math.max(4, prefix.length));
	let addrEndLen = $derived(Math.max(4, suffix.length));

	const BASE58_CHARS = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
	let workers: Worker[] = [];
	let workerTries: number[] = [];

	function clearMatchColors() {
		showMatchColors = false;
	}

	function isValidBase58(str: string): boolean {
		return [...str].every((c) => BASE58_CHARS.includes(c));
	}

	function validate(): string | null {
		if (!prefix && !suffix) return 'Enter a prefix or suffix (or both).';
		if (prefix && !isValidBase58(prefix)) return 'Prefix contains invalid base58 characters.';
		if (suffix && !isValidBase58(suffix)) return 'Suffix contains invalid base58 characters.';
		if (threads < 1 || threads > 64) return 'Threads must be between 1 and 64.';
		return null;
	}

	function terminateAll() {
		for (const w of workers) {
			w.terminate();
		}
		workers = [];
		workerTries = [];
	}

	onDestroy(() => {
		terminateAll();
	});

	function generate() {
		const validationError = validate();
		if (validationError) {
			status = { message: validationError, type: 'error' };
			return;
		}

		// Clean up any leftover workers
		terminateAll();

		status = null;
		result = null;
		preview = null;
		bestScore = 0;
		tries = 0;
		running = true;
		showMatchColors = true;

		const threadCount = threads;
		let finishedCount = 0;
		let done = false;
		workerTries = new Array(threadCount).fill(0);

		function finish(finalStatus?: { message: string; type: 'error' | 'warning' | 'success' }) {
			if (done) return;
			done = true;
			tries = workerTries.reduce((a, b) => a + b, 0);
			terminateAll();
			running = false;
			if (finalStatus) status = finalStatus;
		}

		for (let i = 0; i < threadCount; i++) {
			const w = new Worker(new URL('./vanity-worker.ts', import.meta.url), { type: 'module' });

			w.onmessage = (e) => {
				if (done) return;
				const data = e.data;

				if (data.type === 'progress') {
					workerTries[i] = data.tries;
					tries = workerTries.reduce((a, b) => a + b, 0);

					if (data.bestScore > bestScore) {
						bestScore = data.bestScore;
						if (data.bestAddress) {
							preview = { address: data.bestAddress, privateKey: '' };
						}
					}

					if (tries >= maxTries) {
						for (const w of workers) w.postMessage({ type: 'stop' });
					}
				}

				if (data.type === 'found') {
					workerTries[i] = data.tries;
					result = data.result;
					finish({ message: `Found in ${workerTries.reduce((a, b) => a + b, 0).toLocaleString()} tries`, type: 'success' });
				}

				if (data.type === 'stopped' || data.type === 'error') {
					workerTries[i] = data.tries ?? workerTries[i];
					finishedCount++;

					// Keep the best preview from stopped workers
					if (data.type === 'stopped' && data.preview && data.bestScore >= bestScore) {
						bestScore = data.bestScore;
						preview = data.preview;
					}

					if (data.type === 'error' && !done) {
						for (const w of workers) w.postMessage({ type: 'stop' });
						finish({ message: data.message, type: 'error' });
						return;
					}

					if (finishedCount >= threadCount) {
						const totalTries = workerTries.reduce((a, b) => a + b, 0);
						if (totalTries >= maxTries) {
							finish({ message: `No match after ${totalTries.toLocaleString()} tries`, type: 'error' });
						} else {
							finish({ message: `Stopped after ${totalTries.toLocaleString()} tries`, type: 'warning' });
						}
					}
				}
			};

			workers.push(w);
			w.postMessage({ type: 'start', prefix, suffix });
		}
	}

	function stop() {
		for (const w of workers) {
			w.postMessage({ type: 'stop' });
		}
	}
</script>

<div class="flex flex-col">
	<h1 class="page-title">VANITY ADDRESS</h1>

	<div class="page-description">
		Generate a Solana address that starts or ends with specific characters.
		Brute-forces random keypairs until a match is found. Longer patterns take
		exponentially more tries. Valid characters are base58:
		1-9 A-H J-N P-Z a-k m-z (no 0, O, I, l).
	</div>

	<div class="form-row">
		<label class="form-label">PREFIX</label>
		{#if showMatchColors && prefix}
			<span class="flex-1 px-2 py-1 font-mono">{#each prefix.split('') as char, i}{@const addr = result?.address ?? preview?.address}{#if addr && addr[i] === char}<span class="text-success">{char}</span>{:else}{char}{/if}{/each}</span>
		{:else}
			<input
				type="text"
				bind:value={prefix}
				oninput={clearMatchColors}
				placeholder="SOL"
				disabled={running}
				autocomplete="off"
				class="form-input"
			/>
		{/if}
		<button onclick={() => { prefix = ''; clearMatchColors(); }} disabled={running} class="form-action">CLEAN</button>
	</div>

	<div class="form-row">
		<label class="form-label">SUFFIX</label>
		{#if showMatchColors && suffix}
			<span class="flex-1 px-2 py-1 font-mono">{#each suffix.split('') as char, i}{@const addr = result?.address ?? preview?.address}{#if addr && addr[addr.length - suffix.length + i] === char}<span class="text-success">{char}</span>{:else}{char}{/if}{/each}</span>
		{:else}
			<input
				type="text"
				bind:value={suffix}
				oninput={clearMatchColors}
				placeholder="BOX"
				disabled={running}
				autocomplete="off"
				class="form-input"
			/>
		{/if}
		<button onclick={() => { suffix = ''; clearMatchColors(); }} disabled={running} class="form-action">CLEAN</button>
	</div>

	<div class="form-row">
		<label class="form-label">THREADS</label>
		<input
			type="number"
			bind:value={threads}
			min={1}
			max={64}
			step={1}
			disabled={running}
			autocomplete="off"
			class="form-input"
		/>
		<button onclick={() => threads = defaultThreads} disabled={running} class="form-action">AVAILABLE</button>
	</div>

	<div class="form-row">
		<label class="form-label">MAX TRIES</label>
		<input
			type="number"
			bind:value={maxTries}
			min={1000}
			step={1000}
			disabled={running}
			autocomplete="off"
			class="form-input"
		/>
		<button onclick={() => maxTries = 10_000_000} disabled={running} class="form-action">DEFAULT</button>
	</div>

	<div class="form-row">
		{#if running}
			<button onclick={stop} class="form-action-left text-error">STOP</button>
			<span class="flex-1 px-2 py-1 flex justify-between"><span class="opacity-70">{tries.toLocaleString()} TRIES...</span><span class="opacity-70">{bestScore}/{prefix.length + suffix.length}</span></span>
			<button onclick={stop} class="form-action text-error">STOP</button>
		{:else}
			<button onclick={generate} class="form-action-left">GENERATE</button>
			<span class="flex-1 px-2 py-1 {status ? (status.type === 'error' ? 'text-error' : status.type === 'warning' ? 'text-warning' : 'text-success') : ''}">{status?.message ?? ''}</span>
			<button disabled class="form-action text-error">STOP</button>
		{/if}
	</div>

	<div class="form-row">
		<label class="form-label">PUBLIC KEY</label>
		<span class="form-value {running && !result ? 'opacity-40' : ''}">{#if showMatchColors && displayAddress}{#each displayAddress.slice(0, addrStartLen).split('') as char, i}{#if prefix && i < prefix.length && char === prefix[i]}<span class="text-success">{char}</span>{:else}{char}{/if}{/each}...{#each displayAddress.slice(-addrEndLen).split('') as char, i}{@const realIndex = displayAddress.length - addrEndLen + i}{#if suffix && realIndex >= displayAddress.length - suffix.length && char === suffix[realIndex - (displayAddress.length - suffix.length)]}<span class="text-success">{char}</span>{:else}{char}{/if}{/each}{:else}{displayAddress ? shortKey(displayAddress, addrStartLen, addrEndLen) : ''}{/if}</span>
		<button onclick={() => navigator.clipboard.writeText(displayAddress)} disabled={!result && (running || !preview)} class="form-action">COPY</button>
	</div>
	<div class="form-row">
		<label class="form-label">PRIVATE KEY</label>
		<span class="form-value {running && !result ? 'opacity-40' : ''}">{displayPrivateKey ? shortKey(displayPrivateKey) : ''}</span>
		<button onclick={() => navigator.clipboard.writeText(displayPrivateKey)} disabled={!result && (running || !preview)} class="form-action">COPY</button>
	</div>
</div>
