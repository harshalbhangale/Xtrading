# Call My Bluff

A creator reputation and trading terminal for X, built on Monad. Link identity, inspect a refundable stake, review sourced financial calls, then execute a wallet-approved spot trade. Identity, stake and performance are independent signals.

**Phase: verified identity implementation.** The public app and extension run locally without credentials. Server-verified Privy/X sessions, signed wallet-binding APIs and persisted identity state are implemented. Kuru orders/fills, stake deployment, hosted indexing and Nansen insights remain pending. No example balances, fake reputations or simulated fills are shown as live data.

## Start

Requirements: Node.js 22+, pnpm 11.1.3, Foundry for contracts. Docker is optional for the local database and Envio runtime.

```sh
pnpm install
cp apps/web/.env.example apps/web/.env.local
pnpm dev
```

Open http://localhost:3000. The landing page, user dashboard (`/dashboard`), creator studio (`/creator`), extension hub (`/extension`), agent connection plan (`/integrations`), terminal (`/terminal`) and `/setup` page work before secrets are added. `/api/health` reports configuration presence without returning secrets. `Configured` means a setting exists; it does not mean the provider has been tested.

Developer route map, reusable components, proposed API contracts and extension/MCP integration boundaries: [frontend handoff](docs/frontend-handoff.md). Local watchlists and profile drafts are implemented; they do not publish or verify an account.

Completed work, remaining tasks and phase completion tests: [implementation checklist](docs/implementation-plan.md).

Monad testnet **10143** is the default. Mainnet **143** requires explicit configuration. Never use a mainnet market address on testnet. The sample Kuru address is a documented deployment reference, not a liquidity or execution guarantee.

## Workspace

| Path | Purpose |
|---|---|
| `apps/web` | Next.js app, conditional Privy login, server configuration and health endpoint |
| `apps/extension` | Manifest V3 development extension; adds creator evidence links to X posts |
| `packages/domain` | Validated chain, identity, stake and trade-intent types; integer token amounts |
| `packages/integrations` | Monad/Kuru market configuration, sponsor status, server-use Nansen client |
| `packages/database` | Drizzle/Postgres schema and versioned SQL migrations |
| `contracts` | Refundable ERC20 stake contract and Foundry tests |
| `services/indexer` | Envio stake event configuration, schema and snapshot handlers |

## Privy and provider configuration

Set `NEXT_PUBLIC_PRIVY_APP_ID` in `apps/web/.env.local`. Enable Twitter login, embedded Ethereum wallets and `http://localhost:3000` as an allowed origin in the Privy dashboard. The login button only loads Privy when configured. Set server-only `PRIVY_APP_SECRET`, `NEXT_PUBLIC_APP_URL` and the database connection to enable identity binding on `/creator/profile`. The server verifies Privy access tokens and fetches linked accounts; an explicit off-chain wallet signature proves ownership with an expiring, single-use nonce. The real project X login, user-approved embedded-wallet ownership signature and persisted binding after page refresh have been verified. See [identity binding](docs/identity-binding.md). Login alone does not qualify for the bounty.

Server credentials (`PRIVY_APP_SECRET`, `NANSEN_API_KEY`, `DATABASE_URL`) must never use the `NEXT_PUBLIC_` prefix. No credentials are required to view the foundation. Nansen requests are not automatically issued; the fixed-host client currently allows only the documented TGM holders endpoint. Use the server-only web wrapper when adding evidence services. Nansen mainnet coverage must be checked for the selected assets; testnet is not a supported substitute.

The required sponsors and their completion evidence are tracked in [SPONSORS.md](SPONSORS.md). Optional AI models, Aurora and CRE remain outside this phase.

## Chrome extension

```sh
pnpm --filter @call-my-bluff/extension build
```

In Chrome, open `chrome://extensions`, enable developer mode and load `apps/extension/dist` as an unpacked extension. Open X. The extension adds **View creator evidence** links to visible posts; the local app must be running. Its current app origin is deliberately fixed to `http://localhost:3000` in `src/content.ts` and `src/popup.ts`. Set an HTTPS origin for a production build.

This build has no verified tick or trade controls. A future badge needs verified account ownership plus current indexed stake, with a freshness policy. Only extension users see injected UI. X DOM selectors may change; isolate changes in `content.ts`.

## Stake contract

```sh
pnpm contracts:build
pnpm contracts:test
pnpm contracts:abi
```

`CreatorStake` accepts a conventional non-rebasing ERC20 and has immutable token, minimum and cooldown settings. Deposits are refundable. `requestWithdrawal()` immediately disables `isActive`; `withdraw()` returns the full balance once the cooldown expires. Cancelling restores stake eligibility and a later request starts a new cooldown. No admin withdrawal or slashing exists. Full `StakeUpdated` snapshots support idempotent indexing.

The proposed deployment uses a seven-day cooldown (`604800` seconds). A nominal $500 stake means `500 * 10^tokenDecimals` for a chosen stablecoin; the contract does not assert a USD exchange rate. Verify the actual token address and decimals before deployment. Fee-on-transfer deposits are rejected. Deployment is intentionally not performed by setup. This is development code, not a production audit.

## Envio

```sh
pnpm indexer:codegen
pnpm --filter @call-my-bluff/indexer typecheck
```

The initial config uses **no contract addresses**, so it cannot index deployed stake events yet. After deploying on testnet, set that exact address and deployment `start_block` in `services/indexer/config.yaml`, then regenerate and run `pnpm --filter @call-my-bluff/indexer dev` with Docker available. Add the GraphQL endpoint to the web environment after verifying indexed events.

Position IDs include chain, contract and wallet. Event IDs include chain, block and log index. Handlers replace full balances rather than accumulating deltas, making repeated event handling idempotent. Kuru order/fill contracts and finality/freshness handling will be added after validating the chosen market's event ABI.

## Database

```sh
docker compose up -d postgres
pnpm db:migrate
```

Local Postgres is bound to loopback port **5433**. The checked-in development credentials are for this local container only. Drizzle commands run from `packages/database`; they use its process `DATABASE_URL` or the local fallback, and do not load the web `.env.local`. Supply `DATABASE_URL` explicitly for another database. Do not point development migration commands at production by accident.

`pnpm db:generate` generates a migration after schema changes. The identity APIs persist verified creator bindings and expiring ownership challenges. Store only verified stable X IDs and wallet bindings. Raw token amounts use decimal integer strings / SQL `numeric(78,0)`; actual fills remain distinct from intents and hypothetical call outcomes.

The local database has now been started and the initial migration applied. To verify your own environment, set `DATABASE_URL` explicitly and run `pnpm db:check`. Remote URLs must specify `sslmode=verify-full`; certificate verification remains enabled for runtime connections and migrations. Use the AWS RDS certificate trust bundle if required by the chosen deployment. Do not commit connection credentials.

Mumbai cloud database template, bootstrap and access boundaries: [AWS database setup](infrastructure/aws/README.md). Set server-only `DATABASE_CA_FILE` to the local trusted CA bundle path when using RDS.

`/api/ready` performs a live database check and returns `ready`, `migration_required`, `unconfigured` or `unavailable`; non-ready states return HTTP 503. It checks the six required tables, including wallet challenges, not provider access or full application readiness. `/api/health` remains the lightweight configuration/liveness endpoint. No account records or fixtures are seeded by these checks.

## Checks

```sh
pnpm indexer:codegen
pnpm check
```

Checks include Biome, TypeScript, domain/provider boundary tests, Foundry stake tests and web/extension production builds. Indexer codegen is required before its TypeScript check on a fresh checkout. CI runs it automatically and migrates a local Postgres service for the identity integration tests. Run `IDENTITY_TEST_DATABASE_URL=postgresql://cmb:cmb_local@localhost:5433/call_my_bluff pnpm check` to include those tests locally. No credentials, blockchain transactions or paid provider requests are needed.

## Next milestone

1. Confirm remaining provider access and market feasibility; the real X/wallet binding and persistence-after-refresh check are complete.
2. Deploy and prove Privy-signed stake deposit, request/cancel and withdrawal on testnet.
3. Read Kuru market parameters, simulate approval/order transactions, obtain explicit wallet approval, and reconcile actual fills.
4. Deploy Envio and drive badges and portfolio from indexed events with finality/freshness indicators.
5. Add sourced Nansen mainnet evidence with timestamps, coverage and unavailable states, then implement a transparent call-scoring methodology.

Research and references live in `docs/research`. Implementation is original; the KOLlateral/XSwap references are architectural inspiration, not imported source.
