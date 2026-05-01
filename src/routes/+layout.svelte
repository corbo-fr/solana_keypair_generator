<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.png';
	import { onMount } from 'svelte';

	let { children } = $props();

	if (typeof window !== 'undefined') {
		try { localStorage.clear(); } catch {}
		try { sessionStorage.clear(); } catch {}
		try {
			for (const c of document.cookie.split(';')) {
				const name = c.split('=')[0]?.trim();
				if (!name) continue;
				const paths = ['/', location.pathname];
				const domains = ['', location.hostname, '.' + location.hostname];
				for (const p of paths) for (const d of domains) {
					document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=${p}${d ? `; domain=${d}` : ''}`;
				}
			}
		} catch {}
	}

	async function wipeAsyncState() {
		try {
			if (indexedDB.databases) {
				const dbs = await indexedDB.databases();
				for (const db of dbs) if (db.name) indexedDB.deleteDatabase(db.name);
			}
		} catch {}
		try {
			if ('caches' in self) {
				const keys = await caches.keys();
				await Promise.all(keys.map((k) => caches.delete(k)));
			}
		} catch {}
		try {
			if (navigator.serviceWorker) {
				const regs = await navigator.serviceWorker.getRegistrations();
				await Promise.all(regs.map((r) => r.unregister()));
			}
		} catch {}
	}

	onMount(() => { wipeAsyncState(); });
</script>

<svelte:head><link rel="icon" type="image/png" href={favicon} /></svelte:head>
<div class="min-h-svh bg-black flex items-center justify-center">
	<main class="w-full max-w-[642px]">
		{@render children()}
	</main>
</div>
