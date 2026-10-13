# Xtrading repository, wallet and video review

Reviewed 13 October 2026, approximately 17:29 IST. No transactions, orders, signatures, deployments or credential changes were made. Public provider reads were made through existing integrations. This review produced this document and `mainnet-wallet-review-2026-10-13.json`.

## Repository and validation

Fetched GitHub `harshalbhangale/Xtrading`. Local main initially matched origin/main at `6ad9602`; both advanced during the review to `b6e0fa8e86404d91b4f2bf419d4136b40c006cd5`. The latter only rebuilds the two downloadable extension ZIPs. Production ZIP is version 0.11.1, 511,330 bytes, with the app trade handoff present. Version alone does not prove that this build is installed in the recording browser.

`pnpm check` passed lint, workspace typechecks, 204 application tests, 30 Foundry tests, and web/extension builds. Six application tests and four Foundry mainnet fork tests were skipped. The separate CRE workflow passed seven Bun tests. These checks establish build/test health, not end-to-end execution. Portfolio, wallet-panel and CSS edits appeared concurrently during this review; they were not authored, reverted or committed by this audit, and later edits are outside the completed check's snapshot.

Production health and database readiness returned HTTP 200. Prices returned BTC/ETH/MON from Kuru mainnet and hourly book-history charts. Public health prose is partly stale: its descriptions still understate historical Kuru fills and the bond-free CRE settlement. Prefer actual receipt evidence over those strings.

## Key handling

The existing mainnet demo key in `~/.xtrading/mainnet-demo.env` is valid and derives buyer address `0x02cefD0E0547bb176f508380399A982fAb676A92`. File mode is 600. No key value was printed, copied into these artifacts or used to sign.

Web/indexer/CRE environment files are untracked. Configured wallet/signing key values were searched against 1,495 blob objects reachable through fetched Git refs, with no matches. This is a check for those exact configured values, not a complete credential or historical security audit. Local CRE and historical Perpl credentials remain configured; the current Perpl execution implementation does not use the old team signing key to trade for users.

Possession of this demo key proves which address it controls. It does not establish that the address is a Privy-created embedded wallet. Browser wallet type and login association still need direct verification for that claim.

## Mainnet wallet evidence

Buyer snapshot at block 113035028, 17:28:53 IST:

| Asset | Balance |
|---|---:|
| MON | 40.4518039968569 |
| USDC | 3.885047 |
| WETH | 0 (separate recent read) |

USDC allowances to MON/USDC, WETH/USDC and Kuru Flow were zero on recent reads. Creator `0x51bDFC2a4D1C3B04A89f8CA928bd377B767Df424` holds 0.0398263570831 MON and zero USDC. Previously bound `0x716ae38ccd2c044d33b9aa040a2a6901f6ffd964` holds zero MON/USDC.

HyperSync scanned direct transactions involving the demo buyer and USDC events across archived history. Every discovered transaction was independently receipt-checked through Monad mainnet RPC. Public details are saved in the companion JSON. This covers the identified buyer and its USDC activity; it is not an inventory of every unrelated wallet, every token, or all internal native transfers.

| Action | Transaction | Result |
|---|---|---|
| Receive 9.897169 USDC | `0x6e00ac2af0fd5c635d8f58a9c25e157965dfc998659d82c57198657ea93ea57c` | Success |
| Attempted incoming native transfer | `0x4efa028238ebbfc029cd4f00571c7396f43f45093867a397f89be799fe1cd4c3` | Reverted; proposed value was not received |
| Receive 0.98 MON | `0x17c3d573f457086ce0be8570cedf5bcfbb35fe1a15733a6e652656c4cf59b2f3` | Success |
| Send 5 USDC to `0x8143…F356` | `0xd472b15b806ce336c122f1a6d0a722a62643de9143312ee93f64b435c4d16118` | Success |
| Approve 1 USDC to MON book | `0xc2de59ecede3de1db96ae875b103de57d53457fee1a7f8764d3f75a6f84a3514` | Success |
| MON buy | `0x54a19b582bc439194c7eb6d1494b6336e0c5b96d18abdb9d672b8dfa0d6013fc` | Spent 1 USDC |
| MON sell | `0x496c1559e65f0086727ab1ca04b92f9ddb80d812b9b1d2421c57981e9ee6db1d` | Received 0.998407 USDC; saved expected output is not actual output |
| Approve 1 USDC to Flow | `0x419458b051d9c744ddb7648d17ccc56c7bf519225ebb8b862f1827395b2deee8` | Success |
| Creator-fee MON buy | `0x450e00b927f5b1dc9703b7bbb9fc7ffa52835dfe88ac596632633eb6c1b9d64c` | Real 0.0398263570831-MON creator payment |
| Second MON approval | `0x9671cbe9dbc10cc8880e34d2c9617d64b15fc000404cd246cf304ccb46fc1a71` | Exact 1 USDC |
| Second MON buy | `0x7b3a5f41719f6c0d7611d0d64da497dd50fb3c2f6c7079c103e33fa6a26392ff` | 1 USDC → 39.8231850583 MON |
| Second MON sell | `0x45db923a8a1ee310fd6890df3ad03dd6fcb43cbfcbccf9d3bce5206636c3b289` | Returned 0.998845 USDC |
| WETH book approval | `0x61fd62ee0d4256bde00669894ffffa484784243b6e464f467523c4a43ffd2a02` | Exact 1 USDC |
| Relayed WETH buy | `0xd6bbdff95a5f4577cb6465fd83b87f487d712bf3f998c149bb8122dd88c9004f` | Kuru WETH book fill: 1 USDC → 0.0003965232 WETH |
| Relayed routed WETH sell | `0x0b3a5af70e6d0aced43cf311c048e7088703dcdcc58dc01e7982b4f1f97c924f` | Same WETH amount sold; wallet received 0.990626 USDC; no configured Kuru Trade event in this receipt |

The eight originally saved demo receipts consumed 0.290788332 MON gas. The second MON round trip alone consumed 0.162237936 MON and lost 0.001155 USDC before gas. The WETH round trip lost 0.009374 USDC; relayers paid the two outer transactions' gas. No profitable-user outcome is established by these trades.

Buyer nonce is 11, but ten direct outgoing transactions were discovered (nonces 0–9). The WETH buy includes an EIP-7702 authorization at nonce 10, and the wallet now has delegation code pointing to `0x63c0c19a282a1b52b07dd5a65b58948a07dae32b`. This explains why nonce alone overcounts direct outgoing transactions. Both WETH execution transactions have relayer senders.

## Product claims and recording blockers

1. **Wallet flow:** Privy X/email/wallet login and embedded-wallet creation are implemented. Server verifies sessions and linked wallets. Creator bindings use stable X IDs and nonce-protected ownership proofs. Ordinary trading now needs a Privy-linked wallet rather than a creator binding. Wallets still confirm transactions; funding does not establish creator identity or profitable advice.
2. **Spot:** Kuru mainnet trades use wallet funds directly. Receiving USDC/MON into a wallet is not a Kuru exchange deposit. MON is needed for gas. Source links are user-supplied attribution, not independently proven causal evidence.
3. **Relayed trade attribution is a concrete gap:** `apps/web/lib/fill-indexing.ts` requires `transaction.from === user wallet` and a directly recognized destination/input. The relayed WETH buy would fail this check despite its genuine Kuru fill. The routed WETH sale is also outside the configured direct venue path. Do not describe these receipts as proof of working dashboard attribution. Receipt checks should support securely verified smart-wallet execution before that flow is advertised.
4. **Wallet selection:** the receive/send panel prefers the embedded wallet, while `useTradingWallet()` returns `wallets[0]`. With multiple linked wallets, check the address displayed for funding matches the reviewed trade's address.
5. **Perpl:** current code prepares exact AUSD approvals, account funding, orders, reduce-only closes and withdrawals for each user's own testnet wallet/account. Confirm reads actual fill events. Historical ETH/MON team-account fills still have successful receipts, but account 1096 and those relayer-originated transactions are not evidence of the new user's own embedded-wallet flow. That flow remains documented as simulation-only until demonstrated. Mainnet USDC cannot fund testnet AUSD collateral.
6. **Nansen:** current production insight request returned HTTP 200 with an unavailable verdict. All five source requests returned 403, labelled by the app as exhausted credits. The account-side cause was not independently verified. No wallet finding, PnL or token-flow insight was returned. Restore access and record a useful source-backed result before claiming a live Nansen demo.
7. **Missing tweets:** detection uses archived/observed posts and repeated X public embed lookups, not Nansen. Two misses flag a post as no longer public; deletion, protection and suspension are indistinguishable through this method. It covers captured posts, not all of X.
8. **Contract inspection:** address extraction, token metadata, liquidity, concentration and wallet-flow flags are implemented where covered. No authoritative impersonation/counterfeit verification system was found. Say users can inspect the exact address and risk context; do not claim every scam is detected or prevented.
9. **Reputation:** registered-call outcomes, samples and tier calculations exist. The project creator currently has zero scored calls. The approved five-correct-calls-with-verified-profitable-user-trades fee gate is still missing; base fee remains 10 bps. Identity, call correctness, creator payments and realized user returns are separate.
10. **Attestations/Envio:** production returns a current mainnet creator payment and current bond-free testnet call settlement, both receipt-checked. A payment record is not a tweet outcome. Not every detected tweet is committed onchain. The ten-block lag is a freshness policy, not a finality guarantee. Historical HyperIndex coverage and the working HyperSync demonstration are distinct.
11. **CRE:** real testnet settlement exists (`0x66d7aeed…`). It was broadcast through simulation with a simulation forwarder. Autonomous DON deployment remains pending.
12. **Following:** discovery, managed following and browser-observed X follows are implemented; these are not a complete imported X follow graph. Extension behavior still needs rehearsal on the actual recording browser.

## Suggested film structure

Keep the Wolf of Wall Street opening as a short fictional hook. The evidence should then become the plot. Suggested title: **Everybody has a call. Show me the receipt.**

| Beat | What to say/show | Proof required |
|---|---|---|
| 0–10s: hype | A fictional KOL promises the moon; freeze-frame: “Great call. Where's the record?” | Clearly staged opening |
| 10–30s: product | “Xtrading puts trading and the creator's record beside the call on X.” Open a real supported post and inline card. | Installed current extension |
| 30–60s: spot | Show Privy login, receiving address, mainnet balance, exact review, wallet confirmation and Kuru fill. | Confirmed receipt, same wallet address, correct mainnet label |
| 60–85s: accountability | Open registered-call history, missing-post status and one covered Nansen finding. “Check what was called, what remains public, and what the wallet data actually shows.” | Actual records; Nansen access currently blocked |
| 85–110s: perps | Explicit testnet switch. “The same wallet experience also prepares Perpl longs and shorts on testnet.” Show small order, actual fill, position, close/withdraw if completed. | Real new wallet-approved execution, not historical team fills |
| 110–135s: receipts | Show Envio decoded payment and testnet outcome links; describe the CRE broadcast accurately. | Current explorer/receipt evidence |
| Final 5s | “Trade the call. Check the record.” | Product name and URL |

This is a planning outline, not the final voiceover. Adjust duration to the actual submission limit; SPONSORS requires a Perpl demo of at most two minutes. Sponsors belong beside the visible job they perform: Privy signs, Kuru fills, Perpl opens testnet positions, Nansen adds covered analytics, Envio surfaces events, CRE supplies the demonstrated settlement.

## Meme and intercut ideas

- **Hype → receipts:** reuse the existing Wolf-style opening, then an abrupt sound cut to the explorer receipt. Overlay “Marketing department” followed by “Accounting department.” Keep the opening under ten seconds.
- **Disappearing call:** a fictional tweet dissolves; the archived record remains. Overlay “The post became unavailable. The captured record stayed.” Avoid labelling a real creator a scammer.
- **Two identical token names:** a Spider-Man-pointing-style original animation with different addresses below the same ticker. Punchline: “Same name. Check the address.” It illustrates inspection, not a proven counterfeit-detection feature.
- **Quote → submitted → filled:** three rapid cinematic title cards; stop on the actual receipt. This makes execution evidence entertaining and understandable.
- **Spot/perp scene change:** a door marked “Monad mainnet — Kuru” and another marked “Monad testnet — Perpl.” Keep persistent network captions on all trading footage.
- **Courtroom close:** fictional prosecutor says “Objection: screenshot.” Smash-cut to verified events: “Exhibit A: the receipt.” Use the app's actual evidence instead of invented numbers.

Use two or three short intercuts across the film; keep approvals, fill amounts, network labels and evidence legible. Record the remaining real wallet flows before cutting footage that presents them as completed.
