# Sponsor-compatible feature expansion

Researched 11 October 2026 against primary implementation sources. These are feasibility recommendations, not completed integrations or prize eligibility guarantees. The parent research separately verifies the signed-in organizer pages. Keep the core product: bonded X identity, transparent KOL evidence, trading from posts, and a personal dashboard.

## Priorities

| Feature | Priority | Product value |
|---|---|---|
| Kimi evidence extraction | Core helper | Converts captured posts into reviewable call records. |
| Aurora funding into Monad | Best optional addition | Lets users fund the bond/trading wallet from another chain. |
| CRE call-expiry evaluator | Best optional addition | Makes a fixed evaluation procedure reproducible. |
| Mera private preferences vault | Small optional addition | Protects watchlists, user notes and risk preferences. |
| Perpl portfolio risk product | Larger extension | Adds authenticated positions, funding, margin and liquidation monitoring. |
| Perpl capped copy trading | Later/pivot in complexity | Requires trading authorization, reliable automation and new risk controls. |
| Mera entire account layer | Alternative stack | Replaces embedded-wallet architecture; independent web flow must work. |

## Aurora: fund the wallet before trading

[Intents Deposits](https://docs.intents.aurora.dev/) supports cross-chain funding. Its [supported chains](https://docs.intents.aurora.dev/intents-deposits/supported-chains.md) lists Monad as source and destination. Offer “Fund from another chain,” fix the destination to the authenticated user's Monad wallet, and show deposit, settlement, failure and refund states. Then re-quote Kuru and ask the user to approve the spot trade. Verify actual destination token availability, limits, liquidity, fees and the API key before promising a particular source/token pair.

[Intents Connect recipes](https://docs.intents.aurora.dev/intents-connect/intents-connect-sdk/typescript-sdk/recipes-and-fees.md) support a `bridge-in` followed by EVM calls executed by an intermediary account. A deposit-and-trade recipe is technically plausible, but that intermediary is not automatically the user's existing Kuru margin account. Prove approval, execution ownership and final recipient with a small test. Amount placeholders must be passed through as specified, not treated as ordinary numbers.

[Execution lifecycle](https://docs.intents.aurora.dev/intents-connect/deep-dive/execution-lifecycle.md) explicitly says destination-operation failures can leave funds at the intermediary, requiring client recovery. Do not present this as an automatically atomic cross-chain trade. Wallet funding followed by approved trading is the smaller, clearer demo.

## CRE: evaluate structured calls, preserve source limits

[CRE getting-started](https://docs.chain.link/cre/getting-started/overview) demonstrates cron, HTTP fetch, contract reads and computed reports/writes. Store a call's asset address, direction, entry timestamp, expiry, comparator, price-source policy and formula version before evaluation. A cron workflow retrieves the fixed market observation, applies deterministic arithmetic and emits a report with the outcome and provenance. Ambiguous text, missing prices and unavailable markets become “unresolved,” rather than model-guessed wins/losses.

CRE orchestrates computation and consensus; it cannot prove that a captured X post is authentic or complete, or make a poor external price source accurate. Keep Kimi extraction outside final arithmetic and retain source post IDs, capture timestamps and hashes. Separate call performance from executed wallet PnL.

[Deployment docs](https://docs.chain.link/cre/guides/operations/deploying-workflows) require deploy access approval; CLI simulation remains possible. The parent verified the bounty accepts successful simulation or deployment, so a working simulation is a credible bounded deliverable. Native CRE Monad write support was not confirmed during this research; verify capability configuration/forwarders before designing direct Monad writes. A simulated/report-only workflow is not an onchain deployed oracle.

## Perpl: start with a full risk dashboard

[Official API documentation](https://github.com/PerplFoundation/api-docs) documents REST history and WebSocket live state, including positions, fills, wallet statistics and portfolio data. Build portfolio equity, exposure, margin/available collateral, funding impact and liquidation-distance views. Compute alerts from the documented market/account fields with data timestamps; reconnect and reconcile snapshots after disconnects. The parent verified the risk bounty wants protocol and user-wallet coverage, so a decorative small Perpl tab is insufficient.

[Integration docs](https://github.com/PerplFoundation/api-docs/blob/main/integrations.md) distinguish `read` and `trade` key scopes; neither allows withdrawals/transfers-out. Third-party enrollment requires an Origin whitelisted by Perpl. It uses an Ed25519 key plus a wallet signature, not ordinary bearer-token auth. This whitelist is an external readiness dependency. User-created keys offer another documented onboarding path.

Copy trading is possible as app automation, but auth alone is insufficient: users need funded exchange accounts and onchain order-forwarding authorization. Mirror actual KOL fills, not AI interpretations of tweets. Enforce max notional, leverage, market allowlists, stale-signal expiry, daily budget and a pause switch. These limits are application controls unless proven enforceable by the underlying authorization system; “trade-only” still permits substantial trading losses. Deduplicate fills and reconcile partial executions. This is a larger scope than Kuru spot trading.

## Kimi: an evidence parser, not the reputation judge

[Kimi API overview](https://www.kimi.ai/help/kimi-api/api-overview) confirms Chat Completions, text/multimodal interpretation and custom tool calls; external resources are not accessed by default. Feed only obtained evidence, require asset/direction/target/time horizon plus exact supporting excerpts and “unknown” fields, validate the schema, and retain extraction/model versions. Do not invent missing horizons or token addresses from a ticker alone.

Show an evidence preview and allow corrections; final performance calculation stays deterministic. Avoid automatic trades or slashing triggered by generated text. API credentials and an authorized working model are required. The parent verified this bounty also needs a published article, so the API demo alone is not the complete submission.

## Mera: private preferences are a natural non-wallet use

[Secret vaults](https://mera.category.xyz/concepts/secret-vaults/) encrypt arbitrary bytes with AES-256-GCM using passkey PRF-derived material and fresh salts. Encode private watchlists, KOL notes, preferences and AI memory as versioned JSON, encrypt locally, sync only vault ciphertext, and demonstrate recovery on another device. This is encryption/authenticated integrity, not a public signature proving authorship.

[Security model](https://mera.category.xyz/concepts/security-model/) states derived software keys exist in app memory, domain migration affects recovery, and vault backup/sync is the application's responsibility. [Authenticator support](https://mera.category.xyz/authenticator-support/) requires PRF; a passkey saved in desktop Chrome's local profile can fail. Test the actual demo browser/provider and include an export/recovery design.

For the separate Mera account-layer bounty, the parent verified a complete web onboarding/reconstruction flow must work without a wallet-extension installation. An optional X overlay can sit alongside that standalone flow. Do not count a private-preferences vault as implementing Mera for every trading-account operation.
