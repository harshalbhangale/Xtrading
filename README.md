# Tradepost

Creator evidence and spot/perp trading from X, built on Monad. The product includes a landing page, creator studio, user dashboard, Chrome extension and planned MCP server.

Identity binding works. Both stake contracts and mUSDC are deployed and verified on testnet. A wallet-approved 500 mUSDC deposit is confirmed and indexed by Envio; the authenticated stake page now reads indexed history. The X extension adds verified-creator badges, trade-call detection (Groq, or rules without a key), a call-check drawer with the creator record and a Nansen wallet check, and reviewed Kuru spot / Perpl perp trades; providers without keys run in labelled demo mode. Confirmed Kuru fills, a live Perpl order, a keyed Nansen run, CRE workflow and MCP remain pending.

Live withdrawal request and cancellation were confirmed and indexed; the 500 mUSDC stake is active again. The extension implements separate binding/stake indicators, evidence details and spot trade review links. Chrome installation and real-X validation are pending. Its public evidence endpoint exposes recorded stable-X-ID bindings and requires fresh matching RPC/Envio data before showing active stake.

Live: https://tradepostapp.vercel.app (Monad testnet). See [Deployment](#deployment).

## Run locally

Requirements: Node.js 22+, pnpm 11.1.3 and Foundry. Docker is used for local Postgres and the Envio runtime.

```sh
pnpm install --frozen-lockfile
# On first setup only; preserve an existing .env.local.
cp apps/web/.env.example apps/web/.env.local
pnpm indexer:codegen
pnpm dev
```

Open http://localhost:3000. Public pages work without credentials. Login and persisted identity need Privy and the database configured.

Monad testnet **10143** is the default. Mainnet requires explicit configuration; stake actions currently support testnet only. Token amounts use bigint or decimal integer strings.

## Workspace

| Path | Purpose |
|---|---|
| `apps/web` | Next.js pages, authenticated APIs and wallet review |
| `apps/extension` | Manifest V3 X extension |
| `packages/domain` | Runtime schemas and shared types |
| `packages/integrations` | Chain, market, stake and provider adapters |
| `packages/database` | Postgres schema, identity service and migrations |
| `contracts` | Refundable stake, mock USDC and Foundry tests |
| `services/indexer` | Envio stake event handlers and generated bindings |

## Configuration

Use `apps/web/.env.local` for `NEXT_PUBLIC_PRIVY_APP_ID`, `PRIVY_APP_SECRET`, `NEXT_PUBLIC_APP_URL`, `MONAD_RPC_URL` and `DATABASE_URL`. Optional: `GROQ_API_KEY`, `NANSEN_API_KEY` and the `PERPL_*` keys (see `.env.example`); each runs in labelled demo mode when empty. Keep provider secrets server-only. Enable Twitter login, EVM embedded wallets and the app origin in Privy.

Remote database connections require `sslmode=verify-full` and the trusted RDS CA bundle through `DATABASE_CA_FILE`. `/api/health` reports configuration presence; `/api/ready` checks the six required database tables.

Local database:

```sh
docker compose up -d postgres
pnpm db:migrate
pnpm db:check
```

The migration CLI uses its process `DATABASE_URL` or the local fallback on port 5433; it does not load the web environment. Use the documented AWS bootstrap for RDS migrations and grants.

## Extension

```sh
pnpm --filter @call-my-bluff/extension build
```

In Chrome, enable developer mode at `chrome://extensions` and load `apps/extension/dist`. See [X extension](docs/x-extension.md).

## Contracts and indexer

The stake contract accepts a fixed ERC20 and has a seven-day cooldown. Withdrawal requests immediately disable active-stake eligibility. Cancellation restores eligibility when the threshold is met. There is no administrator withdrawal or slashing.

mUSDC has six decimals, no monetary value and an initial 10,000-token mint. Using it requires explicit mock mode and a matching stake deployment. Confirmed Circle-token deployment details are in `contracts/deployments/monad-testnet.json`.

```sh
pnpm contracts:build
pnpm contracts:test
pnpm contracts:abi
pnpm indexer:codegen
```

Envio also indexes Kuru V2 swaps, deposits, withdrawals and account registrations for the portfolio and activity pages. Set `ENVIO_MONAD_RPC_URL` in `services/indexer/.env` to use a keyed RPC; adding contracts requires `envio start -r` (local projection rebuild). Envio is running locally and has indexed the first mock stake deposit, using contract-qualified position IDs, reorg rollback, a ten-block indexing lag and a 200-block reorg window. Its local database is isolated from the app database. The stake page shows up to 20 indexed balance updates, indexing progress and current/lagging/unavailable states. Extension projections are not connected yet.

To run locally, copy `services/indexer/.env.example` to `.env`, run `docker compose -p cmb-stake-indexer -f services/indexer/docker-compose.yml up -d`, then `pnpm --filter @call-my-bluff/indexer start`. Hasura is bound to localhost port 8081; its local development admin secret is `testing`. These settings are for local development only. Indexed history remains empty until stake events occur; a block lag is not a claim of chain finality.

Set server-only `ENVIO_GRAPHQL_URL=http://localhost:8081/v1/graphql` and `ENVIO_HASURA_ADMIN_SECRET=testing` for local app access. The authenticated endpoint scopes queries to the current bound wallet and configured contract, validates integer strings and timestamps, and compares indexer freshness and latest balance to the RPC snapshot. Unavailable indexing does not disable direct chain reads or transaction review. Hasura must stringify numeric types; never convert token balances through JavaScript numbers.

## Deployment

- **Web:** Vercel project `tradepostapp`, root directory `apps/web`, Node 22, function region `bom1`. Pushes to `main` deploy to production. Environment variables mirror `apps/web/.env.example`; `NEXT_PUBLIC_APP_URL` must equal the production origin because POST routes check it. Add that origin to the Privy app's allowed domains.
- **Database:** AWS RDS (ap-south-1). Hosted runtimes pass the regional CA bundle as `DATABASE_CA_PEM`. Run schema changes with the bootstrap in `infrastructure/aws`.
- **Indexer:** Envio Hosted Service project `tradepost` (root `services/indexer`, `config.yaml`). Push to the `envio` branch to redeploy (`git push origin main:envio`) only when the indexer changes; the free plan keeps 3 deployments. Each deployment has its own GraphQL URL, so update Vercel `ENVIO_GRAPHQL_URL` afterwards. `ENVIO_MONAD_RPC_URL` can be set in Envio's environment variables for faster syncs.
- **Extension:** `pnpm --filter @call-my-bluff/extension package` builds for the production origin and writes `apps/web/public/downloads/tradepost-extension.zip`, served from the extension page. Re-run it after extension changes. A production build only talks to that origin; `build` without the variable targets localhost.

## Checks

```sh
IDENTITY_TEST_DATABASE_URL=postgresql://cmb:cmb_local@localhost:5433/call_my_bluff pnpm check
```

Checks include formatting, TypeScript, application tests, local identity integration tests, Foundry and web/extension builds. Latest local results: 22 application tests and 12 Foundry tests passed; six database integration tests were skipped without a test database URL. CI provisions its own Postgres service.

## Developer documents

- [Delivery checklist](docs/implementation-plan.md)
- [Frontend and API handoff](docs/frontend-handoff.md)
- [Architecture](docs/architecture.md)
- [Required sponsors](SPONSORS.md)
- [X extension](docs/x-extension.md)
- [Component references](docs/references.md)
- [Identity binding](docs/identity-binding.md)
- [Stake transactions](docs/stake-transactions.md)
- [Mock USDC](docs/mock-usdc.md)
- [AWS database setup](infrastructure/aws/README.md)
