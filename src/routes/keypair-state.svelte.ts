import { loadInputs, saveInputs } from '$lib/persist';

// --- Constants ---
const BASE58_CHARS = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
export const defaultThreads = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 8 : 8;
const PERF_WINDOW_MS = 1000;
const PERF_STEP_MS = 100;
const PERF_SAMPLES_PER_WINDOW = PERF_WINDOW_MS / PERF_STEP_MS;

// --- Types ---
export type KeyPair = { address: string; privateKey: string };
export type Status = { message: string; type: 'error' | 'warning' | 'success' };

// --- Form inputs (persisted) ---
const savedInputs = loadInputs('keypair', {
	prefix: '',
	suffix: '',
	maxTries: 100_000_000,
	maxTime: 10,
	threads: defaultThreads
});

// --- All reactive state in a single object so properties can be bound/assigned from components ---
export const s = $state({
	// Form inputs
	prefix: savedInputs.prefix,
	suffix: savedInputs.suffix,
	maxTries: savedInputs.maxTries,
	maxTime: savedInputs.maxTime,
	threads: savedInputs.threads,
	// Generation state
	running: false,
	elapsed: 0,
	bestScore: 0,
	showMatchColors: false,
	status: null as Status | null,
	result: null as KeyPair | null,
	preview: null as KeyPair | null,
	// Performance tracking
	genPerSecHistory: [] as number[],
	currentGenPerSec: 0,
	minGenPerSec: 0,
	maxGenPerSec: 0,
	// Workers
	workerTries: [] as number[],
});

// --- Non-reactive internal state ---
let perfSamples: number[] = [];
let prevTries = 0;
let perfInterval: ReturnType<typeof setInterval> | null = null;
let workers: Worker[] = [];
let startTime = 0;
let timerInterval: ReturnType<typeof setInterval> | null = null;
let finishedCount = 0;
let done = false;

// --- Persist inputs ---
$effect.root(() => {
	$effect(() => {
		saveInputs('keypair', {
			prefix: s.prefix,
			suffix: s.suffix,
			maxTries: s.maxTries,
			maxTime: s.maxTime,
			threads: s.threads,
		});
	});
});

// --- Helpers ---
export function getTries() {
	return s.workerTries.reduce((a, b) => a + b, 0);
}

export function formatTime(seconds: number): string {
	if (seconds >= 3600) return `${Math.floor(seconds / 3600)}h ${Math.floor(seconds % 3600 / 60)}m`;
	return `${Math.floor(seconds / 60)}m ${Math.floor(seconds % 60)}s`;
}

function isValidBase58(str: string): boolean {
	return [...str].every((c) => BASE58_CHARS.includes(c));
}

function validate(): string | null {
	if (s.prefix && !isValidBase58(s.prefix)) return 'Prefix contains invalid base58 characters.';
	if (s.suffix && !isValidBase58(s.suffix)) return 'Suffix contains invalid base58 characters.';
	if (!s.maxTries || s.maxTries < 1) return 'Max tries must be at least 1.';
	if (!s.maxTime || s.maxTime < 1) return 'Max time must be at least 1 minute.';
	if (s.threads < 1 || s.threads > 64) return 'Threads must be between 1 and 64.';
	return null;
}

export function clearMatchColors() {
	s.showMatchColors = false;
}

// --- Performance sampling ---
function samplePerf() {
	const current = getTries();
	if (prevTries === 0 && perfSamples.length === 0) {
		prevTries = current;
		return;
	}
	const diff = current - prevTries;
	prevTries = current;
	perfSamples.push(diff);

	const windowSamples = perfSamples.slice(-PERF_SAMPLES_PER_WINDOW);
	const genPerSec = windowSamples.reduce((a, b) => a + b, 0) * (PERF_WINDOW_MS / PERF_STEP_MS) / windowSamples.length;
	s.currentGenPerSec = Math.round(genPerSec);

	if (perfSamples.length % PERF_SAMPLES_PER_WINDOW === 0) {
		s.genPerSecHistory.push(s.currentGenPerSec);
		if (s.genPerSecHistory.length === 1) {
			s.minGenPerSec = s.currentGenPerSec;
			s.maxGenPerSec = s.currentGenPerSec;
		} else {
			if (s.currentGenPerSec < s.minGenPerSec) s.minGenPerSec = s.currentGenPerSec;
			if (s.currentGenPerSec > s.maxGenPerSec) s.maxGenPerSec = s.currentGenPerSec;
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
	s.elapsed = (Date.now() - startTime) / 1000;
	samplePerf();
	s.status = finalStatus;
	terminateAll();
	s.running = false;
}

function handleWorkerMessage(workerIndex: number, data: any) {
	if (done) return;

	if (data.type === 'progress') {
		s.workerTries[workerIndex] = data.tries;

		if (data.bestScore > s.bestScore) {
			s.bestScore = data.bestScore;
			s.preview = { address: data.bestAddress, privateKey: data.bestPrivateKey };
		}

		if (getTries() >= s.maxTries) stopWorkers();
		return;
	}

	if (data.type === 'found') {
		s.workerTries[workerIndex] = data.tries;
		s.result = data.result;
		finish({ message: '', type: 'success' });
		return;
	}

	if (data.type === 'error') {
		stopWorkers();
		finish({ message: data.message, type: 'error' });
		return;
	}

	if (data.type === 'stopped') {
		s.workerTries[workerIndex] = data.tries ?? s.workerTries[workerIndex];
		if (data.preview && data.bestScore >= s.bestScore) {
			s.bestScore = data.bestScore;
			s.preview = data.preview;
		}

		finishedCount++;
		if (finishedCount < workers.length) return;

		if (getTries() >= s.maxTries || (Date.now() - startTime) / 1000 >= s.maxTime * 60) {
			finish({ message: '', type: 'error' });
		} else {
			finish({ message: '', type: 'warning' });
		}
	}
}

// --- Actions ---
export function generate() {
	const error = validate();
	if (error) {
		s.status = { message: error, type: 'error' };
		return;
	}

	terminateAll();

	s.status = null;
	s.result = null;
	s.preview = null;
	s.bestScore = 0;
	s.elapsed = 0;
	finishedCount = 0;
	done = false;
	prevTries = 0;
	perfSamples = [];
	s.genPerSecHistory = [];
	s.currentGenPerSec = 0;
	s.minGenPerSec = 0;
	s.maxGenPerSec = 0;
	s.workerTries = new Array(s.threads).fill(0);
	startTime = Date.now();
	s.running = true;
	s.showMatchColors = true;

	timerInterval = setInterval(() => {
		s.elapsed = (Date.now() - startTime) / 1000;
		if (s.elapsed >= s.maxTime * 60) stopWorkers();
	}, 200);

	perfInterval = setInterval(samplePerf, PERF_STEP_MS);

	for (let i = 0; i < s.threads; i++) {
		const w = new Worker(new URL('./vanity-worker.ts', import.meta.url), { type: 'module' });
		w.onmessage = (e) => handleWorkerMessage(i, e.data);
		workers.push(w);
		w.postMessage({ type: 'start', prefix: s.prefix, suffix: s.suffix });
	}
}

export function stop() {
	stopWorkers();
}

