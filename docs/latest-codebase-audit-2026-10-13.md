# Xtrading — latest code and Claude session audit

Checked 13 October 2026. Read-only production checks; no new signatures, trades, orders, deployments or permission changes were made during this audit.

## Code and session

- Local `main`: `fd4d49c` (Kuru historical price charts and manifest fix).
- Fetched `origin/main` and `origin/envio`: `8242b84`, one commit ahead. Its only changes are the indexer name and description in `services/indexer/config.yaml`; there is no application-code divergence.
- Read the local Claude session titled **Codebase review and hackathon planning** (`1052d610-80d1-443c-b1da-fcd792740b63`), including its latest Envio findings. Also read the recent implementation summary from **Agentic trading bot integrations** for the chart update.
- Existing `docs/status-audit-2026-10-13.md` describes the older `3174ceb` state. It is historical, not the latest checklist.

## Working or verified

| Feature | Evidence and limits |
|---|---|
| Public app and database | Production health and database readiness return 200. |
| Inline X trading interface | Code attaches Buy to native ticker cards or supplies an inline card for supported cashtags; mainnet MetaMask execution and secure app review fallback are implemented. Downloaded production ZIP is version 0.11.1. Installed-X end-to-end execution was not repeated in this audit. |
| Kuru prices and charts | Production prices endpoint returns BTC, ETH and MON prices from Kuru, each with 25 `kuru-book-1h` points. These are historical order-book midpoints, not trade-volume candles. |
| Mainnet spot buy/sell | Independently checked the saved demo receipts through Monad mainnet RPC: all five transactions succeeded, including the USDC approval, MON buy, MON sell, Flow approval and creator-fee buy. These were scripted trades, not proof of the full X interface flow. |
| Creator payment mechanics | Receipt `0x450e00b927f5b1dc9703b7bbb9fc7ffa52835dfe88ac596632633eb6c1b9d64c` contains a Kuru Flow `FeeCollected` payment of 39826357083100000 wei of MON to `0x51bDFC2a4D1C3B04A89f8CA928bd377B767Df424`. This proves a payment, not creator eligibility or user profit. |
| Staking removal | Commit `780303e` removed stake/bond screens and APIs. Contracts remain deployed; historical deposits are not deleted. The app withdrawal UI was also removed, so previous funds need a documented recovery path. |
| Terminal, following and creator analytics | Implemented: calls from observed followed accounts, detected-call price movement, registered-call outcomes, creator tiers, post availability flags and post analytics. Browser observations do not provide the full X following graph. |
| Bond-free Chainlink scorecard | Code and testnet deployment are recorded; CRE now commits and evaluates calls without requiring creator collateral. The recorded broadcast simulation is distinct from a deployed DON workflow. |

## Gaps that matter

1. **The approved fee-unlock rule is missing.** The user requires five distinct correct calls with verified profitable user trades before creator trading fees unlock. Current `packages/domain/src/reputation.ts` instead pays linked creators 0.1% immediately; Pro requires five scored calls and a 50% hit rate. Max/Ultra use larger scored samples and hypothetical return metrics. Neither those metrics nor detected-post price moves establish a user's realized profit. Production's public payout endpoint reports `mainnetFeesEnabled: true`.
2. **Profit attribution is not built.** Need a verified source call, authenticated user/wallet attribution, entry/exit fills, matching position/lot accounting, trading fees and gas, and positive realized net profit. Count unique calls, exclude creator self-trades, preserve failures, and invalidate qualifying evidence after reorgs. Browser-supplied post IDs alone are insufficient evidence.
3. **Newest Envio projections are not verified live.** The endpoint documented by Claude, `https://indexer.dev.hyperindex.xyz/6634cb9/v1/graphql`, is ready on chain 10143 but rejects both `CreatorFeePayment` and `CallBond` queries as missing fields. Production Envio environment values are stored as Secrets and were not readable through `vercel env run`; this audit therefore does not independently establish its currently selected endpoint. Deploy the latest `envio` branch and verify the actual configured endpoint.
4. **Promoting `a2e3a1d` is insufficient for the latest features.** Its committed config has neither chain-143 Kuru Flow indexing nor the new bond-free scorecard address. It can expose older bonded-call indexing, but cannot supply the newest creator-payment projection. A current deployment is needed; no paid upgrade should be assumed.
5. **Finish the real X flow.** Verify the loaded extension version, network selection, wallet approval, actual output, creator payment and dashboard attribution together. The extension now defaults to mainnet while earlier project instructions defaulted to testnet; resolve that discrepancy explicitly.
6. **Perpl remains operator-only.** Configured credentials and implemented review/session routes are not proof of a live filled order. Verify its scoped extension session, funded account, submission and exchange result. General-user trading is not demonstrated.
7. **Nansen and CRE demo evidence.** Nansen is configured and powers wallet/price integrations; demonstrate a current sourced wallet finding with coverage and timestamp. CRE still needs DON deployment and the production forwarder for autonomous hourly operation.

## Checks run

- `pnpm check`: passed lint, workspace types, 164 application tests, 30 Foundry tests, and optimized web/extension builds.
- Six database integration tests skipped without a dedicated test database. Four optional mainnet fork tests skipped without their explicit RPC flag; they are not counted as passed.
- `bun test` in `services/cre/settlement`: seven tests passed.
- Mainnet demo receipts verified independently against chain 143; no transactions were sent.

## Next delivery order

1. Enforce zero creator fees until five qualifying profitable calls are verified; keep payout registration separate from eligibility.
2. Build the source-call and realized-profit evidence pipeline, with a clear eligibility counter and unavailable states.
3. Deploy and select the current Envio schema; reconcile the already-recorded fee payment and bond-free scorecard result.
4. Complete one wallet-approved trade from the real X interface and verify its dashboard record.
5. Complete the Perpl, Nansen and autonomous CRE demonstrations; update README/SPONSORS and the older checklist to match verified behavior.
