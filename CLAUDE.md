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
- **Tailwind CSS v4** + **DaisyUI** for UI
- **@tailwindcss/forms** and **@tailwindcss/typography** plugins
- **@solana/web3.js** for Solana interactions
