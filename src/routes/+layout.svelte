<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';

	let { children } = $props();
</script>

<svelte:head><title>SolBox</title><link rel="icon" href={favicon} /></svelte:head>
<div class="flex flex-col h-screen">
	<main class="flex-1 overflow-auto">
		{@render children()}
	</main>
</div>
