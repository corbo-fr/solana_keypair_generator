import { describe, it, expect } from 'vitest';
import { matchScore } from './match';

describe('matchScore', () => {
	describe('prefix only', () => {
		it('returns 0 for no match', () => {
			expect(matchScore('ABCDEF', 'xyz', '')).toBe(0);
		});

		it('returns full length for exact prefix match', () => {
			expect(matchScore('ABCdef', 'ABC', '')).toBe(3);
		});

		it('counts all matching positions, not just consecutive', () => {
			// "12345" vs "123a5" => positions 0,1,2 match, 3 doesn't, 4 matches = 4
			expect(matchScore('123a5xxxxx', '12345', '')).toBe(4);
		});

		it('counts scattered matches', () => {
			// "ABCDE" vs "AxCxE" => positions 0,2,4 match = 3
			expect(matchScore('AxCxExxxxx', 'ABCDE', '')).toBe(3);
		});

		it('returns 0 for completely different prefix', () => {
			expect(matchScore('zzzzz', 'ABCDE', '')).toBe(0);
		});

		it('handles single char prefix match', () => {
			expect(matchScore('Axxxx', 'A', '')).toBe(1);
		});

		it('handles single char prefix no match', () => {
			expect(matchScore('Bxxxx', 'A', '')).toBe(0);
		});
	});

	describe('suffix only', () => {
		it('returns 0 for no match', () => {
			expect(matchScore('ABCDEF', '', 'xyz')).toBe(0);
		});

		it('returns full length for exact suffix match', () => {
			expect(matchScore('xxxDEF', '', 'DEF')).toBe(3);
		});

		it('counts all matching positions, not just consecutive', () => {
			// suffix "12345" vs "...1x345" => positions match at 1,3,4,5 from end
			expect(matchScore('xxxxx1x345', '', '12345')).toBe(4);
		});

		it('handles single char suffix', () => {
			expect(matchScore('xxxxA', '', 'A')).toBe(1);
		});
	});

	describe('prefix + suffix', () => {
		it('counts both prefix and suffix matches', () => {
			expect(matchScore('ABCxxxDEF', 'ABC', 'DEF')).toBe(6);
		});

		it('counts partial matches in both', () => {
			expect(matchScore('AxCxxxDxF', 'ABC', 'DEF')).toBe(4);
		});

		it('returns 0 when neither matches', () => {
			expect(matchScore('zzzzzzzzz', 'ABC', 'DEF')).toBe(0);
		});
	});

	describe('edge cases', () => {
		it('returns 0 for empty prefix and suffix', () => {
			expect(matchScore('anything', '', '')).toBe(0);
		});

		it('handles address shorter than prefix', () => {
			// address "AB" vs prefix "ABCDE" - only 2 positions to check
			expect(matchScore('AB', 'ABCDE', '')).toBe(2);
		});

		it('is case sensitive', () => {
			expect(matchScore('abcde', 'ABCDE', '')).toBe(0);
		});
	});
});
