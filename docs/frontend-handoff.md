# Frontend handoff

Identity binding and stake RPC reads are connected. The stake contract and mUSDC are deployed; mock-mode configuration, matching stake deployment, deposits, live indexing, trading and MCP remain pending.

## Run

Run `pnpm install --frozen-lockfile`, `pnpm indexer:codegen`, and `pnpm dev`. Copy `apps/web/.env.example` to `.env.local` only if it does not exist; preserve configured credentials. Monad testnet 10143 is the default. No secrets are needed for this frontend. Run `pnpm check` before committing foundational changes.

## Route map

| Route | Surface | Current functionality |
|---|---|---|
| `/` | Landing | Product story, audience entry points and extension introduction |
| `/terminal` | Public terminal | Validated handle lookup and empty call feed |
| `/creators` / `/creators/[handle]` | Public records | Lookup and honest unindexed state |
| `/dashboard` | User overview | Portfolio slots, creator lookup and extension entry |
| `/dashboard/watchlist` | User watchlist | Browser-local add/remove, duplicate handling, reload persistence; max 50 handles |
| `/dashboard/portfolio` | User portfolio | Holdings, confirmed fills and fee table slots |
| `/dashboard/trade` | Trade review | Interactive buy/sell draft, venue reference and unavailable quote/approval fields |
| `/dashboard/activity` | User activity | Event ledger slot |
| `/creator` | Creator overview | Setup journey and independent identity/stake/reputation slots |
| `/creator/profile` | Creator onboarding | Verified session, explicit wallet ownership proof, persisted binding status; separate local profile draft |
| `/creator/stake` | Creator funds | Authenticated live testnet reads, simulated deployment/deposit/withdrawal reviews and explicit wallet approval |
| `/creator/calls` | Creator calls | Interactive evaluation-status filter; ingestion pending |
| `/creator/reputation` | Creator performance | Methodology and coverage slots; unavailable metrics |
| `/extension` | Extension hub | Installation and explicitly illustrative unknown/linked/stale previews |
| `/integrations` | Agent connections | Proposed MCP tools; connection disabled |
| `/setup` | Developer configuration | Setting presence, separate from live verification |
| `/portfolio` | Legacy link | Redirects to `/dashboard/portfolio` |

The dashboards are publicly accessible shells. Add server authorization before returning private account data. A local draft or saved handle is not a verified account or a server record.

## Components

- `components/dashboard/ui.tsx`: shell, headings, metrics, panels, empty states, tables and connection notes. `RecordTable` currently renders its empty state; add typed row renderers alongside the service integration.
- `components/dashboard/sidebar.tsx`: audience navigation, with horizontally scrollable navigation on mobile.
- `profile-draft.tsx` and `watchlist.tsx`: browser-only state. Never use it as an identity or wallet proof. Both components handle unavailable storage and validate stored data.
- `call-filters.tsx`: controlled status selector; filtering is local until the service is wired.
- `components/extension-preview.tsx`: design reference, not installed extension UI or provider data. Preserve the preview watermark.
- `app/globals.css`: shared tokens and original terminal. `app/frontend.css`: landing, dashboards and connected surfaces, responsive and reduced-motion rules.
- Pages are server components; interactions are isolated client components. The error boundary offers retry without displaying raw errors. Dashboard layouts have route loading states.

Use an em dash for unavailable metrics. Do not fabricate balances, scores or chart history. Verified identity, stake, hypothetical call outcomes and actual wallet returns must remain independent.

## Implemented identity APIs

`GET /api/identity`, `POST /api/identity/challenge` and `POST /api/identity/bind` require a server-verified Privy bearer token. POST requests also require the configured app origin. Responses use runtime schemas from `packages/domain`; no client-supplied X ID or signing message is trusted. See [identity binding](identity-binding.md) for request contracts, limits and verification. Public creator lookup is still pending.

## Planned backend contracts

These are proposed APIs, **not existing routes**. Serializable view models are exported from `packages/domain/src/view-models.ts`. Add runtime response validation when implementing them. Monetary fields are integer token-unit strings.

| Proposed endpoint | Authorization | Consumer |
|---|---|---|
| `GET /api/me/creator` | Verified Privy session | Creator overview/profile |
| `GET /api/creators/:xUserId/stake` | Public bounded query | Profile, stake and extension |
| `GET /api/creators/:xUserId/calls` | Public pagination/filtering | Call ledger and public record |
| `GET /api/creators/:xUserId/reputation` | Public, source coverage | Reputation panels |
| `GET/PUT /api/me/watchlist` | Verified session | Explicit local-list migration and sync |
| `GET /api/me/portfolio` and `/activity` | Verified session with wallet authorization | Portfolio/activity |
| `POST /api/trades/prepare` | Verified session, allowlisted market, limits | Extension trade review |

`DataState<T>` distinguishes disconnected, unavailable, loading, error and ready responses. Ready data carries source, observation time, coverage and finality. Signed transactions, submitted orders and confirmed fills are different states. Match market addresses and token decimals to the selected chain.

## Extension

The current extension adds evidence links only. The preview defines next display states: unknown identity, linked identity with current stake, and stale stake. Implement actual rendering after the public APIs exist. Keep X DOM discovery in `apps/extension/src/content.ts` separate from transport and evidence components.

An active-stake badge requires verified identity and fresh matching chain/contract data. A pending withdrawal immediately removes eligibility. Trade review needs quote expiry, bounded approval, fees, slippage protection and exact amounts before wallet signing. No infinite approval default or automatic copy trade.

## MCP

Implement MCP against shared backend services with authorization, rate limits and response validation. Do not fetch provider keys or private database data from the client.

Proposed tools: `get_creator`, `list_calls`, `get_stake_status`, authorized `get_portfolio`, and `prepare_trade`. Trade preparation returns unsigned, expiring transactions for review; it does not sign or submit. SDK, transport, authentication and deployment remain separate work.

## Next work

Follow the [delivery checklist](implementation-plan.md). UI and service references are in [component references](references.md).
