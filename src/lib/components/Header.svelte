<script lang="ts">
	import SolanaLogo from '$lib/components/icons/SolanaLogo.svelte';
	import { shortKey } from '$lib/format';

	let connected = $state(false);
	let address = $state('');

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
</script>

<header class="flex items-stretch justify-between border-b border-base-300">
	<span class="flex items-center px-2 py-1 font-bold tracking-widest"><SolanaLogo class="h-4 w-4 mr-1" /> SOLBOX</span>
	{#if connected}
		<button onclick={toggleConnect} class="px-2 py-1 uppercase tracking-widest border-l border-base-300 text-success hover:bg-base-200">{shortKey(address)}</button>
	{:else}
		<button onclick={toggleConnect} class="px-2 py-1 uppercase tracking-widest border-l border-base-300 text-primary hover:bg-base-200 animate-pulse">CONNECT WALLET</button>
	{/if}
</header>
