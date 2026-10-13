# Xtrading

Trade the calls you see on X, and see whether the people making them are worth following. Built on Monad.

- **Chrome extension:** a Buy button inside X's own ticker cards (or an inline card when there is none) with live prices, creator tiers and red flags on posts and profiles, and a call-check drawer.
- **App** ([xtradingnow.xyz](https://xtradingnow.xyz)): a live Terminal of calls from creators you follow, Kuru spot trading on Monad **mainnet and testnet**, Perpl perps (testnet), creator studio, earnings and post analytics, and an MCP server for agents.
- **Creators** link X to a wallet, register calls and inspect performance and post-availability evidence. Staking and subscriptions are removed. Current code implements Pro / Max / Ultra and 0.1/0.5/1/2% creator fees, but the approved **five correct calls with verified profitable user trades** eligibility rule is not implemented yet. Account linking and hypothetical call returns do not establish user profit.
- **Chainlink CRE** has broadcast a real bond-free testnet call settlement. The hourly workflow is implemented; autonomous DON deployment is still pending.

Sponsors: Kuru, Privy, Envio, Nansen, Perpl, Chainlink CRE.

## Deployments and onchain evidence

### Monad mainnet (chain 143)

Xtrading deploys **no contracts on mainnet**. Trading and creator fees run on Kuru's existing contracts:

| Contract | Address |
|---|---|
| Kuru MON/USDC order book | [`0x065C9d28E428A0db40191a54d33d5b7c71a9C394`](https://monadvision.com/address/0x065C9d28E428A0db40191a54d33d5b7c71a9C394) |
| Kuru WETH/USDC order book | [`0xa6aFD386135B7D41A6C40C525abC4A1019b0D132`](https://monadvision.com/address/0xa6aFD386135B7D41A6C40C525abC4A1019b0D132) |
| Kuru cbBTC/USDC order book | [`0x40c49F171202F91ff5d2faE34c22dD2BFdD22aF0`](https://monadvision.com/address/0x40c49F171202F91ff5d2faE34c22dD2BFdD22aF0) |
| Kuru Flow entrypoint (creator fees) | [`0xb3e6778480b2E488385E8205eA05E20060B813cb`](https://monadvision.com/address/0xb3e6778480b2E488385E8205eA05E20060B813cb) |
| USDC | [`0x754704Bc059F8C67012fEd69BC8A327a5aafb603`](https://monadvision.com/address/0x754704Bc059F8C67012fEd69BC8A327a5aafb603) |

**Mainnet demo, 13 Oct 2026** (`scripts/mainnet-demo.sh`, receipts in `contracts/deployments/mainnet-demo.json`), from [`0x02cefD0E0547bb176f508380399A982fAb676A92`](https://monadvision.com/address/0x02cefD0E0547bb176f508380399A982fAb676A92):

| Step | Transaction |
|---|---|
| Approve 1 USDC to the MON/USDC book | [`0xc2de59ec…`](https://monadvision.com/tx/0xc2de59ecede3de1db96ae875b103de57d53457fee1a7f8764d3f75a6f84a3514) |
| Kuru market buy, 1 USDC → MON | [`0x54a19b58…`](https://monadvision.com/tx/0x54a19b582bc439194c7eb6d1494b6336e0c5b96d18abdb9d672b8dfa0d6013fc) |
| Kuru market sell, MON → USDC | [`0x496c1559…`](https://monadvision.com/tx/0x496c1559e65f0086727ab1ca04b92f9ddb80d812b9b1d2421c57981e9ee6db1d) |
| Approve 1 USDC to Kuru Flow | [`0x419458b0…`](https://monadvision.com/tx/0x419458b051d9c744ddb7648d17ccc56c7bf519225ebb8b862f1827395b2deee8) |
| **Creator-fee buy:** 1 USDC → MON, 0.1% (0.0398 MON) paid to creator [`0x51bDFC2a4D1C3B04A89f8CA928bd377B767Df424`](https://monadvision.com/address/0x51bDFC2a4D1C3B04A89f8CA928bd377B767Df424) in the same transaction | [`0x450e00b9…`](https://monadvision.com/tx/0x450e00b927f5b1dc9703b7bbb9fc7ffa52835dfe88ac596632633eb6c1b9d64c) |

All five succeeded; total gas 0.1286 MON.

### Monad testnet (chain 10143)

| Contract | Address | Deploy tx | Status |
|---|---|---|---|
| CallSettlement, bond-free scorecard | [`0x836aa86C5B013f2fbbE0Fc960E88677D4C106BB9`](https://testnet.monadvision.com/address/0x836aa86C5B013f2fbbE0Fc960E88677D4C106BB9) | [`0xa2be13e1…`](https://testnet.monadvision.com/tx/0xa2be13e1944d8ce81e9a6a38df440b0298fe026b70745e237f9fc868bf0269ba) | **Live** (app, CRE, Envio) |
| CallSettlement, bonded | [`0x260264E74028d498a1A10f90dDC4f4b91F3395DF`](https://testnet.monadvision.com/address/0x260264E74028d498a1A10f90dDC4f4b91F3395DF) | [`0x6845266c…`](https://testnet.monadvision.com/tx/0x6845266c2a03460422c7aa5fe47f10ae1a29ddd20ce26439417fab96b313c193) | Retired |
| mUSDC (demo token, no value) | [`0x78928c53A623585317f9102B88C2d76Df66b6825`](https://testnet.monadvision.com/address/0x78928c53A623585317f9102B88C2d76Df66b6825) | [`0x1e2f933c…`](https://testnet.monadvision.com/tx/0x1e2f933ced24e1d53a64aaaa6225f7dd30ffee4c7fd15650fe249884d3bd44a8) | Live |
| CreatorStake (mUSDC) | [`0x9e09b97dBaDc1D6f3A3C5bA9aF0E47923C34634e`](https://testnet.monadvision.com/address/0x9e09b97dBaDc1D6f3A3C5bA9aF0E47923C34634e) | [`0x7490e4ff…`](https://testnet.monadvision.com/tx/0x7490e4ff758eaa24b33ccd6a4e1868b947bbba7d64964ef706abf85f19db447f) | Retired (staking removed) |
| CreatorStake (Circle test USDC) | [`0x4B1a8c4E158E4E3EEa22A62205F1e0CD82d0D5B6`](https://testnet.monadvision.com/address/0x4B1a8c4E158E4E3EEa22A62205F1e0CD82d0D5B6) | [`0x4879d523…`](https://testnet.monadvision.com/tx/0x4879d523495b9a1c1fb59bd4f862d5686b3ca392e3b38f26827558a4b4f7ccf8) | Retired |

External testnet contracts used: Kuru Spot V2 AccountCore [`0xdbaaDe7B42c95399bb1E9614D51B5B9e2cf78038`](https://testnet.monadvision.com/address/0xdbaaDe7B42c95399bb1E9614D51B5B9e2cf78038), MON/USDC [`0x26cd68436B6A4AEB3ec52abC20A4d121f8B4BAc9`](https://testnet.monadvision.com/address/0x26cd68436B6A4AEB3ec52abC20A4d121f8B4BAc9), WETH/USDC [`0x9d187971B64505Ac81f12c5FD2ac9c5247Ec62F3`](https://testnet.monadvision.com/address/0x9d187971B64505Ac81f12c5FD2ac9c5247Ec62F3), WBTC/USDC [`0x8661cB7c5f4f8ae3ee116B63Aa5a23c69110e357`](https://testnet.monadvision.com/address/0x8661cB7c5f4f8ae3ee116B63Aa5a23c69110e357), Kuru test USDC [`0xA402B424f392EAA05DBc8779e4502A1F6A96fEF1`](https://testnet.monadvision.com/address/0xA402B424f392EAA05DBc8779e4502A1F6A96fEF1); Perpl exchange [`0x1964c32f0be608e7d29302aff5e61268e72080cc`](https://testnet.monadvision.com/address/0x1964c32f0be608e7d29302aff5e61268e72080cc); Chainlink CRE simulation forwarder [`0xB9F79d863261869B234c481D1f9A7af84AeAd192`](https://testnet.monadvision.com/address/0xB9F79d863261869B234c481D1f9A7af84AeAd192).

**Chainlink CRE settlements** (workflow `services/cre/settlement`, simulated with `cre workflow simulate --broadcast`):

| Call | Register | Settlement | Outcome |
|---|---|---|---|
| ETH up ≥1 bp, 1h, bond-free scorecard | [`0xdd1347a1…`](https://testnet.monadvision.com/tx/0xdd1347a171cba2c5d9679eb865e76220a92a4ff371fbb20075689dc366d17f31) | [`0x66d7aeed…`](https://testnet.monadvision.com/tx/0x66d7aeed1c4318adf1255639de637eeabab1f824e8951288fc1f71ba47326b59) | **Correct** ($2,507.63 → $2,519.53) |
| ETH up ≥1 bp, 1h, 100 mUSDC bond | [`0xabfab781…`](https://testnet.monadvision.com/tx/0xabfab781dbb3b59d4a51fbe85e1e674244b25756d850e971ad542bb3e92bd7bc) | [`0xb9dc4db9…`](https://testnet.monadvision.com/tx/0xb9dc4db91ff4cb92d91d956b23d0689cbb44bf36186a0c9968ecd54ba60003f1) | Wrong, bond slashed ($2,521.23 → $2,512.86) |

**Stake lifecycle (historical, before staking was removed):** approve [`0x3a0b312a…`](https://testnet.monadvision.com/tx/0x3a0b312a96ba761a66f39d092d69015a1c3a042cc9bbcebaff69fd0d0eb84463), 500 mUSDC deposit [`0x7bef5d5e…`](https://testnet.monadvision.com/tx/0x7bef5d5e099a400590b24dfc1b43d0d217673068412b39176d4b08467b946427), withdrawal request [`0xcafe4f4d…`](https://testnet.monadvision.com/tx/0xcafe4f4d12bfd5af50f5bc8f873cdf7f698b431be68faf6060b918d91688f622), cancellation [`0x06615685…`](https://testnet.monadvision.com/tx/0x06615685b97e0d6e0d5d12148c30d21032f9545f1d0fe612c23588a125cb3879); all indexed by Envio.

### Services

| Service | Where | Status |
|---|---|---|
| Web app and API | [xtradingnow.xyz](https://xtradingnow.xyz) (Vercel) | Live |
| MCP server | `https://xtradingnow.xyz/api/mcp` | Live |
| Chrome extension 0.11.1 | [xtradingnow.xyz/extension](https://xtradingnow.xyz/extension) | Live download |
| Envio | HyperIndex supplies historical Kuru testnet activity. HyperSync supplies current mainnet creator payments and bond-free testnet call settlements | `/dashboard/onchain` shows canonical receipt-checked events, progress and freshness; authenticated earnings use HyperSync if the hosted entity is unavailable |
| Chainlink CRE workflow | `tradepost-settlement-staging`, Monad testnet selector `2183018362218727504` | Simulated with broadcast; DON deployment needs Chainlink access |

### Current delivery checklist — verified 13 October 2026

“Verified” means there is a checked live response or receipt. “Implemented” means the code exists; it is not proof that the complete user flow has been demonstrated.

| Area | What is done | What remains |
|---|---|---|
| App and identity | Live frontend/API and database readiness; Privy X login, embedded wallets and nonce-protected wallet binding implemented | Rehearse onboarding with the exact demo account; linking proves account control, not unique humanity |
| X extension | Version 0.11.1: inline ticker Buy/Sell, explicit networks, wallet handoff, profile records, image/address capture and observed-follow sync | Verify the installed build on real X through signing, confirmed fill and dashboard attribution; mobile uses a web handoff, not a native-X extension |
| Kuru | Real scripted mainnet buy, sell and same-transaction creator payment; recorded testnet fill; live prices and book-history charts | Complete one trade from the actual X interface and confirm output, fee and history together |
| Envio | Live HyperSync payment and bond-free settlement evidence; creator earnings fallback; HyperIndex testnet activity | Repair the hosted GitHub deployment connection for the newest HyperIndex handlers; this does not block the HyperSync demo |
| Creator analytics | Call records, outcomes, sample sizes, tier calculation and repeated post-availability flags implemented | Implement verified realized-profit accounting and the five-call fee gate; missing posts must remain “not publicly available,” not assumed deleted |
| Perpl | Testnet market/account reads, capped operator order review/submission and status routes implemented | Demonstrate an actual filled order and resulting position; general-user account onboarding and reduce-only exits remain |
| Nansen | Server-side wallet/token context integration and sourced coverage states implemented | Record a useful live insight for a supported mainnet wallet with real history |
| Chainlink CRE | Hourly workflow source, tests and real testnet broadcast settlement | DON deployment and production forwarder configuration; broadcast simulation is not autonomous scheduling |
| MCP | Live endpoint and public tool listing; authenticated unsigned trade preparation implemented | Demonstrate an authenticated agent flow; tools do not sign or submit trades |

### Work order

1. **Fix creator fee eligibility.** No fees before five distinct correct calls with verified positive realized user profit after trading costs. Build entry/exit fill matching and call attribution, exclude self-trades, and invalidate orphaned evidence. The existing base fee and tier thresholds do not enforce this rule.
2. **Finish the X → Kuru demo.** Confirm the installed extension, network, quote, explicit wallet approval, actual output, creator payment and dashboard record. Resolve the current default mismatch: dashboard starts on testnet, inline cards currently start on mainnet.
3. **Complete sponsor demonstrations.** One real Perpl fill/position and one sourced Nansen mainnet finding. Keep unavailable evidence labelled.
4. **Activate autonomous CRE if deployment access permits.** Deploy the DON workflow and configure the approved forwarder. Keep the existing testnet broadcast clearly described if deployment remains unavailable.
5. **Finish delivery.** Record the product and sponsor demos; document Kuru target users, actual usage, acquisition and roadmap. Repair the hosted HyperIndex connection separately. Document access to historical testnet deposits: the old staking UI was removed, but deployed contracts and any existing funds remain.

Live Envio demo: [onchain evidence](https://xtradingnow.xyz/dashboard/onchain). See [demo steps](docs/envio-demo.md). Both mainnet creator payment and testnet call settlement returned `current` during verification.

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

The dashboard defaults to Monad testnet **10143**. Inline extension cards currently default to mainnet **143**; changing them to match the testnet-first policy remains pending. Every trade displays its network and requires approval. Staking is removed from the app. Token amounts use bigint or decimal integer strings.

## Workspace

| Path | Purpose |
|---|---|
| `apps/web` | Next.js pages, authenticated APIs and wallet review |
| `apps/extension` | Manifest V3 X extension |
| `packages/domain` | Runtime schemas and shared types |
| `packages/integrations` | Chain, market, stake and provider adapters |
| `packages/database` | Postgres schema, identity service and migrations |
| `contracts` | Bond-free scorecard, Kuru fork tests and legacy stake/mock-token contracts |
| `services/indexer` | Envio HyperIndex Kuru, scorecard and creator-fee handlers |

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

In Chrome, enable developer mode at `chrome://extensions` and load `apps/extension/dist`. See [X extension](docs/x-extension.md).

## Contracts and indexer

`contracts/src` holds `CallSettlement` (the Chainlink CRE scorecard, deployed bond-free on testnet; it can also lock optional bonds), `CreatorStake` (retired: staking was removed from the app, contracts left untouched) and `MockUSDC` (demo token). Foundry tests cover settlement outcomes, replay and forwarder checks, accounting conservation and the bond-free mode; `KuruCreatorFeeFork.t.sol` executes creator-fee buys at every tier rate against Kuru's mainnet contracts (`KURU_FEE_FORK_RPC=https://rpc.monad.xyz forge test --evm-version prague`).

```sh
pnpm contracts:build
pnpm contracts:test
pnpm contracts:abi
pnpm indexer:codegen
```

The latest HyperIndex handlers cover historical stake events, Kuru V2 swaps, deposits, withdrawals and account registrations, call registrations/settlements and mainnet Kuru Flow creator payments. The older hosted build does not expose all those entities. The web app also directly queries HyperSync for current creator payments and bond-free scorecard settlements. Event IDs are chain:block:logIndex with reorg rollback, a ten-block lag and freshness checks against the chain head. Set `ENVIO_MONAD_RPC_URL` in `services/indexer/.env` for a keyed RPC; adding contracts requires `envio start -r`.

To run locally, copy `services/indexer/.env.example` to `.env`, run `docker compose -p cmb-stake-indexer -f services/indexer/docker-compose.yml up -d`, then `pnpm --filter @call-my-bluff/indexer start`. Hasura is bound to localhost port 8081; its local development admin secret is `testing`. These settings are for local development only. Indexed history remains empty until stake events occur; a block lag is not a claim of chain finality.

Set server-only `ENVIO_GRAPHQL_URL=http://localhost:8081/v1/graphql` and `ENVIO_HASURA_ADMIN_SECRET=testing` for local app access. The authenticated endpoint scopes queries to the current bound wallet and configured contract, validates integer strings and timestamps, and compares indexer freshness and latest balance to the RPC snapshot. Unavailable indexing does not disable direct chain reads or transaction review. Hasura must stringify numeric types; never convert token balances through JavaScript numbers.

## Mainnet spot (Kuru)

The dashboard sidebar has a Testnet / Mainnet switch, which is remembered per browser; a `?chainId=` link overrides it. Testnet is the default. Mainnet uses Kuru's mainnet order books (MON, WETH and cbBTC against USDC, verified onchain at every quote). A market order spends straight from the wallet: one exact approval to the order book for USDC buys, then one immediate-or-cancel order with a minimum output derived from an `eth_call` of the same order. There is no Kuru account, deposit or deadline on mainnet, and limit-order minimum sizes do not apply. Mainnet is off unless the server sets `KURU_MAINNET_ENABLED=true`. Perpl execution remains testnet-only; staking is removed. Run `KURU_MAINNET_FORK_RPC=http://127.0.0.1:8549 pnpm test` against `anvil --fork-url https://rpc.monad.xyz --port 8549` to execute both order types on a fork.

Embedded Privy wallets confirm in Privy's dialog; external wallets (MetaMask, Rabby) receive the reviewed transaction through their own provider. The server never signs.

## Inline trading and creator payments

Extension 0.11.1 implements compact ticker cards, Buy/Sell expansion, explicit network selection, book-history charts and a separate creator-record disclosure. `/trade/inline` is a compact wallet window without the dashboard sidebar. Quotes carry no authentication; balances, gas, allowance and minimum output are checked in authenticated review.

Creators register the wallet already proved through their X binding at `/creator/earnings`. Registered-creator mainnet buys can currently include a disclosed tier-based creator fee, deducted from bought-token output. This current behavior must be gated by the five-profitable-call rule before it is presented as the approved eligibility model. The adapter builds one configured Kuru order-book route through the fixed Kuru Flow entrypoint, approves the exact USDC budget and enforces the buyer's net minimum. No fee is charged for unregistered creators, testnet trades or fee-disabled trades. Self-referral from the bound buyer wallet is rejected. Account linking proves control, not unique humanity. Source-post attribution remains browser-supplied and unverified.

Fee execution requires both `KURU_MAINNET_ENABLED=true` and `CREATOR_FEES_ENABLED=true`. Mainnet fork tests verified buyer receipt, same-transaction creator payment, exact allowance consumption, and atomic failure with no payout. A real scripted fee-paying mainnet transaction is linked above and visible through Envio; the full X UI flow remains pending. To rerun the fork tests:

```sh
KURU_FEE_FORK_RPC=https://rpc.monad.xyz forge test --root contracts --match-contract KuruCreatorFeeForkTest --evm-version prague -vv
```

Envio's new mainnet projection records actual `FeeCollected` and `KuruFlowSwap` events from block 112914000. The earnings API checks recipient scope, canonical block hashes and indexer freshness. Live earnings fall back to server-side HyperSync when the hosted fee entity is absent; the public `/dashboard/onchain` page shows actual fee payments and current bond-free scorecard settlements. Set server-only `ENVIO_API_TOKEN` in the web environment. Registration and quotes never count as earnings. Testnet V2 builder-fee support is still pending.

## Chainlink CRE call scorecard

`contracts/src/CallSettlement.sol` is deployed bond-free on testnet (`minBond = maxBond = 0`, `contracts/deployments/call-scorecard-monad-testnet.json`): a creator records an open call with one gas-only transaction (Calls → "Record on Chainlink"); no tokens move. The hourly-trigger workflow source in `services/cre/settlement` reads due calls when simulated or deployed at a finalized block, fetches the opens of the Binance 1-minute candles at the window start and expiry (each node independently, median agreed), and writes one signed report through the Chainlink forwarder. The contract records Success, Failure or Tie onchain; a missing price never resolves a call. With a positive bond range the same contract can also lock optional bonds (Foundry-tested), but the app no longer offers bonds.

```sh
cd services/cre/settlement && bun install && bun test
services/cre/scripts/fork-e2e.sh ETH 0 1   # asset, direction (0 Up, 1 Down), target bps
```

The script forks Monad testnet about three hours back (anvil dev account, port 8548). It deploys against the simulation forwarder, registers and funds a call, and moves time past expiry. Then it runs `cre workflow simulate --broadcast` and prints the onchain outcome. The testnet scorecard currently trusts the simulation forwarder so `cre workflow simulate settlement --target staging-settings --broadcast` settles real calls; switch it with `setForwarder` once the workflow is deployed. Set `CALL_SETTLEMENT_ADDRESS` for the app. Deploy the contract with the production forwarder `0xF8344CFd5c43616a4366C34E3EEE75af79a74482`, set `settlementAddress` in `config.staging.json`, and deploy the workflow.

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

Latest `pnpm check` passed formatting, TypeScript, 171 application tests, 30 Foundry tests and web/extension builds. Six database tests and four optional fork tests were skipped without their explicit configuration; they are not counted as passes. Six database integration tests are skipped without a test database URL; CI provisions its own Postgres service. Mainnet fork suites require their explicit RPC variables and do not run as ordinary offline checks.

## Developer documents

- Current delivery checklist: see above. [Original implementation plan](docs/implementation-plan.md) is historical and includes retired staking phases.
- [Envio demo](docs/envio-demo.md)
- [Frontend and API handoff](docs/frontend-handoff.md)
- [Architecture](docs/architecture.md)
- [Required sponsors](SPONSORS.md)
- [X extension](docs/x-extension.md)
- [Component references](docs/references.md)
- [Kollateral review and accountability roadmap](docs/kollateral-reference-review.md)
- [Identity binding](docs/identity-binding.md)
- [Historical stake transactions](docs/stake-transactions.md)
- [Mock USDC](docs/mock-usdc.md)
- [AWS database setup](infrastructure/aws/README.md)
