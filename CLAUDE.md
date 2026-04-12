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

1. **Title** (`page-title`) — bold uppercase page name.
2. **Description** (`page-description`) — optional help text, `text-sm opacity-70`.
3. **Form rows** — one or more `form-row` containers.
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

- `page-title` — page heading (`px-2 py-1 uppercase tracking-widest border-b border-base-300 font-bold`)
- `page-description` — subtitle/help text (`px-2 py-1 border-b border-base-300 text-sm opacity-70`)
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

## Icons & Logos

- All SVG icons/logos are sourced from **Iconify** (https://icon-sets.iconify.design/).
- Each icon is a standalone Svelte component in `src/lib/components/icons/` (e.g. `SolanaLogo.svelte`).
- Icons use `fill="currentColor"` so they inherit the parent's text color.
- Always reuse existing icon components — import from `$lib/components/icons/` instead of duplicating SVGs inline.
