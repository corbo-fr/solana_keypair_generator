<script lang="ts">
	import MarqueeText from '$lib/components/MarqueeText.svelte';
	import { loadWallets, saveWallets, type Wallet } from '$lib/wallets';
	import { shortKey } from '$lib/format';
	import { Keypair } from '@solana/web3.js';
	import { getBase58Decoder } from '@solana/kit';

	// --- State ---
	let wallets = $state<Wallet[]>(loadWallets());
	let publicKeyInput = $state('');
	let privateKeyInput = $state('');
	let importJsonInput = $state('');
	type Status = { message: string; type: 'error' | 'warning' | 'success' };
	let status = $state<Status | null>(null);

	// --- Persist on change ---
	$effect(() => {
		saveWallets(wallets);
	});

	// --- Actions ---
	function generateWallet() {
		const keypair = Keypair.generate();
		const address = keypair.publicKey.toBase58();
		const privateKey = getBase58Decoder().decode(keypair.secretKey);
		wallets = [...wallets, { publicKey: address, privateKey }];
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
		wallets = [...wallets, { publicKey: pub, privateKey: priv }];
		publicKeyInput = '';
		privateKeyInput = '';
		status = { message: `Wallet added (${wallets.length} total).`, type: 'success' };
	}

	function removeWallet(index: number) {
		wallets = wallets.filter((_, i) => i !== index);
		status = { message: `Wallet removed (${wallets.length} total).`, type: 'success' };
	}

	function importJson() {
		const raw = importJsonInput.trim();
		if (!raw) {
			status = { message: 'Paste a JSON array to import.', type: 'error' };
			return;
		}
		try {
			const parsed = JSON.parse(raw);
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
					valid.push({ publicKey: item.publicKey, privateKey: item.privateKey });
				}
			}
			if (valid.length === 0) {
				status = { message: 'No new wallets to import (all duplicates).', type: 'warning' };
				return;
			}
			wallets = [...wallets, ...valid];
			importJsonInput = '';
			status = { message: `Imported ${valid.length} wallet${valid.length > 1 ? 's' : ''} (${wallets.length} total).`, type: 'success' };
		} catch {
			status = { message: 'Invalid JSON.', type: 'error' };
		}
	}

	function exportJson() {
		const json = JSON.stringify(wallets, null, 2);
		navigator.clipboard.writeText(json);
		status = { message: `Exported ${wallets.length} wallet${wallets.length !== 1 ? 's' : ''} to clipboard.`, type: 'success' };
	}

	function clearAll() {
		wallets = [];
		status = { message: 'All wallets cleared.', type: 'success' };
	}
</script>

<div class="flex flex-col">
	<h1 class="page-title">WALLET MANAGER</h1>

	<MarqueeText text="Manage your Solana keypairs locally. Generate, import/export as JSON, add or remove wallets. Everything is stored in your browser's localStorage — nothing leaves your machine." />

	<!-- Add wallet form -->
	<div class="form-row">
		<label class="form-label">PUBLIC KEY</label>
		<input
			type="text"
			bind:value={publicKeyInput}
			placeholder="base58 public key"
			autocomplete="off"
			class="form-input"
		/>
		<button onclick={() => { publicKeyInput = ''; }} class="form-action">CLEAN</button>
	</div>

	<div class="form-row">
		<label class="form-label">PRIVATE KEY</label>
		<input
			type="text"
			bind:value={privateKeyInput}
			placeholder="base58 private key"
			autocomplete="off"
			class="form-input"
		/>
		<button onclick={() => { privateKeyInput = ''; }} class="form-action">CLEAN</button>
	</div>

	<div class="form-row">
		<button onclick={addWallet} class="form-action-left marching-border">ADD</button>
		<span class="flex-1 px-2 py-1 {status ? '' : 'opacity-40'}">
			{#if status}
				<span class={status.type === 'error' ? 'text-error' : status.type === 'warning' ? 'text-warning' : 'text-success'}>{status.message}</span>
			{/if}
		</span>
		<button onclick={generateWallet} class="form-action marching-border">GENERATE</button>
	</div>

	<!-- Import JSON -->
	<div class="form-row">
		<label class="form-label"><span>IMPORT</span><span class="ml-auto opacity-30 font-normal normal-case tracking-normal">json</span></label>
		<input
			type="text"
			bind:value={importJsonInput}
			placeholder='[{{"publicKey":"...","privateKey":"..."}}]'
			autocomplete="off"
			class="form-input"
		/>
		<button onclick={importJson} class="form-action">IMPORT</button>
	</div>

	<!-- Export / Clear -->
	<div class="form-row">
		<label class="form-label"><span>EXPORT</span><span class="ml-auto opacity-30 font-normal normal-case tracking-normal">json</span></label>
		<span class="form-value opacity-40">{wallets.length} wallet{wallets.length !== 1 ? 's' : ''} in storage</span>
		<button onclick={exportJson} disabled={wallets.length === 0} class="form-action !text-success {wallets.length > 0 ? 'marching-border' : ''}">COPY JSON</button>
	</div>

	<div class="form-row">
		<label class="form-label"></label>
		<span class="form-value"></span>
		<button onclick={clearAll} disabled={wallets.length === 0} class="form-action !text-error">CLEAR ALL</button>
	</div>

	<!-- Wallet list -->
	{#each wallets as wallet, i}
		<div class="form-row">
			<label class="form-label"><span>#{i + 1}</span><span class="ml-auto opacity-30 font-normal normal-case tracking-normal">wallet</span></label>
			<span class="form-value">{shortKey(wallet.publicKey, 12, 12)}</span>
			<button onclick={() => navigator.clipboard.writeText(wallet.publicKey)} class="form-action !text-success">COPY PUB</button>
		</div>
		<div class="form-row">
			<label class="form-label"></label>
			<span class="form-value opacity-40">****{'.' .repeat(20)}****</span>
			<button onclick={() => removeWallet(i)} class="form-action !text-error">DELETE</button>
		</div>
	{/each}
</div>
