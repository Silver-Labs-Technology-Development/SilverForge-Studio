# SilverForge Studio architecture

## Static boundary

Vite compiles a static browser application. The app can be hosted on a
project-site path using relative asset URLs. No signing service or private
backend is required. Wallets authorize transactions locally; RPC and explorer
services are public or user-configured. Metadata storage is user-provided and
must be public for wallets and indexers to retrieve it.

## Adapters

| Adapter | Token operation | Wallet / fee asset | Status |
| --- | --- | --- | --- |
| Ethereum | OpenZeppelin fixed-supply ERC-20 | Injected EVM wallet / ETH | Implemented; local EVM deployment test, not live-network verified |
| BNB Smart Chain | Same ERC-20 bytecode, BEP-20-compatible interface | Injected EVM wallet / BNB | Implemented; local EVM deployment test, not live-network verified |
| Solana | Classic SPL mint, ATA, initial supply, immutable Metaplex metadata | Injected Solana wallet / SOL | Implemented; local RPC construction/signature tests, not live-network verified |
| BTCS L2 local | OpenZeppelin fixed-supply ERC-20 profile | Injected EVM wallet / local BTCS fee token | Experimental local adapter; identity-gated, no running-node integration test |

EVM network IDs are checked against the selected chain before fee estimation
and checked again before signing. Solana RPC genesis hashes are checked so a
custom RPC endpoint cannot silently change the cluster behind the selected
network label. The BTCS L2 local adapter additionally requires `net_version`
31337 and a `web3_clientVersion` beginning with `BTCSL2/` before preparing or
sending a transaction. It targets `http://127.0.0.1:8545`, has no explorer
link, and must not be mistaken for a public testnet or mainnet. Explorer URLs
are generated from the selected network record when one is configured.

## EVM token contract

`contracts/SilverForgeERC20.sol` inherits OpenZeppelin ERC20 and mints the
chosen initial supply once to the deployment wallet. It has no owner, mint
authority, pause switch, proxy, or external metadata pointer. The selected
logo is not part of the on-chain contract. The deployment bytecode is compiled
during the build and copied to the static output.

## Solana transaction

The browser constructs one transaction containing mint-account creation,
classic Token Program initialization, associated token-account creation,
initial mint, and a Metaplex metadata account using the published
CreateMetadataAccountV3 instruction layout. Classic Token Program instruction
data and accounts are serialized directly with `@solana/web3.js`; the SPL SDK
is not a dependency. Tests assert program IDs, instruction discriminators,
account roles, and encoded supply/metadata fields. Metadata is immutable.
The wallet signs the transaction; a generated mint-account signer exists
temporarily in browser memory as a required transaction signer and its secret
bytes are cleared after it is signed or fails. No secret is logged or
persisted. JavaScript does not provide guaranteed secure memory erasure.

## SilvEx and SilverPay

SilverForge has no exchange feature. SilvEx is a separate planned destination;
this app does not show markets, trade buttons, or invented exchange endpoints.
SilverPay remains the unified wallet product and is not embedded as a second
signer here. The local BTCS L2 profile is a separate experimental deployment
target; it must not be described as Ethereum, BNB, or Solana deployment.
