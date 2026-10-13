# Xtrading

Creator evidence and spot/perp trading from X, built on Monad. The product includes a landing page, creator studio, user dashboard, Chrome extension and MCP server. Supported spot tickers expand into an inline Buy/Sell card inside the post. Creator payouts are opt-in; staking is optional and separate.

Identity binding works. Both stake contracts and mUSDC are deployed and verified on testnet. A wallet-approved 500 mUSDC deposit is confirmed and indexed by Envio; the authenticated stake page now reads indexed history. The X extension adds creator records on profile headers, trade-call detection (Groq, or rules without a key), a call-check drawer with the creator record and a Nansen wallet check, and reviewed Kuru spot / Perpl perp trades; providers without keys run in labelled demo mode. The MCP server is live. The Chainlink CRE settlement workflow for bonded calls has run end to end on a local Monad fork (success and slash paths); its testnet deployment is pending. Confirmed Kuru fills, a live Perpl order and a keyed Nansen run remain pending.

Live withdrawal request and cancellation were confirmed and indexed; the 500 mUSDC stake is active again. The extension implements separate binding/stake indicators, evidence details and spot trade review links. Chrome installation and real-X validation are pending. Its public evidence endpoint exposes recorded stable-X-ID bindings and requires fresh matching RPC/Envio data before showing active stake.

Profile cards and creator pages now expand to show ongoing registered calls and indexed Kuru swaps. Optional browser-only follow observations populate Watchlist without a paid X following API. This covers accounts you view, not the full following graph; creator-owned Perpl positions remain pending. See [setup and limits](docs/browser-following.md).

Live: https://xtradingnow.xyz (Monad testnet). See [Deployment](#deployment).

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

## Mainnet spot (Kuru)

The dashboard sidebar has a Testnet / Mainnet switch, which is remembered per browser; a `?chainId=` link overrides it. Testnet is the default. Mainnet uses Kuru's mainnet order books (MON, WETH and cbBTC against USDC, verified onchain at every quote). A market order spends straight from the wallet: one exact approval to the order book for USDC buys, then one immediate-or-cancel order with a minimum output derived from an `eth_call` of the same order. There is no Kuru account, deposit or deadline on mainnet, and limit-order minimum sizes do not apply. Mainnet is off unless the server sets `KURU_MAINNET_ENABLED=true`. Perpl and staking remain testnet-only in the app. Run `KURU_MAINNET_FORK_RPC=http://127.0.0.1:8549 pnpm test` against `anvil --fork-url https://rpc.monad.xyz --port 8549` to execute both order types on a fork.

Embedded Privy wallets confirm in Privy's dialog; external wallets (MetaMask, Rabby) receive the reviewed transaction through their own provider. The server never signs.

## Inline trading and creator payments

Extension 0.7.0 adds compact ticker cards, Buy/Sell expansion, explicit network selection, expiring book indications and a separate creator-record disclosure. `/trade/inline` is a compact wallet window without the dashboard sidebar. Quotes carry no authentication; balances, gas, allowance and minimum output are checked in authenticated review.

Creators register the wallet already proved through their X binding at `/creator/earnings`. Eligible mainnet buys can include an explicitly selected 0.5% creator fee, deducted from bought-token output. The adapter builds one configured Kuru order-book route through the fixed Kuru Flow entrypoint, approves the exact USDC budget and enforces the buyer's net minimum. No fee is charged for unregistered creators, testnet trades or fee-disabled trades. Self-referral from the bound buyer wallet is rejected. Account linking proves control, not unique humanity. Source-post attribution remains browser-supplied and unverified.

Fee execution requires both `KURU_MAINNET_ENABLED=true` and `CREATOR_FEES_ENABLED=true`. Mainnet fork tests verified buyer receipt, same-transaction creator payment, exact allowance consumption, and atomic failure with no payout. No real fee-paying wallet transaction has been completed yet. To rerun the three fork tests:

```sh
KURU_FEE_FORK_RPC=https://rpc.monad.xyz forge test --root contracts --match-contract KuruCreatorFeeForkTest --evm-version cancun -vv
```

Envio's new mainnet projection records actual `FeeCollected` and `KuruFlowSwap` events from block 112914000. The earnings API checks recipient scope, canonical block hashes and indexer freshness. Hosted redeployment and its GraphQL endpoint update are required before live earnings history is available. Registration and quotes never count as earnings. Testnet V2 builder-fee support is still pending.

## Bonded calls (Chainlink CRE)

`contracts/src/CallSettlement.sol` holds opt-in call bonds, separate from refundable stake. A creator registers a call (asset, direction, target move, 1h–30d horizon, bond); its window starts at the registration block. Every hour, the workflow in `services/cre/settlement` reads due calls at a finalized block. It fetches the opens of the Binance 1-minute candles at the window start and expiry; each node fetches independently and the median is agreed. It then writes one signed report through the Chainlink forwarder. Success returns bond + reward, failure moves the bond into the reward pool, and a tie returns the bond. A missing price never slashes; the bond is refundable after three days.

```sh
cd services/cre/settlement && bun install && bun test
services/cre/scripts/fork-e2e.sh ETH 0 1   # asset, direction (0 Up, 1 Down), target bps
```

The script forks Monad testnet about three hours back (anvil dev account, port 8548). It deploys against the simulation forwarder, registers and funds a call, and moves time past expiry. Then it runs `cre workflow simulate --broadcast` and prints the onchain outcome. The testnet contract (`contracts/deployments/call-settlement-monad-testnet.json`) currently trusts the simulation forwarder so `cre workflow simulate settlement --target staging-settings --broadcast` settles real calls; switch it with `setForwarder` once the workflow is deployed. Set `CALL_SETTLEMENT_ADDRESS` for the app. Deploy the contract with the production forwarder `0xF8344CFd5c43616a4366C34E3EEE75af79a74482`, set `settlementAddress` in `config.staging.json`, and deploy the workflow.

## Deployment

- **Web:** Vercel project `xtradingnow`, root directory `apps/web`, Node 22, function region `bom1`. Production domain `xtradingnow.xyz` (Vercel nameservers); `www`, `xtradingtoday.vercel.app`, `tradepostapp.vercel.app` and `nomorebluff.vercel.app` 308-redirect to it. Pushes to `main` deploy to production. Environment variables mirror `apps/web/.env.example`; `NEXT_PUBLIC_APP_URL` must equal the production origin because POST routes check it. Add that origin to the Privy app's allowed domains.
- **Database:** AWS RDS (ap-south-1). Hosted runtimes pass the regional CA bundle as `DATABASE_CA_PEM`. Run schema changes with the bootstrap in `infrastructure/aws`.
- **Indexer:** Envio Hosted Service project `tradepost` (root `services/indexer`, `config.yaml`). Push to the `envio` branch to redeploy (`git push origin main:envio`) only when the indexer changes; the free plan keeps 3 deployments. Each deployment has its own GraphQL URL, so update Vercel `ENVIO_GRAPHQL_URL` afterwards. `ENVIO_MONAD_RPC_URL` can be set in Envio's environment variables for faster syncs.
- **MCP:** `https://xtradingnow.xyz/api/mcp` (Streamable HTTP, stateless). Signed-in tools take the user's Privy access token as `Authorization: Bearer`, copied from `/integrations`. No tool signs or submits.
- **Extension:** `pnpm --filter @call-my-bluff/extension package` builds for the production origin and writes `apps/web/public/downloads/xtrading-extension.zip`, served from the extension page. Re-run it after extension changes. A production build only talks to that origin; `build` without the variable targets localhost.

## Checks

```sh
IDENTITY_TEST_DATABASE_URL=postgresql://cmb:cmb_local@localhost:5433/call_my_bluff pnpm check
```

Checks include formatting, TypeScript, application tests, local identity integration tests, Foundry and web/extension builds. Six database integration tests are skipped without a test database URL; CI provisions its own Postgres service. Mainnet fork suites require their explicit RPC variables and do not run as ordinary offline checks.

## Developer documents

- [Delivery checklist](docs/implementation-plan.md)
- [Frontend and API handoff](docs/frontend-handoff.md)
- [Architecture](docs/architecture.md)
- [Required sponsors](SPONSORS.md)
- [X extension](docs/x-extension.md)
- [Component references](docs/references.md)
- [Kollateral review and accountability roadmap](docs/kollateral-reference-review.md)
- [Identity binding](docs/identity-binding.md)
- [Stake transactions](docs/stake-transactions.md)
- [Mock USDC](docs/mock-usdc.md)
- [AWS database setup](infrastructure/aws/README.md)
