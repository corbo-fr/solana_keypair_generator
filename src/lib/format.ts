export function shortKey(key: string, startLen = 4, endLen = 4): string {
	return key.length > startLen + endLen + 3
		? key.slice(0, startLen) + '...' + key.slice(-endLen)
		: key;
}
