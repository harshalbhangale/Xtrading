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

Current status: Privy identity binding works; both Circle-token and matching mUSDC stake contracts are deployed and verified; mUSDC has 10,000 tokens in the project wallet. Envio is running locally and backfilling both deployments. Deposits, indexed stake evidence in the app, Kuru execution and Nansen data remain pending.

Perpl API is in scope; its separate analytics/risk dashboard bounty is excluded. CRE settlement is planned alongside call evaluation. Kimi is optional; Aurora and other sponsor branches come after the core demo.

## Resources

- [Kuru bounty](https://hackathon.monad.xyz/tracks/build-the-next-consumer-trading-app-on-kuru)
- [Privy bounty](https://hackathon.monad.xyz/tracks/privy)
- [Envio bounty](https://hackathon.monad.xyz/tracks/best-use-of-envio)
- [Nansen bounty](https://hackathon.monad.xyz/tracks/best-use-of-nansen)
- [Component references](docs/references.md)
- [Delivery checklist](docs/implementation-plan.md)
