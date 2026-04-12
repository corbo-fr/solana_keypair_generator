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

## Icons & Logos

- All SVG icons/logos are sourced from **Iconify** (https://icon-sets.iconify.design/).
- Each icon is a standalone Svelte component in `src/lib/components/icons/` (e.g. `SolanaLogo.svelte`).
- Icons use `fill="currentColor"` so they inherit the parent's text color.
- Always reuse existing icon components — import from `$lib/components/icons/` instead of duplicating SVGs inline.
