# Architecture

X extension → public evidence API → creator identity, stake and call evidence.

Trading: X post → app review → Privy wallet approval → Kuru → Envio order/fill projection → dashboard.

## Services

- Next.js: public pages, authenticated APIs and transaction preparation.
- Privy: X login, embedded wallets and explicit signing.
- Postgres: verified identity bindings, nonce challenges and future call/trade records.
- CreatorStake: refundable ERC20 deposits with a seven-day withdrawal cooldown.
- Envio: stake and trading events, keyed by chain/contract and event identity.
- Nansen: server-side mainnet wallet/token context, with coverage and timestamps.
- MCP: bounded access to the same evidence and trade-preparation services.

## Data rules

Identity, refundable stake, hypothetical call outcomes and actual wallet returns are separate fields. A deposit does not verify an X account or establish profitable advice.

Bind stable X IDs to owned wallets through server-verified sessions and single-use signed nonces. Resolve current handles to those IDs.

Store transaction amounts as bigint or validated decimal integer strings. Default to Monad testnet 10143 and configure each token/market explicitly. mUSDC is demo currency, not a real $500 commitment.

Calls retain their source, asset chain/address, direction, horizon and interpretation version. AI extracts and explains; deterministic code calculates results under published rules. Ambiguous calls and missing prices remain unresolved.

A linked-wallet sale is an observation with transaction evidence, not proof of deception. Coverage of one wallet does not establish complete financial activity.

Submitted orders are separate from fills. Public evidence includes observation time, source, freshness and finality; RPC reads are not indexer projections.

Provider secrets stay on the server. Wallet approval stays explicit. Prepare bounded transactions rather than arbitrary provider or wallet RPC requests.
