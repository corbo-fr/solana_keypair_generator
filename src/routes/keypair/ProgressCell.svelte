<script lang="ts">
	import type { Snippet } from 'svelte';
	let { pct = 0, show = false, class: className = '', children }: {
		pct: number;
		show: boolean;
		class?: string;
		children: Snippet;
	} = $props();
</script>

<span class="w-28 shrink-0 px-2 py-1 border-l border-base-300 text-center relative overflow-hidden {className}">
	{#if show}
		<div class="absolute top-0 bottom-0 left-0 bg-base-200 transition-all duration-150 ease-out" style="width:{pct}%"></div>
	{/if}
	<span class="relative">{@render children()}</span>
</span>
