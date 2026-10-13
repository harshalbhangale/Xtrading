# Xtrading status — 13 October 2026

Read-only code and production audit. No transactions, signatures or provider orders submitted.

## Code and checks

- Clean local `main` matches fetched `origin/main` at `3174ceb`.
- Regenerated stale local Envio bindings for CallSettlement. No tracked source changes were required.
- `pnpm check` passed: 111 application tests, 29 Foundry tests, lint, workspace typechecks and production builds. Six database tests and the optional mainnet fork suite were skipped; this run does not prove mainnet execution.
- CRE separately passed seven Bun tests and TypeScript checks.
- Production origin is https://xtradingnow.xyz. Database readiness and health endpoints passed.

## Verified reads

- `nomorebluffonx` has a saved stable-X-ID/wallet binding and active 500 mUSDC stake. Production reports current Envio indexing with deposit, withdrawal request and cancellation history.
- Project wallet `0x51bDFC2a4D1C3B04A89f8CA928bd377B767Df424` holds 9.740156732 test MON, zero Kuru V2 USDC, and zero Perpl test AUSD.
- Public market reads show testnet MON/USDC with both bid and ask; WETH/USDC and WBTC/USDC have no reported best ask at this read. Simulation is still required for execution.
- The production mainnet trade page renders MON/WETH/cbBTC against USDC rather than the disabled-state panel. No mainnet quote, signature or fill was verified in this audit.
- Perpl is reported as operator-only; public market discovery works. A reviewed order is not a confirmed fill.
- The AUSD faucet page returns HTTP 200. No claim was submitted during this audit.
- CallSettlement `0x260264E74028d498a1A10f90dDC4f4b91F3395DF` still trusts the simulation forwarder. Its recorded demo call `0xaa4a41421ed67cf0adcabaed6ce150f767ff1883f6b826809bbbcdf5663bd4ca` has status Failure, with entry price 252123000000 and exit price 251286000000. This is testnet settlement evidence, not proof of an hourly DON deployment.

## Latest implemented changes

Kuru mainnet order-book adapter, explicit dashboard network switch, exact approvals and simulated market-order minima; embedded and external-wallet transaction handoff; native MON testnet spot; test AUSD claim page; redesigned marketing/dashboard/stake pages; deployed bonded-call receiver and app bonding flow; Envio settlement projections; revised extension creator-card placement and actions.

The extension drawer still describes mainnet execution as not ready while the dashboard has mainnet code. Align the handoff and status wording, then validate the current installed build on real X.

## Remaining demo evidence, in order

1. Fund the receiving wallet with the correct token; the Kuru token contract address is not a receiving wallet. Obtain Kuru V2 USDC or use the explicit mainnet route with real funds and user approval.
2. Complete one confirmed Kuru fill, then verify source-post attribution and actual dashboard accounting. Verify mainnet indexing coverage separately from the V2 testnet handlers.
3. Claim or receive Perpl test AUSD, verify the correct exchange account, execute a bounded order and demonstrate a safe reduce-only exit. Confirm whether execution uses the operator account or the user's wallet.
4. Test extension 0.6.0 on real X after the latest card changes: ordinary posts, profile headers, stale evidence, network handoff and source links.
5. Show a sourced Nansen insight for a wallet with covered Monad mainnet activity; key presence alone is insufficient.
6. Deploy the hourly CRE workflow to the DON, configure production forwarder/workflow identity, then verify scheduled settlement. Keep refundable stake separate from call bonds.
7. Finish timeout/refund, account isolation, rejected signatures and recovery checks; record the complete sponsor demo.

README's opening CRE summary and parts of the older checklist/audit are stale. Prefer the dated evidence above over unchecked or contradictory historical prose.
