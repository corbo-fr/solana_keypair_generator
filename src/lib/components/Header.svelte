<script lang="ts">
	import SolanaLogo from '$lib/components/icons/SolanaLogo.svelte';

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

	function shortAddress(addr: string) {
		return addr.length > 8 ? addr.slice(0, 4) + '...' + addr.slice(-4) : addr;
	}
</script>

<header class="flex items-stretch justify-between border-b border-base-300">
	<span class="flex items-center px-2 py-1 font-bold tracking-widest"><SolanaLogo class="h-4 w-4 mr-1" /> SOLBOX</span>
	{#if connected}
		<button onclick={toggleConnect} class="btn btn-outline btn-success border-0 border-l border-base-300 uppercase self-stretch">{shortAddress(address)}</button>
	{:else}
		<button onclick={toggleConnect} class="btn btn-outline btn-primary border-0 border-l border-base-300 uppercase self-stretch">CONNECT WALLET</button>
	{/if}
</header>
