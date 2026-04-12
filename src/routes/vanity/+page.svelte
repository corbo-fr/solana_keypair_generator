<script lang="ts">
	import { onDestroy } from 'svelte';
	import { shortKey } from '$lib/format';

	let prefix = $state('');
	let suffix = $state('');
	let maxTries = $state(10_000_000);
	let maxTime = $state(10);
	const defaultThreads = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 8 : 8;
	let threads = $state(defaultThreads);
	let running = $state(false);
	let tries = $state(0);
	let startTime = $state(0);
	let elapsed = $state(0);
	let timerInterval: ReturnType<typeof setInterval> | null = null;
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

	function stopTimer() {
		if (timerInterval) {
			clearInterval(timerInterval);
			timerInterval = null;
		}
	}

	function terminateAll() {
		stopTimer();
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
		elapsed = 0;
		startTime = Date.now();
		running = true;
		showMatchColors = true;

		timerInterval = setInterval(() => {
			elapsed = (Date.now() - startTime) / 1000;
			if (elapsed >= maxTime * 60) {
				for (const w of workers) w.postMessage({ type: 'stop' });
			}
		}, 200);

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
							preview = { address: data.bestAddress, privateKey: data.bestPrivateKey };
						}
					}

					if (tries >= maxTries) {
						for (const w of workers) w.postMessage({ type: 'stop' });
					}
				}

				if (data.type === 'found') {
					workerTries[i] = data.tries;
					elapsed = (Date.now() - startTime) / 1000;
					result = data.result;
					finish({ message: `Found in ${workerTries.reduce((a, b) => a + b, 0).toLocaleString()} tries (${Math.floor(elapsed / 60)}m ${Math.floor(elapsed % 60)}s)`, type: 'success' });
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
						elapsed = (Date.now() - startTime) / 1000;
						const totalTries = workerTries.reduce((a, b) => a + b, 0);
						const timeStr = `${Math.floor(elapsed / 60)}m ${Math.floor(elapsed % 60)}s`;
						if (totalTries >= maxTries || elapsed >= maxTime * 60) {
							finish({ message: `No match after ${totalTries.toLocaleString()} tries (${timeStr})`, type: 'error' });
						} else {
							finish({ message: `Stopped after ${totalTries.toLocaleString()} tries (${timeStr})`, type: 'warning' });
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
		<div class="flex-1 relative">
			{#if showMatchColors && prefix}
				<span class="absolute inset-0 px-2 py-1 font-mono pointer-events-none">{#each prefix.split('') as char, i}{@const addr = result?.address ?? preview?.address}{#if addr && addr[i] === char}<span class="text-success">{char}</span>{:else}{char}{/if}{/each}</span>
			{/if}
			<input
				type="text"
				bind:value={prefix}
				oninput={clearMatchColors}
				placeholder="SOL"
				disabled={running}
				autocomplete="off"
				class="form-input w-full {showMatchColors && prefix ? 'text-transparent caret-transparent' : ''}"
			/>
		</div>
		<button onclick={() => { prefix = ''; clearMatchColors(); }} disabled={running} class="form-action">CLEAN</button>
	</div>

	<div class="form-row">
		<label class="form-label">SUFFIX</label>
		<div class="flex-1 relative">
			{#if showMatchColors && suffix}
				<span class="absolute inset-0 px-2 py-1 font-mono pointer-events-none">{#each suffix.split('') as char, i}{@const addr = result?.address ?? preview?.address}{#if addr && addr[addr.length - suffix.length + i] === char}<span class="text-success">{char}</span>{:else}{char}{/if}{/each}</span>
			{/if}
			<input
				type="text"
				bind:value={suffix}
				oninput={clearMatchColors}
				placeholder="BOX"
				disabled={running}
				autocomplete="off"
				class="form-input w-full {showMatchColors && suffix ? 'text-transparent caret-transparent' : ''}"
			/>
		</div>
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
		<label class="form-label">MAX TIME</label>
		<input
			type="number"
			bind:value={maxTime}
			min={1}
			step={1}
			disabled={running}
			autocomplete="off"
			class="form-input"
		/>
		<button onclick={() => maxTime = 10} disabled={running} class="form-action">DEFAULT</button>
	</div>

	<div class="form-row">
		{#if running}
			<button onclick={stop} class="form-action-left text-error">STOP</button>
			<span class="flex-1 px-2 py-1 flex justify-between" style="background:linear-gradient(to right, var(--color-base-200) {Math.min(100, Math.max((tries / maxTries) * 100, (elapsed / (maxTime * 60)) * 100))}%, transparent {Math.min(100, Math.max((tries / maxTries) * 100, (elapsed / (maxTime * 60)) * 100))}%)"><span class="opacity-70">{tries.toLocaleString()} TRIES...</span><span class="opacity-70">{Math.floor(elapsed / 60)}m {Math.floor(elapsed % 60)}s</span></span>
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
		<span class="form-value {running && !result ? 'opacity-40' : ''}">{displayPrivateKey ? '****' + '.'.repeat(Math.max(3, addrStartLen + addrEndLen - 5)) + '****' : ''}</span>
		<button onclick={() => navigator.clipboard.writeText(displayPrivateKey)} disabled={!result && (running || !preview)} class="form-action">COPY</button>
	</div>
</div>
