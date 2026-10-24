# SilverForge Studio

SilverForge Studio is a static, non-custodial developer preview for creating a
fixed-supply EVM token on Ethereum or BNB Smart Chain, a classic SPL token
with Metaplex metadata on Solana, and an experimental local BTCS L2 EVM
adapter. BTCS L2 support is limited to a local development node; it is not a
public network or production integration.

**Current status:** implementation prototype. Local build and simulated/local
tests do not establish live public-network deployment, security certification,
or production readiness. The source repository is public. GitHub Pages is
currently enabled from the `gh-pages` branch and serves the static preview at
<https://silver-labs-technology-development.github.io/SilverForge-Studio/>.
The earlier repository policy said publishing was disabled pending owner
approval; no approval record was found, so that policy mismatch needs an owner
decision. The source workflow does not deploy.

## Run locally

Requirements: Node.js 20.18.0 or later and npm.

```sh
npm ci
npm test
npm run build
npm run preview
```

The preview URL is printed by Vite (normally `http://127.0.0.1:4173/`). For
live wallet testing, use Sepolia, BSC Testnet, or Solana Devnet and test funds.
The automated EVM test executes a signed deployment and contract calls in an
isolated EthereumJS VM. Solana tests construct and sign a transaction against
a local JSON-RPC fixture and assert the classic Token Program and Metaplex
instruction layouts; no public chain deployment is claimed by these tests.

Optional live local BTCS L2 check (requires a disposable node started with
`--dev-sequencer`):

```sh
BTCS_L2_RPC_URL=http://127.0.0.1:8545 \
BTCS_L2_DEV_PRIVATE_KEY=<documented local harness fixture> npm test
```

This adds a real ERC-20 deployment and read-back: 17/17 tests pass. Without
the two environment variables the live case is skipped (16 pass, 1 skip). The
harness key is the public development fixture in
`btcs-l2/execution/evm/src/config.ts`; it is used only against the disposable
local chain. The node rejects the `pending` block tag, so the live test reads
the nonce from `latest` explicitly. Use a **fresh data directory** for each
live run: a reused node with leftover pending transactions can reject the
nonce even when the latest nonce looks correct.

## What the frontend does

- Connects to an injected EVM wallet or compatible injected Solana wallet.
- Supports Ethereum, Sepolia, BNB Smart Chain, BSC Testnet, Solana Mainnet,
  Solana Devnet, and an experimental local BTCS L2 development node. Mainnet
  choices are clearly called out as real-fund transactions; testnets are
  recommended.
- The local BTCS L2 option targets `http://127.0.0.1:8545` and requires chain
  ID 31337 plus a `BTCSL2/` client identity before transaction preparation and
  again before signing. It has no explorer link. An optional live local test
  compiles, deploys, mines, and reads back an ERC-20 contract on a running
  disposable node; public BTCS L2 deployment is still unsupported.
- Compiles a minimal OpenZeppelin ERC-20 implementation with fixed initial
  supply and no owner, mint, pause, or upgrade authority. The same interface is
  BEP-20-compatible when deployed on BNB Smart Chain.
- Creates a classic SPL mint, associated token account, initial supply, and
  immutable Metaplex token metadata on the selected Solana cluster.
- Requires a locally selected logo, validates its file signature and size,
  estimates fees/rent, shows a review step, requests wallet signing, waits for
  chain confirmation, and then links to the token and transaction explorers.

Signing takes place through the user's wallet. The app never asks for, stores,
or embeds a wallet private key or seed phrase. The Solana mint signer is
generated temporarily in browser memory because the SPL program requires the
new mint account to sign its creation; its secret bytes are cleared after
signing or failure and are not persisted or transmitted as a secret. Browser
JavaScript cannot guarantee secure memory erasure, so this is not equivalent
to hardware-backed or operating-system key isolation.

## Static-hosting and storage boundary

The live GitHub Pages preview serves only the built static files. This
repository does not
contain a private API, persistent database, logo upload service, or provider
credential. EVM RPC requests use the connected wallet's configured provider.
Solana uses the displayed public cluster endpoint by default and lets the user
choose another HTTPS endpoint. Public RPC providers may throttle, discontinue,
or change service; a user-specific URL is visible to that user's browser and
must not contain a secret API key.

The required logo file is selected locally and previewed in the browser. It is
not uploaded or retained by SilverForge. For SPL metadata, users must first
host the logo and metadata JSON at public HTTPS URLs under their control; the
form requires both URLs. The metadata-download action creates a JSON file but
does not publish it. EVM ERC-20 contracts do not store a token image or URI;
the optional logo URL is descriptive metadata only. Storage fees depend on the
provider selected by the user; no paid Silver Labs service is required or
included.

## Build, tests, and GitHub Pages

```sh
npm run build
```

Vite uses a relative asset base by default, which works at a GitHub Pages
project path. Set `VITE_BASE_PATH=/SilverForge-Studio/` only if an absolute
base is needed for a deployment preview. `npm test` compiles the contract,
validates form and network boundaries, executes the EVM deployment against an
isolated EthereumJS VM, and tests Solana transaction construction/signing
against a local RPC fixture.

The GitHub Actions workflow runs tests and builds on pushes and pull requests.
It does **not** deploy or enable Pages. Pages currently uses the legacy
`gh-pages` branch, which contains a checked-in build and tracked
`node_modules`; this is not a reviewed deployment workflow. The owner should
either approve and replace it with an Actions artifact deployment or disable
Pages. Do not treat the preview as a production release.

## Ecosystem boundaries

- **SilverPay** is the unified wallet/account product; it is not this token
  creator.
- **SilvEx** is a separate planned exchange destination. No trade, swap,
  market, or CEX/DEX endpoint is linked because none has been verified.
- **BTCS L2** is available only as an experimental local development adapter.
  No public BTCS L2 deployment is supported or verified. ERC-20/BEP-20
  compatibility does not mean an Ethereum or BNB deployment is a BTCS L2
  token.
- **Silver Scan** is not yet linked as an explorer destination. Result links
  point only to the actual selected network's public explorer.

## License and dependencies

SilverForge Studio source is MIT-licensed. Its dependency tree includes
OpenZeppelin Contracts (MIT), ethers (MIT), EthereumJS VM packages (MPL-2.0),
Solana web3.js (MIT/Apache-2.0), TweetNaCl (Public Domain), solc
(GPL-3.0-or-later), Vite (MIT), and jayson (MIT). SPL Token and Metaplex
instructions are constructed from their public protocol layouts; their SDK
packages are not bundled. Review installed license files and notices before
redistributing a production bundle; solc is build-time only and is not included
in the site.

## Contributing and security

Contributions should include reproducible tests and must preserve the
non-custodial boundary. Never add secrets, wallet keys, seed phrases, provider
credentials, or private RPC URLs to source, build output, issues, or logs. Do
not use mainnet until the transaction parameters and network fee are reviewed.
Security reports should be shared privately with the Silver Labs repository
owner; no dedicated security intake endpoint has been verified yet.
