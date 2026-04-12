<script lang="ts">
	const pages = [
		{ label: 'WALLET', href: '/' },
		{ label: 'TRANSFER', href: '/transfer' },
		{ label: 'TOKENS', href: '/tokens' },
		{ label: 'KEYPAIR', href: '/keypair' },
		{ label: 'AIRDROP', href: '/airdrop' }
	];
</script>

<nav class="flex flex-col border-r border-base-300">
	{#each pages as page, i}
		<a
			href={page.href}
			class="px-2 py-1 uppercase tracking-widest hover:bg-base-200 {i > 0 ? 'border-t border-base-300' : ''}"
		>{page.label}</a>
	{/each}
</nav>
