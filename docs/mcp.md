# MCP server

Xtrading runs a [Model Context Protocol](https://modelcontextprotocol.io) server so AI agents can read creator evidence and markets, and prepare trades for the user to sign.

**Agents never sign.** Every trade tool returns unsigned transactions and an `approvalUrl`. The user opens that link and signs in their own wallet.

| | |
|---|---|
| Endpoint | `https://xtradingnow.xyz/api/mcp` |
| Transport | Streamable HTTP, stateless, JSON responses. Only `POST` is accepted; `GET` and `DELETE` return `405`. |
| Default network | Monad testnet (`10143`). Mainnet (`143`) must be passed explicitly as `chainId`. |
| Rate limit | 120 requests per minute per IP, then `429`. |
| Code | [`apps/web/lib/mcp.ts`](../apps/web/lib/mcp.ts) (tools), [`apps/web/app/api/mcp/route.ts`](../apps/web/app/api/mcp/route.ts) (HTTP route) |

## Connect

Public tools need no login:

```sh
claude mcp add --transport http xtrading https://xtradingnow.xyz/api/mcp
```

Signed-in tools need the user's Privy access token as a header. Sign in at [`/integrations`](https://xtradingnow.xyz/integrations) and use **Copy Claude Code command**. It gives:

```sh
claude mcp add --transport http xtrading https://xtradingnow.xyz/api/mcp \
  --header "Authorization: Bearer <privy-access-token>"
```

The token expires after about an hour. Copy it again when tools ask for a session. Treat it like a password: it lets an agent read your account and prepare trades, but it cannot sign, withdraw or move funds.

Any other MCP client works the same way: send JSON-RPC over `POST` with `Accept: application/json, text/event-stream`.

## Tools

### Public

| Tool | Inputs | Returns |
|---|---|---|
| `get_creator` | `handle` | Identity binding (stable X user ID to wallet) and stake status. A binding proves account ownership, not accuracy. |
| `list_calls` | `handle` | Calls the creator registered, priced at posting and scored at expiry ([`directional-return-v1`](https://xtradingnow.xyz/methodology)). Outcomes are hypothetical, not wallet returns. |
| `recent_calls` | `handle`, `since?` (ISO time) | Trade calls detected in the creator's recent posts, newest first, with the tradable route. Only covers posts seen by Xtrading users, not the full X feed. |
| `classify_post` | `postId`, `handle`, `text` | Asset, direction and instrument found in the post text, and a route to a testnet market (Kuru spot or Perpl perp). A Kuru route is only offered while that side of the order book has orders. Bearish text never becomes a leveraged short. Nothing is saved. |
| `get_markets` | none | Kuru testnet books (MON, WETH, WBTC against USDC), Perpl testnet markets (`perpl`) and, when the server enables it, Perpl mainnet markets (`perplMainnet`), each with its `marketId`. |
| `quote_trade` | `market`, `side`, `amount`, `chainId?` | Indicative Kuru output after the taker fee. Returns `status: "unavailable"` when the book has no orders on that side or the amount is too small. Display only; `prepare_trade` sets the real minimum. |

### Signed in

| Tool | Network | Inputs | Returns |
|---|---|---|---|
| `get_portfolio` | testnet or mainnet | `chainId?` | Wallet balances and confirmed Kuru trades (testnet indexed by Envio; mainnet re-checked from receipts). |
| `get_position` | mainnet | `market` | Open size, cost and profit for one Kuru market, from your trade receipts and a current sell quote. |
| `prepare_trade` | testnet or mainnet | `market`, `side`, `amount`, `chainId?`, `slippageBps?`, `handle?`, `sourcePostId?` | The next unsigned Kuru step (exact approval, deposit, or a simulated swap with a minimum output) and an `approvalUrl`. Expires after 30 seconds. |
| `get_perp_account` | testnet or mainnet | `chainId?` | Wallet AUSD, your own Perpl exchange account (available and locked) and open positions, read from the Exchange contract. |
| `prepare_perp` | testnet or mainnet | `chainId?`, `marketId`, `side` (`long`/`short`), `size`, `leverage`, `slippageBps?`, `handle?`, `sourcePostId?` | Unsigned steps (exact AUSD approval and account funding if needed, then an immediate-or-cancel order at mark ± slippage) and an `approvalUrl`. Expires after 60 seconds. |
| `prepare_perp_close` | testnet or mainnet | `chainId?`, `marketId`, `slippageBps?` | One unsigned reduce-only order that closes your whole position. Side and size come from the chain. May fill partially. |
| `prepare_perp_withdraw` | testnet or mainnet | `chainId?`, `amount` (AUSD) | One unsigned step that moves free AUSD from your Perpl account back to the same wallet. |

Input rules:

- `handle`: X handle, with or without `@`, up to 15 characters.
- `market`: `MON`, `WETH` or `WBTC` (WBTC trades cbBTC on mainnet).
- `amount` and `size`: decimal strings such as `"10"` or `"0.01"`. No negatives, no `1e5`. Amounts are converted to integer token units on the server; floats are never used.
- `slippageBps`: 1 to 500, default 100.
- Perpl `leverage` and `size` are also capped by the server (`PERPL_MAX_LEVERAGE`, `PERPL_MAX_SIZE`) and by each market's own maximum.
- Perpl `marketId` is different on each network (for example ETH is 32 on testnet and 20 on mainnet). Take it from `get_markets` for the same network.

## Perpl on mainnet

Pass `chainId: 143` to any Perpl tool to use Monad mainnet with **real AUSD**. It works only when the server sets `PERPL_MAINNET_ENABLED=true`; otherwise the tools answer `Request refused: perpl_mainnet_disabled.` and never fall back to testnet.

Mainnet has its own, lower caps: leverage up to `PERPL_MAINNET_MAX_LEVERAGE` (default 3), at most `PERPL_MAINNET_MAX_COLLATERAL` AUSD of margin per order (default 50, refused with `collateral_above_cap`), and an optional size cap `PERPL_MAINNET_MAX_SIZE`. The `approvalUrl` opens the mainnet trade page, and the user still signs every step in their own wallet.

Perpl numbers come back as integers. Scale them with the `sizeDecimals`, `priceDecimals` and `collateralDecimals` fields in the same response.

## Signing flow

1. The agent calls a `prepare_*` tool.
2. The user opens `approvalUrl`. It loads the same review on `/dashboard/trade`, and the user signs each step in their own wallet.
3. The trade page confirms the transaction from its receipt. Agents can then read the result with `get_portfolio` or `get_perp_account`.

For Perpl closes and withdrawals, `approvalUrl` opens the Perpl account panel, where the user presses **Close** or **Withdraw**. See [Perpl exits](perpl-exits.md).

## Errors

- **Bad input:** JSON-RPC error `-32602` naming the field.
- **No session:** `"This tool needs the user's Xtrading session…"`. Send a fresh token.
- **Refused by a rule:** `"Request refused: <code>."`, for example `invalid_amount`, `creator_unavailable`, `leverage_above_cap`, `size_above_cap`, `collateral_above_cap`, `collateral_insufficient`, `perpl_mainnet_disabled`, `position_not_open` or `amount_above_available`.
- **Upstream down:** `"The service is temporarily unavailable."`

Tool errors come back as a normal result with `isError: true`, so the agent can read them.

## Separate signals

Identity, call outcomes and wallet returns are three different things. A verified account does not mean good calls, and a scored call is not a real wallet profit. Agents should report them separately and never merge them into one score.
