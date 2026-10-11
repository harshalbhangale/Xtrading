# Foundation milestone

Completed on 11 October 2026. This milestone contains original scaffolding and development contracts; the live MVP is still to be implemented.

## Included

- pnpm workspace, pinned dependency lockfile, shared TypeScript configuration, Biome and CI.
- Next.js terminal, creator lookup, portfolio and setup screens, with truthful empty states.
- Conditional Privy login provider, Monad/Kuru configuration and a server-only web boundary for Nansen.
- Chrome Manifest V3 development extension with creator evidence links.
- Postgres/Drizzle schema and generated initial SQL migration.
- Refundable ERC20 stake contract, exported ABI and Envio snapshot event handlers.
- Setup instructions and project development rules.

## Verified

- `pnpm install --frozen-lockfile` completed successfully.
- `pnpm indexer:codegen` completed and generated handler types.
- `pnpm db:generate` generated the five-table initial migration.
- `pnpm check` passed lint, all workspace TypeScript checks, seven unit tests, nine Foundry tests and both production builds. The deposit conservation fuzz test ran 256 cases.
- Browser walkthrough verified invalid-handle rejection, normalized creator lookup, portfolio empty state and provider configuration states. Desktop and 390px mobile layouts were inspected; no horizontal overflow or browser errors were observed.
- `/api/health` returned the foundation phase, testnet chain 10143 and four sponsor statuses without credentials.

## Remaining integration work

- No verified X/wallet binding, submitted trade or hosted indexer exists yet. The extension has not been installed into the user's Chrome profile.
- Provider credentials and allowed origins need configuration before live authentication and data verification.
- The stake contract has not been deployed or audited; testnet deployment is the next fund-handling milestone.
- The database migration has been generated but not applied. The attempted local Docker image pull did not complete and was stopped; no database container was started.
- The CI workflow is prepared; hosted CI results will be checked after pushing.

## Proposed subsequent commits

Each commit should represent an implemented and checked change, in the order actually completed:

1. Server-verified Privy sessions, stable X identity and wallet binding.
2. Testnet stake deployment configuration and wallet-approved deposit/withdrawal UI.
3. Live Envio stake projections and extension badge freshness.
4. Kuru market reads, quote/simulation and wallet-approved order execution.
5. Actual fill indexing and the personal portfolio ledger.
6. Nansen-backed evidence and transparent reputation methodology.

Do not manufacture intermediate history, backdate commits or describe pending integrations as completed.
