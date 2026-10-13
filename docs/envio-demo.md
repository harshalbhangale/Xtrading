# Envio demonstration

Open https://xtradingnow.xyz/dashboard/onchain. No login is required.

1. Show the mainnet creator payment: 0.0398263570831 MON, transaction `0x450e00b927f5b1dc9703b7bbb9fc7ffa52835dfe88ac596632633eb6c1b9d64c`.
2. Show the testnet bond-free call outcome and open its explorer transaction.
3. Point out the Envio HyperSync source, scan progress, observation time and unavailable/lagging states.
4. Sign in as a creator with a proven wallet binding to see their scoped payments in payout history. An unbound account cannot claim another wallet's earnings.

HyperSync discovers the fixed-contract events. The app decodes them, joins transaction/block metadata and checks displayed receipts and canonical block hashes independently. Amounts stay bigint/integer strings. Queries are bounded and shared for 60 seconds per server process; the public JSON endpoint is cached for 60 seconds. No provider token reaches the browser.

This is live chain evidence, not simulated PnL. Correct call outcomes do not prove profitable user trades or satisfy the five-call fee eligibility rule by themselves. Historical creator payments do not establish current eligibility.

The hosted HyperIndex connection still needs repair for a new deployment. Do not promote an old build expecting it to acquire new handlers. Existing HyperIndex activity remains separate from the direct HyperSync evidence.
