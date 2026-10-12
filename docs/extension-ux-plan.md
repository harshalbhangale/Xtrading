# Xtrading extension: data and UX plan

12 October 2026. Scope: mainnet spot first, one confirmed Kuru swap before perpetual trading. This is an analysis/design proposal; it does not enable mainnet, execute trades or prove new integrations.

## Product decision

Keep X readable. An ordinary post gets no trading panel. A supported token or actionable trading call gets a compact row: token, network, Details, Swap. The creator badge may appear on bound accounts independently of whether a post contains a call. A profile contains a compact creator summary with expansion, not a long automatic dossier.

Three questions determine the layout:

1. What asset is this, and can I trade the exact asset on this network?
2. What evidence do we have about the creator and token?
3. What will this swap cost and receive, and where do I approve it?

## Current implementation audit

- `apps/extension/src/content.ts`: call/address classification, canonical post link, separate buy/sell review links, visibility gate and recycled-post response protection exist. The row currently repeats direction, instrument, venue, extractor and actions. Reduce it to one summary and two actions.
- `apps/extension/src/drawer.ts`: post summary, images, creator counts, Nansen wallet verdict and trade section exist. Repeated trade links and long explanatory text compete with the primary action. Make Swap the primary section and evidence expandable.
- `apps/extension/src/styles.ts`: shadow roots isolate CSS, but lavender backgrounds and purple panels differ from X's black/neutral surfaces. Follow X's actual display theme; OS color preference alone is insufficient. The new badge in merged PR #1 is lime/white; keep that accent restrained.
- `apps/extension/src/overview.ts`: captured posts, registered predictions and indexed swaps are separated in data, but the expanded presentation is long. Use distinct tabs and show three items with a full-record link.
- `apps/extension/src/creator-badge.ts` on remote main: fix unbound-profile insertion/removal loops, stale mounted indicators, keyboard activation and unsupported on-chain identity wording before adding more requests.
- `apps/web/lib/markets.ts`, `spot-trade.ts` and `packages/integrations/src/kuru.ts`: verified snapshots and unsigned transaction steps exist for testnet only. Mainnet requires a separate verified adapter and market registry; changing chain ID alone is insufficient.
- `packages/integrations/src/nansen.ts`: current client permits holders, wallet DEX trades and transactions. Token price/change/volume/netflow panels require new explicit endpoint adapters and runtime schemas. They are not present just because an API key exists.
- Mainnet token-address verification is essential. Cashtags, OCR candidates and Solana-shaped addresses cannot select an executable market by themselves.

## Screen layout

### Feed row

Example structure: `MON · Monad   Details   Swap`. Token/network appear only after exact mapping. Before mapping: `Token reference · network unverified   View details`; no executable Swap action. Keep the original X action row intact. No unsolicited popups or automatic wallet prompts.

### Click-open panel

Desktop width 360–400px, right-side panel; on narrow screens a full-width sheet. Black/dim/light neutral theme aligned with X, 1px borders, 12–16px spacing, 14px body text, 12px metadata. Use the supplied logo, minimal lime accent, green/red only for meaningful changes. Reduced motion, visible keyboard focus and large enough hit areas. Opening must not obscure the post text without an easy close; restore focus on close. Use a real link for creator navigation and focus containment only if the panel is modal.

Order:

1. Token identity: symbol/name, `Monad mainnet`, verified full address on expansion, market and original-post link.
2. Market snapshot: reference price and 24h change if supported; below, one sourced token insight. Do not load a dozen metrics by default.
3. Swap ticket: Buy/Sell, pay/receive, available balance, amount, quote output and fee/minimum-output review.
4. Primary action: `Review swap in wallet` via the app. Confirmation remains on the trusted app origin; this avoids adding a general wallet bridge to X.
5. Creator summary: recorded binding, stake with its own network, `No evaluated calls yet` or properly supported results. Expand for evidence.

In the first iteration, inline amount entry produces a read-only quote; it hands the exact reviewed token pair, chain, side and amount to the app. The app re-quotes and simulates before signing. Quote changes are shown for review, not silently accepted. Embedded signing on X is a later architecture decision, not a dependency for the first real swap.

### Creator expansion

Separate `Calls`, `Wallet activity`, `Evidence` tabs. Label predictions as calls, not open positions. Actual wallet swaps are confirmed activity, not necessarily a currently open holding. A linked Perpl account is required before displaying actual open perp positions.

## Minimal data model and stats

| UI item | Source / calculation | Display rule |
|---|---|---|
| Recorded identity | Server-verified stable-X-ID/wallet binding | No profitable-trader implication; handle lookup is not fresh X ownership proof |
| Stake | RPC plus fresh matching Envio projection | Show token, amount, network and withdrawal status; testnet mUSDC must stay explicitly testnet |
| Evaluated calls | Versioned registered-call ledger | Denominator excludes open, unresolved and unsupported calls; show evaluation count and coverage |
| Call hit rate | Successful / evaluated under published rules | Only after defined minimum sample (proposal: 10); always show numerator/denominator; ties handled explicitly; no score without outcomes |
| Open calls | Registered, unexpired predictions | Do not call these actual trades |
| Wallet activity | Bound-wallet confirmed indexed events | Actual fills, amounts and chain; separate observed call returns from wallet returns |
| Reference price/change | Supported Nansen token endpoint or verified market snapshot | Identify venue vs market reference, denomination, period and observation timestamp |
| Quote | Verified Kuru market simulation | Exact token addresses, chain, input/output, minimum receive, fees, deadline and quote age; new quote after relevant inputs change |
| Nansen insight | Supported token/wallet endpoint | One factual observation with time window/source; no claimed scam rating or buy recommendation |

Hide optional unsupported metrics instead of showing many empty tiles. Required missing information such as token identity, quote or balance shows an explicit unavailable state. Never render a failed fetch as 0. Every dataset carries chain/address identity, source, observation time, retrieval time, coverage and freshness; retrieval time is not the timestamp of the underlying market observation.

The preview uses missing-data placeholders only. It is not a screenshot of live data. Provider details and sources are in `extension-data-research.md`.

Interactive preview: `extension-design-preview.html`; captured desktop view: `extension-design-preview.png`. Buy/Sell switches the input/output labels, creator details expand into separate call/activity/source views, and light/dark modes are available. No provider requests or signatures occur. Browser checks covered these controls and a narrow-screen sheet; the actual extension still requires implementation and real-X validation.

## Requests, accuracy and costs

- First screen: cached creator binding lookup and exact token/market resolution only. Fetch token analytics and quotes on expansion, not on every visible post.
- Deduplicate by chain/address and stable creator ID; use bounded server caches. Rate-limited or exhausted Nansen credits show unavailable analytics while trading can proceed if independent Kuru execution checks pass.
- Suggested initial UI refresh policy: quote debounce 400ms, invalidate immediately on amount/pair/side/chain/account change, refresh quote about every 10–15s while active (provider limits permitting), require fresh simulation at approval. Server-enforced transaction deadlines remain authoritative.
- Recheck mounted identity/stake about every minute when visible; pause optional polling when hidden; dispose observers and timers on navigation. Token analytics may use a longer cache, with its actual age visible.
- Abort or reject stale replies after post recycling, handle changes, wallet/network changes or drawer closure. Quotes should use a request generation ID as well as explicit trade identity.
- A Nansen wallet observation is not proof of deception; selling after a bullish post may have many explanations. Show the observed transaction and timing rather than a moral verdict.
- Wallet history may be empty for a new wallet even on mainnet. Token-level insights do not depend on the buyer having trade history.

## Spot-first implementation phases

### 1. Stabilize and simplify

Fix the four badge review findings; add observer-stabilization and expiry tests. Rebuild the compact row, theme-aware panel and accessible creator expansion. Remove extractor/model details from the default view and retain them under evidence. Use source-aware empty states.

### 2. Prepare a real mainnet Kuru swap

Use latest main before implementation, preserving the local documentation edit. Add explicit chain 143 configuration separate from testnet 10143, verify official contracts/ABIs/token decimals and live orderbook liquidity. Confirm routing actually uses Kuru's orderbook for the sponsor demonstration; Kuru branding or an aggregator quote alone is not proof. Verify a small input quote, token balances, exact allowances, gas, minimum receive, deadline and transaction simulation. Keep testnet stake separate.

### 3. Execute and prove the first swap

Present the exact amount and wallet-approved transaction(s). Confirm success from receipt and decoded fill events, then index actual amounts and associate the original source post. Support cancellation/rejection, changed quote, insufficient gas/funds, missing liquidity, reverted or dropped transaction and stale/reorged projections. A submitted hash is not a fill. Show `Submitted`, then `Confirmed`, then `Indexed` separately. If reorged, remove confirmation and refresh state.

Exit evidence: original X post → exact mainnet token → sourced Nansen context or honest missing state → fresh Kuru quote → reviewed signature(s) → successful receipt with fill amounts → mainnet explorer → matching dashboard/indexer activity. Nansen coverage must not be fabricated to complete this story.

### 4. Add minimal Nansen token analysis

Implement explicit validated endpoint adapters for supported token stats. One or two high-signal observations, not a composite trust score. Demonstrate a real dated result and a missing-history state. This can happen alongside quote preparation but must not block validating the core swap.

### 5. Perpetuals after the spot exit criterion

Reuse the shell but separate Spot/Perps explicitly. Add leverage, collateral, notional exposure, fees, margin/liquidation information where the venue supplies it, reduce-only close and account identity. Confirm mainnet deployment/API/account funding separately. Do not silently execute a user's order on the team's account. First demonstrate open → fill → position → reduce-only close; then add social/copy features with separate authorization.

## Decisions still needed for execution

Funded mainnet demo wallet, exact supported token pair, small reviewed trade amount, and permission for that particular transaction. These do not block design or read-only integration work. Never reuse mock stake tokens or testnet contracts as mainnet assets.

## References

- [Kuru official deployment addresses](https://docs.kuru.io/contracts/Contract-addresses)
- [Monad mainnet network information](https://docs.monad.xyz/developer-essentials/network-information)
- [Nansen supported chains](https://docs.nansen.ai/reference/chains)
- [Nansen token information](https://docs.nansen.ai/api/token-god-mode/token-information)
- [Nansen token holders](https://docs.nansen.ai/api/token-god-mode/holders)
- [Kuru consumer trading bounty](https://hackathon.monad.xyz/tracks/build-the-next-consumer-trading-app-on-kuru)
- [PR #1 badge review target](https://github.com/harshalbhangale/nomorebluffonx/pull/1)
