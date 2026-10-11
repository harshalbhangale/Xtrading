# Stake transaction handoff

The creator stake page now reads live Monad testnet state and prepares unsigned, simulated transactions. A real deployment and deposit are not yet claimed. The bound project wallet has 5 test MON for gas and zero of the selected test USDC at the last browser verification.

## Fixed testnet configuration

- Chain: Monad testnet 10143; stake actions currently refuse other chains.
- Token: Circle test USDC `0x534b2f3A21130d7a60830c2Df862319e593943A3`.
- Decimals: 6; minimum: `500000000` raw units (500 test USDC).
- Withdrawal delay: `604800` seconds (seven days).
- These test tokens have no monetary value. They do not demonstrate a real $500 financial commitment.

The address comes from [Circle's official contract list](https://developers.circle.com/stablecoins/usdc-contract-addresses). Its deployed code, symbol and decimals were checked on chain. Contract amounts stay as bigint or decimal integer strings. Decimal inputs reject rounding, exponent notation, whitespace and uint256 overflow.

## APIs and review flow

`GET /api/stake` requires a server-verified Privy session and a current persisted X/wallet binding. It returns live wallet balances and, when configured, contract parameters, stake balance, allowance and unlock timestamp. Reads use one block number and recheck the block hash to detect a reorg during the snapshot. They are explicitly latest/unfinalized, include observation time, and are not Envio projections or extension-badge evidence.

`POST /api/stake/prepare` requires the same session and exact app origin. Body: `{ "action": "deploy" | "deposit" | "requestWithdrawal" | "cancelWithdrawal" | "withdraw", "amount": "500" }`; amount applies only to deposit. The server fixes token/chain/contract destinations, validates balances and action eligibility, estimates gas without signing, and returns a two-minute transaction review. RPC chain, token metadata and deployed immutable settings must match configuration.

For deposits, an insufficient nonzero allowance first prepares a zero reset. A zero allowance prepares exactly the requested amount. Only sufficient allowance prepares deposit. Each step requires a separate user action and fresh simulation; the UI does not chain approvals or sign automatically. Existing larger allowances are not expanded. Gas limit uses a 20% buffer above the displayed estimate; fees are reviewed in the wallet.

The UI requests Privy wallet approval using the bound address and explicit chain 10143. A submitted hash is displayed separately from receipt success. It waits for two blocks before reporting a successful receipt, then refreshes RPC state; two blocks do not claim consensus finality. Rejection/reversion/timeouts do not create a stake receipt in the indexer or database.

## Deployment and indexing

1. On `/creator/stake`, prepare deployment, inspect the token/minimum/cooldown and approve in the wallet. The deployment bytecode is exported from this repository's Foundry artifact by `pnpm contracts:abi`.
2. Record the successful creation receipt, contract address and deployment block. Configure server-only `CREATOR_STAKE_ADDRESS` in the ignored web environment, then reload the app. Do not configure an unconfirmed address.
3. Verify deployed token/minimum/cooldown against the fixed values. Obtain at least 500 test USDC in the bound wallet using the matching token address, then review approval and deposit separately.
4. Configure the exact address and start block in `services/indexer/config.yaml`; run codegen/typecheck and start the indexer. No addresses or invented events have been added yet.
5. Verify request/cancel behavior and withdrawal after cooldown. A short-cooldown demonstration needs a separate, clearly labeled deployment and explicit configuration support; this flow enforces seven days.

The contract has no administrator or slashing. Wallet recovery/migration, ERC-1271 identity proofs, transaction history persistence, indexer finality/freshness and real stake-to-extension evidence remain separate work.

## Verification

`pnpm check` passed with 19 tests, nine Foundry tests (256 fuzz cases) and web/extension builds. Tests cover exact amount conversion, invalid precision/overflow, bounded approval/reset encoding and the existing contract conservation/withdrawal/account-isolation cases. A real authenticated browser session read live balances and successfully estimated deployment gas. Live deployment, approval/deposit and withdrawal receipts remain pending user wallet approval and funding.
