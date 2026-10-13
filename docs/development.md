# Development

Everything needed to run, test and deploy Xtrading. For the product overview see the [README](../README.md).

## Run locally

Requirements: Node.js 22+, pnpm 11.1.3 and Foundry. Docker is used for local Postgres and the Envio runtime.

```sh
pnpm install --frozen-lockfile
# On first setup only; preserve an existing .env.local.
cp apps/web/.env.example apps/web/.env.local
pnpm indexer:codegen
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). Public pages work without credentials. Login and persisted identity need Privy and the database configured.

The dashboard defaults to Monad testnet **10143**. Every trade displays its network and requires approval. Staking is removed from the app. Token amounts use bigint or decimal integer strings.

## Workspace


| Path                    | Purpose                                                           |
| ----------------------- | ----------------------------------------------------------------- |
| `apps/web`              | Next.js pages, authenticated APIs and wallet review               |
| `apps/extension`        | Manifest V3 X extension                                           |
| `packages/domain`       | Runtime schemas and shared types                                  |
| `packages/integrations` | Chain, market, stake and provider adapters                        |
| `packages/database`     | Postgres schema, identity service and migrations                  |
| `contracts`             | Kuru creator-fee fork tests and legacy stake/mock-token contracts |
| `services/indexer`      | Envio HyperIndex Kuru and creator-fee handlers                    |




## Configuration

Use `apps/web/.env.local` for `NEXT_PUBLIC_PRIVY_APP_ID`, `PRIVY_APP_SECRET`, `NEXT_PUBLIC_APP_URL`, `MONAD_RPC_URL` and `DATABASE_URL`. Optional: `GROQ_API_KEY`, `NANSEN_API_KEY` and the `PERPL_*` keys (see `.env.example`); missing provider credentials must show demo or unavailable states, never fabricated live evidence. Keep provider secrets server-only. Enable Twitter login, EVM embedded wallets and the app origin in Privy.

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

In Chrome, enable developer mode at `chrome://extensions` and load `apps/extension/dist`. See [X extension](x-extension.md).

## Contracts and indexer

`contracts/src` holds `CreatorStake` (retired: staking was removed from the app, contracts left untouched) and `MockUSDC` (demo token). Foundry tests cover stake accounting and the mock token; `KuruCreatorFeeFork.t.sol` executes creator-fee buys at every tier rate against Kuru's mainnet contracts (`KURU_FEE_FORK_RPC=https://rpc.monad.xyz forge test --evm-version prague`).

```sh
pnpm contracts:build
pnpm contracts:test
pnpm contracts:abi
pnpm indexer:codegen
```

The latest HyperIndex handlers cover historical stake events, Kuru V2 swaps, deposits, withdrawals and account registrations and mainnet Kuru Flow creator payments. The older hosted build does not expose all those entities. The web app also directly queries HyperSync for current creator payments. Event IDs are chain:block:logIndex with reorg rollback, a ten-block lag and freshness checks against the chain head. Set `ENVIO_MONAD_RPC_URL` in `services/indexer/.env` for a keyed RPC; adding contracts requires `envio start -r`.

To run locally, copy `services/indexer/.env.example` to `.env`, run `docker compose -p cmb-stake-indexer -f services/indexer/docker-compose.yml up -d`, then `pnpm --filter @call-my-bluff/indexer start`. Hasura is bound to localhost port 8081; its local development admin secret is `testing`. These settings are for local development only. Indexed history remains empty until stake events occur; a block lag is not a claim of chain finality.

Set server-only `ENVIO_GRAPHQL_URL=http://localhost:8081/v1/graphql` and `ENVIO_HASURA_ADMIN_SECRET=testing` for local app access. The authenticated endpoint scopes queries to the current bound wallet and configured contract, validates integer strings and timestamps, and compares indexer freshness and latest balance to the RPC snapshot. Unavailable indexing does not disable direct chain reads or transaction review. Hasura must stringify numeric types; never convert token balances through JavaScript numbers.

## Mainnet spot (Kuru)

The dashboard sidebar has a Testnet / Mainnet switch, which is remembered per browser; a `?chainId=` link overrides it. Testnet is the default. Mainnet uses Kuru's mainnet order books (MON, WETH and cbBTC against USDC, verified onchain at every quote). A market order spends straight from the wallet: one exact approval to the order book for USDC buys, then one immediate-or-cancel order with a minimum output derived from an `eth_call` of the same order. There is no Kuru account, deposit or deadline on mainnet, and limit-order minimum sizes do not apply. Mainnet is off unless the server sets `KURU_MAINNET_ENABLED=true`. Staking is removed. Run `KURU_MAINNET_FORK_RPC=http://127.0.0.1:8549 pnpm test` against `anvil --fork-url https://rpc.monad.xyz --port 8549` to execute both order types on a fork.

## Mainnet perps (Perpl)

Perpl mainnet (chain 143, Exchange `0x34B6552d57a35a1D042CcAe1951BD1C370112a6F`, AUSD `0x00000000eFE302BEAA2b3e6e1b18d08D69a9012a`) uses the same wallet flow as testnet: the user's own wallet signs an exact AUSD approval, account funding and an immediate-or-cancel `execOrder`, and fills are read from the receipt. It has its own switch, `PERPL_MAINNET_ENABLED=true`, separate from Kuru's, and never falls back to testnet. Mainnet caps are lower and separate: `PERPL_MAINNET_MAX_LEVERAGE` (default 3), `PERPL_MAINNET_MAX_COLLATERAL` (AUSD margin one order may lock, default 50) and an optional `PERPL_MAINNET_MAX_SIZE`. API routes take `chainId` (`143`, default `10143`); the account route takes `?chainId=143` and `/api/markets` takes `?perplChainId=143`. Market IDs differ per network (ETH is 32 on testnet, 20 on mainnet). The X extension stays on testnet.

Embedded Privy wallets confirm in Privy's dialog; external wallets (MetaMask, Rabby) receive the reviewed transaction through their own provider. The server never signs.

## Inline trading and creator payments

Extension 0.11.1 implements compact ticker cards, Buy/Sell expansion, explicit network selection, book-history charts and a separate creator-record disclosure. `/trade/inline` is a compact wallet window without the dashboard sidebar. Quotes carry no authentication; balances, gas, allowance and minimum output are checked in authenticated review.

Creators register the wallet already proved through their X binding at `/creator/earnings`. Mainnet buys from a registered creator's post include a disclosed tier-based creator fee, deducted from the bought-token output. The adapter builds one configured Kuru order-book route through the fixed Kuru Flow entrypoint, approves the exact USDC budget and enforces the buyer's net minimum. No fee is charged for unregistered creators, testnet trades or fee-disabled trades. Self-referral from the bound buyer wallet is rejected. Account linking proves control, not unique humanity. Source-post attribution remains browser-supplied and unverified.

Fee execution requires both `KURU_MAINNET_ENABLED=true` and `CREATOR_FEES_ENABLED=true`. Mainnet fork tests verified buyer receipt, same-transaction creator payment, exact allowance consumption, and atomic failure with no payout. A fee-paying mainnet transaction is linked in the [README](../README.md#live-on-monad). To rerun the fork tests:

```sh
KURU_FEE_FORK_RPC=https://rpc.monad.xyz forge test --root contracts --match-contract KuruCreatorFeeForkTest --evm-version prague -vv
```

Envio's new mainnet projection records actual `FeeCollected` and `KuruFlowSwap` events from block 112914000. The earnings API checks recipient scope, canonical block hashes and indexer freshness. Live earnings fall back to server-side HyperSync when the hosted fee entity is absent; the public `/dashboard/onchain` page shows actual fee payments. Set server-only `ENVIO_API_TOKEN` in the web environment. Registration and quotes never count as earnings. Testnet V2 builder-fee support is still pending.

## Deployment

- **Web:** Vercel project `xtradingnow`, root directory `apps/web`, Node 22, function region `bom1`. Production domain `xtradingnow.xyz` (Vercel nameservers); `www`, `xtradingtoday.vercel.app`, `tradepostapp.vercel.app` and `nomorebluff.vercel.app` 308-redirect to it. Pushes to `main` deploy to production. Environment variables mirror `apps/web/.env.example`; `NEXT_PUBLIC_APP_URL` must equal the production origin because POST routes check it. Add that origin to the Privy app's allowed domains.
- **Database:** AWS RDS (ap-south-1). Hosted runtimes pass the regional CA bundle as `DATABASE_CA_PEM`. Run schema changes with the bootstrap in `infrastructure/aws`.
- **Indexer:** Envio Hosted Service project `tradepost` (root `services/indexer`, `config.yaml`). Push to the `envio` branch to redeploy (`git push origin main:envio`) only when the indexer changes; the free plan keeps 3 deployments. Each deployment has its own GraphQL URL, so update Vercel `ENVIO_GRAPHQL_URL` afterwards. `ENVIO_MONAD_RPC_URL` can be set in Envio's environment variables for faster syncs.
- **MCP:** `https://xtradingnow.xyz/api/mcp` (Streamable HTTP, stateless). Signed-in tools take the user's Privy access token as `Authorization: Bearer`, copied from `/integrations`. No tool signs or submits. Tool reference: [mcp.md](mcp.md).
- **Extension:** `pnpm --filter @call-my-bluff/extension package` builds for the production origin and writes `apps/web/public/downloads/xtrading-extension.zip`, served from the extension page. Re-run it after extension changes. A production build only talks to that origin; `build` without the variable targets localhost.



## Checks

```sh
IDENTITY_TEST_DATABASE_URL=postgresql://cmb:cmb_local@localhost:5433/call_my_bluff pnpm check
```

`pnpm check` runs formatting, TypeScript, the Vitest suite, Foundry tests and the web/extension builds. Database integration tests need `IDENTITY_TEST_DATABASE_URL` (CI provisions Postgres); mainnet fork suites need their RPC variables and are skipped otherwise.
