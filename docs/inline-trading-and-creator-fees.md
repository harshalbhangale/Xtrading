# Inline X trading and creator fees

Research date: 13 October 2026. This is a proposed change, not a record of shipped functionality.

## Reference reviewed

Scannty/eth-blinks, default branch `blinks-v2`, commit `2abdf595442142971867696921782e6c3f50be10`. Reviewed the recursive repository inventory and the main extension, wallet bridge, background service, verification frontend/backend, Uniswap and Intercepta adapters, identity documentation and landing-page layout. Vendored SDK binaries and icon assets were not independently audited. Other branches exist; this review targets the current default implementation.

The extension augments X's existing cashtag cards, adds Buy, and expands a swap form beneath the selected card. Shadow DOM isolates styling; computed X theme variables match the surrounding tweet. A mutation observer discovers cards after navigation and scrolling. Quotes debounce input and discard stale responses. Transactions use the browser wallet through a page-world bridge; provider keys remain in an Express backend.

It uses Uniswap Trading API integrator fees: 50 bps of gross output on buys goes to a registered creator. World ID establishes action-scoped human uniqueness. The registration endpoint binds the proof to a submitted handle and wallet but does not itself authenticate X ownership or prove wallet control. It stores records in a local JSON file keyed by handle. We should retain our stable-X-ID, server-verified Privy session and nonce wallet proof instead.

GitHub reports no license and the reviewed tree contains no project license file. Reimplement the layout and interaction patterns in our own code; do not copy project source or bundled assets without compatible permission. No reference source was added to the application during this research.

## Proposed product

A supported ticker/address produces one compact token card beneath the post: asset, price, 24h change, sourced sparkline, Buy and Sell. Clicking opens a form in that same tweet, replacing the trade sidebar. The form shows explicit Testnet/Mainnet, connected wallet, pay/receive amounts, balance, minimum output, slippage, estimated gas, Kuru venue and any creator fee. Unsupported chains/assets get an honest unavailable state.

Creator analytics expand separately: authenticated X identity, supported call outcomes with sample size and time window, deleted/unavailable-post evidence, actual linked-wallet trading activity and confirmed creator earnings. Public predictions are not wallet positions. Missing historical candles do not become invented charts or claims of target hits.

Creator onboarding becomes X login, wallet ownership proof and opt-in payout registration. Staking/bonded calls remain optional and separate; neither gates ordinary swaps nor proves profitability. Existing contracts and balances stay intact.

## Kuru fee paths

### Mainnet: prefer Kuru Flow

Official quote API documents `referrerAddress` and `referrerFeeBps`. A read-only live check obtained a JWT and successfully requested 1 mainnet USDC into native MON with 50 bps and a test recipient. Response fields were `type`, `status`, `output`, `minOut`, `transaction` and `gasPrices`; transaction fields were `calldata`, `value` and `to`. The calldata contained the requested recipient. No approval, signature or transaction was submitted. This demonstrates quote construction, not successful payment or settlement.

The application now has a separate opt-in Flow adapter alongside ordinary direct order-book trading. It constructs a single configured Kuru order-book route locally, rather than accepting opaque API calldata or routing through other venues. It pins chain, token addresses, spender, recipient, fee and net minimum output; simulates at a pinned block; checks router configuration and gas; and uses exact approvals. Receipt decoding confirms actual payment. Three Foundry mainnet fork tests verified gross/output-fee rounding, buyer net receipt, exact allowance consumption and failure with no payout. No real wallet fee-paying trade has been completed.

Resolve payout wallet server-side from authenticated creator registration and immutable X user ID. Review pins registration version, browser-supplied tweet ID, chain, fee rate and quote expiry. Persisting authenticated source attribution for mainnet fees remains pending. Do not trust a payout wallet supplied by the tweet or content script. Creator-unregistered buys charge no creator fee; no platform fallback recipient. Original-post capture distinguishes quoted posts, and the adapter rejects self-referral for the known bound wallet. Source author attribution is still unverified; it must not be described as authenticated fee provenance. These measures do not prove unique humanity or detect all related wallets.

The generic Kuru referral-code program is different from Flow transaction fees and should not be used as a substitute.

### Testnet V2: builder fees

Our swap ABI already includes `BuilderConfig`; current requests use zero address and zero fee. AccountCore supports `approveBuilder(builder, maxFeePps, expiry)` and revocation. Fee denominator is 10,000,000, so 0.5% is `feePps=50000`, not 50. On buys the fee comes from base output; on sells from quote proceeds. Positive fees credit the builder's root free balance and emit `BuilderFeeAccrued`; the creator then withdraws through AccountCore. Do not describe this as a direct wallet payment in the swap transaction.

Use an explicitly approved creator builder address with a capped rate and finite expiry. Test rounding, partial fills, failed swaps, account registration, withdrawal capacity and revocation with Foundry. Mainnet Flow and testnet V2 require distinct adapters and UI descriptions.

## Verification without World ID

Use the existing Privy X OAuth and replay-protected wallet binding for the MVP. Label this “X account linked / payout wallet verified,” never “verified human.” Passkey/MFA can protect account access but does not establish one-person-one-account uniqueness. Avoid claiming Sybil resistance from a wallet, X login or stake.

Cleanverse is an optional investigation if stronger credentials become essential. The supplied bounty specifically requires CVI-gated CVA movement; ordinary creator payout registration is insufficient. Its current credential availability, pricing, privacy and uniqueness properties were not established by this review. Do not add it merely for a badge. Current hackathon listing did not expose readable bounty content through the fetched page, so the supplied criteria are the available basis for this assessment.

## Delivery order

1. Implement original compact ticker cards and in-tweet Buy/Sell expansion using existing market and quote endpoints. Validate scrolling, reposts/quotes, X rerenders, theme changes, keyboard access and no duplicate cards.
2. Complete a zero-creator-fee Kuru swap and reconcile actual fill first.
3. Add opt-in creator payout registration; retain identity and analytics but remove required staking from this flow.
4. Implement and fork-test Flow referrer fees; testnet V2 builder fees independently. Show exact fee and net minimum output before wallet review.
5. Add Envio fee/fill projections and tweet attribution with idempotency, reorg handling and freshness. Dashboard earnings require confirmed payment evidence.
6. Add sourced Nansen context and creator analytics without calling analytics a safety guarantee. CRE remains useful for optional bonded calls and settlement; it is not necessary for routing creator fees.
7. Run a small approved mainnet buy demonstrating buyer receipt, creator payment, source post and indexed dashboard evidence. Keep Perpl expansion after spot succeeds.

Required demo: supported X post → inline form → disclosed fee → wallet approval → confirmed fill → creator earnings evidence. No claims of a completed fee-paying swap until the receipt is verified.

## Sources

- Reference: https://github.com/Scannty/eth-blinks/tree/2abdf595442142971867696921782e6c3f50be10
- Reference fee registry: https://github.com/Scannty/eth-blinks/blob/2abdf595442142971867696921782e6c3f50be10/backend/kickbacks.js
- Mainnet Flow: https://docs.kuru.io/kuru-flow/flow-overview
- Flow quote schema: https://docs.kuru.io/api-reference/calculate-best-path-quote
- Flow auth: https://docs.kuru.io/api-reference/generate-jwt-token
- Separate referral program: https://docs.kuru.io/product/referrals
- V2 fees: https://kuru-testnet-docs.mintlify.site/matching-engine/fees
- V2 AccountCore: https://kuru-testnet-docs.mintlify.site/contracts/account-core
- Privy OAuth: https://docs.privy.io/authentication/user-authentication/login-methods/oauth
