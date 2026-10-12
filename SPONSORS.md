# MVP sponsors

Primary track: **Onchain Finance & Trading**.

| Sponsor | Core feature | Required demo evidence |
|---|---|---|
| Kuru | Spot trading from X on Monad | Approved order, confirmed fill and source-post attribution in the dashboard |
| Perpl | Explicit perp calls and social trading | Risk-bounded, wallet-approved Perpl execution with real onchain activity; ≤2-minute demo |
| Privy | X login, embedded wallet and signing | Verified X/wallet binding, stake deposit and Kuru transaction through Privy |
| Envio | Stake and trading projections | Onchain events update extension indicators and dashboard history |
| Nansen | Wallet/token context | Actual sourced insight with timestamp, network and coverage |
| Chainlink CRE | Hourly settlement of expired, bonded calls | Simulated workflow, authenticated settlement report, reward/slash event and Envio projection |

Current status, kept as separate records:

- Implemented: Privy identity binding, both stake contracts and mUSDC, extension indicators, Kuru spot review, Perpl order review, MCP at `/api/mcp`, the CallSettlement contract, the CRE workflow source, and Envio handlers for stake, Kuru SpotSwap and CallSettlement.
- Verified: a wallet-approved 500 mUSDC deposit, plus the later withdrawal request and cancellation, indexed by Envio, with that stake active again. CRE success and slash paths ran on a local Monad fork. MCP lists its public tools.
- Pending: a confirmed Kuru fill, a live Perpl order, a keyed Nansen finding for a wallet with Monad mainnet history, real-X validation of this extension build, and DON deployment of the workflow. The testnet receiver still trusts the simulation forwarder.

Perpl API is in scope; its separate analytics/risk dashboard bounty is excluded. Kimi is optional; Aurora and other sponsor branches come after the core demo.

## Resources

- [Kuru bounty](https://hackathon.monad.xyz/tracks/build-the-next-consumer-trading-app-on-kuru)
- [Privy bounty](https://hackathon.monad.xyz/tracks/privy)
- [Envio bounty](https://hackathon.monad.xyz/tracks/best-use-of-envio)
- [Nansen bounty](https://hackathon.monad.xyz/tracks/best-use-of-nansen)
- [Component references](docs/references.md)
- [Delivery checklist](docs/implementation-plan.md)
