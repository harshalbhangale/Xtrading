# X extension: badges, call detection and trade handoff

The extension is the primary product surface. On x.com it adds:

1. **Signal bars** only under posts classified as trading calls: asset, direction, spot/perp and venue, with **Trade ▸** (routable) or **Details ▸** (no testnet market).
2. **A profile-header card** on X profile pages with separate recorded binding, refundable stake, detected-call count and pending score; it links to the creator dashboard. Untracked accounts show missing evidence honestly.
3. **A call-check drawer**, opened only when the user clicks: the post, separate creator identity/stake/call evidence, Nansen wallet observations and the venue route, with **Review trade in app ↗**.
4. **Expand calls & wallet activity** on the profile card: ongoing registered calls and indexed Kuru swaps. Creator-specific Perpl positions remain unavailable until the creator links their own account.
5. **Optional viewed-follow sync** into Watchlist using local extension storage. It observes profiles and visible rows in your own following list, with no paid X following API. See [setup and limits](browser-following.md).

Ordinary posts remain untouched and author names have no automatically inserted badges. Profile evidence refreshes every minute while the tab is visible; drawer evidence loads when opened.

Signing never happens in the extension. The drawer opens `/dashboard/trade` with the route prefilled; the user sets amounts and approves in the app.

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
| Perpl | `PERPL_API_KEY`, `PERPL_API_KEY_SECRET`, `PERPL_ACCOUNT_ID` | Ed25519-signed `POST /v1/trading/orders` (IOC market order) | Order validated and shown as "Demo order validated"; nothing is sent |
| Kuru | none beyond RPC | Existing live testnet simulation and Privy-signed transactions | — |

`GET /api/health` reports `modes` (credential presence only). The extension popup shows them.

## Rules that keep the output honest

- Extraction is not advice. The model extracts; deterministic code routes. A perp route requires explicit perp/leverage/long/short wording in the post, even if the model says otherwise. Bearish language alone routes to a Kuru **spot sale of owned MON**, never a short.
- No venue substitution: an asset without a configured Kuru spot market or an open Perpl market shows "No testnet market".
- Reputation counts calls extracted from posts seen by extension users (`post_signals`, methodology `signal-v1`). The score stays pending until calls are evaluated against sourced expiry prices.
- A Nansen sale is an observation, not proof of deception; one wallet never covers all activity. The bound wallet is a testnet embedded wallet, so live mainnet checks often return "no matching activity".
- Perpl orders require a signed-in user with a current binding, explicit confirmation, server caps (`PERPL_MAX_LEVERAGE`, `PERPL_MAX_SIZE`) and one submission per user/post/side per minute. "Submitted" is not "filled". The configured Perpl key trades the configured account; per-user Perpl accounts are future work.

## Limits and protections

- `POST /api/signals/classify`: public, 90 requests/min per client, body ≤ 4 KB, text ≤ 2000 chars, global LLM budget 120 calls/min (overflow falls back to rules), cached by post ID + text hash.
- Provider requests accept messages only from x.com/twitter.com tabs, cap concurrency at 4, deduplicate requests and send no cookies or tokens. The local following bridge accepts only the configured app origin's Watchlist page.
- Untrusted post text is rendered with `textContent` only and isolated in shadow roots.
- Delayed classification responses are discarded if X has recycled the post. Missing or invalid classification produces no injected UI.

Eight extension UI cases cover ordinary posts, click-only drawers and expansion, profile records, navigation during evidence reads, invalid responses and recycled posts. Five follow-observation and three storage tests cover scoping, opt-in, isolation and clearing. Production validation on real X is still pending.

## Build and install

```sh
pnpm --filter @call-my-bluff/extension build   # default origin http://localhost:3000
```

Load `apps/extension/dist` as an unpacked extension in `chrome://extensions`. Restart `pnpm dev` after adding keys or pulling schema changes, then run `pnpm db:migrate` for the `post_signals` table.
