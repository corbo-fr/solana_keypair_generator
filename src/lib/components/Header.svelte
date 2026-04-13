<script lang="ts">
	import SolanaLogo from '$lib/components/icons/SolanaLogo.svelte';
	import { shortKey } from '$lib/format';
	import {
		canUndo, canRedo, undo, redo,
		resetConfig, importConfig, exportConfig,
		getLastAction, getWallets,
	} from '$lib/config.svelte';

	let connected = $state(false);
	let address = $state('');
	let fileInput: HTMLInputElement;
	let statusMessage = $state('');
	let statusType = $state<'error' | 'success' | ''>('');

	let lastAction = $derived(getLastAction());
	let undoEnabled = $derived(canUndo());
	let redoEnabled = $derived(canRedo());

	function toggleConnect() {
		if (connected) {
			connected = false;
			address = '';
		} else {
			// TODO: real wallet connection
			connected = true;
			address = '7xKX...9fGh';
		}
	}

	function handleReset() {
		resetConfig();
		flash('Config reset.', 'success');
	}

	function handleImport() {
		fileInput.click();
	}

	function handleFileImport(e: Event) {
		const file = (e.target as HTMLInputElement).files?.[0];
		if (!file) return;
		const reader = new FileReader();
		reader.onload = () => {
			const result = importConfig(reader.result as string);
			flash(result.message, result.ok ? 'success' : 'error');
			fileInput.value = '';
		};
		reader.readAsText(file);
	}

	function handleExport() {
		const json = exportConfig();
		navigator.clipboard.writeText(json);
		const count = getWallets().length;
		flash(`Exported ${count} wallet${count !== 1 ? 's' : ''} to clipboard.`, 'success');
	}

	let flashTimeout: ReturnType<typeof setTimeout> | null = null;
	function flash(msg: string, type: 'error' | 'success') {
		statusMessage = msg;
		statusType = type;
		if (flashTimeout) clearTimeout(flashTimeout);
		flashTimeout = setTimeout(() => { statusMessage = ''; statusType = ''; }, 3000);
	}
</script>

<input type="file" accept=".json" bind:this={fileInput} onchange={handleFileImport} class="hidden" />

<header class="flex flex-col border-b border-base-300">
	<div class="flex items-stretch justify-between">
		<span class="flex items-center px-2 py-1 font-bold tracking-widest"><SolanaLogo class="h-4 w-4 mr-1" /> SOLBOX</span>
		{#if connected}
			<button onclick={toggleConnect} class="w-44 shrink-0 px-2 py-1 uppercase tracking-widest border-l border-base-300 text-success hover:bg-base-200">{shortKey(address)}</button>
		{:else}
			<button onclick={toggleConnect} class="w-44 shrink-0 px-2 py-1 uppercase tracking-widest border-l border-base-300 text-primary hover:bg-base-200 marching-border">CONNECT WALLET</button>
		{/if}
	</div>
	<div class="flex border-t border-base-300 bg-base-200">
		<div class="w-44 shrink-0 flex border-r border-base-300">
			<button onclick={undo} disabled={!undoEnabled} class="flex-1 px-2 py-1 border-r border-base-300 text-primary hover:bg-base-300 cursor-pointer disabled:opacity-40 disabled:pointer-events-none">&#9664;</button>
			<button onclick={redo} disabled={!redoEnabled} class="flex-1 px-2 py-1 text-primary hover:bg-base-300 cursor-pointer disabled:opacity-40 disabled:pointer-events-none">&#9654;</button>
		</div>
		<span class="flex-1 px-2 py-1 truncate opacity-50">
			{#if statusMessage}
				<span class={statusType === 'error' ? 'text-error' : 'text-success'}>{statusMessage}</span>
			{:else}
				{lastAction}
			{/if}
		</span>
		<button onclick={handleReset} disabled={getWallets().length === 0} class="w-22 shrink-0 px-2 py-1 uppercase tracking-widest border-l border-base-300 text-error hover:bg-base-300 cursor-pointer disabled:opacity-40 disabled:pointer-events-none">RESET</button>
		<button onclick={handleImport} class="w-22 shrink-0 px-2 py-1 uppercase tracking-widest border-l border-base-300 text-primary hover:bg-base-300 cursor-pointer">IMPORT</button>
		<button onclick={handleExport} disabled={getWallets().length === 0} class="w-22 shrink-0 px-2 py-1 uppercase tracking-widest border-l border-base-300 text-primary hover:bg-base-300 cursor-pointer disabled:opacity-40 disabled:pointer-events-none">EXPORT</button>
	</div>
</header>
