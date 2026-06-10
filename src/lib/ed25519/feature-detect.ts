import { simd } from 'wasm-feature-detect';

export async function detectSimd(): Promise<boolean> {
	try {
		return await simd();
	} catch {
		return false;
	}
}
