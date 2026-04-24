import { describe, it, expect } from 'vitest';
import { shortKey } from './format';

describe('shortKey', () => {
	it('truncates long keys with ellipsis', () => {
		expect(shortKey('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdef')).toBe('ABCD...cdef');
	});

	it('returns short keys unchanged', () => {
		expect(shortKey('ABCDEFGH')).toBe('ABCDEFGH');
	});

	it('returns keys at exact boundary unchanged', () => {
		// startLen(4) + endLen(4) + 3 = 11, so length <= 11 stays as-is
		expect(shortKey('12345678901')).toBe('12345678901');
	});

	it('truncates keys just over the boundary', () => {
		expect(shortKey('123456789012')).toBe('1234...9012');
	});

	it('respects custom startLen and endLen', () => {
		expect(shortKey('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdef', 6, 6)).toBe('ABCDEF...abcdef');
	});

	it('handles custom startLen=1 endLen=1', () => {
		expect(shortKey('ABCDEFGHIJ', 1, 1)).toBe('A...J');
	});

	it('returns empty string for empty input', () => {
		expect(shortKey('')).toBe('');
	});
});
