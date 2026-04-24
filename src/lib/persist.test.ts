import { describe, it, expect, beforeEach, vi } from 'vitest';
import { loadInputs, saveInputs } from './persist';

const store: Record<string, string> = {};

const mockLocalStorage = {
	getItem: vi.fn((key: string) => store[key] ?? null),
	setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
	removeItem: vi.fn((key: string) => { delete store[key]; }),
	clear: vi.fn(() => { for (const key in store) delete store[key]; }),
	get length() { return Object.keys(store).length; },
	key: vi.fn((i: number) => Object.keys(store)[i] ?? null),
};

Object.defineProperty(globalThis, 'localStorage', { value: mockLocalStorage, writable: true });

beforeEach(() => {
	mockLocalStorage.clear();
	vi.clearAllMocks();
});

describe('loadInputs', () => {
	it('returns defaults when nothing is saved', () => {
		const defaults = { prefix: '', threads: 4 };
		expect(loadInputs('test', defaults)).toEqual({ prefix: '', threads: 4 });
	});

	it('loads saved values', () => {
		const defaults = { prefix: '', threads: 4 };
		store['solbox_inputs_test'] = JSON.stringify({ prefix: 'ABC', threads: 8 });
		expect(loadInputs('test', defaults)).toEqual({ prefix: 'ABC', threads: 8 });
	});

	it('ignores saved keys not in defaults', () => {
		const defaults = { prefix: '' };
		store['solbox_inputs_test'] = JSON.stringify({ prefix: 'ABC', extra: 'ignored' });
		const result = loadInputs('test', defaults);
		expect(result).toEqual({ prefix: 'ABC' });
		expect((result as any).extra).toBeUndefined();
	});

	it('ignores saved values with wrong type', () => {
		const defaults = { threads: 4 };
		store['solbox_inputs_test'] = JSON.stringify({ threads: 'not a number' });
		expect(loadInputs('test', defaults)).toEqual({ threads: 4 });
	});

	it('returns defaults on invalid JSON', () => {
		const defaults = { prefix: '' };
		store['solbox_inputs_test'] = 'not json{{{';
		expect(loadInputs('test', defaults)).toEqual({ prefix: '' });
	});
});

describe('saveInputs', () => {
	it('saves values to localStorage', () => {
		saveInputs('test', { prefix: 'XYZ', threads: 2 });
		expect(store['solbox_inputs_test']).toBe(JSON.stringify({ prefix: 'XYZ', threads: 2 }));
	});

	it('overwrites previous values', () => {
		saveInputs('test', { a: 1 });
		saveInputs('test', { a: 2 });
		expect(JSON.parse(store['solbox_inputs_test'])).toEqual({ a: 2 });
	});
});
