<script lang="ts">
	import MarqueeText from '$lib/components/MarqueeText.svelte';
	import DiagonalStripesSeparator from '$lib/components/DiagonalStripesSeparator.svelte';
	import { loadWallets, saveWallets, type Wallet } from '$lib/wallets';
	import { shortKey } from '$lib/format';
	import { Keypair } from '@solana/web3.js';
	import { getBase58Decoder } from '@solana/kit';
	import { loadInputs, saveInputs } from '$lib/persist';

	// --- State ---
	const savedInputs = loadInputs('home', { publicKeyInput: '', privateKeyInput: '' });
	let wallets = $state<Wallet[]>(loadWallets());
	let fileInput: HTMLInputElement;
	let publicKeyInput = $state(savedInputs.publicKeyInput);
	let privateKeyInput = $state(savedInputs.privateKeyInput);
	type Status = { message: string; type: 'error' | 'warning' | 'success' };
	let status = $state<Status | null>(null);

	// --- Persist on change ---
	$effect(() => {
		saveWallets(wallets);
	});
	$effect(() => {
		saveInputs('home', { publicKeyInput, privateKeyInput });
	});

	// --- Move ---
	function moveWallet(index: number, direction: -1 | 1, e: MouseEvent) {
		const target = index + direction;
		if (target < 0 || target >= wallets.length) return;
		const copy = [...wallets];
		[copy[index], copy[target]] = [copy[target], copy[index]];
		wallets = copy;
		// Focus the same button at the new position after DOM update
		const btn = e.currentTarget as HTMLButtonElement;
		const isUp = direction === -1;
		requestAnimationFrame(() => {
			const rows = btn.closest('.flex.flex-col')?.querySelectorAll(':scope > .form-row');
			if (!rows) return;
			// Wallet rows start after the fixed rows (header, import, stripes, add, stripes, generate)
			const walletRows = Array.from(rows).slice(-copy.length);
			const targetRow = walletRows[target];
			const buttons = targetRow?.querySelectorAll('button');
			// Up button is first, down button is second
			const targetBtn = isUp ? buttons?.[0] : buttons?.[1];
			(targetBtn as HTMLButtonElement)?.focus();
		});
	}

	// --- Actions ---
	function generateWallet() {
		const keypair = Keypair.generate();
		const address = keypair.publicKey.toBase58();
		const privateKey = getBase58Decoder().decode(keypair.secretKey);
		wallets = [...wallets, { publicKey: address, privateKey, label: '' }];
		status = { message: `Wallet generated (${wallets.length} total).`, type: 'success' };
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
		wallets = [...wallets, { publicKey: pub, privateKey: priv, label: '' }];
		publicKeyInput = '';
		privateKeyInput = '';
		status = { message: `Wallet added (${wallets.length} total).`, type: 'success' };
	}

	function removeWallet(index: number) {
		wallets = wallets.filter((_, i) => i !== index);
		status = { message: `Wallet removed (${wallets.length} total).`, type: 'success' };
	}

	function importJson() {
		fileInput.click();
	}

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
				const valid: Wallet[] = [];
				for (const item of parsed) {
					if (typeof item.publicKey !== 'string' || typeof item.privateKey !== 'string') {
						status = { message: 'Each item must have publicKey and privateKey strings.', type: 'error' };
						return;
					}
					if (!wallets.some((w) => w.publicKey === item.publicKey) && !valid.some((w) => w.publicKey === item.publicKey)) {
						valid.push({ publicKey: item.publicKey, privateKey: item.privateKey, label: item.label || '' });
					}
				}
				if (valid.length === 0) {
					status = { message: 'No new wallets to import (all duplicates).', type: 'warning' };
					return;
				}
				wallets = [...wallets, ...valid];
				status = { message: `Imported ${valid.length} wallet${valid.length > 1 ? 's' : ''} (${wallets.length} total).`, type: 'success' };
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

</script>

<input type="file" accept=".json" bind:this={fileInput} onchange={handleFileImport} class="hidden" />

<div class="flex flex-col">
	<div class="page-header">
		<h1 class="page-title">WALLET MANAGER</h1>
		<MarqueeText text="Manage your Solana keypairs locally. Generate, import/export as JSON, add or remove wallets. Everything is stored in your browser's localStorage — nothing leaves your machine." />
	</div>

	<DiagonalStripesSeparator />

	<!-- Import / Export -->
	<div class="form-row">
		<button onclick={importJson} class="form-action-left">IMPORT</button>
		<span class="form-value opacity-40">{wallets.length} wallet{wallets.length !== 1 ? 's' : ''}</span>
		<button onclick={() => { wallets = []; }} disabled={wallets.length === 0} class="form-action !text-error border-r-0">RESET ALL</button>
		<button onclick={exportJson} disabled={wallets.length === 0} class="form-action">EXPORT</button>
	</div>

	<DiagonalStripesSeparator />

	<!-- Generate wallet -->
	<div class="form-row">
		<button onclick={addWallet} class="form-action-left border-r-0">IMPORT</button>
		<button onclick={generateWallet} class="form-action-left">GENERATE</button>
		<div class="flex-1 border-r border-base-300"><input type="text" bind:value={publicKeyInput} placeholder="public key" autocomplete="off" class="form-input w-full" /></div>
		<div class="flex-1"><input type="password" bind:value={privateKeyInput} placeholder="private key" autocomplete="off" class="form-input w-full" /></div>
		<button onclick={addWallet} class="form-action">ADD</button>
	</div>

	<!-- Wallet list -->
	{#each wallets as wallet, i}
		<div class="form-row">
			<label class="form-label"><span class="opacity-30 font-normal normal-case tracking-normal mr-2">#{i + 1}</span>{shortKey(wallet.publicKey)}</label>
			<input type="text" bind:value={wallet.label} placeholder="label" autocomplete="off" class="form-input" />
			<button onclick={(e) => moveWallet(i, -1, e)} disabled={i === 0} class="shrink-0 w-8 border-l border-base-300 opacity-50 hover:bg-base-200 disabled:opacity-20 disabled:pointer-events-none">&#9650;</button>
			<button onclick={(e) => moveWallet(i, 1, e)} disabled={i === wallets.length - 1} class="shrink-0 w-8 border-l border-base-300 opacity-50 hover:bg-base-200 disabled:opacity-20 disabled:pointer-events-none">&#9660;</button>
			<button onclick={() => removeWallet(i)} class="form-action !text-error">DELETE</button>
		</div>
	{/each}
</div>
