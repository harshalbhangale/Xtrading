# X extension

The Chrome extension (Manifest V3, version 0.12.4) is where most people use Xtrading. It reads posts on x.com, shows a trade card under the ones it can route, shows who is behind the call, and lets the user sign a trade without leaving X. Architecture diagrams for everything below: [Technical overview](architecture.md#the-x-extension).

## What it adds to X

**Under posts**

| Card | When it appears | What it does |
|---|---|---|
| Kuru swap card | X shows its ticker card for MON, ETH or BTC, the post has a supported cashtag, or the post is classified as a spot call | Live Kuru price, Buy or Sell, amount, network choice (mainnet selected, testnet available), creator fee line, then signing |
| Perpl tab or perp card | The post explicitly says long, short, leverage or perp, and Perpl has an open market for the asset | Long or short ticket with leverage, size or USD amount, slippage, estimated margin, fee and liquidation price. Testnet by default; mainnet (real AUSD) when picked and enabled on the server |
| Call check | Any classified call | What the post says, the creator's record and tier, and Nansen's wallet check of the creator |
| Fake-token warning | The post shares a token contract | Nansen's verdict on the contract, for example "The post says PEPE, but this isn't PEPE's contract" |
| Flagged-token card | The post names a token by contract and there is nothing safe to route | Nansen's verdict only. Nothing can be bought. |
| Creator badge | The author has bound their X account to a wallet | A small mark next to their name. It means the account is bound, not that the calls are good. |

Ordinary posts get nothing. One card per post: a card drawn from a cashtag is upgraded in place when the classification arrives.

**On profiles**

- A creator card: binding, tier, red flags and recent registered calls.
- Save to watchlist. The website's Watchlist page reads the saved handles through the app bridge.
- Optional follow sync. With opt-in on the Watchlist page, it records which accounts you follow as you scroll your own following list. It's stored locally in the extension and never reads X cookies or calls X's paid APIs.

**In the toolbar popup:** the app it's connected to and which providers are live (`/api/health`).

## Signing a trade

Nothing in the extension holds a key or a session. Each transaction is confirmed by the user in their own wallet.

| User has | Spot (Kuru) | Perp (Perpl) |
|---|---|---|
| MetaMask or Rabby in the browser | Signed on X. The card builds the exact Kuru step (approval, deposit or swap), simulates it for the minimum output, and the wallet signs it. A registered creator's fee is paid inside the same mainnet buy through Kuru Flow. | Signed on X. The service worker asks `/api/extension/perp/prepare` for the steps, the wallet signs each one, and `/api/extension/perp/confirm` reads the fill from the receipt. |
| No browser wallet | Opens the compact Xtrading window (`/trade/inline`), where the Privy wallet signs | Opens `/trade/perp` on the same network, where the Privy wallet signs |

The wallet must be on the right network; the card asks it to switch first.

**Creator fees.** On mainnet buys from a creator who registered a payout wallet, the card shows the creator's cut (0.1%, 0.5%, 1% or 2% by tier) and the wallet it goes to. The buyer can untick it. Testnet trades and sells never carry a fee.

## How data flows

```
X post ─▶ content script ─▶ service worker ─▶ POST /api/signals/classify
                                               └▶ signal (Groq or rules) + route (Kuru spot, Perpl perp or unavailable)
card opens ─▶ /api/markets/quote, /api/markets, /api/creators/:handle/payout
call check ─▶ /api/creators/:handle/insights, /reputation, /calls, /overview
signing    ─▶ wallet bridge ─▶ MetaMask or Rabby   (or the Xtrading window ─▶ Privy)
```

The content script never calls the API itself. The service worker accepts a fixed set of message types only from x.com and twitter.com tabs, validates every response with the shared schemas, runs at most four requests at a time, deduplicates and caches them, and sends no cookies or tokens.

The wallet bridge runs in X's page, where wallets inject `window.ethereum`, and forwards only these methods: `eth_requestAccounts`, `eth_accounts`, `eth_chainId`, `wallet_switchEthereumChain`, `wallet_addEthereumChain`, `eth_call`, `eth_getBalance`, `eth_sendTransaction` and `eth_getTransactionReceipt`.

## Rules that keep it honest

- **The model extracts, code routes.** A perp route needs explicit perp wording in the post, whatever the model says. Bearish wording alone becomes a spot sell, never a short.
- **No substitution.** A post that names a contract address is never routed to a ticker market. An asset with no configured market shows as not tradable.
- **Detection isn't scoring.** Detected calls feed the terminal and the call check. Only calls a creator registers count toward tiers ([Technical overview](architecture.md#calls-scoring-and-reputation)).
- **Stored posts are verified.** A classified post is saved only when X's public embed confirms the post exists, the handle wrote it and it says the captured text.
- **Nansen findings are observations.** A sale isn't proof of bad faith, and one wallet never covers all of someone's activity. Missing or failed checks are shown as missing, never as clean.
- **Untrusted text** is rendered with `textContent` inside shadow roots. Responses for a post that X has since recycled are discarded.

## Providers

| Provider | Server setting | With it | Without it |
|---|---|---|---|
| Groq | `GROQ_API_KEY`, optional `GROQ_MODEL` (default `openai/gpt-oss-120b`) | Structured extraction, temperature 0 | Rules extractor, labelled as rule-extracted |
| Nansen | `NANSEN_API_KEY` | Wallet and token checks on Monad mainnet and other covered chains | Labelled demo finding, never stored |
| Kuru | `MONAD_RPC_URL`, plus `KURU_MAINNET_ENABLED` for server-prepared mainnet trades | Live books and simulated quotes | Unavailable |
| Perpl | `MONAD_RPC_URL` | Perpl context and the user's own exchange account | Unavailable |

## Limits

- `POST /api/signals/classify`: public, 90 requests a minute per client, body up to 8 KB, text up to 2,000 characters, up to four X media URLs. A global budget of 120 model calls a minute falls back to rules. Results are cached by post ID and text hash.
- Detected calls only cover posts that Xtrading users have seen. Image-only posts aren't classified.
- The spot card defaults to Kuru mainnet and builds trades in the browser, so it doesn't depend on the server's mainnet switch. Perp tickets default to testnet; mainnet needs `PERPL_MAINNET_ENABLED=true` on the server and has lower caps.

## Build and install

```sh
pnpm --filter @call-my-bluff/extension build     # talks to http://localhost:3000
pnpm --filter @call-my-bluff/extension package   # production build, writes apps/web/public/downloads/xtrading-extension.zip
```

Load `apps/extension/dist` as an unpacked extension at `chrome://extensions` with developer mode on. A build only talks to the origin it was built for. Code: [`apps/extension/src`](../apps/extension/src).
