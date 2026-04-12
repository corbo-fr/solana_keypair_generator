<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import Header from '$lib/components/Header.svelte';
	import NavBar from '$lib/components/NavBar.svelte';

	let { children } = $props();
</script>

<svelte:head><title>SolBox</title><link rel="icon" href={favicon} /></svelte:head>
<div class="flex flex-col h-screen">
	<Header />
	<div class="flex flex-1 min-h-0">
		<NavBar />
		<main class="flex-1 overflow-auto">
			{@render children()}
		</main>
	</div>
</div>
