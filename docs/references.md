# Component references

| Repository | Revision | Reference for |
|---|---|---|
| [KOLlateral](https://github.com/RomarioKavin1/kollateral/tree/34e26116f4600adc9b700d55afda5ce52529b10e) | `34e2611` | Creator dossiers, call ledger, historical results and wallet comparisons |
| [KOLlateral extension](https://github.com/RomarioKavin1/kollateral-extension/tree/ba6d302f106a123bd60a9cd2b909cb252a2c957c) | `ba6d302` | Profile evidence card and public creator API |
| [XSwap](https://github.com/Scannty/eth-blinks/tree/2abdf595442142971867696921782e6c3f50be10) | `2abdf59` | Inline trading panel, dynamic-feed detection and quote review |

## Components

| Reference files | Our implementation |
|---|---|
| KOLlateral `lib/signal-schema.ts`, `scripts/run-pipeline.ts` | Classify sourced calls into asset, direction and horizon; leave ambiguous calls unscored |
| `lib/dossier.ts`, `components/CallLedger.tsx`, `components/DossierCharts.tsx` | Creator dossier, call ledger and historical results with source links |
| `lib/score.ts`, `lib/insights.ts` | Versioned evaluation rules, sample sizes, benchmarks and per-token summaries |
| `lib/said-did.ts`, `components/SaidVsDid.tsx` | Nansen-backed wallet observations with transaction evidence and coverage |
| `app/api/creator/[handle]/route.ts`, extension `content.js` | Public creator lookup and X profile/post popovers |
| XSwap `extension/x-ticker-swap.js` | Shadow DOM panels, feed updates, debounced quotes and stale-response rejection |
| KOLlateral `lib/onchain-swap.ts` | Confirmed Kuru order/fill reconciliation through Envio |

KOLlateral paths above are under its `app/` directory.

## Required adaptations

- Use Kuru on Monad, with explicit market and token configuration.
- Use user-approved Privy signing and bounded allowances.
- Treat Kuru spot sells as sales of owned inventory, not naked shorts.
- Keep hypothetical call results separate from actual wallet returns.
- Resolve handles to verified stable X IDs; do not use a ticker as a token address.
- Show missing data, stale evidence and partial fills explicitly.
- Use authorized post ingestion; keep sources and evaluation versions.
