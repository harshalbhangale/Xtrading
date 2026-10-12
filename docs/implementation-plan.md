# Delivery checklist

Updated 12 October 2026. Core sponsors: Kuru, Privy, Envio and Nansen; added targets: Perpl API and Chainlink CRE. The Chrome extension is the priority product surface.

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
- [x] Latest local checks: 30 application tests, 12 Foundry tests, web/extension builds; six database integration tests skipped in this run.

## Phase 1: Finish stake and indexing

- [x] Record and verify the mock deployment receipt/runtime and configure local mock-token mode.
- [x] Deploy and verify a matching mUSDC stake contract; preserve the earlier Circle-token deployment record.
- [x] Verify separate exact 500 mUSDC approval and deposit transactions; active stake confirmed.
- [x] Verify live withdrawal request disables eligibility and cancellation restores it; both indexed by Envio.
- [ ] Verify a live full refund after the seven-day cooldown. Foundry refund/conservation tests pass; the demo stake currently remains active.
- [x] Run Envio against both verified deployments; expose authenticated stake history and indexing progress.
- [x] Preserve event IDs, configure reorg rollback and display freshness with explicit unfinalized status. Live reorg recovery still needs validation.

Exit: a deposit updates current stake evidence; requesting withdrawal removes active eligibility.

## Phase 2: Live X extension

- [ ] Install and test the extension on real X.
- [x] Add build-time app origin configuration and narrowly scoped host permission; service-worker transport is limited to X senders and creator handles.
- [ ] Resolve handles through verified stable-X-ID mappings.
- [x] Implement separate recorded-binding and current indexed stake indicators plus evidence details. Validate on real X after installation approval.
- [x] Handle missing/stale data, withdrawal pending, feed navigation and duplicate injection (shadow-DOM UI, recycled-node keys, visibility-gated requests).
- [x] Author badges, profile cards, signal bars and the call-check drawer. Verified on an X-shaped test page in headless Chrome; real-X validation pending.
- [x] Validate message sender origins and implement unsigned spot Buy/Sell handoffs with source post ID. Real-X end-to-end validation remains pending.

Exit: a bound creator's profile/post shows current evidence from the backend.

## Phase 3: Kuru spot, Perpl perps and user dashboard

- [x] Add explicit spot/perp routing policy with no chain or venue fallback.
- [x] Connect routing to reviewed call intent and trading UI (`/api/signals/classify` → `/dashboard/trade`).
- [x] Verify Kuru testnet MON/USDC deployment, token decimals and SDK ABI with live reads.
- [x] Add public Kuru/Perpl market discovery and authenticated unsigned Kuru step preparation.
- [x] Move spot trading to Kuru Spot V2 testnet (AccountCore `0xdbaa…8038`; WETH/USDC and WBTC/USDC, both with live two-sided books). The old V1 MON/USDC market had no bids. Flow: exact approve → deposit shortfall → swap with simulated minimum and onchain deadline; withdraw back to wallet. A read-only `eth_call` from a funded third-party account returned 0.0037274949 WETH for 10 USDC, matching the book estimate.
- [ ] Obtain Kuru V2 test USDC (`0xA402…fEF1`, admin-minted, no public faucet) and complete a confirmed fill from the bound wallet.
- [ ] Verify Perpl network, market IDs, collateral units and unsigned order interface.
- [x] Add user-confirmed leverage, server leverage/size caps, slippage and duplicate-order prevention for Perpl opens. Reduce-only exits remain.
- [x] Ed25519-signed Perpl order submission; demo mode without credentials. Live submission pending a funded, forwarding-enabled account.
- [ ] Demonstrate Perpl social trading with actual onchain activity; record its ≤2-minute API-bounty demo.
- [x] Connect actual eth_call quote simulation, integer slippage and explicit Privy review UI.
- [ ] Verify successful quotes and wallet approval in funded/liquid conditions; separate fee breakdown remains unavailable.
- [x] Add X trade entry points with source-post attribution.
- [ ] Execute only after Privy wallet approval.
- [ ] Index order/fill events and distinguish open, partial, filled, cancelled and failed orders.
- [ ] Populate portfolio/activity from confirmed fills; add optional watchlist sync.
- [ ] Test rejected signatures, expired quotes, wrong chain, insufficient funds and unavailable liquidity.

Exit: X → review → approval → Kuru fill → dashboard with actual amounts.

## Phase 4: Calls, reputation and Nansen

- [x] Creator-registered calls instead of X scraping: post authorship verified through X's public oEmbed (no API key), registration within 24h of posting, immutable terms. Nansen key configured (100-credit plan).
- [x] Store sourced calls with stable creator binding, asset, direction, horizon, entry observation and post text (`POST /api/calls`).
- [x] Publish deterministic evaluation rules, price sources and methodology version (`/methodology`, directional-return-v1). Binance 1m spot for BTC/ETH/SOL, Nansen 1m OHLCV for WMON on Monad mainnet; integer prices only.
- [x] Show sample size, coverage, open calls and hypothetical outcomes separately from wallet returns (`GET /api/creators/:handle/calls`, creator record and studio). Expired calls resolve lazily on read, at most four per request.
- [ ] Verify a live registration from the bound account and a resolved outcome.
- [ ] Add an actual Nansen-backed wallet/token insight with source and timestamp.
- [ ] Connect dossiers, call ledgers, reputation pages and extension popovers.
- [ ] Confirm authorized X ingestion and Nansen access/coverage.
- [x] Store extracted calls (`post_signals`) with handle, asset symbol, direction, instrument, horizon, text hash and methodology version. Stable-ID linkage and asset addresses remain.
- [ ] Publish deterministic evaluation rules, price sources and methodology version.
- [ ] Show sample size, coverage, unresolved calls and hypothetical outcomes separately from wallet returns.
- [x] Nansen DEX-trade consistency check for the bound wallet with timestamps and coverage notes; labelled demo findings without a key. A live keyed run is pending.
- [x] Connect call ledgers, reputation counts and extension drawers/profile cards. Scores remain pending evaluation.

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
