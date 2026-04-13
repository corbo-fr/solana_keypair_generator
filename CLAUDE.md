# Solana Toolbox

## Philosophy

Solana Toolbox is a **100% frontend** application — there is no backend. All Solana operations (wallet generation, keypair creation, token transfers, balance checks, etc.) are executed directly in the browser.

The user provides their own **RPC URL** in the frontend interface, which is used to communicate with the Solana network for all on-chain operations.

## Goals

- Provide a collection of useful Solana tools (wallet generation, keypair management, SOL/token transfers, balance lookups, etc.)
- Everything runs client-side — no server, no API, no backend logic
- The user's RPC URL is the only bridge to the Solana network
- Private keys and sensitive data never leave the browser

## Stack

- **SvelteKit** (static/frontend only, deployed on Cloudflare Pages via Workers)
- **Tailwind CSS v4** + **DaisyUI** for UI (custom theme `solbox`)
- **@tailwindcss/forms** and **@tailwindcss/typography** plugins
- **@solana/web3.js** for Solana interactions

## UI Rules

### Core Principles

- **No margin, no padding** on divs/components. The only spacing allowed is minimal padding around text content (`px-2 py-1` max).
- **Borders are the only separators.** Everything is delimited by `border border-base-300`. No gaps, no margins, no whitespace between elements.
- **Grid/square aesthetic.** The layout must look like a tight grid — cells touching, borders shared, zero wasted space. Think terminal UI, spreadsheet, engineer dashboard.
- **No rounded corners.** Everything is sharp 90-degree angles, no exceptions.
- **Monospace font everywhere.** IBM Plex Mono is the only font.
- **Muted text colors.** Never pure black or pure white — always off-white/off-black for a smooth, low-contrast feel.
- **All titles/labels uppercase.** Every title, heading, and label text must be uppercase.

### Button Rules

- All buttons use `text-primary` by default. Only use semantic colors for contextual states: `text-error` for destructive/stop actions, `text-success` for success/confirmation, `text-warning` for warnings. Never leave buttons with default/unstyled text color.
- Hover state: `hover:bg-base-200` on all buttons.
- Disabled state: `disabled:opacity-40 disabled:pointer-events-none`.

### Page Structure

Every page follows this vertical structure — a `flex flex-col` container with stacked rows separated by `border-b border-base-300`:

1. **Header** (`page-header`) — a single row containing the title and description side by side.
   - **Title** (`page-title`) — bold uppercase page name, fixed-width with right border.
   - **Description** (`page-description` via `MarqueeText`) — scrolling help text filling remaining space.
2. **Form rows** — one or more `form-row` containers.
4. **Result rows** — same row layout for displaying output values.

### Form Row Pattern (3-column grid)

Each row is a `form-row` (`flex border-b border-base-300`) with up to 3 cells:

| Cell | Class | Width | Purpose |
|------|-------|-------|---------|
| Label | `form-label` | `w-40 shrink-0` | Uppercase label with right border |
| Input/Value | `form-input` or `form-value` | `flex-1` | Editable input or read-only value |
| Action | `form-action` | `w-40 shrink-0` | Button with left border (COPY, CLEAN, DEFAULT, etc.) |

For rows where the action is on the left (e.g. GENERATE), use `form-action-left` instead (right border instead of left).

### CSS Utility Classes (defined in `layout.css`)

Use these classes instead of repeating raw Tailwind classes:

- `page-header` — header row container (`flex border-b border-base-300`)
- `page-title` — page title cell (`shrink-0 px-2 py-1 uppercase tracking-widest border-r border-base-300 font-bold`)
- `page-description` — scrolling description cell (`flex-1 min-w-0 px-2 py-1 opacity-70`)
- `form-row` — horizontal row container (`flex border-b border-base-300`)
- `form-label` — fixed-width label cell (`w-40 shrink-0 px-2 py-1 uppercase tracking-widest border-r border-base-300`)
- `form-value` — flexible read-only value cell (`flex-1 px-2 py-1 break-all`)
- `form-input` — flexible input cell (`flex-1 px-2 py-1 bg-transparent border-0 focus:outline-none font-mono`)
- `form-action` — right-side action button (`w-40 shrink-0 px-2 py-1 uppercase tracking-widest border-l border-base-300 text-primary hover:bg-base-200 disabled:…`)
- `form-action-left` — left-side action button (same but with `border-r` instead of `border-l`)

### Status & Feedback

- Status messages use semantic text colors: `text-error`, `text-warning`, `text-success`.
- Muted/secondary text uses `opacity-70` or `opacity-40`.
- Running/loading states dim non-final values with `opacity-40`.

## Page Development Rules

### Svelte Patterns

- **Svelte 5 only** — use `$state`, `$derived`, `$derived.by`, `$props`, `$effect`, `{@render}`. Never use Svelte 4 stores (`writable`, `$:`, `export let`).
- **`<script lang="ts">`** — always TypeScript.
- **Flat state at the top** — declare all `$state` variables at the top of the script, grouped by concern (form inputs, process state, results, performance tracking).
- **Derived over computed** — use `$derived` / `$derived.by` for any value that can be computed from state. Never manually sync derived values.
- **Type aliases inline** — define small types (`type KeyPair = { ... }`) directly in the component script, not in separate files, unless shared across multiple pages.

### Page File Structure

Each page lives in `src/routes/<page-name>/` with:

- `+page.svelte` — main page component containing all state, logic, and template.
- **Co-located child components** — page-specific components (e.g. `ProgressCell.svelte`, `PerfGraph.svelte`) live next to `+page.svelte`, not in `$lib/`.
- **Web Workers** — if the page does CPU-intensive work, use a co-located worker file (e.g. `vanity-worker.ts`). Instantiate with `new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })`.
- **Shared components** go in `$lib/components/` only when used by multiple pages (e.g. `MarqueeText.svelte`).
- **Shared utilities** go in `$lib/` (e.g. `format.ts`).

### Template Structure

Every page template follows this exact order inside a `<div class="flex flex-col">`:

1. `<div class="page-header">` wrapping `<h1 class="page-title">PAGE NAME</h1>` + `<MarqueeText text="..." />` on the same line.
3. **Input rows** — `form-row` with `form-label` + `form-input` + `form-action` (CLEAN/DEFAULT buttons).
4. **Action row** — `form-row` with `form-action-left` (primary action like GENERATE) + status/feedback area + `form-action` (STOP or secondary action).
5. **Result rows** — `form-row` with `form-label` + `form-value` + `form-action` (COPY buttons).

### Form Row Conventions

- **Labels** can have a secondary hint: `<label class="form-label"><span>LABEL</span><span class="ml-auto opacity-30 font-normal normal-case tracking-normal">hint</span></label>`.
- **CLEAN buttons** reset a single input to empty.
- **DEFAULT buttons** reset an input to its default value.
- **COPY buttons** use `navigator.clipboard.writeText(value)`, are disabled until a result exists, and use `!text-success` + `marching-border` when enabled.
- **Primary action button** (GENERATE, SEND, etc.) uses `form-action-left` with `marching-border` when not running.
- **STOP button** uses `!text-error` and `marching-border` when running.
- Inputs are always `disabled={running}` during a process.

### State & Lifecycle Patterns

- **`running` boolean** — gates UI: disables inputs, toggles button visibility, dims preview values.
- **`status` object** — `{ message: string, type: 'error' | 'warning' | 'success' } | null`. Displayed in the action row's middle cell.
- **`result` object** — `null` until final result. When set, enables COPY buttons and removes opacity on values.
- **`preview` object** — optional intermediate/best result during processing, displayed with `opacity-40`.
- **`onDestroy(terminateAll)`** — always clean up intervals, workers, and listeners.
- **`validate()` function** — returns error string or null. Called before starting any process. Sets `status` on error.

### Result Display Patterns

- Result values use conditional background: `bg-success/10` on success, `bg-error/10` on failure (no result + status set).
- During processing, preview values show with `opacity-40`.
- Private keys are never displayed in cleartext — always masked (`****...****`).
- Multiple key formats (b58, mnemonic, byte array) each get their own row with format hint in the label.

### Navigation

- When adding a new page, add it to the `pages` array in `src/lib/components/NavBar.svelte`.

## Icons & Logos

- All SVG icons/logos are sourced from **Iconify** (https://icon-sets.iconify.design/).
- Each icon is a standalone Svelte component in `src/lib/components/icons/` (e.g. `SolanaLogo.svelte`).
- Icons use `fill="currentColor"` so they inherit the parent's text color.
- Always reuse existing icon components — import from `$lib/components/icons/` instead of duplicating SVGs inline.
