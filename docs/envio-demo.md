# Envio demo

Where Envio's data shows up in Xtrading and how to walk through it end to end. The data-flow diagram is in the [Technical overview](architecture.md#onchain-data-with-envio).

## What uses Envio

| Path | Indexes | Shown on |
|---|---|---|
| **HyperIndex** ([`services/indexer`](../services/indexer): `config.yaml`, `schema.graphql`, `src/handlers.ts`) | Testnet Kuru V2 accounts, swaps, deposits and withdrawals. Mainnet Kuru Flow `FeeCollected` and `KuruFlowSwap`. | Activity page and MCP `get_portfolio` (testnet), creator earnings, the counter-trade red flag, indexer progress in the Terminal |
| **HyperSync** ([`envio-evidence.ts`](../apps/web/lib/envio-evidence.ts), [`wallet-overview.ts`](../apps/web/lib/wallet-overview.ts)) | Mainnet Kuru Flow `FeeCollected` logs, and a wallet's mainnet transactions | [`/dashboard/onchain`](https://xtradingnow.xyz/dashboard/onchain), creator earnings when the indexer lacks a payment, Portfolio history |

HyperIndex events are keyed `chain:block:logIndex`, roll back on reorgs and run 10 blocks behind the head. Every HyperSync event shown is re-checked against its transaction receipt, block hash and log data from a Monad RPC before display. Both report `current`, `lagging` or `unavailable` against the chain head. A block lag is not presented as finality.

## Walkthrough

1. **Public payments, no login.** Open [xtradingnow.xyz/dashboard/onchain](https://xtradingnow.xyz/dashboard/onchain). It lists creator payments with the indexed block and a link to each transaction, for example 0.0398263570831 MON paid in [`0x450e…d64c`](https://monadvision.com/tx/0x450e00b927f5b1dc9703b7bbb9fc7ffa52835dfe88ac596632633eb6c1b9d64c). Point out the source, status and "indexed through block" line.
2. **End to end.** Buy on mainnet from a registered creator's post. The creator's fee is paid inside the same Kuru Flow transaction. Once Envio reaches that block, the payment appears on the onchain page and in the creator's earnings.
3. **Creator earnings.** Sign in as that creator at `/creator/earnings`. Only payments to their own verified wallet are shown.
4. **Trader activity.** Make a testnet Kuru trade, then open `/dashboard/activity`. Swaps, deposits and withdrawals come from HyperIndex, with its progress compared to the chain head.
5. **Agents.** Through the MCP server, `get_portfolio` returns the same indexed activity.

## What it doesn't claim

This is chain evidence, not simulated profit. A correct call doesn't prove anyone traded it profitably, and a past payment doesn't make a creator eligible now. Registrations and quotes never count as earnings.

## Redeploying

HyperIndex is deployed from the `envio` branch to Envio's hosted service (`git push origin main:envio`). Each deployment only has the entities of the commit it was built from, and gets its own GraphQL URL, so update `ENVIO_GRAPHQL_URL` on Vercel afterwards. HyperSync needs `ENVIO_API_TOKEN` in the web environment. See [Development](development.md#deployment).
