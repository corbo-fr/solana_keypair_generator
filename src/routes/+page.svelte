<script lang="ts">
	import MarqueeText from '$lib/components/MarqueeText.svelte';
	import ProgressCell from './ProgressCell.svelte';
	import PerfGraph from './PerfGraph.svelte';
	import { shortKey } from '$lib/format';
	import { entropyToMnemonic } from '@scure/bip39';
	import { wordlist } from '@scure/bip39/wordlists/english.js';
	import { getBase58Encoder } from '@solana/kit';
	import DiagonalStripesSeparator from '$lib/components/DiagonalStripesSeparator.svelte';
	import SolanaLogo from '$lib/components/icons/SolanaLogo.svelte';
	import {
		s, defaultThreads,
		getTries, formatTime, clearMatchColors,
		generate, stop
	} from './keypair-state.svelte';

	// --- Derived ---
	let tries = $derived(getTries());
	let displayAddress = $derived(s.result?.address ?? s.preview?.address ?? '');
	let displayPrivateKey = $derived(s.result?.privateKey ?? s.preview?.privateKey ?? '');
	let addrStartLen = $derived(Math.max(4, s.prefix.length + 4));
	let addrEndLen = $derived(Math.max(4, s.suffix.length + 4));

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
		if (!displayAddress || !s.prefix) return 0;
		let count = 0;
		for (let i = 0; i < s.prefix.length; i++) {
			if (displayAddress[i] === s.prefix[i]) count++;
			else break;
		}
		return count;
	});

	let suffixMatched = $derived.by(() => {
		if (!displayAddress || !s.suffix) return 0;
		let count = 0;
		for (let i = 0; i < s.suffix.length; i++) {
			const ai = displayAddress.length - 1 - i;
			const si = s.suffix.length - 1 - i;
			if (ai >= 0 && displayAddress[ai] === s.suffix[si]) count++;
			else break;
		}
		return count;
	});

	let totalTarget = $derived((s.prefix.length || 0) + (s.suffix.length || 0));
	let totalMatched = $derived(prefixMatched + suffixMatched);

	let threadHeights = $derived.by(() => {
		if (s.workerTries.length === 0) return [];
		const min = Math.min(...s.workerTries);
		const max = Math.max(...s.workerTries);
		const range = max - min;
		if (range === 0) return s.workerTries.map(() => 100);
		return s.workerTries.map((t) => ((t - min) / range) * 100);
	});

	let privateKeyFormats = $derived([
		{ label: 'b58', display: displayPrivateKey ? '****' + '.'.repeat(Math.max(3, addrStartLen + addrEndLen - 5)) + '****' : '', value: displayPrivateKey },
		{ label: 'w24', display: displayMnemonic ? '*** *** *** *** ...' : '', value: displayMnemonic },
		{ label: 'arr', display: displayArray ? '[****,****,****,...]' : '', value: displayArray },
	]);
</script>

<div class="flex flex-col">
	<div class="page-header">
		<h1 class="page-title"><SolanaLogo class="inline w-3 h-3 mr-2" />SOLANA KEYPAIR GENERATION</h1>
		<MarqueeText text="Generate a Solana address that starts or ends with specific characters. Brute-forces random keypairs until a match is found. Longer patterns take exponentially more tries. Valid characters are base58: 1-9 A-H J-N P-Z a-k m-z (no 0, O, I, l)." />
	</div>

	<DiagonalStripesSeparator />

	<div class="form-row">
		<label class="form-label"><span>PREFIX</span><span class="ml-auto opacity-30 font-normal normal-case tracking-normal">vanity</span></label>
		<div class="flex-1 relative">
			{#if s.showMatchColors && s.prefix && s.running}
				<span class="absolute inset-0 px-2 py-1 font-mono pointer-events-none">
					{#each s.prefix.split('') as char, i}
						{#if displayAddress && displayAddress[i] === char}<span class="text-success">{char}</span>{:else}{char}{/if}
					{/each}
				</span>
			{/if}
			<input
				type="text"
				bind:value={s.prefix}
				oninput={clearMatchColors}
				placeholder="SOL"
				disabled={s.running}
				autocomplete="off"
				class="form-input w-full {s.showMatchColors && s.prefix && s.running ? 'text-transparent caret-transparent' : s.showMatchColors && s.prefix && !s.running && s.result ? 'text-success' : ''}"
			/>
		</div>
		<ProgressCell
			pct={s.prefix.length ? prefixMatched / s.prefix.length * 100 : 0}
			show={!!(s.showMatchColors && s.prefix)}
			class={s.showMatchColors && s.prefix ? (prefixMatched === s.prefix.length ? 'text-success' : !s.running ? 'text-error' : prefixMatched > 0 ? 'text-success' : '') : 'opacity-40'}
		>
			{s.showMatchColors && s.prefix ? prefixMatched : 0}/{s.prefix.length || 0}
		</ProgressCell>
		<button onclick={() => { s.prefix = ''; clearMatchColors(); }} disabled={s.running} class="form-action">CLEAN</button>
	</div>

	<div class="form-row">
		<label class="form-label"><span>SUFFIX</span><span class="ml-auto opacity-30 font-normal normal-case tracking-normal">vanity</span></label>
		<div class="flex-1 relative">
			{#if s.showMatchColors && s.suffix && s.running}
				<span class="absolute inset-0 px-2 py-1 font-mono pointer-events-none">
					{#each s.suffix.split('') as char, i}
						{@const ai = displayAddress.length - s.suffix.length + i}
						{#if displayAddress && ai >= 0 && displayAddress[ai] === char}<span class="text-success">{char}</span>{:else}{char}{/if}
					{/each}
				</span>
			{/if}
			<input
				type="text"
				bind:value={s.suffix}
				oninput={clearMatchColors}
				placeholder="BOX"
				disabled={s.running}
				autocomplete="off"
				class="form-input w-full {s.showMatchColors && s.suffix && s.running ? 'text-transparent caret-transparent' : s.showMatchColors && s.suffix && !s.running && s.result ? 'text-success' : ''}"
			/>
		</div>
		<ProgressCell
			pct={s.suffix.length ? suffixMatched / s.suffix.length * 100 : 0}
			show={!!(s.showMatchColors && s.suffix)}
			class={s.showMatchColors && s.suffix ? (suffixMatched === s.suffix.length ? 'text-success' : !s.running ? 'text-error' : suffixMatched > 0 ? 'text-success' : '') : 'opacity-40'}
		>
			{s.showMatchColors && s.suffix ? suffixMatched : 0}/{s.suffix.length || 0}
		</ProgressCell>
		<button onclick={() => { s.suffix = ''; clearMatchColors(); }} disabled={s.running} class="form-action">CLEAN</button>
	</div>

	<DiagonalStripesSeparator />

	<div class="form-row">
		<label class="form-label">MAX TRIES</label>
		<input
			type="number"
			bind:value={s.maxTries}
			min={1000}
			step={1000}
			disabled={s.running}
			autocomplete="off"
			class="form-input"
		/>
		<ProgressCell
			pct={Math.min(100, tries / s.maxTries * 100)}
			show={s.running || tries > 0}
			class={!s.running && !s.result && s.status ? 'text-error' : s.running || tries > 0 ? 'opacity-70' : 'opacity-40'}
		>
			{Math.min(100, Math.floor(tries / s.maxTries * 100))}%
		</ProgressCell>
		<button onclick={() => s.maxTries = 100_000_000} disabled={s.running} class="form-action">DEFAULT</button>
	</div>

	<div class="form-row">
		<label class="form-label"><span>MAX TIME</span><span class="ml-auto opacity-30 font-normal normal-case tracking-normal">min</span></label>
		<input
			type="number"
			bind:value={s.maxTime}
			min={1}
			max={1440}
			step={1}
			disabled={s.running}
			autocomplete="off"
			class="form-input"
		/>
		<ProgressCell
			pct={Math.min(100, s.elapsed / (s.maxTime * 60) * 100)}
			show={s.running || s.elapsed > 0}
			class={!s.running && !s.result && s.status ? 'text-error' : s.running || s.elapsed > 0 ? 'opacity-70' : 'opacity-40'}
		>
			{formatTime(s.elapsed)}
		</ProgressCell>
		<button onclick={() => s.maxTime = 10} disabled={s.running} class="form-action">DEFAULT</button>
	</div>

	<div class="form-row">
		<label class="form-label">THREADS</label>
		<input
			type="number"
			bind:value={s.threads}
			min={1}
			max={64}
			step={1}
			disabled={s.running}
			autocomplete="off"
			class="form-input"
		/>
		<span class="w-22 shrink-0 border-l border-base-300 flex items-end">
			{#if threadHeights.length}
				{#each threadHeights as h}
					<div class="flex-1 {s.running ? 'bg-primary' : 'bg-base-200'} transition-all duration-150 ease-out" style="height:{h}%"></div>
				{/each}
			{:else}
				<div class="flex-1 bg-base-200 transition-all duration-150 ease-out" style="height:50%"></div>
			{/if}
		</span>
		<button onclick={() => s.threads = defaultThreads} disabled={s.running} class="form-action">AVAILABLE</button>
	</div>

	<DiagonalStripesSeparator />

	<div class="form-row">
		<button onclick={generate} disabled={s.running} class="form-action-left {s.running ? '' : 'marching-border'}">GENERATE</button>
		<span class="flex-1 px-2 py-1 relative overflow-hidden {s.status?.message || s.running || s.genPerSecHistory.length ? '' : 'opacity-40'}">
			{#if s.status?.message}
				<span class={s.status.type === 'error' ? 'text-error' : s.status.type === 'warning' ? 'text-warning' : 'text-success'}>{s.status.message}</span>
			{:else if s.running || s.genPerSecHistory.length}
				<div class="absolute top-0 bottom-0 left-0 bg-base-200 transition-all duration-150 ease-out" style="width:{s.maxGenPerSec > s.minGenPerSec ? Math.max(0, (s.currentGenPerSec - s.minGenPerSec) / (s.maxGenPerSec - s.minGenPerSec) * 100) : 0}%"></div>
				<span class="relative">{s.currentGenPerSec.toLocaleString()} gen/s</span>
			{/if}
		</span>
		<span class="w-22 shrink-0 border-l border-base-300 overflow-hidden flex items-end" style="height:1.75rem">
			<PerfGraph data={s.genPerSecHistory} currentValue={s.currentGenPerSec} running={s.running} />
		</span>
		<button onclick={stop} disabled={!s.running} class="form-action !text-error {s.running ? 'marching-border' : ''}">STOP</button>
	</div>

	<DiagonalStripesSeparator />

	<div class="form-row">
		<label class="form-label"><span>PUBLIC KEY</span><span class="ml-auto opacity-30 font-normal normal-case tracking-normal">b58</span></label>
		<span class="form-value {s.running && !s.result ? 'opacity-40' : ''} {!s.running && s.result ? 'bg-success/10' : !s.running && !s.result && s.status ? 'bg-error/10' : ''}">
			{#if s.showMatchColors && displayAddress}
				{#each displayAddress.slice(0, addrStartLen).split('') as char, i}
					{#if s.prefix && i < s.prefix.length && char === s.prefix[i]}<span class="text-success">{char}</span>{:else}{char}{/if}
				{/each}...{#each displayAddress.slice(-addrEndLen).split('') as char, i}
					{@const realIndex = displayAddress.length - addrEndLen + i}
					{#if s.suffix && realIndex >= displayAddress.length - s.suffix.length && char === s.suffix[realIndex - (displayAddress.length - s.suffix.length)]}<span class="text-success">{char}</span>{:else}{char}{/if}
				{/each}
			{:else}
				{displayAddress ? shortKey(displayAddress, addrStartLen, addrEndLen) : ''}
			{/if}
		</span>
		<ProgressCell
			pct={totalTarget ? totalMatched / totalTarget * 100 : 0}
			show={!!(s.showMatchColors && totalTarget)}
			class={s.showMatchColors && totalTarget ? (!s.running && s.result ? 'text-success' : !s.running && !s.result && s.status ? 'text-error' : totalMatched > 0 ? 'text-success' : '') : 'opacity-40'}
		>
			{s.showMatchColors && totalTarget ? totalMatched : 0}/{totalTarget || 0}
		</ProgressCell>
		<button onclick={() => navigator.clipboard.writeText(displayAddress)} disabled={!s.result} class="form-action !text-success {s.result ? 'marching-border' : ''}">COPY</button>
	</div>

	{#each privateKeyFormats as fmt}
		<div class="form-row">
			<label class="form-label"><span>PRIVATE KEY</span><span class="ml-auto opacity-30 font-normal normal-case tracking-normal">{fmt.label}</span></label>
			<span class="form-value {s.running && !s.result ? 'opacity-40' : ''} {!s.running && s.result ? 'bg-success/10' : !s.running && !s.result && s.status ? 'bg-error/10' : ''}">{fmt.display}</span>
			<button onclick={() => navigator.clipboard.writeText(fmt.value)} disabled={!s.result} class="form-action !text-success {s.result ? 'marching-border' : ''}">COPY</button>
		</div>
	{/each}
</div>
