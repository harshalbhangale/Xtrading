# Frontend handoff

Identity binding and stake RPC reads are connected. The stake contract and mUSDC are deployed; mock-mode configuration, matching stake deployment, deposits, live indexing, trading and MCP remain pending.

## Run

Run `pnpm install --frozen-lockfile`, `pnpm indexer:codegen`, and `pnpm dev`. Copy `apps/web/.env.example` to `.env.local` only if it does not exist; preserve configured credentials. Monad testnet 10143 is the default. No secrets are needed for this frontend. Run `pnpm check` before committing foundational changes.

## Route map

| Route | Surface | Current functionality |
|---|---|---|
| `/` | Landing | Product story, audience entry points and extension introduction |
| `/creators` / `/creators/[handle]` | Public records | Bound-account registry; identity, stake and call ledger per creator (`/terminal` redirects here) |
| `/methodology` | Public | Call scoring rules, price sources and limits |
| `/dashboard` | User overview | Portfolio slots, creator lookup and extension entry |
| `/dashboard/watchlist` | User watchlist | Browser-local add/remove, duplicate handling, reload persistence; max 50 handles |
| `/dashboard/portfolio` | User portfolio | Holdings, confirmed fills and fee table slots |
| `/dashboard/trade` | Trade review | Authenticated Kuru simulation quotes, bounded approval/order review, explicit Privy signing and receipt status; liquidity/funding may prevent quotes |
| `/dashboard/activity` | User activity | Event ledger slot |
| `/creator` | Creator overview | Setup journey and independent identity/stake/reputation slots |
| `/creator/profile` | Creator onboarding | Verified session, explicit wallet ownership proof, persisted binding status; separate local profile draft |
| `/creator/stake` | Creator funds | Authenticated live testnet reads, simulated deployment/deposit/withdrawal reviews and explicit wallet approval |
| `/creator/calls` | Creator calls | Authenticated call registration from the creator's own X post and their ledger |
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

## Implemented market APIs

Kuru Spot V2 on Monad testnet 10143 ([testnet docs](https://kuru-testnet-docs.mintlify.site/deployments/testnet)). Trading runs against the owner's AccountCore balance. Kuru test USDC `0xA402B424f392EAA05DBc8779e4502A1F6A96fEF1` is admin-minted (no public faucet) and separate from staking USDC, mUSDC and the hackathon faucet tokens.

- `GET /api/markets`: verified WETH/USDC and WBTC/USDC market parameters and top of book at one block (empty-book sentinels reported as null), plus Perpl discovery.
- `POST /api/trades/prepare` (session, binding, origin): `{ instrument: "spot", chainId: 10143, market: "WETH" | "WBTC", side, amount, slippageBps, sourcePostId | null }`; `amount` is integer input-token units. Returns exactly one next step: exact `approve` to AccountCore, `deposit` of the shortfall, or `swap`. Swaps are simulated with `eth_call` at a pinned block; the minimum output is derived with integer slippage and the swap carries an onchain deadline. Non-swap steps show a display-only order-book estimate.
- `GET /api/trades/account` and `POST /api/trades/withdraw`: wallet and Kuru-account balances for USDC/WETH/WBTC, and a reviewed withdrawal to the bound wallet.

Reviews expire after 30 seconds and are re-prepared before Privy opens; a changed target, calldata, value or step requires a new review. Submitted hashes and receipts are not fill records; Envio fill indexing is pending.

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

`DataState<T>` distinguishes disconnected, unavailable, loading, error and ready responses. Ready data carries source, observation time, coverage and finality. Signed transactions, submitted orders and confirmed fills are different states. Match market addresses and token decimals to the selected chain.

## Extension

See [X extension](x-extension.md) for badges, call detection, the call-check drawer, provider modes and limits. Public APIs used by the extension: `GET /api/creators/:handle`, `POST /api/signals/classify`, `GET /api/creators/:handle/insights`. `/dashboard/trade` accepts `instrument=spot|perp`, `side`, `postId`, `handle`, `asset`, `direction`, and for perps `marketId` and `leverage`; it renders the source call with creator context. Perp review/submission: `POST /api/trades/perp/prepare` and `/submit` (verified session, current binding, app origin).

Build with `CMB_EXTENSION_APP_ORIGIN=https://your-app.example pnpm --filter @call-my-bluff/extension build` for an explicit HTTPS origin; default is localhost:3000. The preview illustrations on `/extension` are not live evidence.

## MCP

Implement MCP against shared backend services with authorization, rate limits and response validation. Do not fetch provider keys or private database data from the client.

Proposed tools: `get_creator`, `list_calls`, `get_stake_status`, authorized `get_portfolio`, and `prepare_trade`. Trade preparation returns unsigned, expiring transactions for review; it does not sign or submit. SDK, transport, authentication and deployment remain separate work.

## Next work

Follow the [delivery checklist](implementation-plan.md). UI and service references are in [component references](references.md).
