<script lang="ts">
	import { onDestroy } from 'svelte';
	import MarqueeText from '$lib/components/MarqueeText.svelte';
	import ProgressCell from './ProgressCell.svelte';
	import PerfGraph from './PerfGraph.svelte';
	import { shortKey } from '$lib/format';
	import { entropyToMnemonic } from '@scure/bip39';
	import { wordlist } from '@scure/bip39/wordlists/english.js';
	import { getBase58Encoder } from '@solana/kit';

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
	let elapsed = $state(0);
	let bestScore = $state(0);
	let showMatchColors = $state(false);
	type KeyPair = { address: string; privateKey: string };
	type Status = { message: string; type: 'error' | 'warning' | 'success' };
	let status = $state<Status | null>(null);
	let result = $state<KeyPair | null>(null);
	let preview = $state<KeyPair | null>(null);

	// --- Performance tracking ---
	const PERF_WINDOW_MS = 1000;
	const PERF_STEP_MS = 100;
	const PERF_SAMPLES_PER_WINDOW = PERF_WINDOW_MS / PERF_STEP_MS;
	let genPerSecHistory: number[] = $state([]);
	let currentGenPerSec = $state(0);
	let minGenPerSec = $state(0);
	let maxGenPerSec = $state(0);
	let perfSamples: number[] = [];
	let prevTries = 0;
	let perfInterval: ReturnType<typeof setInterval> | null = null;

	// --- Internal ---
	let workers: Worker[] = [];
	let workerTries: number[] = $state([]);
	let startTime = 0;
	let timerInterval: ReturnType<typeof setInterval> | null = null;
	let finishedCount = 0;
	let done = false;

	// --- Derived ---
	let tries = $derived(workerTries.reduce((a, b) => a + b, 0));
	let displayAddress = $derived(result?.address ?? preview?.address ?? '');
	let displayPrivateKey = $derived(result?.privateKey ?? preview?.privateKey ?? '');
	let addrStartLen = $derived(Math.max(4, prefix.length + 4));
	let addrEndLen = $derived(Math.max(4, suffix.length + 4));

	let displayMnemonic = $derived.by(() => {
		if (!displayPrivateKey) return '';
		try {
			const bytes = getBase58Encoder().encode(displayPrivateKey);
			return entropyToMnemonic(bytes.slice(0, 32), wordlist);
		} catch { return ''; }
	});

	let displayArray = $derived.by(() => {
		if (!displayPrivateKey) return '';
		try {
			const bytes = getBase58Encoder().encode(displayPrivateKey);
			return '[' + Array.from(bytes).join(',') + ']';
		} catch { return ''; }
	});

	let prefixMatched = $derived.by(() => {
		if (!displayAddress || !prefix) return 0;
		let count = 0;
		for (let i = 0; i < prefix.length; i++) {
			if (displayAddress[i] === prefix[i]) count++;
			else break;
		}
		return count;
	});

	let suffixMatched = $derived.by(() => {
		if (!displayAddress || !suffix) return 0;
		let count = 0;
		for (let i = 0; i < suffix.length; i++) {
			const ai = displayAddress.length - suffix.length + i;
			if (ai >= 0 && displayAddress[ai] === suffix[i]) count++;
			else break;
		}
		return count;
	});

	let totalTarget = $derived((prefix.length || 0) + (suffix.length || 0));
	let totalMatched = $derived(prefixMatched + suffixMatched);

	let threadHeights = $derived.by(() => {
		if (workerTries.length === 0) return [];
		const min = Math.min(...workerTries);
		const max = Math.max(...workerTries);
		const range = max - min;
		if (range === 0) return workerTries.map(() => 100);
		return workerTries.map((t) => ((t - min) / range) * 100);
	});

	let privateKeyFormats = $derived([
		{ label: 'b58', display: displayPrivateKey ? '****' + '.'.repeat(Math.max(3, addrStartLen + addrEndLen - 5)) + '****' : '', value: displayPrivateKey },
		{ label: 'w24', display: displayMnemonic ? '*** *** *** *** ...' : '', value: displayMnemonic },
		{ label: 'arr', display: displayArray ? '[****,****,****,...]' : '', value: displayArray },
	]);

	// --- Helpers ---
	function formatTime(seconds: number): string {
		if (seconds >= 3600) return `${Math.floor(seconds / 3600)}h ${Math.floor(seconds % 3600 / 60)}m`;
		return `${Math.floor(seconds / 60)}m ${Math.floor(seconds % 60)}s`;
	}

	function isValidBase58(str: string): boolean {
		return [...str].every((c) => BASE58_CHARS.includes(c));
	}

	function validate(): string | null {
		if (prefix && !isValidBase58(prefix)) return 'Prefix contains invalid base58 characters.';
		if (suffix && !isValidBase58(suffix)) return 'Suffix contains invalid base58 characters.';
		if (threads < 1 || threads > 64) return 'Threads must be between 1 and 64.';
		return null;
	}

	function clearMatchColors() {
		showMatchColors = false;
	}

	// --- Performance sampling ---
	function samplePerf() {
		const current = tries;
		if (prevTries === 0 && perfSamples.length === 0) {
			prevTries = current;
			return;
		}
		const diff = current - prevTries;
		prevTries = current;
		perfSamples.push(diff);

		const windowSamples = perfSamples.slice(-PERF_SAMPLES_PER_WINDOW);
		const genPerSec = windowSamples.reduce((a, b) => a + b, 0) * (PERF_WINDOW_MS / PERF_STEP_MS) / windowSamples.length;
		currentGenPerSec = Math.round(genPerSec);

		if (perfSamples.length % PERF_SAMPLES_PER_WINDOW === 0) {
			genPerSecHistory.push(currentGenPerSec);
			if (genPerSecHistory.length === 1) {
				minGenPerSec = currentGenPerSec;
				maxGenPerSec = currentGenPerSec;
			} else {
				if (currentGenPerSec < minGenPerSec) minGenPerSec = currentGenPerSec;
				if (currentGenPerSec > maxGenPerSec) maxGenPerSec = currentGenPerSec;
			}
		}
	}

	// --- Worker lifecycle ---
	function terminateAll() {
		if (timerInterval) {
			clearInterval(timerInterval);
			timerInterval = null;
		}
		if (perfInterval) {
			clearInterval(perfInterval);
			perfInterval = null;
		}
		for (const w of workers) w.terminate();
		workers = [];
	}

	function stopWorkers() {
		for (const w of workers) w.postMessage({ type: 'stop' });
	}

	function finish(finalStatus: Status) {
		if (done) return;
		done = true;
		elapsed = (Date.now() - startTime) / 1000;
		samplePerf();
		status = finalStatus;
		terminateAll();
		running = false;
	}

	function handleWorkerMessage(workerIndex: number, data: any) {
		if (done) return;

		if (data.type === 'progress') {
			workerTries[workerIndex] = data.tries;

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

			if (tries >= maxTries || (Date.now() - startTime) / 1000 >= maxTime * 60) {
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
		elapsed = 0;
		finishedCount = 0;
		done = false;
		prevTries = 0;
		perfSamples = [];
		genPerSecHistory = [];
		currentGenPerSec = 0;
		minGenPerSec = 0;
		maxGenPerSec = 0;
		workerTries = new Array(threads).fill(0);
		startTime = Date.now();
		running = true;
		showMatchColors = true;

		timerInterval = setInterval(() => {
			elapsed = (Date.now() - startTime) / 1000;
			if (elapsed >= maxTime * 60) stopWorkers();
		}, 200);

		perfInterval = setInterval(samplePerf, PERF_STEP_MS);

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

	<MarqueeText text="Generate a Solana address that starts or ends with specific characters. Brute-forces random keypairs until a match is found. Longer patterns take exponentially more tries. Valid characters are base58: 1-9 A-H J-N P-Z a-k m-z (no 0, O, I, l)." />

	<div class="form-row">
		<label class="form-label"><span>PREFIX</span><span class="ml-auto opacity-30 font-normal normal-case tracking-normal">vanity</span></label>
		<div class="flex-1 relative">
			{#if showMatchColors && prefix && running}
				<span class="absolute inset-0 px-2 py-1 font-mono pointer-events-none">
					{#each prefix.split('') as char, i}
						{#if displayAddress && displayAddress[i] === char}<span class="text-success">{char}</span>{:else}{char}{/if}
					{/each}
				</span>
			{/if}
			<input
				type="text"
				bind:value={prefix}
				oninput={clearMatchColors}
				placeholder="SOL"
				disabled={running}
				autocomplete="off"
				class="form-input w-full {showMatchColors && prefix && running ? 'text-transparent caret-transparent' : showMatchColors && prefix && !running && result ? 'text-success' : ''}"
			/>
		</div>
		<ProgressCell
			pct={prefix.length ? prefixMatched / prefix.length * 100 : 0}
			show={!!(showMatchColors && prefix)}
			class={showMatchColors && prefix ? (prefixMatched === prefix.length ? 'text-success' : !running ? 'text-error' : '') : 'opacity-40'}
		>
			{showMatchColors && prefix ? prefixMatched : 0}/{prefix.length || 0}
		</ProgressCell>
		<button onclick={() => { prefix = ''; clearMatchColors(); }} disabled={running} class="form-action">CLEAN</button>
	</div>

	<div class="form-row">
		<label class="form-label"><span>SUFFIX</span><span class="ml-auto opacity-30 font-normal normal-case tracking-normal">vanity</span></label>
		<div class="flex-1 relative">
			{#if showMatchColors && suffix && running}
				<span class="absolute inset-0 px-2 py-1 font-mono pointer-events-none">
					{#each suffix.split('') as char, i}
						{@const ai = displayAddress.length - suffix.length + i}
						{#if displayAddress && ai >= 0 && displayAddress[ai] === char}<span class="text-success">{char}</span>{:else}{char}{/if}
					{/each}
				</span>
			{/if}
			<input
				type="text"
				bind:value={suffix}
				oninput={clearMatchColors}
				placeholder="BOX"
				disabled={running}
				autocomplete="off"
				class="form-input w-full {showMatchColors && suffix && running ? 'text-transparent caret-transparent' : showMatchColors && suffix && !running && result ? 'text-success' : ''}"
			/>
		</div>
		<ProgressCell
			pct={suffix.length ? suffixMatched / suffix.length * 100 : 0}
			show={!!(showMatchColors && suffix)}
			class={showMatchColors && suffix ? (suffixMatched === suffix.length ? 'text-success' : !running ? 'text-error' : '') : 'opacity-40'}
		>
			{showMatchColors && suffix ? suffixMatched : 0}/{suffix.length || 0}
		</ProgressCell>
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
		<ProgressCell
			pct={Math.min(100, tries / maxTries * 100)}
			show={running || tries > 0}
			class={!running && !result && status ? 'text-error' : running || tries > 0 ? 'opacity-70' : 'opacity-40'}
		>
			{Math.min(100, Math.floor(tries / maxTries * 100))}%
		</ProgressCell>
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
		<ProgressCell
			pct={Math.min(100, elapsed / (maxTime * 60) * 100)}
			show={running || elapsed > 0}
			class={!running && !result && status ? 'text-error' : running || elapsed > 0 ? 'opacity-70' : 'opacity-40'}
		>
			{formatTime(elapsed)}
		</ProgressCell>
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
		<span class="w-28 shrink-0 border-l border-base-300 flex items-end">
			{#if threadHeights.length}
				{#each threadHeights as h}
					<div class="flex-1 {running ? 'bg-primary' : 'bg-base-200'} transition-all duration-150 ease-out" style="height:{h}%"></div>
				{/each}
			{:else}
				<div class="flex-1 bg-base-200 transition-all duration-150 ease-out" style="height:50%"></div>
			{/if}
		</span>
		<button onclick={() => threads = defaultThreads} disabled={running} class="form-action">AVAILABLE</button>
	</div>

	<div class="form-row">
		<button onclick={generate} disabled={running} class="form-action-left {running ? '' : 'marching-border'}">GENERATE</button>
		<span class="flex-1 px-2 py-1 relative overflow-hidden {status?.message || running || genPerSecHistory.length ? '' : 'opacity-40'}">
			{#if status?.message}
				<span class={status.type === 'error' ? 'text-error' : status.type === 'warning' ? 'text-warning' : 'text-success'}>{status.message}</span>
			{:else if running || genPerSecHistory.length}
				<div class="absolute top-0 bottom-0 left-0 bg-base-200 transition-all duration-150 ease-out" style="width:{maxGenPerSec > 0 ? Math.max(0, (currentGenPerSec - minGenPerSec) / (maxGenPerSec - minGenPerSec) * 100) : 0}%"></div>
				<span class="relative">{currentGenPerSec.toLocaleString()} gen/s</span>
			{/if}
		</span>
		<span class="w-28 shrink-0 border-l border-base-300 overflow-hidden flex items-end" style="height:1.75rem">
			<PerfGraph data={genPerSecHistory} currentValue={currentGenPerSec} {running} />
		</span>
		<button onclick={stop} disabled={!running} class="form-action !text-error {running ? 'marching-border' : ''}">STOP</button>
	</div>

	<div class="form-row">
		<label class="form-label"><span>PUBLIC KEY</span><span class="ml-auto opacity-30 font-normal normal-case tracking-normal">b58</span></label>
		<span class="form-value {running && !result ? 'opacity-40' : ''} {!running && result ? 'bg-success/10' : !running && !result && status ? 'bg-error/10' : ''}">
			{#if showMatchColors && displayAddress}
				{#each displayAddress.slice(0, addrStartLen).split('') as char, i}
					{#if prefix && i < prefix.length && char === prefix[i]}<span class="text-success">{char}</span>{:else}{char}{/if}
				{/each}...{#each displayAddress.slice(-addrEndLen).split('') as char, i}
					{@const realIndex = displayAddress.length - addrEndLen + i}
					{#if suffix && realIndex >= displayAddress.length - suffix.length && char === suffix[realIndex - (displayAddress.length - suffix.length)]}<span class="text-success">{char}</span>{:else}{char}{/if}
				{/each}
			{:else}
				{displayAddress ? shortKey(displayAddress, addrStartLen, addrEndLen) : ''}
			{/if}
		</span>
		<ProgressCell
			pct={totalTarget ? totalMatched / totalTarget * 100 : 0}
			show={!!(showMatchColors && totalTarget)}
			class={showMatchColors && totalTarget ? (!running && result ? 'text-success' : !running && !result && status ? 'text-error' : '') : 'opacity-40'}
		>
			{showMatchColors && totalTarget ? totalMatched : 0}/{totalTarget || 0}
		</ProgressCell>
		<button onclick={() => navigator.clipboard.writeText(displayAddress)} disabled={!result} class="form-action !text-success {result ? 'marching-border' : ''}">COPY</button>
	</div>

	{#each privateKeyFormats as fmt}
		<div class="form-row">
			<label class="form-label"><span>PRIVATE KEY</span><span class="ml-auto opacity-30 font-normal normal-case tracking-normal">{fmt.label}</span></label>
			<span class="form-value {running && !result ? 'opacity-40' : ''} {!running && result ? 'bg-success/10' : !running && !result && status ? 'bg-error/10' : ''}">{fmt.display}</span>
			<button onclick={() => navigator.clipboard.writeText(fmt.value)} disabled={!result} class="form-action !text-success {result ? 'marching-border' : ''}">COPY</button>
		</div>
	{/each}
</div>
