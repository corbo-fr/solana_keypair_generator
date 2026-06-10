/* tslint:disable */
/* eslint-disable */

/**
 * Full result of one batch: hit (if found) + best partial match for progress display.
 */
export class BatchResult {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    /**
     * Best partial match (always set; if hit found, same as hit).
     */
    best(): Hit;
    /**
     * The exact match, if found.
     */
    hit(): Hit | undefined;
    readonly best_score: number;
}

export class Hit {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    readonly address: string;
    readonly public_key: Uint8Array;
    readonly secret_key: Uint8Array;
}

/**
 * Single-pass batch: checks prefix+suffix, tracks best partial.
 * seeds: N×32 bytes from crypto.getRandomValues
 */
export function run_batch(seeds: Uint8Array, batch_size: number, prefix: string, suffix: string): BatchResult | undefined;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly __wbg_batchresult_free: (a: number, b: number) => void;
    readonly __wbg_hit_free: (a: number, b: number) => void;
    readonly batchresult_best: (a: number) => number;
    readonly batchresult_best_score: (a: number) => number;
    readonly batchresult_hit: (a: number) => number;
    readonly hit_address: (a: number) => [number, number];
    readonly hit_public_key: (a: number) => [number, number];
    readonly hit_secret_key: (a: number) => [number, number];
    readonly run_batch: (a: number, b: number, c: number, d: number, e: number, f: number, g: number) => number;
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __wbindgen_free: (a: number, b: number, c: number) => void;
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
    readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
