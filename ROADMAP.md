# SilverForge Studio roadmap

Status is based on code and local tests in this repository. A local or
simulated test is not evidence of a live public-chain deployment or an audit.

## Implemented in this preview

- Static Vite app with relative-path build output for project-site hosting.
- Wallet-authorized fixed-supply ERC-20 deployment flow for Ethereum and
  BNB Smart Chain, with matching testnet choices.
- Solana classic SPL mint, associated token account, initial mint, and
  immutable Metaplex metadata transaction flow for mainnet and Devnet.
- Required local logo validation, metadata preparation, network-specific
  fee/rent estimates, transaction review, confirmation states, and explorer
  result links.
- EVM contract compilation, isolated local deployment test, Solana local-RPC
  transaction construction/signature tests, and CI build workflow.

## Active engineering / not yet independently verified

- Live wallet-extension testing on Sepolia, BSC Testnet, and Solana Devnet.
- Independent contract review and review of the exact Solana instruction set.
- Verify public RPC reliability and explorer links at the selected clusters.
- Establish a separately maintained SilverForge repository and approved
  private development remote. No standalone SilverForge repository was found
  in the inspected local workspace or Silver Labs organization search.

## Planned

- User-friendly storage-provider adapters that do not embed provider secrets.
- Optional token-registry metadata integration after the relevant registry and
  indexing requirements are selected.
- BTCS L2 adapter only after chain identity, fee handling, contract profiles,
  wallet connection, and deployment tests are implemented and reviewed.
- SilvEx contextual handoff only when a real supported destination and network
  are available. Centralized and decentralized exchange functionality remain
  distinct integrations.
- Public GitHub Pages release after explicit owner publication approval,
  repository settings review, and a separate deployment change.

## Unresolved research

- Production threat model, independent security review, and supported
  deployment policy for mainnets.
- Metadata storage durability, pinning, moderation, and long-term link
  guarantees.
- Standards and wallet display compatibility across EVM and Solana clients.
- Final BTCS L2 token standard selection. BSNA-FTS1 remains a proposal in the
  current L2 documentation and is not offered by this static frontend.
