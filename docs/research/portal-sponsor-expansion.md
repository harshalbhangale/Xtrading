# Call My Bluff: directly verified sponsor requirements and additions

Inspected 11 October 2026 through the user's authenticated in-app browser. Read all four track detail pages and all 21 bounty detail pages linked from [Tracks & Bounties](https://hackathon.monad.xyz/tracks). This supersedes the initial user-paste-only bounty assessment in `sponsor-fit.md`. No project was created, no bounty was selected, and no transaction or submission was performed.

Deadline shown on the detail pages: **14 October 2026, 09:29 GMT+5:30**. Each primary track awards $30,000 split among three winners at $10,000 each. The portal permits one primary track and multiple sponsor bounties; track-specific bounties must match it. Only the community bounty explicitly confirmed additional stacking in the pages read; do not present a summed prize target as guaranteed eligibility or winnings.

## Main-track choice and judging implications

Choose [Onchain Finance & Trading](https://hackathon.monad.xyz/tracks/onchain-finance) for the user's intended X trading product. Technical execution is 20%, design/craft 20%, originality 15%, founder/market readiness 25%, and traction/path forward 20%. Real execution, a named first trader segment, user testing, and a credible distribution strategy matter as much as integration count. Embedded trading and interfaces exposing real-time execution are explicitly suggested. This is a better match than Consumer Products, whose detailed description distinguishes consumer finance from trader-oriented products.

[Consumer Products & Payments](https://hackathon.monad.xyz/tracks/consumer-payments) is viable only if the product changes focus toward non-trader financial experiences. [Social, Attention & Culture](https://hackathon.monad.xyz/tracks/social-culture) requires community/social participation to be central. [Trust, Identity & AI Infrastructure](https://hackathon.monad.xyz/tracks/trust-identity-ai) seeks a composable primitive other developers use rather than just a consumer app. Adding an LLM to Call My Bluff does not itself justify that track.

## Natural additions, in priority order

### 1. Evidence-backed creator analysis: Nansen + Kimi

Attach an evidence popover to the existing KOL score and each resolvable financial call. It shows observed linked-wallet activity, token concentration, data timestamps/coverage, the interpreted claim and supporting source references. Kimi extracts structured claims and generates a concise explanation; deterministic code calculates the results. Never allow a post to control agent tool permissions, arbitrary signing, or the formula.

Nansen data must meaningfully drive the product, not just price display. Kimi must power a core feature and requires a published article explaining its use. Inference does not prove the source claim is true, and neither sponsor supplies verifiable enclave execution by default. Validate actual endpoint/market coverage before calling an observation complete.

### 2. Fund the app from another chain: Aurora Intents

Allow a user to fund their Monad balance from an asset on a supported chain, then use it for a Kuru trade or the creator stake. This solves a direct acquisition barrier for KOL audiences whose assets are elsewhere.

Eligibility requires an actual live cross-chain flow, using at least one Aurora Intents product. Contract execution after deposits is an advanced version, not an assumed atomic bridge+trade guarantee. Correct destination ownership, refunds, minimum received amount, quotes, and cancellation/failure handling are mandatory. Prefer funding the user's Monad wallet first when account ownership makes a composed deposit-and-trade difficult.

### 3. Scheduled outcome reports: Chainlink CRE

For explicit calls with fixed expiry and price rules, a CRE workflow reads external pricing, checks the registered call and publishes a deterministic outcome report to a contract or application flow. Record the price source, time, rule version and report reference. A missing/stale price leaves the call unresolved.

The bounty requires linking a blockchain to an external system/API/data/LLM/agent and demonstrating either successful CRE CLI simulation or deployment. A clearly labeled CLI simulation is sufficient for that deliverable; production deployment is not required. CRE orchestration does not make an arbitrary API trustworthy or permit subjective stake slashing. Native Monad EVM client write support must be verified before choosing an onchain-write design.

### 4. A KOL-aware Kuru trading plugin: MetaMask Agent Wallet

Expose creator evidence and supported Kuru trade preparation through an installable plugin. An agent can inspect a creator, resolve an asset, obtain an order and submit only through Agent Wallet. A follow/copy policy is optional and must enforce explicit size, asset, expiry and outflow limits.

All plugin transactions must pass through Agent Wallet signing, policy and MFA; no independent key or token handling. Requires `skills/<name>/SKILL.md`, README, an installable plugin and a real-flow demo up to five minutes. Plain MetaMask wallet connection does not qualify. This is a distinct deliverable after the extension trading path works.

### 5. User-owned encrypted journal: Mera PRF

Encrypt private watchlists, research notes and risk preferences under Mera-derived, purpose-separated PRF keys. Store ciphertext and the non-secret reconstruction metadata so the user can recover the same state with the passkey on a fresh browser/device. Do not store raw derived keys. The live demo must reproduce the keys/decrypt state across devices or a fresh browser profile.

The bounty specifically targets non-account work and suggests encrypted app state and agent memory. A wallet derivation alone is insufficient. This can complement a different wallet provider because its role is data encryption, not transaction signing. Confirm SDK/browser support and recovery semantics before implementation.

## The changes that require a bigger scope decision

- **Perpl:** a real derivatives adapter plus an opt-in copy-trading system can fit its API bounty, which explicitly lists social/copy trading among suggestions. Requires demonstrated onchain automation and risk management. Its analytics bounty requires both protocol-level metrics and wallet-level positions/history/performance, including liquidation/funding and watch/compare features. A generic Kuru portfolio dashboard does not qualify. Build a read-only Perpl dashboard before automation if this lane is selected.
- **Mera UX:** the full detail says no **wallet extension** and requires one-passkey onboarding, scoped prompt-free signing and passing a cleared-storage/fresh-device reconstruction test. A complete standalone web trading flow could qualify while the X extension is optional distribution. If the core demo requires extension installation, the requirement is not met. Mera must be the entire account layer for that experience; optional passkey login atop a Privy wallet is insufficient.
- **Agora mobile trading:** requires a mobile application, Mera authentication, AUSD balance and at least one Perpl trade. A mobile companion sharing creator evidence could make sense later; a desktop extension or AUSD denomination alone is insufficient. A responsive page should not be represented as meeting the mobile-app condition without organizer clarification.
- **Kuru new markets:** tokenize precisely defined creator-call outcomes, with credible collateral, issuance/redemption, outcome resolution and liquidity. The bounty explicitly accepts outcome contracts, but requires a real new market and legal/operational viability. Transferable reputation badges alone do not establish this. This substantially expands financial-mechanism scope and is not recommended for the immediate MVP.
- **Qwen/Hunyuan/Cleanverse:** incompatible with the recommended Finance primary track as currently listed. These need a deliberate track/product branch, not small logo-driven additions. Qwen would need a composable agent research infrastructure product plus genuine planning/tool use; Hunyuan a substantive multimodal social/creator experience; Cleanverse mandatory CVI-gated CVA asset movement with a compliance use case.

## Every sponsor bounty reviewed

| Bounty (official detail) | Verified award structure | Product change / assessment |
|---|---|---|
| [Kuru consumer trading](https://hackathon.monad.xyz/tracks/build-the-next-consumer-trading-app-on-kuru) | $5,000, one winner | Core: actual Kuru order-book execution; evidence of trader demand and acquisition/retention plan required. |
| [Privy](https://hackathon.monad.xyz/tracks/privy) | $5,000, one winner | Core: stake and trade signing beyond login; clearly demonstrate powered functionality. |
| [Envio](https://hackathon.monad.xyz/tracks/best-use-of-envio) | $1,000, one winner | Core: aggregate creator stake/order/fill entities, live app consumption, public config/schema/handlers. Depth scores higher than indexing one event. |
| [Nansen](https://hackathon.monad.xyz/tracks/best-use-of-nansen) | $2,000 / $1,500 / $1,000 / $500 | Natural addition: interpreted wallet/token evidence; working demo and documented endpoints. |
| [Aurora Intents](https://hackathon.monad.xyz/tracks/bring-any-chain-liquidity-to-monad) | $2,500 / $1,500 / $1,000 | Natural addition: real cross-chain funding and use in the app; refunds/settlement must work. |
| [Chainlink CRE](https://hackathon.monad.xyz/tracks/best-workflow-with-cre) | $3,000, one winner | Natural addition: external-data outcome orchestration; successful CLI simulation or live deployment. |
| [Kimi](https://hackathon.monad.xyz/tracks/best-builds-powered-by-kimi) | $3,000 credits across 10 teams | Natural addition: core claim extraction/evidence explanation; published integration article required. |
| [Alchemy](https://hackathon.monad.xyz/tracks/best-projects-using-alchemy) | $1,000 credits, one winner | Low scope: meaningful Monad RPC/receipt infrastructure, verify chosen service support. |
| [Dynamic](https://hackathon.monad.xyz/tracks/best-use-of-dynamic) | $5,000, one winner | Alternative wallet provider. Depth/multiple useful primitives rewarded; avoid duplicate auth purely for another bounty. |
| [MetaMask Agent Wallet](https://hackathon.monad.xyz/tracks/best-agent-wallet-plugin) | $2,500, one winner | Optional Kuru/creator-evidence plugin; all signing/policy/MFA through Agent Wallet. |
| [Mera PRF](https://hackathon.monad.xyz/tracks/mera-one-passkey-many-keys) | $2,500, one winner | Optional encrypted journal/agent context with isolated namespaces and cross-device proof. |
| [Mera UX](https://hackathon.monad.xyz/tracks/best-mera-powered-ux-on-monad) | $2,500, one winner | Alternate account stack; complete web flow without installation; one-prompt, sessions, stateless test. |
| [Perpl automation](https://hackathon.monad.xyz/tracks/best-use-of-perpl-s-api) | Two winners, $2,500 each | Advanced extension: working capped copy-trading/automation, reliable execution, real onchain activity. |
| [Perpl analytics](https://hackathon.monad.xyz/tracks/best-analytics-risk-tool) | Three winners, $1,000 each | Advanced dashboard: protocol and wallet views, live metrics, funding/liquidation and wallet comparisons; dark-mode UI specified. |
| [Agora mobile trading](https://hackathon.monad.xyz/tracks/best-mobile-trading-app-on-monad-agora-onchain-trading-bount) | $10,000, one winner | Major addition: mobile + Mera + AUSD + Perpl trade; two-minute flow demo. |
| [Agora payments](https://hackathon.monad.xyz/tracks/best-cross-border-payments-app-on-monad-agora-payments-bount) | $10,000, one winner | Different payments lane: mobile passkeys and cross-border/P2P AUSD; bounty calls for mocked fund movement using the testnet settlement contract. Consumer track required. |
| [Kuru new markets](https://hackathon.monad.xyz/tracks/bring-new-assets-and-markets-to-kuru) | $5,000, one winner | Major addition: real claim-outcome market, issuance/redemption and liquidity strategy. |
| [Monad community](https://hackathon.monad.xyz/tracks/best-community-team-project) | $5,000, one winner | No feature addition: actual membership of an onboarded community and profile declaration. Explicitly stacks with other eligible prizes. |
| [Tencent Hunyuan](https://hackathon.monad.xyz/tracks/build-with-hunyuan-multimodal-interactive-experiences) | $2,000 vouchers: $1,000 across top 3; $1,000 among up to 10 fast-track teams | Social track only; deep multimodal use and published article. |
| [Alibaba Qwen](https://hackathon.monad.xyz/tracks/best-builds-with-qwen-3-8-max) | $5,000 credits across top 3 Track 4 winners | Trust/AI infra track; actual planning/tool use and published article. |
| [Cleanverse](https://hackathon.monad.xyz/tracks/best-integration-of-cleanverse-verified-identity-assets) | $2,000, one winner | Trust/AI infra track; both CVI and CVA mandatory, onchain identity gates asset movement. |

## Recommended build bundles

User-approved MVP bundle (11 October 2026): creator identity/stake + X badge/evidence + Kuru Buy/Sell + confirmed-fill dashboard, using **Kuru, Privy, Envio and Nansen**. See [SPONSORS.md](../../SPONSORS.md). Kimi remains optional as the extraction model. Alchemy remains an optional infrastructure choice.

Second bundle: Aurora funding + CRE outcome workflow. They extend the same user journey rather than adding a different product. Prioritize according to actual credential/API readiness and time remaining.

Third bundle: MetaMask plugin or Mera encrypted journal, only after the core works. Keep Perpl/mobile/new market branches out of the immediate scope unless the team explicitly chooses the additional integration workload.

## Submission evidence

Main-track requirements: public repository, deployed Monad mainnet/testnet product with clear access instructions, technical demo maximum three minutes, pitch video maximum two minutes, logo maximum 3 MB. The optional 30-second advertisement is not scored. Most bounty add-on demos specify two minutes; MetaMask/Cleanverse specify up to five. Kimi/Qwen/Hunyuan additionally require a published article. Include real user-test feedback and a specific creator-distribution plan; do not fabricate demand, usage or profitability.
