# Demo readiness — 13 October 2026

Network plan: Kuru spot and Nansen on Monad mainnet (143). Perpl on Monad testnet (10143) with test AUSD. Autonomous CRE deployment is deferred. No trades or financial signatures were sent during these checks.

## Accounts checked

| Account / wallet | Verified state | Demo use |
|---|---|---|
| Previous buyer `0x02cefD0E0547bb176f508380399A982fAb676A92` | 3.895576 mainnet USDC; 40.6229762602769 MON | Best funded candidate for a small mainnet Kuru trade, subject to the user connecting it in MetaMask. It is not currently a creator binding. |
| @xtradingnow / `0x51bdfc2a4d1c3b04a89f8ca928bd377b767df424` | Bound; 0 mainnet USDC; 0.0398263570831 MON; payout registration absent | Project creator identity and authorized Perpl operator. Needs funding if used as the spot buyer instead. |
| @ishbubbles1 / `0x716ae38ccd2c044d33b9aa040a2a6901f6ffd964` | Bound; 0 mainnet USDC and MON; not a Perpl operator | Not funded for the trade demo. |
| Perpl team exchange account 1096 | Signed read: forwarding on, frozen false, collateral balance 99145768 base units = 99.145768 test AUSD | Funded testnet account. Execution is through the team's API account, not from the user's mainnet wallet. |

Perpl's public context confirms AUSD has six decimals at `0xa9012a055bd4e0edff8ce09f960291c09d5322dc` on testnet. Wallet AUSD and deposited exchange collateral are different balances. Local configured account is 1096; production authenticated preparation still needs to confirm live operator mode.

Balances are snapshots; recheck before signing. The previous buyer has funds for a 1-USDC demonstration without a new deposit. Do not imply that the user's ability to control it has been confirmed this turn.

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

Before filming: confirm installed extension version, wallet access, payout/eligibility behavior, dashboard attribution, Nansen card and one real Perpl filled order. Existing mainnet scripts are useful receipt evidence but not proof of the complete X UI flow.
