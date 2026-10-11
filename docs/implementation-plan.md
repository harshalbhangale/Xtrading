# Delivery checklist

Updated 11 October 2026. Core sponsors: Kuru, Privy, Envio and Nansen; added targets: Perpl API and Chainlink CRE. The Chrome extension is the priority product surface.

## Done

- [x] Workspace, TypeScript, formatting, CI and incremental commits pushed to GitHub.
- [x] Landing page, creator platform and user dashboard pages.
- [x] Local watchlists, profile drafts, trade drafts and call filters.
- [x] MV3 extension build with creator-evidence links.
- [x] Local Postgres and AWS RDS in Mumbai; migrations, restricted access and verified TLS.
- [x] Real Privy/X login, embedded wallet and server-verified identity.
- [x] Signed stable-X-ID/wallet binding with expiring, single-use nonces; persistence verified after refresh.
- [x] Refundable stake contract deployed on Monad testnet; receipt, bytecode and settings verified.
- [x] Live stake RPC reads and separate wallet reviews for approval, deposit and withdrawal actions.
- [x] Original six-decimal mUSDC contract and faucet; deployed with 10,000 mUSDC in the project wallet.
- [x] Envio schema, event handlers, contract configuration and generated bindings.
- [x] Latest local checks: 18 application tests, 12 Foundry tests, web/extension builds; six database integration tests skipped in this run.

## Phase 1: Finish stake and indexing

- [ ] Record the mock deployment receipt and configure mock-token mode.
- [ ] Deploy and verify a matching mUSDC stake contract; preserve the earlier Circle-token deployment record.
- [ ] Verify separate bounded approval and deposit transactions.
- [ ] Verify withdrawal request, cancellation and full refund after cooldown.
- [ ] Run Envio against the selected deployment; expose stake projections.
- [ ] Track event idempotency, reorgs, finality and freshness.

Exit: a deposit updates current stake evidence; requesting withdrawal removes active eligibility.

## Phase 2: Live X extension

- [ ] Install and test the extension on real X.
- [ ] Add explicit app/API configuration and minimal permissions.
- [ ] Resolve handles through verified stable-X-ID mappings.
- [ ] Add independent identity and stake indicators plus evidence popovers.
- [ ] Handle missing/stale data, withdrawal pending, feed navigation and duplicate injection.
- [ ] Verify message origins and safe handoff to wallet review.

Exit: a bound creator's profile/post shows current evidence from the backend.

## Phase 3: Kuru spot, Perpl perps and user dashboard

- [x] Add explicit spot/perp routing policy with no chain or venue fallback.
- [ ] Connect routing to reviewed call intent and trading UI.
- [ ] Verify a supported market, token decimals, ABI and usable liquidity.
- [ ] Verify Perpl network, market IDs, collateral units and unsigned order interface.
- [ ] Add user-confirmed leverage, collateral/exposure caps, slippage, reduce-only exits and duplicate-order prevention.
- [ ] Demonstrate Perpl social trading with actual onchain activity; record its ≤2-minute API-bounty demo.
- [ ] Fetch quotes and prepare unsigned orders with fees, expiry and execution limits.
- [ ] Add X buy/sell entry points with source-post attribution.
- [ ] Execute only after Privy wallet approval.
- [ ] Index order/fill events and distinguish open, partial, filled, cancelled and failed orders.
- [ ] Populate portfolio/activity from confirmed fills; add optional watchlist sync.
- [ ] Test rejected signatures, expired quotes, wrong chain, insufficient funds and unavailable liquidity.

Exit: X → review → approval → Kuru fill → dashboard with actual amounts.

## Phase 4: Calls, reputation and Nansen

- [ ] Confirm authorized X ingestion and Nansen access/coverage.
- [ ] Store sourced calls with stable author ID, asset address, direction, horizon and edit handling.
- [ ] Publish deterministic evaluation rules, price sources and methodology version.
- [ ] Show sample size, coverage, unresolved calls and hypothetical outcomes separately from wallet returns.
- [ ] Add an actual Nansen-backed wallet/token insight with source and timestamp.
- [ ] Connect dossiers, call ledgers, reputation pages and extension popovers.

Exit: each scored call is traceable to its source and inputs; Nansen adds a useful real insight.

## Phase 4B: Hourly CRE settlement

- [ ] Confirm CRE write support and forwarder for Monad testnet 10143; verify CLI/account access.
- [x] Add integer expiry-price evaluator with missing-data and timestamp checks; price adapter and onchain commitment checks remain pending.
- [ ] Register opt-in calls with immutable expiry, price source, evaluation rules and bounded bond/reward amounts.
- [ ] Implement a separate call-bond/reward contract; leave refundable CreatorStake deposits separate.
- [ ] Fund rewards and reserve them at registration; lock each call's bond until settlement or its defined timeout refund.
- [ ] Build an hourly CRE trigger that scans expired unsettled calls in bounded, paginated batches.
- [ ] Retrieve historical expiry prices; validate timestamp, asset identity, decimals and coverage.
- [ ] Submit signed settlement reports through the configured CRE forwarder with workflow identity validation.
- [ ] Enforce single settlement, replay protection, fixed payout limits and timeout refunds in the contract.
- [ ] Foundry-test rewards, losses, ties, duplicate/unauthorized reports, missing prices and accounting conservation.
- [ ] Simulate CRE and index confirmed outcomes with Envio; show evidence and amounts in creator/extension views.

Exit: an expired bonded call produces one verified settlement, paying its reserved reward or deducting only its agreed call bond. Missing prices never trigger a slash. Production activation remains pending until network support and deployment access are verified.

## Phase 5: MCP

- [ ] Implement MCP transport, schemas and connection instructions.
- [ ] Add public creator/call/stake tools and authenticated portfolio access.
- [ ] Add unsigned trade preparation using shared services.
- [ ] Verify a real MCP client and denied private-data access.

## Phase 6: Deployment and submission

- [ ] Deploy web/API and indexer with HTTPS origins and server secrets.
- [ ] Package the extension and document installation.
- [ ] Test restart recovery, stale data, transaction failures and account isolation.
- [ ] Record the complete onboarding → stake → X evidence → trade → confirmed-fill demo.
- [ ] Demonstrate Nansen evidence and MCP; prepare sponsor evidence and submission video.

Commit verified features separately and update this checklist as they land.
