<script>
	let { text, speed = 0.15 } = $props();
	const duration = $derived(text.length * speed);
</script>

<div class="marquee-container page-description overflow-hidden whitespace-nowrap min-w-0">
	<div class="marquee-track" style="animation-duration: {duration}s">
		<span>{text}</span>
		<span>{text}</span>
	</div>
</div>

<style>
	.marquee-track {
		display: inline-flex;
		animation: marquee linear infinite;
	}

	.marquee-track span {
		padding-right: 4rem;
	}

	@keyframes marquee {
		0% {
			transform: translateX(0);
		}
		100% {
			transform: translateX(-50%);
		}
	}
</style>
