# MVP sponsors

Primary track: **Onchain Finance & Trading**.

| Sponsor | Core feature | Required demo evidence |
|---|---|---|
| Kuru | Spot trading from X on Monad | Approved order, confirmed fill and source-post attribution in the dashboard |
| Perpl | Explicit perp calls and social trading | Risk-bounded, wallet-approved Perpl execution with real onchain activity; ≤2-minute demo |
| Privy | X login, embedded wallet and signing | Verified X/wallet binding, creator payout registration and reviewed Kuru transaction through Privy |
| Envio | HyperIndex Kuru activity plus HyperSync creator payments and bond-free call outcomes | `/dashboard/onchain`: real decoded events, receipt checks, block progress and transaction links; creator earnings consume the same payment source |
| Nansen | Wallet/token context | Actual sourced insight with timestamp, network and coverage |
| Chainlink CRE | Hourly bond-free call scorecard | Real testnet broadcast settlement and Envio outcome; autonomous DON deployment remains pending |

Current evidence, verified 13 October 2026:

- Kuru: real scripted mainnet buy/sell and creator payment. The later approved 1-USDC round trip returned 0.998845 USDC, used 0.162237936 MON gas under a 0.2-MON cap, left zero book allowance, and required no exchange deposit. [Receipts and costs](docs/demo-readiness-2026-10-13.md). Complete X-interface execution remains to be demonstrated.
- Privy: identity and wallet-binding flows implemented. Rehearse the exact demo account and wallet approval.
- Envio: mainnet creator payments and testnet bond-free call outcomes are live through HyperSync and checked against receipts. HyperIndex supplies historical testnet activity. Repairing the hosted deployment connection is separate from this working feature.
- Nansen: integration implemented; a useful sourced mainnet wallet finding still needs demonstration.
- Perpl: orders, closes and withdrawals are signed by each user's own wallet for their own exchange account (`execOrder`, `withdrawCollateral`); fills are read from the order transaction's events. Verified by testnet simulation only; a real wallet-signed order through the UI is pending. The team API-key account (1096) is no longer used.
- Chainlink CRE: real testnet broadcast settlement exists. DON deployment and production forwarder setup remain pending.

Staking is removed. The approved creator fee rule requires five distinct correct calls with verified profitable user trades; current tier/base-fee logic does not enforce it yet. Creator payments, hypothetical call performance and realized user profit are separate evidence.

Perpl API is in scope; its separate analytics/risk dashboard bounty is excluded. Kimi is optional; Aurora and other sponsor branches come after the core demo.

## Resources

- [Kuru bounty](https://hackathon.monad.xyz/tracks/build-the-next-consumer-trading-app-on-kuru)
- [Privy bounty](https://hackathon.monad.xyz/tracks/privy)
- [Envio bounty](https://hackathon.monad.xyz/tracks/best-use-of-envio)
- [Nansen bounty](https://hackathon.monad.xyz/tracks/best-use-of-nansen)
- [Component references](docs/references.md)
- [Delivery checklist](docs/implementation-plan.md)
