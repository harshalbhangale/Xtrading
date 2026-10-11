# Call My Bluff: product and implementation blueprint

Researched 11 October 2026. This preserves the user's latest direction: verified KOL identity, a locked stake, reputation over available X activity, in-feed spot trading, and a personal trading dashboard. The earlier DON'T BUY THAT / Kill My Wallet proposal is not the selected product.

Approved sponsor selection: **Kuru + Privy + Envio + Nansen** are required MVP integrations. See [SPONSORS.md](../../SPONSORS.md) for completion criteria. Kimi remains optional; Aurora Intents and Chainlink CRE belong to the later phase.

## Product

Call My Bluff brings a creator's evidence and a trading ticket into the same X interaction. A creator links their X account and wallet and locks a nominal $500 stake. Extension users see an explicitly branded badge with identity status, current stake, and a performance summary. They can inspect the evidence and buy or sell supported assets from the post. Their dashboard records their own executed trades and the originating post/creator.

The extension badge is visible to people with the extension installed; it does not change X's native verification. People without the extension can view a shared public creator profile.

## What the references actually contain

- [XSwap showcase](https://ethglobal.com/showcase/xswap-1xtbn): X ticker-card trading, user wallet approval, token/transaction checks, creator attribution. Its extension architecture isolates UI with Shadow DOM, uses an MV3 background worker for backend requests, and bridges to an injected wallet. Its listed execution chains are Base, Ethereum, Arbitrum, Optimism and Unichain; this is not an existing Monad adapter.
- [XSwap source](https://github.com/Scannty/eth-blinks/tree/blinks-v2): examined `extension/manifest.json`, `bridge.js`, `background.js` and the trading flow in `x-ticker-swap.js`. Backend keys remain server-side. Do not carry over broad all-site host permissions or unrestricted page-message wallet requests without redesign. Keep signing in the wallet/app's explicit transaction review.
- [KOLlateral source](https://github.com/RomarioKavin1/kollateral): inspected README, data schema, dossier building, score calculations, wallet comparisons, extension documentation and scripts inventory. It already has reputation on X, trading, and portfolio analytics. Reputation+trading alone is substantial overlap.
- [KOLlateral scoring](https://github.com/RomarioKavin1/kollateral/blob/main/app/lib/score.ts): fixed $1,000 notional per call and simple directional price returns. These are hypothetical call returns, not the follower's real execution P&L. Its `said-did.ts` matches linked-wallet sells within a time window after bullish calls; that observation alone cannot establish intent or all-wallet conduct.
- [KOLlateral feature notes](https://github.com/RomarioKavin1/kollateral/blob/main/docs/frontend-features.md): claim/stake is scoped as visual/flow states with no escrow settlement. This establishes documented scope, not a runtime audit of every feature.
- [KOLlateral pipeline README](https://github.com/RomarioKavin1/kollateral/blob/main/app/README.md): X ingestion and confirming deleted posts include human-run steps. Do not assume the reference supplies production access to everyone's complete X history.
- Live browser inspection of [KOLlateral](https://kollateral.vercel.app/) and `/terminal`: light monochrome surfaces, lime accent, small monospace labels, bold headings, thin borders, halftone texture, creator search, feed filters, side panels and compact navigation. During inspection the terminal initially showed loading/zero signals; data functionality and execution were not end-to-end tested. This corrects the previous chat's dark-terminal assumption.

GitHub repository metadata returned `license: null` for both source repositories, and neither inspected tree exposed a LICENSE file. Confirm reuse terms before importing code; an original implementation based on the architecture can proceed. References are not a license grant.

## Stake semantics: separate identity, performance and money

Recommended MVP: a refundable creator stake held in a small ERC-20 escrow contract with a disclosed withdrawal cooldown (proposed seven days). Badge eligibility ends as soon as withdrawal is requested. Display token amount, estimated USD value, and valuation time separately. Use one confirmed Monad stablecoin deployment; verify address, decimals and liquidity before selecting it. A $500 nominal balance is not guaranteed to retain a $500 market value.

No automatic stake forfeiture for being wrong, for an AI score, or for a missing post. The profile deposit demonstrates a locked commitment and creates friction for cycling identities; without forfeiture rules it does not financially penalize bad predictions or insure followers. Explain this plainly.

Later optional feature: allocate part of the stake to a specific structured prediction with asset/address/chain, target, expiry, price source and settlement/invalid-data rules locked before acceptance. That requires a distinct escrow and settlement design. Matched challenges are a later product decision, not silently added to the MVP.

Implementation contract: deposit, top-up, request withdrawal, cancel withdrawal if supported, withdraw after cooldown; emit events used to update badges. Wallet authorization is onchain. X identity mapping comes from backend-verified OAuth plus a signed wallet-binding nonce; the blockchain does not directly verify X ownership. Store a reference/hash onchain and use stable X user IDs offchain so renamed handles do not inherit another user's history. Bind nonces to account, wallet, chain, expiry and purpose, and prevent replay. No account-linking transaction is sent in this research task.

## Reputation

Limit the claim to the indexed public financial calls in a stated window, initially a bounded recent window such as 90 days. Show coverage, total indexed posts, valid scored calls, missing prices and unresolved/ambiguous calls. A zero-history account gets 'insufficient history', not a high rating. Identity verification and deposit status remain separate indicators and never boost investment-performance scores.

Pipeline: obtain available posts using authorized X API access -> resolve a supported token by chain and address -> extract direction/target/time horizon -> preserve provenance and versioned interpretation -> compute outcomes from timestamped prices under published rules -> produce a versioned reputation summary with evidence links. X OAuth for login does not itself provision full-history API access or pricing data. [X supports OAuth PKCE and granular scopes](https://docs.x.com/fundamentals/authentication/oauth-2-0/authorization-code); [X API reads use usage billing](https://docs.x.com/x-api/getting-started/pricing), so access and ingestion budget are early prerequisites.

AI parses and explains; deterministic code calculates. Start with explicit, resolvable calls and clear horizons. Ambiguous posts remain unscored. Backfilled classifications use a published fixed horizon if none is supplied, and this must be labeled as an analysis convention. Historical and newly registered calls are distinguishable.

Show win rate with sample size and confidence, median return, a suitable benchmark under a disclosed comparison method, adverse movement/drawdown, and consistency across time windows. Publish the formula before exposing a single 0-100 composite; test its behavior against small samples, correlated/repeated calls and selective coverage. Avoid giving invented weights authority. An observed sale from a linked wallet is evidence to inspect, not a verdict that the creator lied. Linked-wallet coverage cannot prove the creator has no other wallets.

Handle unavailable/deleted/edited posts under the X data-use rules: do not treat a single failed lookup as proven deletion or promise unrestricted permanent retention. Store lawful provenance, review uncertain classifications, and distinguish edit versions rather than rewriting past results.

## Architecture

```text
X timeline/profile
  -> MV3 content script: branded badge, evidence popover, Buy/Sell ticket
  -> background worker: authenticated requests to our API
  -> backend: identity, reputation, market mapping, quote/order construction
  -> explicit wallet review: approve/deposit/order/sign
  -> Monad: creator stake contract and Kuru trading contracts
  -> chain indexer: stake events, order events, fills, balances
  -> creator profile and personal dashboard

X ingestion worker -> classification -> historical prices -> reputation database
```

Suggested original stack: Next.js/React/TypeScript web app, MV3 extension with locally packaged UI, shared TypeScript schemas, viem for chain reads/encoding, Postgres database, a job worker for ingestion/scoring, and Envio for core Monad contract-event indexing. Wallet SDK integration in extension-hosted surfaces is an early spike; use an extension side panel or app-origin confirmation window if the embedded SDK cannot operate reliably in the X page. Injected external wallets can use a carefully bounded provider bridge. Do not inject privileged SDK tokens into the X page or pretend an embedded wallet is automatically available as `window.ethereum`.

Wallet choice: Privy is selected for X linking and embedded wallet signing of both deposit and Kuru trades, which makes the use beyond authentication concrete. Dynamic and Mera are researched alternatives outside the approved MVP.

Trading adapter: Kuru spot on Monad for MVP. Preserve the XSwap interaction pattern but replace its Uniswap quote/Permit2 assumptions with Kuru market configuration, supported order construction and confirmed settlement. Choose a confirmed liquid supported pair first. A cashtag alone cannot identify a token; use an explicit chain/address market allowlist and show the resolved asset. Spot Buy increases holdings and Sell sells available holdings; neither Sell nor Fade magically opens a short. Add limit orders only after basic quoting/signing/fills work. A limit order placed is not a fill.

Persist trade intent with user, creator and post ID plus intended amount, chain and market; reconcile against onchain transaction/order IDs and actual fills. Never trust a client-supplied transaction hash as proof of execution. Handle rejection, expired quotes, partial fills, cancellations and failure. Attribution identifies where a trade was initiated; it does not prove a creator caused every wallet transaction.

## Screens and demo

1. Creator onboarding: X linking, wallet proof, $500 nominal deposit, stake terms.
2. X extension: identity/stake badge, score and coverage, evidence popover, Buy/Sell.
3. Creator dossier: call history, calculated outcomes, observed linked-wallet activity and stake status.
4. My Portfolio: actual holdings/fills, open orders, fees and realized/unrealized P&L with known cost-basis coverage. Unknown cost basis stays unknown.
5. Creator Dashboard: stake management, indexed calls, attributed trade volume and disclosed rewards only if a real payout mechanism exists.

Do not assume XSwap's Uniswap 0.5% integrator-fee mechanism exists in Kuru. MVP records attributed volume; any creator rewards require a separately verified fee/revenue-sharing path.

Demo sequence: creator signs in and locks a real test/demo stake -> indexed event updates the X badge -> viewer opens score evidence -> viewer reviews and signs a supported Kuru buy -> actual fill appears in portfolio with source post -> viewer sells held tokens -> requesting stake withdrawal removes active-stake eligibility. Testnet actions are explicitly labeled; supported execution network is verified before the demonstration.

## Delivery order and verification

1. Establish X OAuth/API access, wallet SDK account configuration, a supported Kuru execution pair/network, and permitted reference-code use. These decide whether the MVP can run live.
2. Prove a standalone Kuru quote/order/sign/confirmed-fill flow and an independent escrow deposit/withdrawal flow.
3. Combine X linking and wallet proof; implement indexed stake badge status.
4. Build extension injection in real X light/dim/dark themes with SPA transitions, duplicate guards and virtualized-feed cleanup.
5. Build evidence-backed scoring for a small explicit call set, with labeled coverage and deterministic results.
6. Reconcile trade receipts and construct the user/creator dashboards.
7. Complete the required Nansen integration using supported Monad endpoints with sourced, timestamped evidence. Verify API access and market coverage at step 1. Optional AI/agent sponsorship follows the complete MVP.

Necessary checks for money-handling code: contract authorization and withdrawal boundaries, duplicate events/reorg reconciliation, wallet-link replay prevention, token/market resolution, transaction amount/recipient/chain validation, slippage or price-limit enforcement, fill reconciliation and score edge cases. User signatures remain explicit in the initial MVP; automated delegation is a later scope with concrete limits.

The approved integration scope is recorded in `../../SPONSORS.md`. Current portal requirements and prize splits are recorded in `portal-sponsor-expansion.md`; API feasibility and initial research remain in `sponsor-fit.md`.
