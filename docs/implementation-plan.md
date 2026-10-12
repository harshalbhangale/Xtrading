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
- [x] Latest local checks: 83 application tests, 29 Foundry tests, web/extension builds; six database integration tests skipped in this run.

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
- [x] Discard delayed classifications for recycled posts; seven DOM regression cases cover call-only inserts, click-only drawers, profile records, stale navigation and invalid responses. Production real-X validation remains pending Chrome reload.
- [x] Signal bars for detected calls and a user-opened call-check drawer. Ordinary posts remain untouched; profile headers show creator records and call drawers show evidence. Real-X validation pending.
- [x] Validate message sender origins and implement unsigned spot Buy/Sell handoffs with source post ID. Real-X end-to-end validation remains pending.

Exit: detected calls open current creator evidence and a safe trade handoff; ordinary posts remain untouched.

## Phase 3: Kuru spot, Perpl perps and user dashboard

- [x] Add explicit spot/perp routing policy with no chain or venue fallback.
- [x] Connect routing to reviewed call intent and trading UI (`/api/signals/classify` → `/dashboard/trade`).
- [x] Verify Kuru testnet MON/USDC deployment, token decimals and SDK ABI with live reads.
- [x] Add public Kuru/Perpl market discovery and authenticated unsigned Kuru step preparation.
- [x] Move spot trading to Kuru Spot V2 testnet (AccountCore `0xdbaa…8038`; WETH/USDC and WBTC/USDC, both with live two-sided books). The old V1 MON/USDC market had no bids. Flow: exact approve → deposit shortfall → swap with simulated minimum and onchain deadline; withdraw back to wallet. A read-only `eth_call` from a funded third-party account returned 0.0037274949 WETH for 10 USDC, matching the book estimate.
- [ ] Obtain Kuru V2 test USDC (`0xA402…fEF1`, admin-minted, no public faucet) and complete a confirmed fill from the bound wallet.
- [x] Verify Perpl network, market IDs, collateral units and order interface: signed reads against testnet show account 1096 with forwarding enabled and 100 AUSD; order format matches Perpl's OrderSpec. Ticket reads back order status, fill and position (`/api/trades/perp/status`).
- [x] Add user-confirmed leverage, server leverage/size caps, slippage and duplicate-order prevention for Perpl opens. Reduce-only exits remain.
- [x] Ed25519-signed Perpl order submission; demo mode without credentials. Live submission pending a funded, forwarding-enabled account.
- [ ] Demonstrate Perpl social trading with actual onchain activity; record its ≤2-minute API-bounty demo.
- [x] Connect actual eth_call quote simulation, integer slippage and explicit Privy review UI.
- [ ] Verify successful quotes and wallet approval in funded/liquid conditions; separate fee breakdown remains unavailable.
- [x] Add X trade entry points with source-post attribution.
- [ ] Execute only after Privy wallet approval.
- [x] Index Kuru V2 `SpotSwap`, AccountCore `Deposit`/`Withdrawal` and `AccountRegistered` with Envio (from block 70280000; event IDs are chain:block:logIndex; reorg rollback on). Swaps are taker-level fills; resting-order lifecycle (open/partial/cancelled) is not indexed because the app only places swaps.
- [x] Populate portfolio/activity from indexed fills with freshness against the chain head (`GET /api/me/activity`). Source posts are linked after the receipt is verified as the bound wallet's successful swap (`POST /api/trades/record`); the post ID stays user-supplied.
- [ ] Verify a live fill end to end once Kuru test USDC is available; optional watchlist sync remains.
- [ ] Test rejected signatures, expired quotes, wrong chain, insufficient funds and unavailable liquidity.

Exit: X → review → approval → Kuru fill → dashboard with actual amounts.

## Phase 4: Calls, reputation and Nansen

- [x] Creator-registered calls instead of X scraping: post authorship verified through X's public oEmbed (no API key), registration within 24h of posting, immutable terms. Nansen key configured (100-credit plan).
- [x] Store sourced calls with stable creator binding, asset, direction, horizon, entry observation and post text (`POST /api/calls`).
- [x] Publish deterministic evaluation rules, price sources and methodology version (`/methodology`, directional-return-v1). Binance 1m spot for BTC/ETH/SOL, Nansen 1m OHLCV for WMON on Monad mainnet; integer prices only.
- [x] Show sample size, coverage, open calls and hypothetical outcomes separately from wallet returns (`GET /api/creators/:handle/calls`, creator record and studio). Expired calls resolve lazily on read, at most four per request.
- [ ] Verify a live registration from the bound account and a resolved outcome.
- [x] Store extracted calls (`post_signals`) with handle, asset symbol, direction, instrument, horizon, text hash and methodology version. Stable-ID linkage and asset addresses remain.
- [x] Nansen DEX-trade consistency check for the bound wallet with timestamps and coverage notes, cached 15 minutes; unavailable (never invented) without a key.
- [ ] Show a live Nansen wallet finding for a creator whose bound wallet trades on Monad mainnet (the demo wallet has no mainnet history).
- [x] Connect call ledgers, reputation counts and extension drawers. Scores remain pending evaluation.

Exit: each scored call is traceable to its source and inputs; Nansen adds a useful real insight.

## Phase 4B: Hourly CRE settlement

- [x] CRE supports Monad testnet (`monad-testnet`, selector 2183018362218727504); simulation forwarder `0xB9F79d86…` and production KeystoneForwarder `0xF8344CFd…`. CLI login verified; workflow deployment (DON) access not yet confirmed.
- [x] Add integer expiry-price evaluator with missing-data and timestamp checks; the workflow fetches Binance 1m opens with per-node fetch and median consensus.
- [x] Register opt-in calls with immutable expiry, price source, evaluation rules and bounded bond/reward amounts (`/creator/calls` → "Bond this call"; exact-amount approval, terms hash of the registered call).
- [x] Implement a separate call-bond/reward contract (`CallSettlement`); refundable CreatorStake deposits stay separate.
- [x] Fund rewards and reserve them at registration; lock each call's bond until settlement or the three-day timeout refund.
- [x] Build an hourly CRE trigger that scans expired unsettled calls in bounded batches at a finalized block.
- [x] Retrieve historical prices at window start and expiry; the contract checks timestamps against a 10-minute tolerance.
- [x] Submit signed settlement reports through the CRE forwarder; optional workflow ID/owner check in `onReport`.
- [x] Enforce single settlement, fixed payout limits and timeout refunds in the contract.
- [x] Foundry-test rewards, losses, ties, duplicate/unauthorized reports, missing prices and accounting conservation (16 tests).
- [x] Simulate CRE end to end: `services/cre/scripts/fork-e2e.sh` (fork; success and slash paths) and a real testnet call on `0x260264E7…95DF`.
- [x] Index CallSettlement events with Envio and show bond state in the public ledger. The hosted indexer config is on `origin/envio`. The extension does not show settlement evidence yet; the owner's bond panel also reads the contract directly.
- [ ] Deploy the workflow to the DON and switch the contract to the production forwarder.

Exit: an expired bonded call produces one verified settlement, paying its reserved reward or deducting only its agreed call bond. Missing prices never trigger a slash. Production activation remains pending until network support and deployment access are verified.

## Phase 5: MCP

- [x] Implement MCP transport, schemas and connection instructions: stateless Streamable HTTP at `/api/mcp` (SDK 1.30.1), setup on `/integrations`.
- [x] Public tools `get_creator`, `get_stake_status`, `list_calls`, `get_markets`, `quote_trade`, `classify_post`; signed-in `get_portfolio` via the user's Privy bearer token.
- [x] `prepare_trade` returns one unsigned Kuru step from the shared `prepareSpot` service; nothing signs or submits.
- [x] Verified with the SDK's Streamable HTTP client: 8 tools listed, live public results, and signed-in tools refused without a session.

## Phase 6: Deployment and submission

- [x] Deploy web/API to Vercel: https://xtradingtoday.vercel.app (project `xtradingtoday`, root `apps/web`, Node 22, functions in `bom1` next to RDS, auto-deploy from `main`). Server secrets are sensitive Vercel env vars; the RDS CA goes in `DATABASE_CA_PEM`.
- [x] RDS accepts 5432 from anywhere (rule `sgr-05bfbb69a0f7f59a4`, added outside CloudFormation) so Vercel can connect; TLS verify-full and the restricted `cmb_app` role still apply. Revoke the rule after the hackathon.
- [x] Indexer on Envio Hosted Service (project `tradepost`, Development plan, root `services/indexer`, deploys on pushes to the `envio` branch). Vercel `ENVIO_GRAPHQL_URL` is the per-deployment endpoint (`https://indexer.dev.hyperindex.xyz/371a97c/v1/graphql`); a static production endpoint needs a paid plan, so update the variable after any indexer redeploy. Queries are cached 15s to stay under the 100/minute plan limit.
- [x] Package the extension for the production origin and serve it at `/downloads/no-more-bluff-extension.zip` (`pnpm --filter @call-my-bluff/extension package`).
- [x] Production URL is https://xtradingnow.xyz (Vercel nameservers); `www`, `xtradingtoday.vercel.app`, `tradepostapp.vercel.app` and `nomorebluff.vercel.app` 308-redirect there.
- [x] Privy allowed origins include `https://xtradingnow.xyz`, the redirected Vercel URLs and `http://localhost:3000`; production sign-in and server identity verified.
- [ ] Test restart recovery, stale data, transaction failures and account isolation.
- [ ] Record the complete onboarding → stake → X evidence → trade → confirmed-fill demo.
- [ ] Demonstrate Nansen evidence and MCP; prepare sponsor evidence and submission video.

Commit verified features separately and update this checklist as they land.

## Post accountability follow-up

- [x] Restore profile-header creator evidence while retaining call-only UI on feed posts.
- [x] Registered-call tables retain archived text/timestamps and offer on-demand public post availability checks. A missing public embed is not a confirmed deletion.
- [x] Review Kollateral source and record adaptations in [reference review](kollateral-reference-review.md); no source imported.
- [ ] Archive extension-detected post text as append-only versions with capture provenance.
- [ ] Persist availability observations and run resumable scheduled checks with provider backoff.
- [ ] Add evidence timeline, edit/missing-post filters and evaluated-call performance breakdowns.

## Expanded creator views and free following observations

- [x] Click-to-expand registered ongoing calls and bound-wallet Kuru swaps in the profile card and creator dashboard; separate expired unresolved calls and unavailable creator Perpl positions.
- [x] Opt-in, browser-only observed-follow sync from X profile headers and the signed-in viewer's following list; dashboard polls local extension observations every 15 seconds.
- [x] Keep manual handles separate; show partial coverage and capture times, disable/clear control, no paid X following API.
- [x] Reload extension 0.4.0 and validate profile expansion, real-X header/list selectors and the production app bridge. On 12 October, 25 observed follows appeared in Watchlist after opt-in.
- [ ] Validate live account switching and observed unfollows; storage isolation/removal are covered by automated tests.
- [ ] Creator-owned Perpl account mapping and actual open-position reads.

## Images, address references and post actions

- [x] Capture original-post X photo metadata; exclude avatars and quoted-post photos.
- [x] Show images, full address references and View post in extension drawers and expanded creator dashboards.
- [x] Add separate buy/sell review links for configured Kuru spot markets and long/short links for configured Perpl markets; unknown token/network routes stay unavailable.
- [x] Add optional browser OCR with unverified text and address candidates; no paid image API or automatic trade terms.
- [x] Verify dashboard media, address-only classification, original-post links and browser OCR on a real X attachment.
- [x] Verify extension 0.5.0 after Chrome reload: a real Apex Calls address-only post showed its original image, full address, View post and unavailable trade buttons in the X drawer; the same post appeared in the production dashboard on 12 October 2026.
- [ ] Extract explicit target/stop/timeframe from observed calls and evaluate historical price paths; publish the default observation-window policy for calls without a deadline.
- [ ] Add confirmed token/network mappings for address-bearing posts. Solana execution is outside the current Monad MVP.
