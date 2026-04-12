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

- **No margin, no padding** on divs/components. The only spacing allowed is minimal padding around text content (`px-2 py-1` max).
- **Borders are the only separators.** Everything is delimited by `border border-base-300`. No gaps, no margins, no whitespace between elements.
- **Grid/square aesthetic.** The layout must look like a tight grid — cells touching, borders shared, zero wasted space. Think terminal UI, spreadsheet, engineer dashboard.
- **No rounded corners.** Everything is sharp 90-degree angles, no exceptions.
- **Monospace font everywhere.** IBM Plex Mono is the only font.
- **Muted text colors.** Never pure black or pure white — always off-white/off-black for a smooth, low-contrast feel.
- **All titles/labels uppercase.** Every title, heading, and label text must be uppercase.
- **Button text color.** All buttons use `text-primary` by default (same color as the "CONNECT WALLET" button). Only use semantic colors for contextual states: `text-error` for destructive/stop actions, `text-success` for success/confirmation, `text-warning` for warnings. Never leave buttons with default/unstyled text color.
- **Grid system for forms.** All label+value rows use `flex` with labels having a fixed width (`w-40 shrink-0`) and values taking the remaining space (`flex-1`). Labels are always left-aligned with `px-2 py-1 uppercase tracking-widest border-r border-base-300`. This ensures all labels across a page share the same column width, creating a strict grid alignment. Every page must follow this pattern for any label/input or label/value pair.

## Icons & Logos

- All SVG icons/logos are sourced from **Iconify** (https://icon-sets.iconify.design/).
- Each icon is a standalone Svelte component in `src/lib/components/icons/` (e.g. `SolanaLogo.svelte`).
- Icons use `fill="currentColor"` so they inherit the parent's text color.
- Always reuse existing icon components — import from `$lib/components/icons/` instead of duplicating SVGs inline.
