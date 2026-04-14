<script lang="ts">
	const MAX_POINTS = 300;

	let { data = [], currentValue = 0, running = false }: {
		data: number[];
		currentValue: number;
		running: boolean;
	} = $props();

	let canvas: HTMLCanvasElement | undefined = $state();

	function downsample(input: number[]): number[] {
		if (input.length <= MAX_POINTS) return input;
		const k = Math.ceil(input.length / MAX_POINTS);
		const result: number[] = [];
		for (let i = 0; i < input.length; i += k) {
			const chunk = input.slice(i, i + k);
			result.push(chunk.reduce((a, b) => a + b, 0) / chunk.length);
		}
		return result;
	}

	function draw() {
		if (!canvas) return;
		const ctx = canvas.getContext('2d');
		if (!ctx) return;
		const w = canvas.clientWidth;
		const h = canvas.clientHeight;
		canvas.width = w;
		canvas.height = h;
		ctx.clearRect(0, 0, w, h);
		let raw = running ? [...data, currentValue] : [...data];
		if (raw.length === 0) raw = [0, 0];
		else if (raw.length === 1) raw = [0, ...raw];
		const points = downsample(raw);
		const min = Math.min(...points);
		const max = Math.max(...points);
		const range = max - min;
		const len = points.length;
		const stepX = len === 1 ? 0 : w / (len - 1);
		const getY = (i: number) => range === 0 ? h / 2 : h - ((points[i] - min) / range) * (h - 4) - 2;
		const strokeColor = 'oklch(0.637 0.237 25.331)';
		const fillColor = 'rgba(239, 68, 68, 0.12)';
		ctx.beginPath();
		for (let i = 0; i < len; i++) {
			const x = len === 1 ? w / 2 : i * stepX;
			if (i === 0) ctx.moveTo(x, getY(i));
			else ctx.lineTo(x, getY(i));
		}
		ctx.lineTo(len === 1 ? w / 2 : (len - 1) * stepX, h);
		ctx.lineTo(len === 1 ? w / 2 : 0, h);
		ctx.closePath();
		ctx.fillStyle = fillColor;
		ctx.fill();
		ctx.beginPath();
		for (let i = 0; i < len; i++) {
			const x = len === 1 ? w / 2 : i * stepX;
			if (i === 0) ctx.moveTo(x, getY(i));
			else ctx.lineTo(x, getY(i));
		}
		ctx.strokeStyle = strokeColor;
		ctx.lineWidth = 1;
		ctx.stroke();
	}

	$effect(() => {
		draw();
	});
</script>

<canvas bind:this={canvas} class="w-full" style="height:1.75rem"></canvas>
