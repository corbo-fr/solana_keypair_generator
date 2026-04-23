# SolBox - Solana Toolbox

A collection of Solana tools that run **entirely in your browser**. No backend, no server, no API — your keys never leave your machine.

## Why is this secure?

Traditional vanity address generators require you to trust a server with your private keys. **SolBox takes a radically different approach:**

- **100% client-side** — All cryptographic operations (keypair generation, mnemonic derivation, signing) happen in your browser using Web Workers. There is no server to intercept, log, or leak your keys.
- **No network calls** — The keypair generator works fully offline. No data is sent anywhere. You can disconnect from the internet, generate your keys, and verify this yourself in the Network tab of your browser's DevTools.
- **No backend** — The app is a static site deployed on Cloudflare Pages. There is no server-side code, no database, no API endpoint. The source code you see is the code that runs.
- **Open source** — Every line of code is auditable. You don't have to trust us — read the source.
- **Private keys stay in memory** — Keys exist only in your browser's JavaScript runtime. They are never written to disk, never sent over the network, never stored in cookies or localStorage.

## Tools

| Tool | Description | Status |
|------|-------------|--------|
| **Wallets** | Wallet management with undo/redo history | Done |
| **Keypair** | Vanity keypair generator with prefix/suffix matching | Done |
| **Transfer** | SOL and token transfers | Coming soon |

### Vanity Keypair Generator

Generate Solana keypairs that start and/or end with specific characters.

- Custom **prefix** and **suffix** search (base58 characters only)
- **Multi-threaded** generation using Web Workers for maximum speed
- Real-time stats: keys/sec, attempts, ETA, difficulty estimate
- Live performance graph per thread
- Export results as JSON (public key, private key base58, 24-word mnemonic, byte array)
- Configurable max time and max attempts safety limits
- Keyboard shortcuts: `Enter` to generate, `Escape` to stop

## Tech Stack

- [SvelteKit](https://svelte.dev) (Svelte 5 with runes)
- [Tailwind CSS v4](https://tailwindcss.com) + [DaisyUI](https://daisyui.com)
- [@solana/web3.js](https://github.com/solana-labs/solana-web3.js) + [@solana/kit](https://github.com/anza-xyz/kit)
- [@scure/bip39](https://github.com/paulmillr/scure-bip39) for mnemonic generation
- Deployed on [Cloudflare Pages](https://pages.cloudflare.com)

## Development

```bash
# Install dependencies
pnpm install

# Start dev server
pnpm dev

# Type check
pnpm check

# Build for production
pnpm build

# Preview production build
pnpm preview
```

## License

MIT
