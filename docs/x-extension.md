# X extension: badges, call detection and trade handoff

The extension is the primary product surface. On x.com it adds:

1. **Inline spot cards** under supported trading calls: ticker and live book price, expanding into Buy/Sell amounts, explicit testnet/mainnet choice and secure wallet review. Unknown addresses and explicit perp calls retain a details entry; address-only mentions are not scored calls.
2. **A profile-header card** on X profile pages with separate recorded binding, refundable stake, detected-call count and pending score; it links to the creator dashboard. Untracked accounts show missing evidence honestly.
3. **Expandable creator evidence**, separate from the swap form: linked account, call count/performance, sourced Nansen observations and creator dashboard. Details for unsupported/perp routes open inside the post rather than a fixed sidebar.
4. **Expand calls & wallet activity** on the profile card: ongoing registered calls and indexed Kuru swaps. Creator-specific Perpl positions are not shown yet; orders already trade the creator's own wallet account.
5. **Optional viewed-follow sync** into Watchlist using local extension storage. It observes profiles and visible rows in your own following list, with no paid X following API. See [setup and limits](browser-following.md).

Ordinary posts receive no trade cards. Bound authors can show a quiet identity badge; a badge does not establish performance or unique humanity. Profile evidence refreshes every minute while the tab is visible; expanded evidence loads when opened.

Signing never happens in the extension. Spot cards open `/trade/inline` in a compact secure wallet window with the route, amount and explicit chain prefilled. The user reviews balances, gas, minimum received and any selected creator fee before approving. Perp review still uses the dashboard.

Creator fees require opt-in payout registration and server enablement. Eligible mainnet buys offer 0.5% of bought-token output to the registered creator; testnet and ordinary fee-disabled swaps charge no creator fee. Identity control, call performance and actual wallet returns remain distinct. Source attribution is browser-supplied. Version 0.7.0 has automated expiry, stale-response, amount, fee-output and X-rerender coverage; real-X validation still needs Chrome reload.

## Flow

```
X post → content script → service worker → POST /api/signals/classify
       → signal (Groq or rules) + deterministic route (Kuru spot / Perpl perp / unavailable)
Trade ▸ → GET /api/creators/:handle/insights?asset&direction → evidence + reputation + Nansen check
       → app /dashboard/trade?instrument=…&side=…&postId=…&handle=… → review → wallet / Perpl order
```

## Provider modes

| Provider | Key(s) | Live | Without keys |
|---|---|---|---|
| Groq (call extraction) | `GROQ_API_KEY`, optional `GROQ_MODEL` (default `openai/gpt-oss-120b`, strict JSON-schema output, temperature 0) | Structured-output extraction | Deterministic rules extractor, labelled `RULES` / "rule-extracted" |
| Nansen | `NANSEN_API_KEY` | `POST /api/v1/profiler/dex-trades` for the bound wallet on Monad mainnet, 30 days | Deterministic demo finding labelled `DEMO DATA`; never stored |
| Perpl | none beyond `MONAD_RPC_URL` | The user's own wallet signs `execOrder` on Perpl's testnet Exchange (IOC, limit at mark ± slippage) for its own exchange account; the server reads the result from the receipt | — (the server holds no Perpl key) |
| Kuru | none beyond RPC | Existing live testnet simulation and Privy-signed transactions | — |

`GET /api/health` reports `modes` (credential presence only). The extension popup shows them.

## Rules that keep the output honest

- Extraction is not advice. The model extracts; deterministic code routes. A perp route requires explicit perp/leverage/long/short wording in the post, even if the model says otherwise. Bearish language alone routes to a Kuru **spot sale of owned MON**, never a short.
- No venue substitution: an asset without a configured Kuru spot market or an open Perpl market shows "No testnet market".
- Reputation counts calls extracted from posts seen by extension users (`post_signals`, methodology `signal-v1`). The score stays pending until calls are evaluated against sourced expiry prices.
- A Nansen sale is an observation, not proof of deception; one wallet never covers all activity. The bound wallet is a testnet embedded wallet, so live mainnet checks often return "no matching activity".
- Spot (Kuru) and perp (Perpl) trades both open the Xtrading window and are signed there by the user's own Privy wallet (X, email or an external wallet like MetaMask). Trading needs a login, not an X binding; the server checks the wallet is linked to the logged-in Privy user, and the extension never signs, holds a session or injects a script into X. For Perpl the server returns unsigned steps (exact AUSD approval, account opening or top-up when needed, then `execOrder`) with caps from `PERPL_MAX_LEVERAGE` and `PERPL_MAX_SIZE`; the result is read from the transaction's events and must come from the wallet that placed it. The X binding stays for creators (payouts, registered calls, verified identity, Nansen wallet check).

## Limits and protections

- `POST /api/signals/classify`: public, 90 requests/min per client, body ≤ 8 KB, text ≤ 2000 chars, up to four validated X media URLs, global LLM budget 120 calls/min (overflow falls back to rules), cached by post ID + text hash.
- Provider requests accept messages only from x.com/twitter.com tabs, cap concurrency at 4, deduplicate requests and send no cookies or tokens. The local following bridge accepts only the configured app origin's Watchlist page.
- Untrusted post text is rendered with `textContent` only and isolated in shadow roots.
- Delayed classification responses are discarded if X has recycled the post. Missing or invalid classification produces no injected UI.

Eleven extension UI cases cover ordinary posts, click-only drawers and expansion, profile records, navigation during evidence reads, invalid/mismatched responses, recycled posts, address-only references and separate trade review links. Two media tests exclude quoted-post images and avatars. Five follow-observation and three storage tests cover scoping, opt-in, isolation and clearing. Extension 0.4.0 profile expansion and opt-in following-list sync were verified on real X against the production backend on 12 October 2026. Wider feed/navigation coverage, live account switching and unfollow checks remain.

## Post images and token references (0.5.0)

The extension captures original-post photo URLs when it observes a detected call or an explicit address mention. The drawer and expanded creator dashboard show those attachments, full address references and a canonical **View post** link. These are browser-submitted observations, not authenticated X evidence. Old records acquire attachments only when observed again; changed text cannot overwrite a previous text-hash record.

The dashboard's optional **Read image text** uses Tesseract.js in the browser. It downloads the OCR engine/language data on first use and requires no paid image API. Results remain unverified text; possible addresses must be checked against the original. OCR does not set entry/target/expiry, modify routes, or submit trades. Completely image-only posts are not automatically classified.

Buy/sell links open review for explicitly configured Monad testnet markets; perp routes use long/short labels. Address-bearing posts require verified network/token mapping before execution and show unavailable trade buttons, including Solana/Pump.fun references. A ticker never substitutes for a different token address. Detected posts have no evaluated outcomes yet and do not represent a creator's actual positions.

## Build and install

```sh
pnpm --filter @call-my-bluff/extension build   # default origin http://localhost:3000
```

Load `apps/extension/dist` as an unpacked extension in `chrome://extensions`. Restart `pnpm dev` after adding keys or pulling schema changes, then run `pnpm db:migrate` for the `post_signals` table.
