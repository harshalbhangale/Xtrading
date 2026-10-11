# Sponsor fit for Call My Bluff

Researched 11 October 2026. Product scope: KOLs prove control of an X account, deposit a bond, receive an extension-visible badge, build evidence-based reputation, and let readers buy/sell supported assets from X with a portfolio dashboard.

**Updated after direct portal inspection:** the parent agent subsequently accessed the user's authenticated browser session and read all four primary-track detail pages and all 21 sponsor-bounty detail pages. The earlier unauthenticated access limitation below describes the initial research only. Current organizer requirements, prize splits, and proposed additions are recorded in [portal-sponsor-expansion.md](./portal-sponsor-expansion.md); use that document for submission decisions.

## Recommendation

The user approved **Onchain Finance & Trading** with **Kuru + Privy + Envio + Nansen** as required MVP integrations on 11 October 2026. Nansen API access and market coverage are early readiness checks. Dynamic remains a researched alternative outside the selected scope. See [SPONSORS.md](../../SPONSORS.md) for the current requirements. The trading flow is the central product, while bonded identity and reputation explain why users would choose it.

This is a product recommendation, not an organizer ruling on eligibility. Do not pursue every bounty or turn the product into an AI trade simulator.

## What could be independently verified

The [official tracks page](https://hackathon.monad.xyz/tracks) public HTML confirms one primary track plus optional sponsor bounties and shows **Oct 14, 03:59 UTC**, equivalent to **09:29 IST**. Browser navigation redirects to provider sign-in. Bounty details are dynamically loaded behind that access gate, including the [MetaMask bounty](https://hackathon.monad.xyz/tracks/best-agent-wallet-plugin). Therefore the full prize amounts and bounty requirements below come from the user's pasted organizer text, not independently retrieved live bounty details. The year 2026 is supplied by the user/event context.

### Kuru: strong fit, distinguish order book from aggregation

[Official SDK quickstart](https://docs.kuru.io/sdk/quickstart-sdk) documents `@kuru-labs/kuru-sdk`, margin deposits, limit orders and receipt events. [Current contract addresses](https://docs.kuru.io/contracts/Contract-addresses) publish mainnet MON-AUSD and MON-USDC markets. Start with one of these pairs; a token mentioned on X is not automatically listed or liquid on Monad.

The quickstart's example testnet addresses differ from the current contract-address page. Pin current deployment addresses and market parameters before implementation. Keep signing in the user's wallet rather than copying the private-key example into an extension.

[Kuru Flow authentication](https://docs.kuru.io/api-reference/generate-jwt-token) uses a JWT endpoint. [Kuru's official trading tooling](https://github.com/Kuru-Labs/kuru-trading-skills) supports unsigned preparation and external wallet clients. Flow is an aggregator; using Flow alone does not prove the pasted bounty's requirement to route through Kuru's order book. For the strongest submission, demonstrate a direct supported Kuru market trade/limit order with its order/fill receipt, or verify the actual Flow route and obtain organizer guidance.

### Privy: strong fit beyond login

[OAuth docs](https://docs.privy.io/authentication/user-authentication/login-methods/oauth) explicitly support Twitter. [EVM configuration](https://docs.privy.io/basics/react/advanced/configuring-evm-networks) explicitly includes Monad and supports default/supported chain configuration. [React quickstart](https://docs.privy.io/basics/react/quickstart) covers embedded wallets and sending transactions.

Use Privy for account linking plus actual bond deposits and Kuru transaction signing. Login-only would fail the user's pasted bounty criterion. Verify auth server-side and bind immutable X account ID to a wallet proof; a visible handle supplied by the extension is insufficient. OAuth proves account control, not historical honesty. An OAuth login also does not automatically grant arbitrary X timeline API access. Prototype browser-extension OAuth/callback and wallet UI integration immediately; a hosted app window/secure wallet bridge is an implementation hypothesis, not a verified extension compatibility guarantee.

### Dynamic: reasonable alternative

[Twitter configuration](https://docs.dynamic.xyz/social-providers/twitter), [social linking](https://docs.dynamic.xyz/users/social-linking), and [embedded wallet creation](https://docs.dynamic.xyz/wallets/embedded-wallets/create-embedded-wallets) document the necessary identity/wallet flow. These indexed pages describe the legacy React SDK. The [current documentation index](https://www.dynamic.xyz/docs/llms.txt) directs new apps to its JavaScript SDK/React quickstart; relevant current section pages were inaccessible during this check. Pin current SDK guidance and explicitly configure/verify Monad before choosing it. Adding Dynamic and Privy to the same basic login flow provides little product value.

### Envio: strong core feature

[Envio's Monad page](https://envio.dev/chains/monad) confirms mainnet chain ID 143 and HyperIndex, HyperSync and HyperRPC support. Index bond deposit/withdrawal events and Kuru trade/fill events to power live badges, executed trade history and dashboard data. This satisfies the substance of the user's pasted requirement more convincingly than an incidental RPC call. HyperRPC is read-only; it does not submit transactions.

### Nansen: selected evidence integration

[Holders endpoint](https://docs.nansen.ai/api/token-god-mode/holders) includes `monad` in its schema and exposes balances/concentration. Premium labels require a paid plan. [Address PnL](https://docs.nansen.ai/api/profiler/address-pnl-and-trade-performance) also supports Monad; aggregate summaries may lag up to about an hour. Transform data into evidence such as holder concentration or whether a linked wallet sold after a call. Keep reputation separate from wallet PnL, show data age, and validate actual Kuru trade coverage with authorized API access; schema support does not guarantee every market is indexed.

### MetaMask Agent Wallet: optional separate deliverable

[Plugin overview](https://docs.metamask.io/agent-wallet/plugins/) confirms native `mm` commands, opt-in beta support, and policy-gated wallet submission. The [official template](https://github.com/MetaMask/agent-wallet-plugin-template) exposes `ctx.publicClient(chainId)` for reads and `ctx.walletExecutor()` for signing/submission. [Supported chains](https://docs.metamask.io/agent-wallet/reference/supported-chains/) includes Monad mainnet 143 and testnet 10143, but `mm chains list` is authoritative for an installed version.

A viable add-on: an installable Kuru trade plugin that checks the KOL evidence, obtains a quote and submits through Agent Wallet. Ordinary MetaMask browser-wallet connection is not this bounty. The user's pasted requirements additionally specify version ≥6.2.0, no signing/policy/MFA bypass, `skills/<name>/SKILL.md`, README and ≤5-minute real-flow demo. Do not route plugin transactions through Privy as a shortcut. Build only after the extension MVP works.

## All pasted bounties assessed

Every award/eligibility condition in this table is user-supplied; fit is our assessment. USD amounts are cash unless marked credits/vouchers.

| Sponsor/bounty | Award | Fit and qualifying work |
|---|---:|---|
| Monad community team | $5,000 | Conditional on Metropolis supporter-team eligibility. |
| Agora cross-border | $10,000 | Poor: requires mobile AUSD payments plus Mera. |
| Agora mobile trading | $10,000 | Poor for extension: requires mobile + Mera + AUSD + Perpl. |
| Envio | $1,000 | Strong: bond/trade indexing drives badge/dashboard. |
| Aurora Intents | $5,000 | Optional: real any-chain deposit-and-execute into Monad. |
| Cleanverse | $2,000 | Poor: CVI-gated CVA asset movement changes scope. |
| Kuru consumer trading | $5,000 | Strongest: focused spot trading through order book. |
| Kuru new assets/markets | $5,000 | Poor: existing-token X trading creates no new market class. |
| Dynamic | $5,000 | Strong alternative to Privy: demo authentication/wallet/signing. |
| Alchemy | $1,000 credits | Optional: meaningful Monad infrastructure integration; verify chosen service. |
| Chainlink CRE | $3,000 | Optional: working workflow orchestrates data/score attestations; avoid decorative integration. |
| Perpl automation | $5,000 | Poor for spot MVP: real bot/automation required. |
| Perpl analytics/risk | $3,000 | Conditional: dashboard must focus on Perpl. |
| Privy | $5,000 | Strong: embedded wallet bond/trade transactions beyond login. |
| Nansen | $5,000 total pool | Strong secondary: actionable evidence from supported data. |
| Tencent Hunyuan | $2,000 vouchers | Optional multimodal/social product feature; unnecessary for MVP. |
| Kimi | $3,000 credits | Optional evidence extraction with genuine model usage. |
| Qwen 3.8 Max | $5,000 credits | Poor unless meaningful agentic behavior, not text summarization. |
| Mera account UX | $2,500 | Alternative account stack: entire layer must use Mera. Browser extension constraint requires clarification. |
| Mera PRF creative keys | $2,500 | Poor unless creative non-wallet key use is central. |
| MetaMask Agent Wallet | $2,500 | Optional installable policy-gated Kuru plugin, separate from Chrome wallet UI. |

Pasted primary tracks each list $30,000: Finance & Trading (recommended), Consumer Products & Payments, Social/Attention/Culture, and Trust/Identity/AI Infrastructure. Some sponsor bounties constrain primary track, so do not assume every optional bounty combines with Finance.

## Readiness decisions

1. Obtain signed-in organizer detail access and confirm judging rules before claiming eligibility; this research did not register or select tracks.
2. Prototype X OAuth + hosted signing bridge, direct Kuru trade and Envio event indexing first. Secure API credentials are needed for Nansen; no paid calls were made.
3. Define bond amount/token, withdrawal cooldown and revocation. A $500 deposit proves bonded identity, not a guaranteed profitable KOL. Without explicit slashing criteria it is a refundable membership bond, not enforceable accountability.
4. Define data coverage and deterministic reputation rules before scoring. The platform can observe captured posts and linked-wallet trades; it cannot promise all X history or all wallets. Show sample size and missing data.
