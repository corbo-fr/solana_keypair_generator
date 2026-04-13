<script lang="ts">
	import { onDestroy } from 'svelte';
	import { shortKey } from '$lib/format';

	// --- Constants ---
	const BASE58_CHARS = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
	const defaultThreads = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 8 : 8;

	// --- Form inputs ---
	let prefix = $state('');
	let suffix = $state('');
	let maxTries = $state(100_000_000);
	let maxTime = $state(10);
	let threads = $state(defaultThreads);

	// --- Generation state ---
	let running = $state(false);
	let tries = $state(0);
	let elapsed = $state(0);
	let bestScore = $state(0);
	let showMatchColors = $state(false);
	type KeyPair = { address: string; privateKey: string };
	type Status = { message: string; type: 'error' | 'warning' | 'success' };
	let status = $state<Status | null>(null);
	let result = $state<KeyPair | null>(null);
	let preview = $state<KeyPair | null>(null);

	// --- Internal ---
	let workers: Worker[] = [];
	let workerTries: number[] = [];
	let startTime = 0;
	let timerInterval: ReturnType<typeof setInterval> | null = null;
	let finishedCount = 0;
	let done = false;

	// --- Derived ---
	let displayAddress = $derived(result?.address ?? preview?.address ?? '');
	let displayPrivateKey = $derived(result?.privateKey ?? preview?.privateKey ?? '');
	let addrStartLen = $derived(Math.max(4, prefix.length));
	let addrEndLen = $derived(Math.max(4, suffix.length));

	let prefixMatched = $derived.by(() => {
		if (!displayAddress || !prefix) return 0;
		let count = 0;
		for (let i = 0; i < prefix.length; i++) {
			if (displayAddress[i] === prefix[i]) count++;
		}
		return count;
	});

	let suffixMatched = $derived.by(() => {
		if (!displayAddress || !suffix) return 0;
		let count = 0;
		for (let i = 0; i < suffix.length; i++) {
			const ai = displayAddress.length - suffix.length + i;
			if (ai >= 0 && displayAddress[ai] === suffix[i]) count++;
		}
		return count;
	});

	// --- Helpers ---
	function formatTime(seconds: number): string {
		return `${Math.floor(seconds / 60)}m ${Math.floor(seconds % 60)}s`;
	}

	function totalTries(): number {
		return workerTries.reduce((a, b) => a + b, 0);
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

	function clearMatchColors() {
		showMatchColors = false;
	}

	// --- Worker lifecycle ---
	function terminateAll() {
		if (timerInterval) {
			clearInterval(timerInterval);
			timerInterval = null;
		}
		for (const w of workers) w.terminate();
		workers = [];
		workerTries = [];
	}

	function stopWorkers() {
		for (const w of workers) w.postMessage({ type: 'stop' });
	}

	function finish(finalStatus: { message: string; type: 'error' | 'warning' | 'success' }) {
		if (done) return;
		done = true;
		tries = totalTries();
		elapsed = (Date.now() - startTime) / 1000;
		status = finalStatus;
		terminateAll();
		running = false;
	}

	function handleWorkerMessage(workerIndex: number, data: any) {
		if (done) return;

		if (data.type === 'progress') {
			workerTries[workerIndex] = data.tries;
			tries = totalTries();

			if (data.bestScore > bestScore) {
				bestScore = data.bestScore;
				preview = { address: data.bestAddress, privateKey: data.bestPrivateKey };
			}

			if (tries >= maxTries) stopWorkers();
			return;
		}

		if (data.type === 'found') {
			workerTries[workerIndex] = data.tries;
			result = data.result;
			finish({ message: '', type: 'success' });
			return;
		}

		if (data.type === 'error') {
			stopWorkers();
			finish({ message: data.message, type: 'error' });
			return;
		}

		if (data.type === 'stopped') {
			workerTries[workerIndex] = data.tries ?? workerTries[workerIndex];
			if (data.preview && data.bestScore >= bestScore) {
				bestScore = data.bestScore;
				preview = data.preview;
			}

			finishedCount++;
			if (finishedCount < workers.length) return;

			const t = totalTries();
			if (t >= maxTries || (Date.now() - startTime) / 1000 >= maxTime * 60) {
				finish({ message: '', type: 'error' });
			} else {
				finish({ message: '', type: 'warning' });
			}
		}
	}

	// --- Actions ---
	function generate() {
		const error = validate();
		if (error) {
			status = { message: error, type: 'error' };
			return;
		}

		terminateAll();

		status = null;
		result = null;
		preview = null;
		bestScore = 0;
		tries = 0;
		elapsed = 0;
		finishedCount = 0;
		done = false;
		startTime = Date.now();
		running = true;
		showMatchColors = true;

		timerInterval = setInterval(() => {
			elapsed = (Date.now() - startTime) / 1000;
			if (elapsed >= maxTime * 60) stopWorkers();
		}, 200);

		workerTries = new Array(threads).fill(0);
		for (let i = 0; i < threads; i++) {
			const w = new Worker(new URL('./vanity-worker.ts', import.meta.url), { type: 'module' });
			w.onmessage = (e) => handleWorkerMessage(i, e.data);
			workers.push(w);
			w.postMessage({ type: 'start', prefix, suffix });
		}
	}

	function stop() {
		stopWorkers();
	}

	onDestroy(terminateAll);
</script>

<div class="flex flex-col">
	<h1 class="page-title">KEYPAIR GENERATION</h1>

	<div class="page-description">
		Generate a Solana address that starts or ends with specific characters.
		Brute-forces random keypairs until a match is found. Longer patterns take
		exponentially more tries. Valid characters are base58:
		1-9 A-H J-N P-Z a-k m-z (no 0, O, I, l).
	</div>

	<div class="form-row">
		<label class="form-label"><span>PREFIX</span><span class="ml-auto opacity-30 font-normal normal-case tracking-normal">vanity</span></label>
		<div class="flex-1 relative">
			{#if showMatchColors && prefix}
				<span class="absolute inset-0 px-2 py-1 font-mono pointer-events-none">{#each prefix.split('') as char, i}{#if displayAddress && displayAddress[i] === char}<span class="text-success">{char}</span>{:else}{char}{/if}{/each}</span>
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
		<span class="w-28 shrink-0 px-2 py-1 border-l border-base-300 text-center relative overflow-hidden {showMatchColors && prefix ? (prefixMatched === prefix.length ? 'text-success' : '') : 'opacity-40'}">
			{#if showMatchColors && prefix}<div class="absolute top-0 bottom-0 left-0 bg-base-200 transition-all duration-150 ease-out" style="width:{prefixMatched / prefix.length * 100}%"></div>{/if}
			<span class="relative">{showMatchColors && prefix ? prefixMatched : 0}/{prefix.length || 0}</span>
		</span>
		<button onclick={() => { prefix = ''; clearMatchColors(); }} disabled={running} class="form-action">CLEAN</button>
	</div>

	<div class="form-row">
		<label class="form-label"><span>SUFFIX</span><span class="ml-auto opacity-30 font-normal normal-case tracking-normal">vanity</span></label>
		<div class="flex-1 relative">
			{#if showMatchColors && suffix}
				<span class="absolute inset-0 px-2 py-1 font-mono pointer-events-none">{#each suffix.split('') as char, i}{@const addr = displayAddress}{#if addr && addr[addr.length - suffix.length + i] === char}<span class="text-success">{char}</span>{:else}{char}{/if}{/each}</span>
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
		<span class="w-28 shrink-0 px-2 py-1 border-l border-base-300 text-center relative overflow-hidden {showMatchColors && suffix ? (suffixMatched === suffix.length ? 'text-success' : '') : 'opacity-40'}">
			{#if showMatchColors && suffix}<div class="absolute top-0 bottom-0 left-0 bg-base-200 transition-all duration-150 ease-out" style="width:{suffixMatched / suffix.length * 100}%"></div>{/if}
			<span class="relative">{showMatchColors && suffix ? suffixMatched : 0}/{suffix.length || 0}</span>
		</span>
		<button onclick={() => { suffix = ''; clearMatchColors(); }} disabled={running} class="form-action">CLEAN</button>
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
		<button onclick={() => maxTries = 100_000_000} disabled={running} class="form-action">DEFAULT</button>
	</div>

	<div class="form-row">
		<label class="form-label"><span>MAX TIME</span><span class="ml-auto opacity-30 font-normal normal-case tracking-normal">min</span></label>
		<input
			type="number"
			bind:value={maxTime}
			min={1}
			max={1440}
			step={1}
			disabled={running}
			autocomplete="off"
			class="form-input"
		/>
		<button onclick={() => maxTime = 10} disabled={running} class="form-action">DEFAULT</button>
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
		<button onclick={generate} disabled={running} class="form-action-left {running ? '' : 'animate-pulse'}">GENERATE</button>
		<span class="flex-1 px-2 py-1 relative overflow-hidden {status?.message && tries === 0 && !running ? 'text-error' : (running || tries > 0 ? 'opacity-70' : 'opacity-40')}">
			{#if running || tries > 0}<div class="absolute top-0 bottom-0 left-0 bg-base-200 transition-all duration-150 ease-out" style="width:{Math.min(100, tries / maxTries * 100)}%"></div>{/if}
			<span class="relative">{status?.message && tries === 0 && !running ? status.message : `${tries.toLocaleString()} ${tries === 1 ? 'try' : 'tries'}`}</span>
		</span>
		<span class="w-28 shrink-0 px-2 py-1 border-l border-base-300 text-center {running || elapsed > 0 ? 'opacity-70' : 'opacity-40'} relative overflow-hidden">
			{#if running || elapsed > 0}<div class="absolute top-0 bottom-0 left-0 bg-base-200 transition-all duration-150 ease-out" style="width:{Math.min(100, elapsed / (maxTime * 60) * 100)}%"></div>{/if}
			<span class="relative">{formatTime(elapsed)}</span>
		</span>
		<button onclick={stop} disabled={!running} class="form-action !text-error {running ? 'animate-pulse' : ''}">STOP</button>
	</div>

	<div class="form-row">
		<label class="form-label"><span>PUBLIC KEY</span><span class="ml-auto opacity-30 font-normal normal-case tracking-normal">b58</span></label>
		<span class="form-value {running && !result ? 'opacity-40' : ''}">{#if showMatchColors && displayAddress}{#each displayAddress.slice(0, addrStartLen).split('') as char, i}{#if prefix && i < prefix.length && char === prefix[i]}<span class="text-success">{char}</span>{:else}{char}{/if}{/each}...{#each displayAddress.slice(-addrEndLen).split('') as char, i}{@const realIndex = displayAddress.length - addrEndLen + i}{#if suffix && realIndex >= displayAddress.length - suffix.length && char === suffix[realIndex - (displayAddress.length - suffix.length)]}<span class="text-success">{char}</span>{:else}{char}{/if}{/each}{:else}{displayAddress ? shortKey(displayAddress, addrStartLen, addrEndLen) : ''}{/if}</span>
		<button onclick={() => navigator.clipboard.writeText(displayAddress)} disabled={!result && (running || !preview)} class="form-action">COPY</button>
	</div>
	<div class="form-row">
		<label class="form-label"><span>PRIVATE KEY</span><span class="ml-auto opacity-30 font-normal normal-case tracking-normal">b58</span></label>
		<span class="form-value {running && !result ? 'opacity-40' : ''}">{displayPrivateKey ? '****' + '.'.repeat(Math.max(3, addrStartLen + addrEndLen - 5)) + '****' : ''}</span>
		<button onclick={() => navigator.clipboard.writeText(displayPrivateKey)} disabled={!result && (running || !preview)} class="form-action">COPY</button>
	</div>
</div>
