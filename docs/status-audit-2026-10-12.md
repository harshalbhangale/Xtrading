# Xtrading status audit

Reviewed 12 October 2026 against GitHub, local code, Claude's **Codebase review and hackathon planning** session, the delivery checklist and production read-only endpoints. No orders, signatures, deployments or funds were submitted during this audit.

## Code and handoff

- Local `main` and fetched `origin/main` both point to `c07b0fe`; the checkout was clean before this document was added.
- Local `codex/foundation` points to `8c5d6f8` and is already an ancestor of `main`. Relative to its own remote it is three commits ahead and one behind. Continue from `main`; do not overwrite it with the old foundation branch.
- `origin/envio` points to `80ddb37`. This separate deployment branch is intentional; ordinary web commits should not redeploy the indexer.
- Claude's latest handoff ends at `c07b0fe`: settlement contract and workflow committed, but no settlement deployment, workflow simulation or workflow unit tests. Its expired CLI login blocker is now resolved: `cre whoami` succeeds and deploy access is enabled. `cre version` reports `CRE CLI development`.
- The product is now Xtrading at https://xtradingtoday.vercel.app. The repository and deployed mock token retain their earlier names.

## Evidence checked now

| Area | Result | Remaining proof |
|---|---|---|
| Build and checks | `pnpm check` passes: 59 application tests, 29 Foundry tests, typecheck, lint and web/extension builds | Six database integration tests skipped without a test database URL |
| CRE source | Separate `bun run typecheck` passes | Nested workflow is outside the normal workspace check; no workflow tests or simulation yet |
| Production database | `/api/ready` returns ready | Restart recovery and account isolation testing |
| Privy identity | Public record exposes the saved stable X ID and bound wallet | Repeat onboarding on a fresh account/browser |
| Stake and Envio | Production reports 500 mUSDC active, current indexing and all three deposit/request/cancellation events | Full refund after a new withdrawal request and seven-day cooldown; reorg recovery |
| Kuru V2 | WETH/USDC and WBTC/USDC configured; quote/approve/deposit/swap/withdraw implementation exists | Bound-wallet funding and a confirmed fill. Today's market endpoint returns null best bid/ask, so executable liquidity must be rechecked |
| Perpl | Live public markets; signed submission and order/fill/position polling implemented | Claude verified team account 1096 with 100 AUSD and forwarding. No demonstrated live fill; repeat account read before submitting |
| Calls | Registration and historical scoring implementation exists | Production creator ledger is currently empty; register a fresh call and observe its expiry outcome |
| Nansen | Production reports key present; price/wallet adapters exist | Actual sourced wallet finding. The demo wallet has no demonstrated Monad mainnet trading history |
| MCP | Production initialization succeeds | Claude previously verified eight tools and unauthenticated denial. Recheck an authenticated portfolio/unsigned preparation flow for the demo |
| X extension | Latest badges, profile cards, classifier, drawer and production package exist | Test this merged version on real X; earlier testing of the simpler extension does not validate this version |
| CRE settlement | Separate bonded-call receiver plus 16 passing Foundry tests; hourly workflow source exists | Receiver deployment, correct forwarder/workflow configuration, simulation, app wiring and settlement indexing |

Credential presence and working reads do not prove a provider trade or finding. Perpl live execution uses the team's server-key account and operator allowlist, not each user's Privy wallet.

## Work order

1. **Reconcile the handoff documents.** README, health descriptions, sponsor status and parts of the checklist still say MCP, hosted indexing or the settlement contract are unimplemented. Record implemented, verified and pending separately.
2. **Validate the latest extension on real X.** Install the production package; check bound/unbound creators, independent stake badge, profile navigation, drawer, classification, stale/unavailable states, duplicate injection and app handoff. Preserve screenshots.
3. **Complete one Kuru spot flow.** Obtain Kuru V2 test USDC at `0xA402B424f392EAA05DBc8779e4502A1F6A96fEF1` for the bound wallet, recheck liquidity, then user-approved exact approval/deposit/swap. Verify receipt, indexed fill, actual portfolio amounts and source-post link. mUSDC cannot substitute for Kuru's quote token.
4. **Complete one Perpl flow.** Recheck funded operator account; user reviews and submits a bounded test order. Confirm fill, position and transaction; implement a reduce-only exit before leaving a demo position open. Record the API-bounty demo.
5. **Register a fresh creator call now.** Verify authorship and integer entry observation, then a historical expiry outcome. Keep ordinary scored calls separate from opt-in financially bonded calls.
6. **Demonstrate Nansen and MCP.** Use a consenting creator's bound wallet with actual covered history, or show the honest empty result. Verify authenticated MCP scope and unsigned transaction output without sharing session tokens.
7. **Finish CRE in stages.** Confirm Monad selector and simulation/live forwarders; add workflow tests; fix pagination/catch-up and per-call failure isolation; configure mandatory workflow identity for live deployment. Stage a receiver deployment and bounded reward funding for user approval, simulate without broadcast, then demonstrate one explicitly approved bonded call. Add app registration/claim/refund and Envio settlement projections.
8. **Finish failure tests and submission.** Wrong chain, rejected signature, insufficient funds/liquidity, expired quote, stale indexer, retries and account isolation; capture the complete demo and sponsor evidence.

## CRE issues to address before deployment

- Both workflow configs still use the zero receiver address.
- The workflow always calls `dueCalls(0, scanLimit)` and discards the returned cursor. Later calls can starve behind the first page; slicing to the first five also lets unsupported or missing-price calls repeatedly block useful work.
- HTTP/JSON/price exceptions are not isolated per call, so one failure can abort a batch.
- Workflow ID/owner validation is optional in the receiver and defaults off. Configure and verify it before trusting live reports.
- No workflow unit tests cover pagination, historical gaps, retry isolation or restart catch-up. Passing Solidity tests do not establish working CRE execution.

The settlement reward pool is separate from refundable creator stake. Existing 500 mUSDC stake must not become a slashing pool.
