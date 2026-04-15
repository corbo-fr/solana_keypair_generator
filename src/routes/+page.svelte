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
	import XLogo from '$lib/components/icons/XLogo.svelte';
	import TelegramLogo from '$lib/components/icons/TelegramLogo.svelte';
	import DiscordLogo from '$lib/components/icons/DiscordLogo.svelte';
	import { downloadJson } from '$lib/download';
	import { onDestroy } from 'svelte';
	import {
		s, defaultThreads, getIsVanity,
		getTries, formatTime, clearMatchColors,
		generate, stop, cleanup, sanitizeBase58,
		getDifficulty, formatDifficulty, getEta
	} from './keypair-state.svelte';

	onDestroy(cleanup);

	// --- Copy feedback ---
	let copiedKey: string | null = $state(null);
	let copiedTimeout: ReturnType<typeof setTimeout> | null = null;

	function copyWithFeedback(value: string, key: string) {
		navigator.clipboard.writeText(value);
		copiedKey = key;
		if (copiedTimeout) clearTimeout(copiedTimeout);
		copiedTimeout = setTimeout(() => { copiedKey = null; }, 1500);
	}

	// --- Input sanitization ---
	function handlePrefixInput(e: Event) {
		const input = e.target as HTMLInputElement;
		const sanitized = sanitizeBase58(input.value);
		if (sanitized !== input.value) input.value = sanitized;
		s.prefix = sanitized;
		clearMatchColors();
	}

	function handleSuffixInput(e: Event) {
		const input = e.target as HTMLInputElement;
		const sanitized = sanitizeBase58(input.value);
		if (sanitized !== input.value) input.value = sanitized;
		s.suffix = sanitized;
		clearMatchColors();
	}

	// --- Keyboard shortcuts ---
	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !s.running) {
			e.preventDefault();
			generate();
		} else if (e.key === 'Escape' && s.running) {
			e.preventDefault();
			stop();
		}
	}

	// --- Export ---
	function exportResult() {
		if (!s.result) return;
		downloadJson({
			publicKey: s.result.address,
			privateKey: s.result.privateKey,
			mnemonic: displayMnemonic,
			byteArray: displayArray,
		}, `solbox-keypair-${s.result.address.slice(0, 8)}.json`);
	}

	// --- Derived ---
	let isVanity = $derived(getIsVanity());
	let tries = $derived(getTries());
	let difficulty = $derived(getDifficulty());
	let eta = $derived(getEta());
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
		{ key: 'b58', label: 'b58', display: displayPrivateKey ? '****' + '.'.repeat(Math.max(3, addrStartLen + addrEndLen - 5)) + '****' : '', value: displayPrivateKey },
		{ key: 'w24', label: 'w24', display: displayMnemonic ? '*** *** *** *** ...' : '', value: displayMnemonic },
		{ key: 'arr', label: 'arr', display: displayArray ? '[****,****,****,...]' : '', value: displayArray },
	]);
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="flex flex-col">
	<div class="page-header">
		<h1 class="page-title"><SolanaLogo class="inline w-3 h-3 mr-2" />VANITY KEYPAIR GENERATOR</h1>
		<MarqueeText class="max-sm:hidden" text="Generate a Solana keypair with a vanity address — choose a custom prefix and/or suffix for your public key. Keypairs are generated randomly until a match is found. Longer patterns take exponentially longer. Valid characters are base58 only: 1-9 A-H J-N P-Z a-k m-z (no 0, O, I, l). Everything runs locally in your browser — your private key never leaves your device. Randomness is powered by crypto.getRandomValues (browser CSPRNG) — keys cannot be predicted or reproduced." />
		<span class="sm:hidden shrink-0 w-16 border-l border-base-300 overflow-hidden flex items-end ml-auto" style="height:1.75rem">
			<PerfGraph data={s.genPerSecHistory} currentValue={s.currentGenPerSec} running={s.running} />
		</span>
		<div class="shrink-0 flex border-l border-base-300">
			<a href="https://x.com/trixky_2" target="_blank" rel="noopener noreferrer" class="flex items-center justify-center w-7 h-full hover:bg-base-200"><XLogo class="w-3 h-3" /></a>
			<a href="https://t.me/trixky_fr" target="_blank" rel="noopener noreferrer" class="flex items-center justify-center w-7 h-full hover:bg-base-200 border-l border-base-300"><TelegramLogo class="w-3 h-3" /></a>
			<a href="https://discord.com" target="_blank" rel="noopener noreferrer" class="flex items-center justify-center w-7 h-full hover:bg-base-200 border-l border-base-300"><DiscordLogo class="w-3 h-3" /></a>
		</div>
	</div>
	<div class="sm:hidden border-b border-base-300">
		<MarqueeText text="Generate a Solana keypair with a vanity address — choose a custom prefix and/or suffix for your public key. Keypairs are generated randomly until a match is found. Longer patterns take exponentially longer. Valid characters are base58 only: 1-9 A-H J-N P-Z a-k m-z (no 0, O, I, l). Everything runs locally in your browser — your private key never leaves your device. Randomness is powered by crypto.getRandomValues (browser CSPRNG) — keys cannot be predicted or reproduced." />
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
				value={s.prefix}
				oninput={handlePrefixInput}
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
		<button onclick={() => { s.prefix = ''; clearMatchColors(); }} disabled={s.running || !s.prefix} class="form-action">CLEAN</button>
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
				value={s.suffix}
				oninput={handleSuffixInput}
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
		<button onclick={() => { s.suffix = ''; clearMatchColors(); }} disabled={s.running || !s.suffix} class="form-action">CLEAN</button>
	</div>

	<DiagonalStripesSeparator />

	<div class="form-row {!isVanity ? 'opacity-40' : ''}">
		<label class="form-label">MAX TRIES</label>
		<input
			type="number"
			bind:value={s.maxTries}
			min={1000}
			step={1000}
			disabled={s.running || !isVanity}
			autocomplete="off"
			class="form-input"
		/>
		<ProgressCell
			pct={Math.min(100, tries / s.maxTries * 100)}
			show={s.running || tries > 0}
			class="max-sm:hidden {!s.running && !s.result && s.status ? 'text-error' : s.running || tries > 0 ? 'opacity-70' : 'opacity-40'}"
		>
			{Math.min(100, tries / s.maxTries * 100).toFixed(2)}%
		</ProgressCell>
		<button onclick={() => s.maxTries = 100_000_000} disabled={s.running || !isVanity} class="form-action">DEFAULT</button>
	</div>

	<div class="form-row {!isVanity ? 'opacity-40' : ''}">
		<label class="form-label"><span>MAX TIME</span><span class="ml-auto opacity-30 font-normal normal-case tracking-normal">min</span></label>
		<input
			type="number"
			bind:value={s.maxTime}
			min={1}
			max={1440}
			step={1}
			disabled={s.running || !isVanity}
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
		<button onclick={() => s.maxTime = 10} disabled={s.running || !isVanity} class="form-action">DEFAULT</button>
	</div>

	<div class="form-row {!isVanity ? 'opacity-40' : ''}">
		<label class="form-label"><span>THREADS</span><span class="ml-auto opacity-30 font-normal normal-case tracking-normal">{defaultThreads}</span></label>
		<input
			type="number"
			bind:value={s.threads}
			min={1}
			max={64}
			step={1}
			disabled={s.running || !isVanity}
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
		<button onclick={() => s.threads = defaultThreads} disabled={s.running || !isVanity} class="form-action">AVAILABLE</button>
	</div>

	<DiagonalStripesSeparator />

	<div class="form-row">
		{#if s.running}
			<button onclick={stop} class="form-action-left !text-error marching-border">STOP</button>
		{:else}
			<button onclick={generate} class="form-action-left marching-border">GENERATE</button>
		{/if}
		<span class="flex-1 px-2 py-1 relative overflow-hidden {s.status?.message || s.running || s.genPerSecHistory.length || (isVanity && !s.result) ? '' : 'opacity-40'}">
			{#if s.status?.message}
				<span class={s.status.type === 'error' ? 'text-error' : s.status.type === 'warning' ? 'text-warning' : 'text-success'}>{s.status.message}</span>
			{:else if s.running || s.genPerSecHistory.length}
				<div class="absolute top-0 bottom-0 left-0 bg-base-200 transition-all duration-150 ease-out" style="width:{s.maxGenPerSec > s.minGenPerSec ? Math.max(0, (s.currentGenPerSec - s.minGenPerSec) / (s.maxGenPerSec - s.minGenPerSec) * 100) : 0}%"></div>
				<span class="relative">{s.currentGenPerSec.toLocaleString()} gen/s{#if eta} — ETA {eta}{/if}</span>
			{:else if isVanity && !s.result}
				<span class="opacity-50">1 in {formatDifficulty(difficulty)} attempts</span>
			{/if}
		</span>
		<span class="max-sm:hidden w-22 shrink-0 border-l border-base-300 overflow-hidden flex items-end" style="height:1.75rem">
			<PerfGraph data={s.genPerSecHistory} currentValue={s.currentGenPerSec} running={s.running} />
		</span>
		<button onclick={exportResult} disabled={!s.result} class="form-action !text-success {s.result ? 'marching-border' : ''}">EXPORT</button>
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
		<button onclick={() => copyWithFeedback(displayAddress, 'pubkey')} disabled={!s.result} class="form-action !text-success {s.result ? 'marching-border' : ''}">{copiedKey === 'pubkey' ? 'COPIED' : 'COPY'}</button>
	</div>

	{#each privateKeyFormats as fmt}
		<div class="form-row">
			<label class="form-label"><span>PRIVATE KEY</span><span class="ml-auto opacity-30 font-normal normal-case tracking-normal">{fmt.label}</span></label>
			<span class="form-value {s.running && !s.result ? 'opacity-40' : ''} {!s.running && s.result ? 'bg-success/10' : !s.running && !s.result && s.status ? 'bg-error/10' : ''}">{fmt.display}</span>
			<button onclick={() => copyWithFeedback(fmt.value, fmt.key)} disabled={!s.result || !fmt.value} class="form-action !text-success {s.result && fmt.value ? 'marching-border' : ''}">{copiedKey === fmt.key ? 'COPIED' : 'COPY'}</button>
		</div>
	{/each}
</div>
