<script lang="ts">
	import MarqueeText from '$lib/components/MarqueeText.svelte';
	import DiagonalStripesSeparator from '$lib/components/DiagonalStripesSeparator.svelte';
	import { getWallets, updateConfig, type WalletEntry } from '$lib/config.svelte';
	import { shortKey } from '$lib/format';
	import { Keypair } from '@solana/web3.js';
	import { getBase58Decoder } from '@solana/kit';
	import { loadInputs, saveInputs } from '$lib/persist';

	// --- State ---
	const savedInputs = loadInputs('home', { publicKeyInput: '', privateKeyInput: '' });
	let publicKeyInput = $state(savedInputs.publicKeyInput);
	let privateKeyInput = $state(savedInputs.privateKeyInput);
	type Status = { message: string; type: 'error' | 'warning' | 'success' };
	let status = $state<Status | null>(null);

	let wallets = $derived(getWallets());

	// --- Helpers ---
	function walletName(w: WalletEntry): string {
		return w.label ? `"${w.label}" (${shortKey(w.publicKey)})` : shortKey(w.publicKey);
	}

	function coloredShortKey(w: WalletEntry): string {
		const short = shortKey(w.publicKey);
		const pLen = w.prefix?.length ?? 0;
		const sLen = w.suffix?.length ?? 0;
		if (!pLen && !sLen) return short;
		// short = "XXXX...XXXX" — 4 start chars + "..." + 4 end chars
		const startLen = 4;
		const endLen = 4;
		const ellipsis = '...';
		const start = short.slice(0, startLen);
		const end = short.slice(-endLen);
		const pClamped = Math.min(pLen, startLen);
		const sClamped = Math.min(sLen, endLen);
		const coloredStart = pClamped > 0
			? `<span class="text-success">${start.slice(0, pClamped)}</span>${start.slice(pClamped)}`
			: start;
		const coloredEnd = sClamped > 0
			? `${end.slice(0, endLen - sClamped)}<span class="text-success">${end.slice(endLen - sClamped)}</span>`
			: end;
		return coloredStart + ellipsis + coloredEnd;
	}

	// --- Persist on change ---
	$effect(() => {
		saveInputs('home', { publicKeyInput, privateKeyInput });
	});

	// --- Move ---
	function moveWallet(index: number, direction: -1 | 1, e: MouseEvent) {
		const target = index + direction;
		if (target < 0 || target >= wallets.length) return;
		const copy = [...wallets];
		[copy[index], copy[target]] = [copy[target], copy[index]];
		updateConfig(copy, `Move ${walletName(copy[target])} from #${index + 1} to #${target + 1}`);
		const btn = e.currentTarget as HTMLButtonElement;
		const isUp = direction === -1;
		requestAnimationFrame(() => {
			const rows = btn.closest('.flex.flex-col')?.querySelectorAll(':scope > .form-row');
			if (!rows) return;
			const walletRows = Array.from(rows).slice(-copy.length);
			const targetRow = walletRows[target];
			const buttons = targetRow?.querySelectorAll('button');
			const targetBtn = isUp ? buttons?.[0] : buttons?.[1];
			(targetBtn as HTMLButtonElement)?.focus();
		});
	}

	// --- Actions ---
	function generateWallet() {
		const keypair = Keypair.generate();
		const address = keypair.publicKey.toBase58();
		const privateKey = getBase58Decoder().decode(keypair.secretKey);
		const newWallets = [...wallets, { publicKey: address, privateKey }];
		updateConfig(newWallets, `Generate wallet #${newWallets.length} ${shortKey(address)}`);
		status = { message: `Wallet generated (${newWallets.length} total).`, type: 'success' };
	}

	function addWallet() {
		const pub = publicKeyInput.trim();
		const priv = privateKeyInput.trim();
		if (!pub || !priv) {
			status = { message: 'Both public and private key are required.', type: 'error' };
			return;
		}
		if (wallets.some((w) => w.publicKey === pub)) {
			status = { message: 'This public key already exists.', type: 'warning' };
			return;
		}
		const newWallets = [...wallets, { publicKey: pub, privateKey: priv }];
		updateConfig(newWallets, `Add wallet #${newWallets.length} ${shortKey(pub)}`);
		publicKeyInput = '';
		privateKeyInput = '';
		status = { message: `Wallet added (${newWallets.length} total).`, type: 'success' };
	}

	function removeWallet(index: number) {
		const name = walletName(wallets[index]);
		const newWallets = wallets.filter((_, i) => i !== index);
		updateConfig(newWallets, `Remove wallet #${index + 1} ${name} — ${newWallets.length} remaining`);
		status = { message: `Wallet removed (${newWallets.length} total).`, type: 'success' };
	}

	function updateLabel(index: number, newLabel: string) {
		const oldLabel = wallets[index].label || '';
		const key = shortKey(wallets[index].publicKey);
		const copy = wallets.map((w, i) => i === index ? { ...w, label: newLabel || undefined } : w);
		const action = newLabel
			? (oldLabel ? `Rename wallet #${index + 1} ${key} from "${oldLabel}" to "${newLabel}"` : `Label wallet #${index + 1} ${key} as "${newLabel}"`)
			: `Remove label from wallet #${index + 1} ${key} (was "${oldLabel}")`;
		updateConfig(copy, action);
	}

	function importJson() {
		fileInput.click();
	}

	let fileInput: HTMLInputElement;

	function handleFileImport(e: Event) {
		const file = (e.target as HTMLInputElement).files?.[0];
		if (!file) return;
		const reader = new FileReader();
		reader.onload = () => {
			try {
				const parsed = JSON.parse(reader.result as string);
				if (!Array.isArray(parsed)) {
					status = { message: 'JSON must be an array.', type: 'error' };
					return;
				}
				const valid: WalletEntry[] = [];
				for (const item of parsed) {
					if (typeof item.publicKey !== 'string' || typeof item.privateKey !== 'string') {
						status = { message: 'Each item must have publicKey and privateKey strings.', type: 'error' };
						return;
					}
					if (!wallets.some((w) => w.publicKey === item.publicKey) && !valid.some((w) => w.publicKey === item.publicKey)) {
						valid.push({
							publicKey: item.publicKey,
							privateKey: item.privateKey,
							mnemonic: item.mnemonic || undefined,
							byteArray: item.byteArray || undefined,
							label: item.label || undefined,
							prefix: item.prefix || undefined,
							suffix: item.suffix || undefined,
						});
					}
				}
				if (valid.length === 0) {
					status = { message: 'No new wallets to import (all duplicates).', type: 'warning' };
					return;
				}
				const newWallets = [...wallets, ...valid];
				updateConfig(newWallets, `Import ${valid.length} wallet${valid.length > 1 ? 's' : ''} from file — ${newWallets.length} total`);
				status = { message: `Imported ${valid.length} wallet${valid.length > 1 ? 's' : ''} (${newWallets.length} total).`, type: 'success' };
			} catch {
				status = { message: 'Invalid JSON.', type: 'error' };
			}
			fileInput.value = '';
		};
		reader.readAsText(file);
	}

	function exportJson() {
		const json = JSON.stringify(wallets, null, 2);
		navigator.clipboard.writeText(json);
		status = { message: `Exported ${wallets.length} wallet${wallets.length !== 1 ? 's' : ''} to clipboard.`, type: 'success' };
	}

	function resetAll() {
		updateConfig([], `Reset all — removed ${wallets.length} wallet${wallets.length !== 1 ? 's' : ''}`);
		status = { message: 'All wallets removed.', type: 'success' };
	}

	// Debounce label changes to avoid spamming history
	let labelTimers: Map<number, ReturnType<typeof setTimeout>> = new Map();
	function onLabelInput(index: number, value: string) {
		const existing = labelTimers.get(index);
		if (existing) clearTimeout(existing);
		labelTimers.set(index, setTimeout(() => {
			updateLabel(index, value);
			labelTimers.delete(index);
		}, 500));
	}
</script>

<input type="file" accept=".json" bind:this={fileInput} onchange={handleFileImport} class="hidden" />

<div class="flex flex-col">
	<div class="page-header">
		<h1 class="page-title">WALLET MANAGER</h1>
		<MarqueeText text="Manage your Solana keypairs locally. Generate, import/export as JSON, add or remove wallets. Everything is stored in your browser's localStorage — nothing leaves your machine." />
	</div>

	<DiagonalStripesSeparator />

	<!-- Generate wallet -->
	<div class="form-row">
		<button onclick={addWallet} class="form-action-left">IMPORT</button>
		<div class="flex-1 border-r border-base-300"><input type="text" bind:value={publicKeyInput} placeholder="public key" autocomplete="off" class="form-input w-full" /></div>
		<div class="flex-1"><input type="password" bind:value={privateKeyInput} placeholder="private key" autocomplete="off" class="form-input w-full" /></div>
		<button onclick={addWallet} class="w-22 shrink-0 px-2 py-1 uppercase tracking-widest border-l border-base-300 text-primary hover:bg-base-200 cursor-pointer disabled:opacity-40 disabled:pointer-events-none">ADD</button>
		<button onclick={generateWallet} class="form-action">GENERATE</button>
	</div>

	<DiagonalStripesSeparator />

	<!-- Wallet list -->
	{#each wallets as wallet, i}
		<div class="form-row">
			<label class="form-label truncate">
				<span class="opacity-30 font-normal normal-case tracking-normal mr-2">#{i + 1}</span>
				<span class="normal-case tracking-normal">{@html coloredShortKey(wallet)}</span>
			</label>
			<input type="text" value={wallet.label ?? ''} oninput={(e) => onLabelInput(i, (e.target as HTMLInputElement).value)} placeholder="label" autocomplete="off" class="form-input" />
			<div class="w-22 shrink-0 flex border-l border-base-300">
				<button onclick={(e) => moveWallet(i, -1, e)} disabled={i === 0} class="flex-1 opacity-50 hover:bg-base-200 disabled:opacity-20 disabled:pointer-events-none">&#9650;</button>
				<button onclick={(e) => moveWallet(i, 1, e)} disabled={i === wallets.length - 1} class="flex-1 border-l border-base-300 opacity-50 hover:bg-base-200 disabled:opacity-20 disabled:pointer-events-none">&#9660;</button>
			</div>
			<button onclick={() => removeWallet(i)} class="form-action !text-error">DELETE</button>
		</div>
	{/each}
</div>
