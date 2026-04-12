<script lang="ts">
	import { page } from '$app/state';

	const pages = [
		{ label: 'WALLET', href: '/' },
		{ label: 'VANITY', href: '/vanity' },
		{ label: 'TRANSFER', href: '/transfer' },
		{ label: 'TOKENS', href: '/tokens' },
		{ label: 'KEYPAIR', href: '/keypair' },
		{ label: 'AIRDROP', href: '/airdrop' }
	];
</script>

<nav class="flex flex-col border-r border-base-300">
	{#each pages as p, i}
		<a
			href={p.href}
			class="px-2 py-1 uppercase tracking-widest hover:bg-base-200 {i > 0 ? 'border-t border-base-300' : ''} {page.url.pathname === p.href ? 'font-bold' : ''}"
		>{p.label}</a>
	{/each}
</nav>
