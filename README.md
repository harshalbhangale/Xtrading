# Call My Bluff

Creator evidence and spot trading from X, built on Monad. The product includes a landing page, creator studio, user dashboard, Chrome extension and planned MCP server.

Identity binding works. The Circle-token stake contract and mock USDC are deployed on testnet. Deposits, live indexing, Kuru trading, Nansen insights and MCP remain pending.

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

Use `apps/web/.env.local` for `NEXT_PUBLIC_PRIVY_APP_ID`, `PRIVY_APP_SECRET`, `NEXT_PUBLIC_APP_URL`, `MONAD_RPC_URL` and `DATABASE_URL`. Keep provider secrets server-only. Enable Twitter login, EVM embedded wallets and the app origin in Privy.

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

In Chrome, enable developer mode at `chrome://extensions` and load `apps/extension/dist`. The current extension adds creator-evidence links using `http://localhost:3000`. Live badges, popovers and trading controls are pending.

## Contracts and indexer

The stake contract accepts a fixed ERC20 and has a seven-day cooldown. Withdrawal requests immediately disable active-stake eligibility. Cancellation restores eligibility when the threshold is met. There is no administrator withdrawal or slashing.

mUSDC has six decimals, no monetary value and an initial 10,000-token mint. Using it requires explicit mock mode and a matching stake deployment. Confirmed Circle-token deployment details are in `contracts/deployments/monad-testnet.json`.

```sh
pnpm contracts:build
pnpm contracts:test
pnpm contracts:abi
pnpm indexer:codegen
```

Envio is configured for the recorded Circle-token stake deployment, but its runtime is not running. After selecting the matching mock deployment, update the exact address/start block and regenerate before starting it.

## Checks

```sh
IDENTITY_TEST_DATABASE_URL=postgresql://cmb:cmb_local@localhost:5433/call_my_bluff pnpm check
```

Checks include formatting, TypeScript, application tests, local identity integration tests, Foundry and web/extension builds. Latest local results: 19 application tests and 12 Foundry tests passed. CI provisions its own Postgres service.

## Developer documents

- [Delivery checklist](docs/implementation-plan.md)
- [Frontend and API handoff](docs/frontend-handoff.md)
- [Architecture](docs/architecture.md)
- [Required sponsors](SPONSORS.md)
- [Component references](docs/references.md)
- [Identity binding](docs/identity-binding.md)
- [Stake transactions](docs/stake-transactions.md)
- [Mock USDC](docs/mock-usdc.md)
- [AWS database setup](infrastructure/aws/README.md)
