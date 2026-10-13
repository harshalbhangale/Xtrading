# Perpl testnet exits

Network: Monad testnet 10143. Account: team account 1096. The app's authorized operator is @xtradingnow, while the exchange owner wallet reported by Perpl is `0x072ecc90fa0ac2292e760a57304a87ad6c32bc89`. They are different roles and wallets.

## Close a position

1. Sign in to `/dashboard/trade?instrument=perp&chainId=10143` with the bound operator.
2. Choose **Review full close** on one open position. Review shows size, side, collateral, estimated taker fee, 0.5% maximum slippage and expiry.
3. Explicitly confirm. The server rechecks operator identity, account ownership, forwarding/frozen state, the position ID/market/side/size/leverage and current market limits. Tampered or expired reviews are rejected.
4. Check order status and the updated account snapshot. Accepted forwarding is not a fill; an IOC close can fill partially. Confirm the remaining position size before another review.
5. On an uncertain response, check the signed review's request ID instead of retrying blindly. Request IDs stay fixed across retries and must exceed the account's last forwarded ID.

The order uses CloseLong (3) or CloseShort (4), not an opposite Open order. It cannot intentionally invert a position. The reviewed size is derived from current account data, not a browser-supplied amount. Reviews are signed and scoped to the authenticated operator for 60 seconds.

Closing releases remaining collateral into the **exchange account**, after PnL, trading fees and funding. It does not send collateral to a wallet. The original collateral amount is not a guaranteed refund.

## Withdraw remaining AUSD

Perpl's official API documentation states that withdrawals are **never permitted through an API key**, including a key with trade scope. See [API key scopes](https://github.com/PerplFoundation/api-docs/blob/main/types.md#api-keys).

Use [official Perpl testnet](https://testnet.perpl.xyz/) with the account owner wallet `0x072ecc90fa0ac2292e760a57304a87ad6c32bc89`. Review the exchange account, amount and recipient before approving its wallet transaction. Do not collect or export the owner's private key. The app provides an official-site handoff; it does not promise automatic withdrawals.

Pre-withdrawal wallet snapshot: **9,900 test AUSD and 0.96465075262 test MON** on the owner wallet. Keep this separate from the exchange account balance.

After the user-approved withdrawal, verify both the exchange balance reduction and the owner's test-AUSD wallet balance increase using the transaction receipt. Gas is paid in testnet MON. Do not label collateral recovered until this is confirmed.

Implementation: `/api/trades/perp/close/prepare` returns a signed review; `/api/trades/perp/close/submit` requires that review and `confirm: true`; `/api/trades/perp/status` reads the outcome. No new close or withdrawal has been executed as part of building these features.
