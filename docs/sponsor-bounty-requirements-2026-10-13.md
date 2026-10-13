# Official sponsor bounty requirements — 13 October 2026

Read-only audit of the [official inventory](https://hackathon.monad.xyz/tracks) and all 21 individual bounty pages, plus all four primary-track pages, through the browser. The web fetch tool could not access this site; the authenticated browser displayed every detail page. No project selection or submission was changed. There are **21 bounties from 16 sponsor organizations**, matching the earlier pasted inventory.

All requirements below are paraphrases of the official pages. Product-fit recommendations are explicitly separated at the end. This file documents requirements, not proof that Xtrading meets them; implementation evidence belongs in the companion code audit.

## Shared submission and track rules

Deadline: **14 October 2026, 09:29 IST** (03:59 UTC). Choose exactly one primary track. Bounties labelled “All tracks” pair with any primary track; the inventory assigns the remaining bounties to the stated track. Do not assume a bounty from another track is eligible without organizer confirmation.

All four primary-track pages require a logo/image in JPG/JPEG/PNG/WEBP, at most 3 MB; public GitHub repository accessible to the judging address; a technical video of at most 3 minutes showing the actual working product; a separate pitch video of at most 2 minutes introducing team/problem/motivation; and a live Monad mainnet/testnet product with clear access instructions and any test credentials. An optional advertisement of at most 30 seconds is for promotion, not judging. Sponsor-specific clips are additional submission fields, often shorter.

Primary-track judging weights: technical execution 20%, design/craft 20%, originality/track insight 15%, founder/market readiness 25%, traction/path forward 20%. Finance focuses on actual onchain execution, trustworthy pricing/risk UX, a specific trader segment and usage evidence. Consumer focuses on approachable financial UX; Social on community participation/economic ownership; Trust on reusable, secure developer-facing primitives.

Primary sources: [Finance](https://hackathon.monad.xyz/tracks/onchain-finance), [Consumer](https://hackathon.monad.xyz/tracks/consumer-payments), [Social](https://hackathon.monad.xyz/tracks/social-culture), [Trust](https://hackathon.monad.xyz/tracks/trust-identity-ai).

## 1. Monad Foundation — Best Community Team Project

[Official page](https://hackathon.monad.xyz/tracks/best-community-team-project). **All tracks; $5,000 cash, one winner.**

- Eligibility: team represents an onboarded Metropolis community supporter. Its group must be selectable in the profile community field, and the team must indicate its campus/community group there.
- Judging: normal track fit and overall submission quality; best eligible community team across the four tracks. No separate technical scoring scheme.
- Deliverables: standard public repository, demo and Monad deployment.
- Submission ask: identify the community the team represents.
- Can stack with other eligible awards. Simply being a hackathon participant does not establish community eligibility.

## 2. Agora — Cross-Border Payments

[Official page](https://hackathon.monad.xyz/tracks/best-cross-border-payments-app-on-monad-agora-payments-bount). **Consumer Products & Payments; $10,000 cash, one winner.**

- Eligibility: mobile application for person-to-person or cross-border AUSD sends; Mera passkey onboarding; Instant Settlement transfers. Build against Agora public API documentation. The page explicitly permits mocking actual fund movements through the Instant Settlement contract on Monad testnet.
- Judging: implementation quality, real-world usability and business viability of the payment flow.
- Deliverable: working passkey onboarding, AUSD balance, and completed instantly settled send/receive.
- Submission: explain payment features; video at most 2 minutes demonstrating all three steps.
- Having AUSD for trading alone does not satisfy this payment product requirement.

## 3. Agora — Mobile Trading

[Official page](https://hackathon.monad.xyz/tracks/best-mobile-trading-app-on-monad-agora-onchain-trading-bount). **Onchain Finance & Trading; $10,000 cash, one winner.**

- Eligibility: mobile app authenticating through Mera, holding/displaying AUSD, and executing through Perpl. All three are explicit eligibility conditions.
- Judging: implementation, UX and creative combination of the integrations, beyond technical checkbox completion.
- Deliverable: working passkey login, funded or displayed AUSD balance, and at least one Perpl trade.
- Submission: describe core trading features; video at most 2 minutes showing those steps inside the app.
- A desktop extension with Privy and an AUSD balance is insufficient by itself.

## 4. Envio — Best Use

[Official page](https://hackathon.monad.xyz/tracks/best-use-of-envio). **All tracks; $1,000 cash, one winner.**

- Eligibility: HyperIndex, HyperSync or HyperRPC powers real onchain data in a core feature. Merely installing it is insufficient.
- Judging: depth (multichain/nontrivial schemas/derived entities/analytics), live correct working data, originality and maintainable code/schema.
- Deliverables: working cloud or self-hosted pipeline; public config/schema/handlers or HyperSync client; frontend/API/agent consuming it usefully; short end-to-end video or live demo.
- Submission: explain meaningful data use; optional video at most 2 minutes.
- A configured endpoint or a deployment indexing only a retired feature is weaker evidence than a live product feature consuming current events.

## 5. Aurora Intents — Any-Chain Liquidity

[Official page](https://hackathon.monad.xyz/tracks/bring-any-chain-liquidity-to-monad). **All tracks; $5,000 cash split $2,500/$1,500/$1,000, plus support.**

- Eligibility: meaningful Intents Connect, Swap API or Intents Deposits integration in a Monad app.
- Judging: real working flow, credible cross-chain user friction removed, correct settlement/refund handling, clean UX, track fit/creativity. Bonus for multiple source chains, contract composability or Confidential Intents.
- Deliverables: live, unmocked flow with funds arriving from another chain and used by the Monad app; standard Metropolis submission.
- Submission: describe the integrated product; optional video at most 2 minutes showing the real cross-chain flow.
- A bridge link, mock deposit or planned integration does not satisfy it.

## 6. Cleanverse — Verified Identity & Assets

[Official page](https://hackathon.monad.xyz/tracks/best-integration-of-cleanverse-verified-identity-assets). **Trust, Identity & AI Infrastructure; $2,000 cash, one winner.**

- Eligibility: both CVI and CVA are mandatory; wallet-bound identity verification must gate asset transfers/settlement onchain.
- Judging: structural coupling of identity and asset movement, rather than optional identity decoration.
- Deliverables: verify CVI credentials before any CVA movement; working Monad flow; real compliance use case such as permissioned DeFi or verified RWA settlement.
- Submission: describe compliance use case; video at most 5 minutes showing mandatory credential-gated CVA movement.
- Privy X-account linking is not CVI/CVA integration. Resource credentials shown on the public page are deliberately not copied into this report.

## 7. Kuru — Consumer Trading App

[Official page](https://hackathon.monad.xyz/tracks/build-the-next-consumer-trading-app-on-kuru). **Onchain Finance & Trading; $5,000 cash, one winner.**

- Eligibility: focused spot product routing through Kuru’s Monad order book.
- Judging: working integration, clear user, demand evidence, credible acquisition/retention and post-hackathon continuation.
- Deliverables: usable integrated product; target segment; usage/trading evidence; acquisition/retention strategy; continuation plan.
- Submission: describe target segments, demand research/case studies, roadmap and onboarding/retention.
- Social/community/creator-led trading is explicitly a suggested direction. A transaction proves execution, but does not by itself fulfill all demand and go-to-market fields.

## 8. Kuru — New Assets and Markets

[Official page](https://hackathon.monad.xyz/tracks/bring-new-assets-and-markets-to-kuru). **Onchain Finance & Trading; $5,000 cash, one winner.**

- Eligibility: new class of tradable assets/markets using Kuru’s order book, with infrastructure beyond a trading interface.
- Judging: clear asset/customer, demand, credible issuance/redemption/settlement, legal/operational viability and liquidity.
- Deliverables: asset and customer definition, demand evidence, credible asset mechanism, legal/operational plan, initial liquidity strategy and continuation roadmap.
- Submission: describe new asset classes, bringing them onchain and establishing liquidity, and post-event roadmap.
- Surfacing existing MON/USDC or ETH markets in X does not create a new asset class. Creator economies are suggested, but creator fees alone are not asset issuance.

## 9. Dynamic — Best Use

[Official page](https://hackathon.monad.xyz/tracks/best-use-of-dynamic). **All tracks; $5,000 cash, one winner.**

- Eligibility: Dynamic SDK authentication, embedded/server/agent wallets and/or signing; deployed and judge-demoable app fitting a primary track. Multiple SDK languages/platforms qualify.
- Judging: creative wallet/money/agent use, clean execution and real usefulness. Bonuses for combining Dynamic primitives and depth over breadth.
- Deliverable: usable deployed SDK integration.
- Submission: explain SDK use; optional video at most 2 minutes.
- Another authentication provider or a placeholder Dynamic environment variable is not integration.

## 10. Alchemy — Best Projects

[Official page](https://hackathon.monad.xyz/tracks/best-projects-using-alchemy). **All tracks; $1,000 in Alchemy credits, one winner.**

- Eligibility: functional Monad deployment meaningfully integrating at least one Monad-supported Alchemy service or developer tool.
- Judging: integration quality, execution, usefulness/innovation.
- Deliverable: deployed functional product using the service/tool.
- Submission: describe meaningful integration; optional video at most 2 minutes.
- The prize is service credits, not cash. Default public Monad RPC usage alone is not Alchemy usage.

## 11. Chainlink — CRE Workflow

[Official page](https://hackathon.monad.xyz/tracks/best-workflow-with-cre). **All tracks; $3,000 cash, one winner.**

- Eligibility: CRE used meaningfully as an orchestration layer.
- Judging: meaningful orchestration within the project.
- Deliverables: integrate at least one blockchain with an external API/system/data source/LLM/agent; demonstrate successful **CRE CLI simulation OR live CRE network deployment**.
- Submission: explain orchestration role; video at most 2 minutes showing successful simulation or live deployment.
- Autonomous DON deployment is not a mandatory bounty requirement. Ordinary unit tests or an independently scheduled script do not substitute for actual CRE simulation/deployment evidence.

## 12. Perpl — API

[Official page](https://hackathon.monad.xyz/tracks/best-use-of-perpl-s-api). **All tracks; $5,000 cash split between two $2,500 winners.**

- Eligibility: production-ready Perpl trading bot or automation system.
- Judging: reliable execution, risk management, ability to be profitable and real onchain activity.
- Deliverable: working bot/automation with demonstrated real onchain activity.
- Submission: video at most 2 minutes and link to the system, both demonstrating real activity.
- Social trading, copy trading, following and leaderboards are suggested starting points. They do not waive production-readiness, risk management or execution requirements. A trade form or submitted-but-unfilled order alone is insufficient evidence.

## 13. Perpl — Analytics / Risk

[Official page](https://hackathon.monad.xyz/tracks/best-analytics-risk-tool). **Onchain Finance & Trading; $3,000 cash, three $1,000 winners.**

- Eligibility: real/near-real-time Perpl dashboard with protocol and wallet views.
- Judging: fast modern dark UI; timely data; fluid protocol-to-wallet drill-down; concise signal.
- Protocol deliverables: volume (24h/7d/30d/all-time), open interest, TVL, fees/revenue, active users; timeframe charts; deposits/withdrawals/net inflows; market breakdown and long/short skew; liquidations/funding. Cross-venue share context optional.
- Wallet deliverables: address search/profile; positions (size, entry, leverage, unrealized PnL, liquidation); trades/realized PnL; win rate, profit factor, drawdown, streaks, hold time and best/worst markets; save/watch/side-by-side comparison; portfolio/margin. AI behavioral insights optional.
- Submission: live dashboard link; walkthrough at most 2 minutes.
- Generic creator analytics do not satisfy this full protocol-plus-wallet scope.

## 14. Privy

[Official page](https://hackathon.monad.xyz/tracks/privy). **All tracks; $5,000 cash, one winner.**

- Eligibility: Privy functionality beyond authentication. Login-only is explicitly disqualified.
- Judging: clear demo of Privy-powered functionality; bonus for multiple meaningful features.
- Deliverable: demo showing beyond-login functionality.
- Submission: describe integration; optional video at most 2 minutes.
- Embedded wallet creation, ownership proof and wallet signing/execution can supply relevant evidence when actually demonstrated; claiming Privy merely because the login screen exists is insufficient.

## 15. Nansen AI — Best Use

[Official page](https://hackathon.monad.xyz/tracks/best-use-of-nansen). **All tracks; $5,000 cash split $2,000/$1,500/$1,000/$500.**

- Eligibility/judging: at least one meaningful API endpoint, MCP tool or CLI; core product feature beyond a superficial call/basic token price; accessible working product/prototype/demo; explain endpoints/data categories/tools/commands; public repo or technical docs; short video or live demo.
- Deliverables: evaluateable product/prototype, public technical material and action demo.
- Submission: describe integration; optional video at most 2 minutes.
- Raw data exposure alone is not the target. Explain the interpretation/action Nansen enables, and distinguish unsupported/empty wallet data from actual sourced findings.

## 16. Tencent Kepler Plan — Hunyuan

[Official page](https://hackathon.monad.xyz/tracks/build-with-hunyuan-multimodal-interactive-experiences). **Social, Attention & Culture; $2,000 Tencent Cloud vouchers.**

- Eligibility: substantive Hunyuan-powered multimodal/interactive product on Monad; not a token API call.
- Judging: deep Tencent Cloud/Hunyuan usage and general Metropolis quality.
- Deliverables: working demoable product plus **published article/blog explaining use and value**.
- Submission: published article.
- Awards: $1,000 among global top three plus $1,000 among up to ten independently selected Kepler Fast Track teams. Vouchers, not cash.
- Plain text extraction through another model does not establish Hunyuan usage.

## 17. Kimi — Powered by KIMI

[Official page](https://hackathon.monad.xyz/tracks/best-builds-powered-by-kimi). **All tracks; $3,000 credits across ten teams.**

- Eligibility: KIMI genuinely powers the Monad project; no narrow category restriction.
- Judging: meaningful core feature rather than bolted-on chat widget; working demoable product; bonus for creativity.
- Deliverables: working product plus **published article/blog explaining how Kimi was used and its value**.
- Submission: article link/content.
- Credits, not cash. A model switch must actually power and be demonstrated in a meaningful feature.

## 18. Alibaba Cloud — Qwen 3.8 Max

[Official page](https://hackathon.monad.xyz/tracks/best-builds-with-qwen-3-8-max). **Trust, Identity & AI Infrastructure; $5,000 credits across top three Track 4 winners.**

- Eligibility: deployed demoable Monad product using Qwen 3.8 Max agentically.
- Judging: planning, tools and multi-step execution; integration depth beyond prompt answering/API calls; working product.
- Deliverables: agentic product plus **published article/blog explaining Qwen use and value**.
- Submission: published article.
- Simple one-shot call parsing is not, by itself, demonstrated agentic behavior. Track/prize wording ties this award to Track 4.

## 19. Monad Foundation — Mera UX

[Official page](https://hackathon.monad.xyz/tracks/best-mera-powered-ux-on-monad). **All tracks; $2,500 cash, one winner.**

- Eligibility: Mera as the entire account layer; no seed phrase, required wallet extension or custodial backend.
- Judging: time/taps to confirmed transaction, scoped sessions/expiry UX, stateless reconstruction; account-stack composability bonus.
- Deliverables: live real Monad testnet/mainnet transactions; single passkey ceremony, no required extension installation/email/OTP onboarding; prompt-free Mera sessions with clear scope; judges can clear storage/use fresh device and reconstruct identity/access from passkey plus untrusted storage.
- Submission: explain entire account integration; optional UX demo at most 2 minutes.
- An X enhancement extension is different from a required wallet extension; however the complete qualifying product still must meet the one-prompt, stateless, Mera-account requirements.

## 20. Monad Foundation — Mera Many Keys

[Official page](https://hackathon.monad.xyz/tracks/mera-one-passkey-many-keys). **All tracks; $2,500 cash, one winner.**

- Eligibility: creative PRF-derived key material used for non-wallet/non-account work; wallet signing cannot be the point.
- Judging: novelty, correct encryption versus derivation, isolated salt namespaces, no sensitive material persisted on disk/server; live second-device/fresh-profile reconstruction/decryption with same passkey.
- Deliverable: live demonstrated non-account work in at least one PRF namespace.
- Submission: explain non-account use; optional video at most 2 minutes.
- Mera login alone does not satisfy this separate bounty.

## 21. MetaMask — Agent Wallet Plugin

[Official page](https://hackathon.monad.xyz/tracks/best-agent-wallet-plugin). **Onchain Finance & Trading; $2,500 cash, one winner.**

- Eligibility/judging: working installable trader-focused plugin extending Agent Wallet through its plugin architecture and `mm` command.
- Deliverables: installable plugin; every transaction through Agent Wallet signing/policy/MFA; no private key/token handling or bypass; `skills/<name>/SKILL.md` usage instructions; README; real-flow live demo or video at most 5 minutes.
- Submission: describe capabilities; link the skill file; real-flow video at most 5 minutes.
- The page states plugins require a version after v6.2.0. An ordinary MetaMask browser-wallet connection or standalone MCP is not this plugin integration.

## Audit interpretation / recommendations (not official requirements)

- Primary Finance is the natural fit for a product centered on actual Kuru spot execution. A creator/social UX does not automatically mean Social is the best primary track; Finance retains Kuru, Perpl analytics and MetaMask compatibility.
- Most immediately relevant targets: Kuru consumer trading, Privy, Envio, Nansen, CRE. Each still needs the exact live/demo and written evidence listed above.
- CRE can qualify with demonstrated CLI simulation; do not label missing DON deployment as a bounty disqualification.
- Perpl API is an additional execution/automation task, not an automatic award for having a ticket UI.
- Do not add Dynamic/Mera solely for prize breadth if it fragments an already working account flow. Agora mobile, Cleanverse, Qwen Track 4 and Hunyuan Social carry explicit product/track constraints.
- Published articles are mandatory for Hunyuan, Kimi and Qwen; optional sponsor videos do not replace them.
- Keep creator correctness and verified user realized profit separate. None of these bounty pages mandates staking, creator subscription plans or a five-call fee unlock; those are Xtrading product decisions.

No inaccessible detail pages remain in this audit. Award amounts are advertised pools, not an assertion of eligibility or winning. Submission selection, unpublished videos/articles, demand research and current deployed functionality must be checked separately.
