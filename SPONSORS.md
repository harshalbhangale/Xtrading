# Selected sponsor integrations

Approved by the user on 11 October 2026. These are MVP requirements for Call My Bluff. Status: foundation implemented; full live sponsor flows remain pending. See [README.md](README.md) for setup and current limitations.

Primary track: **Onchain Finance & Trading**.

Current implementation includes server-verified Privy/X sessions, embedded wallet onboarding and nonce-protected wallet binding APIs, per-chain Kuru market configuration, Envio stake schemas and event handlers, and a server-use Nansen API boundary. The real X login, user-approved embedded-wallet signature and persisted binding after refresh are verified. Stake and trading signatures remain pending. These implementations do not yet satisfy the completion evidence below. Nansen evidence is mainnet data; do not imply testnet coverage.

## Required MVP integrations

| Sponsor | Product role | Completion evidence |
|---|---|---|
| **Kuru** | Buy/Sell from X through supported Monad spot order-book markets. | A wallet-approved order and confirmed fill, with actual amounts and source post displayed in the user's dashboard. |
| **Privy** | X account linking, embedded wallet onboarding, stake deposits and trading signatures. | Verified account-to-wallet binding, a real stake deposit and a Kuru transaction signed through Privy. Login alone is insufficient. |
| **Envio** | Index stake and trading events; derive creator stake status, order/fill history and dashboard aggregates. | Live indexed events update an extension badge and dashboard; public indexer config, schema and handlers. |
| **Nansen** | Evidence for reputation and token context, using supported Monad wallet/token endpoints. | A sourced, timestamped insight from actual Nansen data displayed beside creator/call evidence, with coverage and unavailable-data states. |

Nansen is selected as a required product integration. Confirm authorized API access and coverage for the chosen demo wallets/markets early. Missing coverage must be visible; do not substitute invented data or silently remove this integration. AI interpretation, hypothetical call performance, and actual wallet/trade results remain distinct.

## Optional and later phases

- **Kimi:** optional model for extracting and explaining financial calls. Selecting it later means using it in a core feature and preparing the required integration article. It is not a committed MVP sponsor yet.
- **Aurora Intents and Chainlink CRE:** later phase after the full stake → badge → evidence → trade → dashboard flow works.
- Other sponsors remain researched possibilities. Dynamic is not the selected primary wallet provider; Mera/Perpl/agent-wallet/new-market branches do not expand the current MVP automatically.

## Implementation order

1. Confirm Privy/X configuration, a supported Kuru market/network, Nansen API access and endpoint coverage, and Envio deployment access.
2. Prove standalone Privy-signed stake deposit and Kuru order/fill flows.
3. Index stake and order/fill events with Envio and update badge/dashboard state.
4. Add Nansen-backed evidence to creator profiles and X popovers.
5. Complete the combined extension journey and personal dashboard; prepare real user-test feedback and the distribution roadmap.

## Organizer references

- [Kuru consumer trading bounty](https://hackathon.monad.xyz/tracks/build-the-next-consumer-trading-app-on-kuru)
- [Privy bounty](https://hackathon.monad.xyz/tracks/privy)
- [Envio bounty](https://hackathon.monad.xyz/tracks/best-use-of-envio)
- [Nansen bounty](https://hackathon.monad.xyz/tracks/best-use-of-nansen)
- [Finance track](https://hackathon.monad.xyz/tracks/onchain-finance)

Full portal review: [research/portal-sponsor-expansion.md](docs/research/portal-sponsor-expansion.md). Product architecture: [research/product-blueprint.md](docs/research/product-blueprint.md). This approved selection takes precedence over earlier optional-provider recommendations in research.
