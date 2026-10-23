# SilverForge working state

## Repository and provenance

The local workspace and the Silver Labs organization repository search did not
find an independently maintained SilverForge repository. The existing
implementation was in `btcs-core/src/qt/silverforgepage.*` (a UI skeleton) and
`btcs-l2/studio` plus `services/asset-service` (a backend-dependent local
asset engine). Those implementations were left intact. This standalone static
frontend is new and does not copy or replace the L2 asset engine or Qt code.

This new directory is a local engineering checkout only. It has not been
published or pushed. An authorized maintainer must confirm the approved
organization-owned private repository and branch before remote setup.

## Scope and evidence

- EVM networks are implemented through wallet RPCs and use one compiled
  OpenZeppelin fixed-supply contract artifact. Local EthereumJS VM tests verify
  deployment, ERC-20 getters, supply, transfer, and recipient balance.
- Solana uses the classic Token Program and Metaplex metadata program.
  Instruction layouts are serialized from protocol fields; tests verify
  program IDs, instruction data/accounts, cluster verification, wallet
  signature handoff, and temporary secret cleanup against a local RPC fixture.
- The experimental BTCS L2 profile points only to `127.0.0.1:8545` and requires
  chain ID 31337 plus the `BTCSL2/` client identity before review and again
  before signing. Its identity checks are unit-tested; deployment against a
  running BTCS L2 node has not been tested.
- The focused test suite passes 12/12 and the static build succeeds. Live
  wallet/network use has not been tested.
- No browser-wallet extension test against public Ethereum, BNB, or Solana
  infrastructure has been run. No live-chain deployment is claimed.
- The local workspace contains a BTCS L2 v1.6 technical whitepaper but no
  v1.8.3 whitepaper file. The architecture addendum was added to the latest
  available local L2 whitepaper without inventing or renaming a v1.8.3 source.

## Release and access

GitHub Actions CI is added for build/test only. GitHub Pages deployment and
source visibility remain unchanged and disabled pending explicit approval.
