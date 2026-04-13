<script lang="ts">
	import { onDestroy, tick } from 'svelte';
	import MarqueeText from '$lib/components/MarqueeText.svelte';
	import { shortKey } from '$lib/format';
	import { entropyToMnemonic } from '@scure/bip39';
	import { wordlist } from '@scure/bip39/wordlists/english.js';
	import { getBase58Encoder } from '@solana/kit';

	// --- Constants ---
	const BASE58_CHARS = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
	const defaultThreads = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 8 : 8;
	const MAX_GRAPH_POINTS = 300;

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
	let perfCanvas: HTMLCanvasElement | undefined = $state();

	// --- Internal ---
	let workers: Worker[] = [];
	let workerTries: number[] = $state([]);
	let startTime = 0;
	let timerInterval: ReturnType<typeof setInterval> | null = null;
	let finishedCount = 0;
	let done = false;

	// --- Derived ---
	let displayAddress = $derived(result?.address ?? preview?.address ?? '');
	let displayPrivateKey = $derived(result?.privateKey ?? preview?.privateKey ?? '');
	let addrStartLen = $derived(Math.max(4, prefix.length));
	let addrEndLen = $derived(Math.max(4, suffix.length));

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

	// --- Helpers ---
	// Format seconds into "Xm Xs" or "Xh Xm" for display
	function formatTime(seconds: number): string {
		if (seconds >= 3600) return `${Math.floor(seconds / 3600)}h ${Math.floor(seconds % 3600 / 60)}m`;
		return `${Math.floor(seconds / 60)}m ${Math.floor(seconds % 60)}s`;
	}

	// Sum of all worker tries across threads
	function totalTries(): number {
		return workerTries.reduce((a, b) => a + b, 0);
	}

	// Check if every character in the string is a valid base58 character
	function isValidBase58(str: string): boolean {
		return [...str].every((c) => BASE58_CHARS.includes(c));
	}

	// Validate form inputs, returns error message or null if valid
	function validate(): string | null {
		if (prefix && !isValidBase58(prefix)) return 'Prefix contains invalid base58 characters.';
		if (suffix && !isValidBase58(suffix)) return 'Suffix contains invalid base58 characters.';
		if (threads < 1 || threads > 64) return 'Threads must be between 1 and 64.';
		return null;
	}

	// Reset match color overlay when user edits prefix/suffix
	function clearMatchColors() {
		showMatchColors = false;
	}

	// --- Performance graph ---
	// Reduce data points to MAX_GRAPH_POINTS by averaging equal-sized groups
	function downsample(data: number[]): number[] {
		if (data.length <= MAX_GRAPH_POINTS) return data;
		const k = Math.ceil(data.length / MAX_GRAPH_POINTS);
		const result: number[] = [];
		for (let i = 0; i < data.length; i += k) {
			const chunk = data.slice(i, i + k);
			result.push(chunk.reduce((a, b) => a + b, 0) / chunk.length);
		}
		return result;
	}

	// Redraw the gen/s canvas: red filled area under the curve + red stroke line
	function drawPerfGraph() {
		if (!perfCanvas) return;
		const ctx = perfCanvas.getContext('2d');
		if (!ctx) return;
		const w = perfCanvas.clientWidth;
		const h = perfCanvas.clientHeight;
		perfCanvas.width = w;
		perfCanvas.height = h;
		ctx.clearRect(0, 0, w, h);
		const raw = running ? [...genPerSecHistory, currentGenPerSec] : genPerSecHistory;
		if (raw.length < 1) return;
		const points = downsample(raw);
		const min = Math.min(...points);
		const max = Math.max(...points);
		const range = max - min;
		const len = points.length;
		const stepX = len === 1 ? 0 : w / (len - 1);
		const getY = (i: number) => range === 0 ? h / 2 : h - ((points[i] - min) / range) * (h - 4) - 2;
		const strokeColor = 'oklch(0.637 0.237 25.331)';
		const fillColor = 'rgba(239, 68, 68, 0.12)';
		// build path + fill
		ctx.beginPath();
		for (let i = 0; i < len; i++) {
			const x = len === 1 ? w / 2 : i * stepX;
			if (i === 0) ctx.moveTo(x, getY(i));
			else ctx.lineTo(x, getY(i));
		}
		ctx.lineTo(len === 1 ? w / 2 : (len - 1) * stepX, h);
		ctx.lineTo(len === 1 ? w / 2 : 0, h);
		ctx.closePath();
		ctx.fillStyle = fillColor;
		ctx.fill();
		// draw line
		ctx.beginPath();
		for (let i = 0; i < len; i++) {
			const x = len === 1 ? w / 2 : i * stepX;
			if (i === 0) ctx.moveTo(x, getY(i));
			else ctx.lineTo(x, getY(i));
		}
		ctx.strokeStyle = strokeColor;
		ctx.lineWidth = 1;
		ctx.stroke();
	}

	// Called every PERF_STEP_MS: records tries delta, computes rolling gen/s average over PERF_WINDOW_MS, and saves a history point every full window
	function samplePerf() {
		const current = totalTries();
		if (prevTries === 0 && perfSamples.length === 0) {
			prevTries = current;
			return;
		}
		const diff = current - prevTries;
		prevTries = current;
		perfSamples.push(diff);

		// compute gen/s as sum of samples over the window (last PERF_SAMPLES_PER_WINDOW steps)
		const windowSamples = perfSamples.slice(-PERF_SAMPLES_PER_WINDOW);
		const genPerSec = windowSamples.reduce((a, b) => a + b, 0) * (PERF_WINDOW_MS / PERF_STEP_MS) / windowSamples.length;
		currentGenPerSec = Math.round(genPerSec);

		// record a history point every full window
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
		drawPerfGraph();
	}

	// --- Worker lifecycle ---
	// Kill all workers and clear all intervals
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

	// Send graceful stop signal to all workers
	function stopWorkers() {
		for (const w of workers) w.postMessage({ type: 'stop' });
	}

	// Finalize generation: capture last perf sample, set status, and clean up
	function finish(finalStatus: { message: string; type: 'error' | 'warning' | 'success' }) {
		if (done) return;
		done = true;
		tries = totalTries();
		elapsed = (Date.now() - startTime) / 1000;
		samplePerf();
		status = finalStatus;
		terminateAll();
		running = false;
	}

	// Route worker messages: progress updates, found match, errors, and graceful stop
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
	// Reset state and spawn worker threads to brute-force keypairs
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
		prevTries = 0;
		perfSamples = [];
		genPerSecHistory = [];
		currentGenPerSec = 0;
		minGenPerSec = 0;
		maxGenPerSec = 0;
		startTime = Date.now();
		running = true;
		showMatchColors = true;

		timerInterval = setInterval(() => {
			elapsed = (Date.now() - startTime) / 1000;
			if (elapsed >= maxTime * 60) stopWorkers();
		}, 200);

		perfInterval = setInterval(samplePerf, PERF_STEP_MS);

		workerTries = new Array(threads).fill(0);
		for (let i = 0; i < threads; i++) {
			const w = new Worker(new URL('./vanity-worker.ts', import.meta.url), { type: 'module' });
			w.onmessage = (e) => handleWorkerMessage(i, e.data);
			workers.push(w);
			w.postMessage({ type: 'start', prefix, suffix });
		}
	}

	// User-triggered graceful stop
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
		<span class="w-28 shrink-0 px-2 py-1 border-l border-base-300 text-center relative overflow-hidden {running || tries > 0 ? 'opacity-70' : 'opacity-40'}">
			{#if running || tries > 0}<div class="absolute top-0 bottom-0 left-0 bg-base-200 transition-all duration-150 ease-out" style="width:{Math.min(100, tries / maxTries * 100)}%"></div>{/if}
			<span class="relative">{Math.min(100, Math.floor(tries / maxTries * 100))}%</span>
		</span>
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
		<span class="w-28 shrink-0 px-2 py-1 border-l border-base-300 text-center relative overflow-hidden {running || elapsed > 0 ? 'opacity-70' : 'opacity-40'}">
			{#if running || elapsed > 0}<div class="absolute top-0 bottom-0 left-0 bg-base-200 transition-all duration-150 ease-out" style="width:{Math.min(100, elapsed / (maxTime * 60) * 100)}%"></div>{/if}
			<span class="relative">{formatTime(elapsed)}</span>
		</span>
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
		<span class="flex-1 px-2 py-1 relative overflow-hidden {running || genPerSecHistory.length ? '' : 'opacity-40'}">
			{#if running || genPerSecHistory.length}
				<div class="absolute top-0 bottom-0 left-0 bg-base-200 transition-all duration-150 ease-out" style="width:{maxGenPerSec > 0 ? Math.max(0, (currentGenPerSec - minGenPerSec) / (maxGenPerSec - minGenPerSec) * 100) : 0}%"></div>
			{/if}
			<span class="relative">{running || genPerSecHistory.length ? `${currentGenPerSec.toLocaleString()} gen/s` : ''}</span>
		</span>
		<span class="w-28 shrink-0 border-l border-base-300 overflow-hidden flex items-end" style="height:1.75rem">
			<canvas bind:this={perfCanvas} class="w-full" style="height:1.75rem"></canvas>
		</span>
		<button onclick={stop} disabled={!running} class="form-action !text-error {running ? 'marching-border' : ''}">STOP</button>
	</div>

	<div class="form-row">
		<label class="form-label"><span>PUBLIC KEY</span><span class="ml-auto opacity-30 font-normal normal-case tracking-normal">b58</span></label>
		<span class="form-value {running && !result ? 'opacity-40' : ''}">{#if showMatchColors && displayAddress}{#each displayAddress.slice(0, addrStartLen).split('') as char, i}{#if prefix && i < prefix.length && char === prefix[i]}<span class="text-success">{char}</span>{:else}{char}{/if}{/each}...{#each displayAddress.slice(-addrEndLen).split('') as char, i}{@const realIndex = displayAddress.length - addrEndLen + i}{#if suffix && realIndex >= displayAddress.length - suffix.length && char === suffix[realIndex - (displayAddress.length - suffix.length)]}<span class="text-success">{char}</span>{:else}{char}{/if}{/each}{:else}{displayAddress ? shortKey(displayAddress, addrStartLen, addrEndLen) : ''}{/if}</span>
		<span class="w-28 shrink-0 px-2 py-1 border-l border-base-300 text-center relative overflow-hidden {showMatchColors && totalTarget ? (!running && result ? 'text-success' : !running && !result && status ? 'text-error' : '') : 'opacity-40'}">
			{#if showMatchColors && totalTarget}<div class="absolute top-0 bottom-0 left-0 bg-base-200 transition-all duration-150 ease-out" style="width:{totalMatched / totalTarget * 100}%"></div>{/if}
			<span class="relative">{showMatchColors && totalTarget ? totalMatched : 0}/{totalTarget || 0}</span>
		</span>
		<button onclick={() => navigator.clipboard.writeText(displayAddress)} disabled={!result && (running || !preview)} class="form-action">COPY</button>
	</div>
	<div class="form-row">
		<label class="form-label"><span>PRIVATE KEY</span><span class="ml-auto opacity-30 font-normal normal-case tracking-normal">b58</span></label>
		<span class="form-value {running && !result ? 'opacity-40' : ''}">{displayPrivateKey ? '****' + '.'.repeat(Math.max(3, addrStartLen + addrEndLen - 5)) + '****' : ''}</span>
		<button onclick={() => navigator.clipboard.writeText(displayPrivateKey)} disabled={!result && (running || !preview)} class="form-action">COPY</button>
	</div>
	<div class="form-row">
		<label class="form-label"><span>PRIVATE KEY</span><span class="ml-auto opacity-30 font-normal normal-case tracking-normal">w24</span></label>
		<span class="form-value {running && !result ? 'opacity-40' : ''}">{displayMnemonic ? '*** *** *** *** ...' : ''}</span>
		<button onclick={() => navigator.clipboard.writeText(displayMnemonic)} disabled={!result && (running || !preview)} class="form-action">COPY</button>
	</div>
	<div class="form-row">
		<label class="form-label"><span>PRIVATE KEY</span><span class="ml-auto opacity-30 font-normal normal-case tracking-normal">arr</span></label>
		<span class="form-value {running && !result ? 'opacity-40' : ''}">{displayArray ? '[****,****,****,...]' : ''}</span>
		<button onclick={() => navigator.clipboard.writeText(displayArray)} disabled={!result && (running || !preview)} class="form-action">COPY</button>
	</div>
</div>
