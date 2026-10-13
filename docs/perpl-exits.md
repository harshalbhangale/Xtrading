# Perpl testnet exits

Network: Monad testnet 10143. Every Perpl action is signed by the user's own bound wallet and acts on that wallet's own exchange account (`execOrder`, `withdrawCollateral` and `depositCollateral` act on `msg.sender`). The server holds no Perpl key and never signs.

## Close a position

1. Sign in to `/dashboard/trade?instrument=perp&chainId=10143`. Open positions are read from the Exchange contract (`getPosition` per market) for the wallet's account.
2. **Review full close** asks the server for one unsigned `execOrder` step. Size and side come from the chain, not the browser. The order is CloseLong (2) or CloseShort (3): reduce-only, immediate-or-cancel, limit at mark ∓ 0.5%. It cannot open or invert a position.
3. **Sign close in wallet** sends it. `/api/trades/perp/confirm` then checks the transaction came from the bound wallet, called `execOrder` on Perpl's exchange with the reviewed ID, and reads fills from the receipt events. A close can fill partially; the account panel refreshes with the remaining size.

## Withdraw remaining AUSD

Closing frees margin into the **exchange account**, after PnL, fees and funding; it does not move it to a wallet. **Withdraw AUSD** asks `/api/trades/perp/withdraw/prepare` for one `withdrawCollateral(amount)` step, capped at the account's available balance, and the wallet signs it. The AUSD returns to the same wallet.

Simulated on testnet (eth_simulateV1, nothing sent): a full CloseLong and CloseShort fill and a withdrawal succeed from an account owner's address.

The earlier team-account flow (account 1096 through an API key) is removed. That account's owner wallet `0x072ecc90fa0ac2292e760a57304a87ad6c32bc89` can still close and withdraw on [Perpl testnet](https://testnet.perpl.xyz/).
