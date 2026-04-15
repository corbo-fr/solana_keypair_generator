<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.png';

	let { children } = $props();
</script>

<svelte:head><link rel="icon" type="image/png" href={favicon} /></svelte:head>
<div class="min-h-screen bg-black flex items-center justify-center">
	<main class="w-full max-w-[642px]">
		{@render children()}
	</main>
</div>
