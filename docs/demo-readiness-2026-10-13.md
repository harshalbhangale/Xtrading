# Demo readiness — 13 October 2026

Network plan: Kuru spot and Nansen on Monad mainnet (143). Perpl on Monad testnet (10143) with test AUSD. Autonomous CRE deployment is deferred. The initial account/Nansen checks were read-only. A subsequent user-approved scripted mainnet round trip completed; its exact costs and receipts are below.

## Accounts checked

| Account / wallet | Verified state | Demo use |
|---|---|---|
| Previous buyer `0x02cefD0E0547bb176f508380399A982fAb676A92` | After round trip: 3.894421 mainnet USDC; 40.4607383242769 MON | Successfully used for the scripted Kuru round trip; still needs connection in MetaMask for the real X UI demonstration. It is not currently a creator binding. |
| @xtradingnow / `0x51bdfc2a4d1c3b04a89f8ca928bd377b767df424` | Bound; 0 mainnet USDC; 0.0398263570831 MON; payout registration absent | Project creator identity and authorized Perpl operator. Needs funding if used as the spot buyer instead. |
| @ishbubbles1 / `0x716ae38ccd2c044d33b9aa040a2a6901f6ffd964` | Bound; 0 mainnet USDC and MON; not a Perpl operator | Not funded for the trade demo. |
| Perpl team exchange account 1096 | Signed read: forwarding on, frozen false, collateral balance 99145768 base units = 99.145768 test AUSD | Funded testnet account. Execution is through the team's API account, not from the user's mainnet wallet. |

Perpl's public context confirms AUSD has six decimals at `0xa9012a055bd4e0edff8ce09f960291c09d5322dc` on testnet. Wallet AUSD and deposited exchange collateral are different balances. Local configured account is 1096; production authenticated preparation still needs to confirm live operator mode.

Balances are snapshots; recheck before signing. The previous buyer has funds for a 1-USDC demonstration without a new deposit. Signing from the existing environment key proved control for the scripted round trip; connection in the browser has not been demonstrated.

## Completed mainnet round trip

Wallet: `0x02cefD0E0547bb176f508380399A982fAb676A92`. Network: Monad mainnet **143**. Approved budget: **1 USDC** with a **0.2 MON gas cap**. A local fork rehearsal preceded mainnet execution; Foundry tests passed.

| Item | Verified result |
|---|---|
| Buy spend | 1 USDC |
| MON bought and sold back | 39.8231850583 MON |
| USDC recovered into wallet | 0.998845 USDC |
| Trading cost | 0.001155 USDC |
| Total gas | 0.162237936 MON, below the 0.2 MON cap |
| Final wallet snapshot | 3.894421 USDC + 40.4607383242769 MON |
| Remaining USDC allowance to this Kuru book | 0 |
| Exchange deposits / creator fees | None |
| Unreturned purchased MON | None |

All three receipts were independently re-read and confirmed successful:

- [Exact 1-USDC approval](https://monadvision.com/tx/0x9671cbe9dbc10cc8880e34d2c9617d64b15fc000404cd246cf304ccb46fc1a71): 0.021658884 MON gas.
- [Buy](https://monadvision.com/tx/0x7b3a5f41719f6c0d7611d0d64da497dd50fb3c2f6c7079c103e33fa6a26392ff): 0.07186614 MON gas.
- [Sell back](https://monadvision.com/tx/0x45db923a8a1ee310fd6890df3ad03dd6fcb43cbfcbccf9d3bce5206636c3b289): 0.068712912 MON gas.

Machine-readable evidence: `contracts/deployments/mainnet-roundtrip-2026-10-13.json`. Runner: `scripts/mainnet-roundtrip.mjs`. The runner refuses a second live run when the receipt record exists; inspect submitted hashes rather than retrying blindly. Keep the environment key private and never put it in the video, logs or Git.

This confirms **scripted execution**, not an X-extension trade, dashboard attribution, a profitable user outcome or creator fee eligibility. Gas and trading costs are not refundable. The purchased MON was sold back directly; there was no exchange balance to withdraw.

## Nansen: live coverage and limitations

Three 30-day Monad-mainnet DEX-trade queries returned HTTP 200 with zero trades for the wallets above. Kuru receipts independently prove the earlier trades; no Nansen KOL trade finding or user profit can be claimed from these empty responses.

A standard-tier USDC holder query returned live data for token `0x754704Bc059F8C67012fEd69BC8A327a5aafb603`, with `premium_labels: false`. Nansen reports the address labelled aMonUSDC (`0x35a73bacb179d3740395a3cecc87ff2e581d6042`) holding about 28.28 million USDC, with a positive 24-hour balance change of about 15.20 million USDC. This is a provider-reported token/contract observation, not trading profit, a buy recommendation or KOL identity. Another returned holder's DEX-trade query was empty as well.

Useful next UI addition: a mainnet USDC context card showing top returned holders and recent balance changes, fetched time, chain, token address and a Nansen attribution link. The card is not implemented yet. Do not display a concentration percentage: the returned ownership percentages were zero and are not usable evidence. No paid premium labels or automatic paid fallback were used.

## Recording order

1. Open a real X post with a supported MON, ETH or BTC ticker. Show Xtrading's inline card and explicit Monad mainnet label.
2. Show the Nansen context card after it is implemented, including coverage and timestamp. Explain what the observation helps the user inspect; do not present raw JSON as the finished feature.
3. User connects the funded buyer wallet, reviews a 1-USDC spot order and approves the exact allowance and swap. Show confirmed receipt and actual received amount. Never replace this with a quote or submitted order.
4. Show activity/Envio evidence. The existing creator payment is historical; only claim a new payment if this new receipt proves it. Creator payouts are currently unregistered for the project account, and the approved five-profitable-call fee gate is not implemented.
5. Explicitly switch to Perpl testnet. Sign in as @xtradingnow, confirm live operator mode and account 1096, review a small low-leverage order, then let the user confirm. Show an actual fill/position; accepted forwarding alone is insufficient.
6. End on the dashboard. Describe CRE as a tested real testnet broadcast with autonomous deployment pending.

## Perpl integration update

Signed API reads confirm two existing filled orders and two open positions on team account 1096. The ETH long used 3x leverage; the MON short used 2x. Both corresponding transactions succeeded:

- [ETH fill](https://testnet.monadvision.com/tx/0x300226fd29539f6944c0fb519f9e4cfc2122d9497f0f975ef1fd33e3406000dc), block 70497853.
- [MON fill](https://testnet.monadvision.com/tx/0x5d61af92db20eafad6f29ac141bab6790c1794c2f389306896bd2f48366da7b2), block 70486462.

The new authenticated `/api/trades/perp/account` route scopes data to the configured team account and requires the bound operator. The Perpl page displays available AUSD, forwarding/frozen state, open positions, recent fills and explorer links. It does not rely on position request IDs: Perpl returned `rq: 0` for these open positions. Order review/submission checks account ownership, forwarding, frozen state and a nonzero available collateral balance. Request IDs advance beyond the account's last forwarded ID.

Evidence: `contracts/deployments/perpl-testnet-evidence.json`. No new orders, deposits, withdrawals or position closes were sent during this integration work. These historical fills are not proof of a new trade from X. Closing positions and withdrawing collateral still require a reviewed flow and user approval.

Before filming: confirm installed extension version, wallet access, payout/eligibility behavior, dashboard attribution, Nansen card and authenticated Perpl account display. Existing mainnet scripts are useful receipt evidence but not proof of the complete X UI flow.
