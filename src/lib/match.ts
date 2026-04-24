export function matchScore(address: string, prefix: string, suffix: string): number {
	let score = 0;
	if (prefix) {
		for (let i = 0; i < prefix.length; i++) {
			if (address[i] === prefix[i]) score++;
		}
	}
	if (suffix) {
		for (let i = 0; i < suffix.length; i++) {
			if (address[address.length - 1 - i] === suffix[suffix.length - 1 - i]) score++;
		}
	}
	return score;
}
