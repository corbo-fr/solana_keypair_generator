<div class="w-full h-[0.875rem] border-b border-base-300 overflow-hidden">
	<div class="stripe-bg w-[200%] h-full"></div>
</div>

<style>
	.stripe-bg {
		background: repeating-linear-gradient(
			-45deg,
			transparent,
			transparent 6px,
			var(--color-base-300) 6px,
			var(--color-base-300) 7px
		);
		animation: slide 20s linear infinite;
	}

	@keyframes slide {
		from {
			transform: translateX(-50%);
		}
		to {
			transform: translateX(0);
		}
	}
</style>
