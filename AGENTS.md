# Call My Bluff development rules

- Read `README.md` and `SPONSORS.md` before changing product scope. Required MVP sponsors are Kuru, Privy, Envio and Nansen.
- Keep verified identity, refundable stake, call performance and actual wallet returns separate. A deposit does not verify an X account; a verified account does not imply profitable advice.
- Use stable X user IDs for bindings. Verify Privy sessions on the server and wallet ownership with nonce/replay protection before trusting a binding.
- Default to Monad testnet 10143. Use explicit per-chain market and token configuration; never silently switch to mainnet.
- Keep token amounts as bigint or validated decimal integer strings. Never use floating point for transaction amounts.
- Keep provider secrets on the server. No arbitrary provider proxy endpoints, automatic signing, infinite approval defaults or private-key collection.
- Show honest empty/unavailable states. Do not represent fixtures, configured settings or submitted orders as real evidence or confirmed fills.
- Test fund-handling changes with Foundry. After indexer changes run codegen and typecheck. Run `pnpm check` for foundational changes.
- Preserve event idempotency and track reorg/finality/freshness when adding live projections.
- Do not import referenced project source without an explicit compatible license.
