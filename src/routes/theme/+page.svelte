<div class="border border-base-300">
	<div class="border-b border-base-300 px-2 py-1">
		<h1 class="text-xl font-bold">SolBox — Theme</h1>
	</div>

	<div class="grid grid-cols-2">
		<!-- Buttons -->
		<div class="border-r border-b border-base-300">
			<div class="border-b border-base-300 px-2 py-1 bg-base-200">
				<span class="text-sm font-semibold">Buttons</span>
			</div>
			<div class="flex flex-wrap px-2 py-1 gap-1">
				<button class="btn btn-primary btn-sm">Primary</button>
				<button class="btn btn-secondary btn-sm">Secondary</button>
				<button class="btn btn-accent btn-sm">Accent</button>
				<button class="btn btn-neutral btn-sm">Neutral</button>
				<button class="btn btn-ghost btn-sm">Ghost</button>
				<button class="btn btn-outline btn-sm">Outline</button>
			</div>
		</div>

		<!-- Status -->
		<div class="border-b border-base-300">
			<div class="border-b border-base-300 px-2 py-1 bg-base-200">
				<span class="text-sm font-semibold">Status</span>
			</div>
			<div class="flex flex-wrap px-2 py-1 gap-1">
				<div class="badge badge-info">info</div>
				<div class="badge badge-success">success</div>
				<div class="badge badge-warning">warning</div>
				<div class="badge badge-error">error</div>
			</div>
			<div class="border-t border-base-300 flex flex-wrap px-2 py-1 gap-1">
				<button class="btn btn-sm btn-info">Info</button>
				<button class="btn btn-sm btn-success">Success</button>
				<button class="btn btn-sm btn-warning">Warning</button>
				<button class="btn btn-sm btn-error">Error</button>
			</div>
		</div>

		<!-- Form -->
		<div class="border-r border-b border-base-300">
			<div class="border-b border-base-300 px-2 py-1 bg-base-200">
				<span class="text-sm font-semibold">Form</span>
			</div>
			<div class="flex flex-col">
				<input type="text" placeholder="RPC URL" class="input input-bordered border-b border-base-300 w-full" />
				<input type="text" placeholder="Wallet address" class="input input-bordered border-b border-base-300 w-full" />
				<select class="select select-bordered border-b border-base-300 w-full">
					<option disabled selected>Network</option>
					<option>Mainnet</option>
					<option>Devnet</option>
					<option>Testnet</option>
				</select>
				<label class="flex items-center justify-between px-2 py-1 cursor-pointer">
					<span class="text-sm">Auto-confirm</span>
					<input type="checkbox" class="checkbox checkbox-primary checkbox-sm" />
				</label>
			</div>
		</div>

		<!-- Misc -->
		<div class="border-b border-base-300">
			<div class="border-b border-base-300 px-2 py-1 bg-base-200">
				<span class="text-sm font-semibold">Misc</span>
			</div>
			<div class="border-b border-base-300 flex items-center px-2 py-1 gap-1">
				<kbd class="kbd kbd-sm">ctrl</kbd>
				<kbd class="kbd kbd-sm">+</kbd>
				<kbd class="kbd kbd-sm">k</kbd>
			</div>
			<div class="border-b border-base-300 px-2 py-1">
				<progress class="progress progress-primary w-full" value="65" max="100"></progress>
			</div>
			<div class="border-b border-base-300 flex px-2 py-1 gap-1">
				<div class="tooltip" data-tip="Tooltip text">
					<button class="btn btn-sm btn-outline">Hover</button>
				</div>
				<button class="btn btn-sm btn-ghost">Loading</button>
			</div>
			<div class="px-2 py-1 text-sm">
				<span class="text-base-content/70">System operational. All checks passed.</span>
			</div>
		</div>

		<!-- Colors -->
		<div class="border-r border-b border-base-300">
			<div class="border-b border-base-300 px-2 py-1 bg-base-200">
				<span class="text-sm font-semibold">Base Colors</span>
			</div>
			<div class="grid grid-cols-3">
				<div class="border-r border-base-300 bg-base-100 px-2 py-1 text-xs">base-100</div>
				<div class="border-r border-base-300 bg-base-200 px-2 py-1 text-xs">base-200</div>
				<div class="bg-base-300 px-2 py-1 text-xs">base-300</div>
			</div>
			<div class="border-t border-base-300 grid grid-cols-3">
				<div class="border-r border-base-300 bg-primary px-2 py-1 text-xs text-primary-content">primary</div>
				<div class="border-r border-base-300 bg-secondary px-2 py-1 text-xs text-secondary-content">secondary</div>
				<div class="bg-accent px-2 py-1 text-xs text-accent-content">accent</div>
			</div>
			<div class="border-t border-base-300 grid grid-cols-1">
				<div class="bg-neutral px-2 py-1 text-xs text-neutral-content">neutral</div>
			</div>
		</div>

		<!-- Typography -->
		<div class="border-b border-base-300">
			<div class="border-b border-base-300 px-2 py-1 bg-base-200">
				<span class="text-sm font-semibold">Typography</span>
			</div>
			<div class="flex flex-col">
				<div class="border-b border-base-300 px-2 py-1 text-xs text-base-content/50">text-xs — 0.75rem</div>
				<div class="border-b border-base-300 px-2 py-1 text-sm text-base-content/60">text-sm — 0.875rem</div>
				<div class="border-b border-base-300 px-2 py-1 text-base text-base-content/70">text-base — 1rem</div>
				<div class="border-b border-base-300 px-2 py-1 text-lg text-base-content/80">text-lg — 1.125rem</div>
				<div class="px-2 py-1 text-xl font-bold text-base-content">text-xl bold</div>
			</div>
		</div>
	</div>
</div>
