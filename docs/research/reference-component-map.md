# Reference components and sponsor implementation map

Reviewed 11 October 2026. This is a static source review, not a claim that the reference apps' live integrations were tested. The required MVP remains Kuru, Privy, Envio and Nansen; this document does not add other sponsors or automatic trading.

## Pinned sources and reuse boundary

| Source | Reviewed revision | License evidence | Use in our project |
|---|---|---|---|
| [KOLlateral](https://github.com/RomarioKavin1/kollateral/tree/34e26116f4600adc9b700d55afda5ce52529b10e) | `34e26116f4600adc9b700d55afda5ce52529b10e` | No LICENSE file or license declaration found in reviewed app package | Architectural and product reference; original implementation |
| [KOLlateral extension](https://github.com/RomarioKavin1/kollateral-extension/tree/ba6d302f106a123bd60a9cd2b909cb252a2c957c) | `ba6d302f106a123bd60a9cd2b909cb252a2c957c` | No LICENSE file found | Profile-card behavior and API-contract reference; original implementation |
| [XSwap / eth-blinks](https://github.com/Scannty/eth-blinks/tree/2abdf595442142971867696921782e6c3f50be10) | `2abdf595442142971867696921782e6c3f50be10` | Backend package declares ISC; no repository-wide LICENSE found establishing extension reuse | Inline trading UX and transport reference; original implementation |

Public visibility is not an explicit license covering copied source or assets. No reference source, logos, data archives or artwork was imported. Before any future source reuse, establish a compatible license or permission, retain required notices, record provenance and follow the hackathon's applicable reuse/disclosure rules. Small genuine feature commits should reflect actual work, not conceal external origins.

## Components to implement from these designs

Paths below refer to the pinned KOLlateral revision unless another repository is specified.

| Reference component | Useful design | Call My Bluff implementation |
|---|---|---|
| `app/lib/signal-schema.ts`, `app/scripts/run-pipeline.ts` | Structured classification and an explicit non-signal/ambiguous state | Store source post ID, stable author ID, chain+asset address, direction, horizon, interpretation version and confidence. Missing direction stays unresolved; AI extracts, deterministic code evaluates. |
| `app/lib/dossier.ts`, `app/components/CallLedger.tsx`, `app/components/DossierCharts.tsx` | A creator record connects individual calls, price marks, outcomes and evidence | Build public dossier and ledger from authenticated identity plus sourced calls. Keep refundable stake, hypothetical call results and actual wallet returns separate. Show coverage and insufficient evidence before scores. |
| `app/lib/score.ts`, `app/lib/insights.ts` | Auditable per-call outcomes and per-token summaries | Publish versioned entry/exit/evaluation rules, sample size and benchmark. Label hypothetical results; avoid presenting a fixed-notional sum as actual portfolio P&L. Use matching settled/open populations in aggregate denominators. |
| `app/lib/said-did.ts`, `app/components/SaidVsDid.tsx` | Link a public call to later wallet evidence with a timestamp and transaction hash | Nansen-backed wallet/token context for a signed linked wallet where coverage exists. Describe observations and uncertainty; a sale does not prove deception, and one linked wallet is not complete financial coverage. |
| `app/app/api/creator/[handle]/route.ts` and separate extension `content.js` | Small public creator payload with loading, absent and error states | Bounded public endpoint resolving current handles to stable verified X IDs. Include independent identity/stake/evidence fields and source/freshness metadata. Never expose private portfolios or auth tokens. |
| XSwap `extension/x-ticker-swap.js` | Shadow-DOM inline panels, dynamic-feed detection, debounced quotes and discarded stale responses | Original X post/profile evidence popover plus allowlisted token-to-Kuru market resolution. Unavailable markets remain unavailable; a ticker alone does not identify a token. |
| `app/lib/onchain-swap.ts` | Reconcile onchain receipts and actual output rather than treating a quote as a fill | Decode Kuru order/fill events through Envio, preserve source post attribution, handle partial fills and expose actual amounts. |

## Sponsor roles and required demo evidence

This mapping implements the approved requirements in `SPONSORS.md`. Attempts to retrieve the four organizer detail pages during this review failed in the web tool; current eligibility and submission wording must be reconfirmed before submission. Integration status below is not an award/eligibility claim.

| Sponsor | Core product function | Concrete demo |
|---|---|---|
| Kuru | The actual execution venue for X-originated spot orders on Monad | X post → market/amount/fees/limits review → user-approved order → confirmed full/partial fill → dashboard attribution. A mock token is not automatically listed or liquid on Kuru. |
| Privy | X onboarding, embedded wallet, verified ownership and explicit transaction signing | Signed stable-X-ID binding, real testnet stake deposit and a Kuru transaction through the user's Privy wallet. Login alone is insufficient. |
| Envio | Live stake and trading projections | Confirmed deposit changes the extension's stake indicator; withdrawal request removes active eligibility. Order/fill events update the dashboard with idempotency, reorg and freshness handling. |
| Nansen | Useful mainnet wallet/token context beside creator evidence | An actual API-backed interpretation with source, time, chain and coverage. Keep mainnet analytics distinct from mock/testnet stake and trades; unsupported coverage is visibly unavailable. |

The combined user journey should make all four integrations useful: inspect a creator's verified identity and current stake, read sourced call/token evidence, review a Kuru spot trade, approve via Privy and see Envio-confirmed results. Explain Nansen's contribution alongside the evidence, not merely in a sponsor logo row.

## Reference behavior we will change

- KOLlateral uses Privy delegated backend signing and auto-follow/fade. Our existing rules require explicit wallet approval and prohibit automatic signing. Kuru spot sells require owned inventory; fading a bullish call does not imply a supported naked short.
- Its direct Base Sepolia swap uses `maxUint256` approval and `amountOutMinimum=0`. Our adapter must use bounded approvals and venue-specific price/slippage limits. Receipt timeouts must remain unknown/pending, not executed.
- Its pipeline defaults missing signal direction to long. We keep ambiguous direction unscored. In the extension API, the headline numerator includes open and settled outcomes while its denominator uses settled calls; our published aggregates must use coherent populations.
- The repository has curated/archive ingestion and synthetic post-link handling despite a broad README claim of no mocks. We must distinguish actual retrievable posts, authorized imports and illustrative fixtures; preserve lawful source provenance and never label synthetic URLs as verified X posts.
- Its internal-X GraphQL scraper depends on guest-token/query details. We need an authorized, documented collection path and must not assume Privy login grants historical post ingestion.
- XSwap's page bridge forwards arbitrary wallet RPC requests, its manifest grants all HTTP/HTTPS origins, and its transaction-check failures permit continuing. Our extension uses narrow permissions, validated messages and app-hosted wallet review. Missing risk checks remain visible.
- Neither TEE attestation nor model confidence proves that financial advice is correct. TEE evidence, if ever added, concerns inference execution and remains independent of outcome scoring.

## Implementation order

1. Finish verified mUSDC configuration, matching stake deployment, deposit and live stake indexing. Preserve the previous Circle-token deployment record.
2. Add the public creator-evidence contract and original profile/post popover. Test real X feed navigation and missing/stale/withdrawal states. Use the separate KOLlateral extension as the profile interaction reference.
3. Add Kuru market feasibility checks, quote/order preparation and approved execution using XSwap's inline interaction design. Reconcile fills with Envio before populating actual portfolio results.
4. Implement authorized call ingestion and the original dossier/ledger/scoring services, drawing on KOLlateral's evidence structure. Integrate actual Nansen context after verifying access and coverage.
5. Expose the same bounded services through MCP, deploy the product and record genuine sponsor demo evidence.

Commit each implemented and verified component as a real milestone with updated documentation and provenance. A design reference, configured key, submitted order or sample screenshot is not completion evidence.
