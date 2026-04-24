import { describe, it, expect } from 'vitest';
import { formatTime, isValidBase58, sanitizeBase58, getDifficulty, formatDifficulty } from './vanity';

describe('formatTime', () => {
	it('formats seconds under a minute', () => {
		expect(formatTime(0)).toBe('0m 0s');
		expect(formatTime(30)).toBe('0m 30s');
		expect(formatTime(59)).toBe('0m 59s');
	});

	it('formats minutes', () => {
		expect(formatTime(60)).toBe('1m 0s');
		expect(formatTime(90)).toBe('1m 30s');
		expect(formatTime(3599)).toBe('59m 59s');
	});

	it('formats hours', () => {
		expect(formatTime(3600)).toBe('1h 0m');
		expect(formatTime(3660)).toBe('1h 1m');
		expect(formatTime(7200)).toBe('2h 0m');
		expect(formatTime(7380)).toBe('2h 3m');
	});

	it('floors partial seconds', () => {
		expect(formatTime(1.9)).toBe('0m 1s');
		expect(formatTime(59.9)).toBe('0m 59s');
	});
});

describe('isValidBase58', () => {
	it('accepts valid base58 strings', () => {
		expect(isValidBase58('123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz')).toBe(true);
		expect(isValidBase58('SoLaNa')).toBe(true);
	});

	it('rejects strings with invalid characters', () => {
		expect(isValidBase58('0')).toBe(false); // 0 not in base58
		expect(isValidBase58('O')).toBe(false); // uppercase O not in base58
		expect(isValidBase58('I')).toBe(false); // uppercase I not in base58
		expect(isValidBase58('l')).toBe(false); // lowercase l not in base58
	});

	it('rejects strings with spaces or special chars', () => {
		expect(isValidBase58('abc def')).toBe(false);
		expect(isValidBase58('abc!')).toBe(false);
	});

	it('accepts empty string', () => {
		expect(isValidBase58('')).toBe(true);
	});
});

describe('sanitizeBase58', () => {
	it('keeps valid base58 characters', () => {
		expect(sanitizeBase58('ABC123')).toBe('ABC123');
	});

	it('removes invalid characters', () => {
		expect(sanitizeBase58('A0BC')).toBe('ABC');
		expect(sanitizeBase58('aOIl')).toBe('a');
	});

	it('removes spaces and special characters', () => {
		expect(sanitizeBase58('A B!C@D')).toBe('ABCD');
	});

	it('returns empty for all-invalid input', () => {
		expect(sanitizeBase58('0OIl ')).toBe('');
	});

	it('returns empty for empty input', () => {
		expect(sanitizeBase58('')).toBe('');
	});
});

describe('getDifficulty', () => {
	it('returns 1 for zero length', () => {
		expect(getDifficulty(0, 0)).toBe(1);
	});

	it('returns 58^n for prefix only', () => {
		expect(getDifficulty(1, 0)).toBe(58);
		expect(getDifficulty(2, 0)).toBe(58 * 58);
		expect(getDifficulty(3, 0)).toBe(58 * 58 * 58);
	});

	it('returns 58^n for suffix only', () => {
		expect(getDifficulty(0, 2)).toBe(58 * 58);
	});

	it('returns 58^(prefix+suffix) for both', () => {
		expect(getDifficulty(2, 3)).toBe(Math.pow(58, 5));
	});
});

describe('formatDifficulty', () => {
	it('formats small numbers', () => {
		expect(formatDifficulty(1)).toBe('~1');
		expect(formatDifficulty(58)).toBe('~58');
		expect(formatDifficulty(999)).toBe('~999');
	});

	it('formats thousands', () => {
		expect(formatDifficulty(1000)).toBe('~1.0K');
		expect(formatDifficulty(1500)).toBe('~1.5K');
		expect(formatDifficulty(999999)).toBe('~1000.0K');
	});

	it('formats millions', () => {
		expect(formatDifficulty(1e6)).toBe('~1.0M');
		expect(formatDifficulty(2.5e6)).toBe('~2.5M');
	});

	it('formats billions', () => {
		expect(formatDifficulty(1e9)).toBe('~1.0B');
	});

	it('formats trillions', () => {
		expect(formatDifficulty(1e12)).toBe('~1.0T');
	});

	it('formats quadrillions', () => {
		expect(formatDifficulty(1e15)).toBe('~1.0Q');
	});
});
