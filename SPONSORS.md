# Built with our sponsors

Xtrading is entered in the **Onchain Finance & Trading** track. Each section below explains what one sponsor does for the product, where the code lives and where you can see it working.

---

## Kuru: trading straight from X

Every trade in Xtrading goes through Kuru's order books on Monad.

- **Market orders without an exchange account.** On mainnet the user's wallet trades directly against the MON, WETH and cbBTC / USDC books. There's one exact USDC approval, then one immediate-or-cancel order. The minimum output comes from an `eth_call` of the same order, so the price the user approves is the price the chain enforces.
- **Creator fees through Kuru Flow.** When the post belongs to a registered creator, the buy is routed through the Kuru Flow entrypoint. The creator's 0.1–2% share is paid to their wallet in the same transaction as the swap, and if anything fails, the whole trade reverts.
- **Live prices and book history** on the extension's ticker cards and in the Terminal.

**Code:** [`packages/integrations/src/kuru.ts`](packages/integrations/src/kuru.ts), [`creator-fees.ts`](packages/integrations/src/creator-fees.ts), [`apps/web/lib/spot-trade.ts`](apps/web/lib/spot-trade.ts), [`apps/extension/src/swap-card.ts`](apps/extension/src/swap-card.ts)

**Onchain:** [Kuru buy](https://monadvision.com/tx/0x54a19b582bc439194c7eb6d1494b6336e0c5b96d18abdb9d672b8dfa0d6013fc) · [sell](https://monadvision.com/tx/0x496c1559e65f0086727ab1ca04b92f9ddb80d812b9b1d2421c57981e9ee6db1d) · [buy with creator fee paid in the same transaction](https://monadvision.com/tx/0x450e00b927f5b1dc9703b7bbb9fc7ffa52835dfe88ac596632633eb6c1b9d64c). The creator-fee path is also covered by mainnet fork tests in [`KuruCreatorFeeFork.t.sol`](contracts/test/KuruCreatorFeeFork.t.sol).

---

## Privy: sign in with X, trade with your own wallet

Privy is the front door to the app.

- **Sign in with X.** Every creator profile, call and fee is tied to the stable X user ID, so changing a handle doesn't break a record.
- **Embedded wallets** for people who don't have one yet. External wallets such as MetaMask and Rabby also work.
- **Explicit signing.** Each trade opens in Privy's confirmation dialog. The server only prepares transactions and never signs them.
- **Wallet binding.** A creator proves they own their payout wallet by signing a one-time nonce. Privy sessions are verified on the server before a binding is saved.

**Code:** [`apps/web/lib/identity-auth.ts`](apps/web/lib/identity-auth.ts), [`packages/database`](packages/database), [`apps/web/lib/trading-wallet.ts`](apps/web/lib/trading-wallet.ts). Design notes are in [docs/identity-binding.md](docs/identity-binding.md).

---

## Envio: the receipts behind every number

Envio lets Xtrading show what happened onchain, not just what someone claims happened.

- **HyperIndex** indexes Kuru V2 swaps, deposits, withdrawals and account registrations on testnet, plus Kuru Flow creator payments on mainnet. Events are keyed by `chain:block:logIndex` and rolled back on reorgs.
- **HyperSync** scans the Kuru Flow `FeeCollected` events live. Each event is checked against its transaction receipt and block hash before it's shown, and the page reports how fresh the data is.
- **Creator earnings** read from the same source, so the dashboard total matches what the chain shows.

**Code:** [`services/indexer`](services/indexer), [`apps/web/lib/envio-evidence.ts`](apps/web/lib/envio-evidence.ts), [`packages/integrations/src/envio-events.ts`](packages/integrations/src/envio-events.ts)

**Live:** [xtradingnow.xyz/dashboard/onchain](https://xtradingnow.xyz/dashboard/onchain) shows creator payments with transaction links and indexed block height. You don't need a wallet to view it.

---

## Nansen: is the caller trading their own call?

A good-looking call record is only half the picture. Nansen shows the other half.

- **Wallet consistency check.** For a creator's linked wallet, Nansen's DEX-trade history shows whether they bought what they told followers to buy, or sold into it. The result is labelled *consistent*, *contradiction* or *no activity*, with the trades that support it.
- **Token context** on ticker cards and creator profiles, always showing the network, timestamp and coverage.
- **Price data** (MON 1-minute OHLCV) used to score MON calls.

The Nansen API key stays on the server. If Nansen can't answer, the app says that rather than guessing.

**Code:** [`packages/integrations/src/nansen.ts`](packages/integrations/src/nansen.ts), [`nansen-evidence.ts`](packages/integrations/src/nansen-evidence.ts), [`apps/extension/src/nansen-panel.ts`](apps/extension/src/nansen-panel.ts)

---

## Perpl: perps for explicit long and short calls

Some calls are leveraged by nature. Xtrading routes those to Perpl.

- **Only when the call says so.** Bearish wording alone never opens a leveraged short. The user picks the perp explicitly.
- **The user's own account.** Orders, closes and withdrawals are signed by the user's wallet against their own Perpl exchange account. Xtrading holds no Perpl key.
- **Guard rails.** Leverage and size caps are enforced, and fills are read from the order transaction's events.

**Code:** [`packages/integrations/src/perpl-exchange.ts`](packages/integrations/src/perpl-exchange.ts), [`apps/web/lib/perpl-trade.ts`](apps/web/lib/perpl-trade.ts), [`apps/extension/src/perp-card.ts`](apps/extension/src/perp-card.ts). The exit flow is described in [docs/perpl-exits.md](docs/perpl-exits.md).

**Network:** Monad testnet, exchange [`0x1964…80cc`](https://testnet.monadvision.com/address/0x1964c32f0be608e7d29302aff5e61268e72080cc).

---

## Bounty tracks

[Kuru](https://hackathon.monad.xyz/tracks/build-the-next-consumer-trading-app-on-kuru) · [Privy](https://hackathon.monad.xyz/tracks/privy) · [Envio](https://hackathon.monad.xyz/tracks/best-use-of-envio) · [Nansen](https://hackathon.monad.xyz/tracks/best-use-of-nansen)
