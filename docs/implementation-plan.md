# Call My Bluff delivery checklist

Status reviewed on 11 October 2026. Checked items are implemented and locally verified. Unchecked items still need implementation or live verification. A scaffold, configured credential, submitted order or illustrative preview is not a completed integration.

Required MVP sponsors: **Kuru, Privy, Envio and Nansen**. The Chrome extension is the highest-priority product surface. The landing page, creator platform, user platform and MCP server support that experience.

## Completed work

### Phase 0 — Repository and technical foundation: complete locally

- [x] pnpm workspace, TypeScript, formatting, build scripts and automated checks.
- [x] Shared validation for chains, handles, addresses and integer token amounts.
- [x] Per-chain integration configuration with Monad testnet 10143 as default.
- [x] Postgres/Drizzle schema and initial migration files.
- [x] Original refundable-stake contract, exported ABI and nine passing Foundry tests, including fuzz coverage.
- [x] Envio stake schema, snapshot handlers and generated/typechecked bindings.
- [x] Conditional Privy frontend setup and server-use Nansen client boundary.
- [x] GitHub CI workflow definition and developer documentation.
- [x] Genuine incremental local commits: foundation, then frontend workspaces.

Local database migration execution and repository push are now verified. Contract deployment, running indexer and hosted CI verification remain pending.

### Phase 1 — Frontend foundation: complete

- [x] Public landing page and navigation into creator and user workspaces.
- [x] Creator discovery, handle lookup and public creator-profile shells.
- [x] User overview, watchlist, portfolio, trade-review and activity pages.
- [x] Creator overview, profile draft, stake, call-history and reputation pages.
- [x] Working local watchlist and profile-draft save/reload/clear behavior.
- [x] Buy/sell controls, input validation and call-history filters.
- [x] Extension hub, illustrative state previews and planned MCP tool catalog.
- [x] Honest empty/unavailable states, loading, error retry and 404 pages.
- [x] Responsive desktop/mobile layouts and reusable dashboard components.
- [x] MV3 extension build with creator-evidence links in the X content script.
- [x] Frontend handoff and proposed shared view models for backend wiring.
- [x] Local `pnpm check`, production builds and browser checks passed for this milestone.

The extension has not yet been installed and verified against real X in Chrome. Watchlists/profile drafts are browser-local; trades, stake actions, reputation and MCP connections are not live.

## Remaining phases

### Phase 2 — Provider access, database and verified identity

**Owners:** backend developer, with frontend support. **Dependency:** existing foundation.

- [x] Confirm Privy Twitter login and embedded-wallet configuration with a real session.
- [ ] Confirm an authorized X account/post ingestion path; record access limits and supported collection scope.
- [ ] Confirm the chosen Kuru testnet market, token decimals, ABI and usable liquidity.
- [ ] Confirm Nansen API access and actual mainnet coverage for demo assets/wallets.
- [ ] Confirm Envio runtime/hosting access and an RPC suitable for the demo.
- [x] Start local Postgres and apply the migration; verify foundation tables after a restart.
- [x] Provision dedicated AWS RDS Postgres in Mumbai, apply cloud migrations and activate a TLS-verified restricted application connection.
- [x] Add a server-only database runtime, TLS enforcement for remote connections and live readiness checks.
- [x] Verify Privy sessions server-side; bind stable X user IDs to owned wallets using expiring, single-use nonces.
- [x] Add runtime-validated API responses, authorization and account isolation.
- [x] Connect profile/onboarding pages to persisted account state.
- [ ] Configure the Git remote, push existing commits and verify hosted CI.

- [ ] Complete the user-approved real wallet signature and verify the resulting binding after refresh. The real X session and challenge issuance are verified; local Postgres tests cover persistence and rejected proofs.

**Completion test:** a real user establishes a persistent X-ID/wallet binding; forged, expired and replayed proofs fail. Provider coverage and market feasibility are recorded before building dependent flows.

### Phase 3 — Refundable stake and live stake indexing

**Owners:** contracts/backend/indexer developer. **Dependency:** Phase 2 identity, token and network configuration.

- [ ] Confirm stake token/address/decimals and raw-unit threshold; review the proposed seven-day cooldown.
- [ ] Deploy the stake contract to Monad testnet and record address, deployment block and immutable settings.
- [ ] Implement wallet-approved bounded allowance, deposit, request, cancel and withdrawal actions through Privy.
- [ ] Simulate transactions and show pending, failed and confirmed states accurately.
- [ ] Configure Envio with the deployed address/start block and run live indexing.
- [ ] Expose stake projections with source, chain, indexed time and finality/freshness status.
- [ ] Define and verify duplicate-event, reorg and RPC/indexer interruption handling.
- [ ] Wire creator stake pages to contract/indexer evidence.
- [ ] Run Foundry checks for fund-handling changes; regenerate/typecheck after indexer changes.

**Completion test:** a real deposit updates indexed stake; requesting withdrawal immediately removes active-stake eligibility; cancel and full refund after cooldown behave correctly. Use a separate short-cooldown test deployment if needed for demonstration, with its settings clearly labeled.

### Phase 4 — Live Chrome extension identity and stake experience

**Owners:** extension/frontend developer, with backend support. **Dependency:** verified bindings and fresh stake data from Phases 2–3.

- [ ] Install and test the current unpacked extension on real X before expanding it.
- [ ] Add environment-specific HTTPS app/API configuration and minimal permissions.
- [ ] Resolve current handles through the server's verified stable-X-ID mapping; reject ambiguous/stale mappings.
- [ ] Add branded identity and active-stake indicators with independent labels.
- [ ] Build the evidence popover with unknown, unavailable, stale and withdrawal-pending states.
- [ ] Keep reputation unavailable until sourced scoring exists in Phase 6.
- [ ] Handle dynamic feed navigation, duplicate injection and extension enable/disable behavior.
- [ ] Verify API/message origins and safe handoff into wallet approval pages.

**Completion test:** a real bound creator's X post shows current identity/stake evidence, and withdrawal or stale indexing removes the active indicator. A deposit alone never produces an identity-verification claim.

### Phase 5 — Kuru trading from X and actual-fill dashboard

**Owners:** trading/backend developer plus extension/frontend developer. **Dependency:** Phase 2 market/session setup and Phase 4 handoff.

- [ ] Fetch live market parameters and quotes; validate chain, market, token and integer amounts.
- [ ] Show fees, slippage, expiry and the venue-appropriate execution limits before approval.
- [ ] Prepare/simulate unsigned transactions with bounded token approvals.
- [ ] Execute only after explicit user approval through Privy; handle rejection/failure.
- [ ] Add buy/sell entry points to X posts and preserve source-post attribution.
- [ ] Index the selected Kuru order/fill events through Envio with idempotency and finality handling.
- [ ] Distinguish submitted, open, partially filled, filled, cancelled and failed orders where supported.
- [ ] Populate portfolio and activity from confirmed fills and wallet evidence.
- [ ] Replace local watchlist storage with optional authenticated sync, retaining clear local-only behavior when signed out.
- [ ] Verify quote expiry, insufficient funds, wrong network and unavailable liquidity paths.

**Completion test:** X → trade review → explicit wallet approval → Kuru confirmed fill → dashboard, with actual amounts and source evidence. A submitted order never appears as a confirmed fill.

### Phase 6 — Sourced calls, reputation and Nansen evidence

**Owners:** evidence/backend developer plus frontend/extension developer. **Dependency:** authorized ingestion and provider coverage confirmed in Phase 2.

- [ ] Ingest supported financial calls with stable author ID, source post, timestamp and duplicate/edit handling.
- [ ] Define explicit assets, direction, entry/evaluation rules and time horizons; mark ambiguous calls unevaluable.
- [ ] Store sourced price observations and version the scoring methodology.
- [ ] Show sample size, coverage, evaluation state and missing data alongside any score.
- [ ] Keep hypothetical call outcomes separate from actual wallet returns and stake participation.
- [ ] Fetch actual supported Nansen mainnet data server-side and derive a useful token/wallet insight.
- [ ] Display source, timestamp, network and coverage; show unavailable states for unsupported data.
- [ ] Wire creator profiles, call ledgers, reputation pages and extension popovers to this evidence.
- [ ] Validate scoring on auditable cases; use insufficient-evidence states when no defensible score exists.

**Completion test:** a creator call can be traced to its post and evaluation inputs, and a real Nansen-backed insight appears in the product. Testnet transactions and mainnet analytics remain visibly distinct.

Phase 6 evidence work can proceed alongside Phases 3–5 after access is confirmed; the core extension trade journey remains the priority.

### Phase 7 — Working MCP server

**Owners:** backend/agent developer. **Dependency:** shared live identity, evidence and trading services.

- [ ] Implement a real MCP transport, server configuration and runtime input/output schemas.
- [ ] Add bounded public tools for creator lookup, call history and stake evidence.
- [ ] Add authenticated portfolio tools with wallet ownership and account isolation.
- [ ] Add trade preparation returning unsigned, expiring transactions for user review.
- [ ] Reuse shared services rather than implementing independent reputation/trading logic.
- [ ] Keep provider secrets server-side; omit automatic signing and arbitrary proxy access.
- [ ] Replace the planned tool catalog with accurate connection instructions and availability states.
- [ ] Verify tools with a real MCP client, including denied private-data access and provider failures.

**Completion test:** an MCP client reads live evidence and prepares a reviewable trade; unauthenticated users cannot read private portfolios. The wallet remains responsible for explicit approval.

### Phase 8 — Deployment, complete demo and handoff

**Owners:** whole team. **Dependency:** the required sponsor flows and product surfaces above.

- [ ] Deploy web/API, database and indexer; configure HTTPS origins and server secrets.
- [ ] Produce an installable extension build with real installation instructions.
- [ ] Run `pnpm check`, indexer codegen/typecheck and focused live end-to-end checks.
- [ ] Verify refresh/restart recovery, stale evidence, failed transactions and private-data isolation.
- [ ] Demonstrate creator onboarding → stake → X evidence → approved trade → confirmed-fill dashboard.
- [ ] Demonstrate sourced call/Nansen evidence and a real MCP tool invocation.
- [ ] Record completion evidence for Kuru, Privy, Envio and Nansen in `SPONSORS.md`.
- [ ] Publish accurate setup documentation, deployment addresses, limitations and demo video.
- [ ] Push genuine milestone commits, verify CI and prepare developer handoff/submission materials.

**Completion test:** another developer can install/run the project and reproduce the real demo from the documentation without invented balances, reputations or fills.

## Working rules for each phase

1. Implement small, reviewable feature milestones and commit them when they work. Preserve accurate authorship and compatible licenses; do not manufacture development history.
2. Mark an item complete only when its completion evidence exists. Keep configuration, implementation and live verification separate.
3. Update this checklist and the frontend handoff as APIs replace placeholder states. Run checks appropriate to each code change.
4. Keep Kimi optional and Aurora/CRE or other sponsor expansions after the core MVP. They are not prerequisites for the phases above.

**Immediate next work:** complete the real wallet-binding signature, confirm Phase 2 provider feasibility, then begin stake deployment and indexing. The frontend developer can prepare API wiring while the extension developer verifies installation/DOM behavior; live badges depend on Phase 3 evidence.
