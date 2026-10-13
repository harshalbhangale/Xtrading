# Product tour

A walk through Xtrading in screenshots: the website, the trader dashboard, the creator studio, agent access and the X extension. Back to the [README](../README.md).

- [Website and sign-in](#website-and-sign-in)
- [Trader dashboard](#trader-dashboard)
- [Creator studio](#creator-studio)
- [Agent access](#agent-access)
- [X extension](#x-extension)

## Website and sign-in

**[xtradingnow.xyz](https://xtradingnow.xyz)**: see the tweet, trade it, stay on X.

![Xtrading landing page](assets/screenshots/landing.png)

**One sign-in, two workspaces.** Traders follow calls and trade. Creators build a public record and earn from buys made from their posts.

![Choose between the trader dashboard and the creator studio](assets/screenshots/get-started.png)

## Trader dashboard

**Terminal.** A live feed of calls from the creators you follow, or from everyone. Each post is tagged with its ticker, direction, whether it can be traded on Monad and how confident the extraction is. Follow or fade a call, report a deleted post, or trade it in one click. The right rail ranks who to follow or fade by how often their calls actually moved their way.

![Terminal: live feed of calls with follow, fade and trade](assets/screenshots/trader-terminal.png)

**Profile.** Shortcuts to spot and perp trading, best bid and ask on each Kuru market read live from the chain, a creator lookup by X handle, and your confirmed fills.

![Trader profile with markets, creator lookup and recent fills](assets/screenshots/trader-profile.png)

**Creator record.** Every creator gets a public page with a verdict, hit rate, median move since posting, deleted calls, red flags and Nansen screening of the tokens they shill.

![Creator record with red flags and Nansen token screening](assets/screenshots/trader-creator-record.png)

## Creator studio

**Overview.** Setup takes three steps: bind your X account to a wallet with a signed message, register calls, and earn a fee tier. Your public record lives at `/creators/<handle>`.

![Creator overview with setup steps and tier progress](assets/screenshots/creator-overview.png)

**Calls.** Paste one of your posts from the last 24 hours and pick the asset, direction, horizon and minimum move. Entry is the price at the minute you posted, the result uses the price at expiry, and the terms can't be edited afterwards.

![Register a call from an X post](assets/screenshots/creator-calls.png)

**Reputation.** Tiers are earned from scored calls and set your cut of each buy: 0.1% when verified, 0.5% at Pro, 1% at Max and 2% at Ultra. Red flags demote you, and no staking is required.

![Tiers, requirements and red flags](assets/screenshots/creator-reputation.png)

## Agent access

**MCP server.** Connect Claude Code or any other MCP client to `https://xtradingnow.xyz/api/mcp`. Agents can read creator records and your portfolio, and prepare trades for you to sign. They can't sign, withdraw or move funds. The page includes a ready-made "follow a creator and take profit" prompt.

![Agent access page with the MCP endpoint and a ready prompt](assets/screenshots/agent-access.png)

## X extension

### Trade from the post

<table>
  <tr>
    <td width="50%"><img src="assets/screenshots/post-long-card.png" alt="Long card under a bullish ETH post" /></td>
    <td width="50%"><img src="assets/screenshots/spot-kuru-buy.png" alt="Kuru spot buy inside X" /></td>
  </tr>
  <tr>
    <td><sub>A bullish $ETH post gets a Long card right under the text</sub></td>
    <td><sub>Buy on Kuru without leaving X</sub></td>
  </tr>
  <tr>
    <td><img src="assets/screenshots/post-short-card.png" alt="Short card under a bearish post" /></td>
    <td><img src="assets/screenshots/perp-ticket.png" alt="Perpl short ticket" /></td>
  </tr>
  <tr>
    <td><sub>"go short on ETH" is read as a bearish perp call</sub></td>
    <td><sub>Short ETH-PERP on Perpl with 1–5x leverage and size caps</sub></td>
  </tr>
  <tr>
    <td><img src="assets/screenshots/perp-review.png" alt="Perp order review" /></td>
    <td><img src="assets/screenshots/perp-sign.png" alt="Signing the perp order" /></td>
  </tr>
  <tr>
    <td><sub>Review value, margin, fee and liquidation price</sub></td>
    <td><sub>Every step is listed, then signed by your own wallet</sub></td>
  </tr>
</table>

### Check the caller

<table>
  <tr>
    <td width="50%"><img src="assets/screenshots/call-check.png" alt="Call check with Nansen wallet check" /></td>
    <td width="50%"><img src="assets/screenshots/post-call-check-creator.png" alt="Nansen requests and creator record" /></td>
  </tr>
  <tr>
    <td><sub>What the post says, the Nansen wallet check and token flows</sub></td>
    <td><sub>Every Nansen request listed, next to the creator's tier and record</sub></td>
  </tr>
</table>

**Creator card on X profiles:** linked wallet, tier, red flags and recent calls.

<p align="center"><img src="assets/screenshots/profile-record.png" width="560" alt="Creator record on an X profile" /></p>

### Catching a fake token

A post shills "PEPE" with a contract address that isn't PEPE. Before anyone clicks, the extension puts a Nansen warning right under the post: no chain Nansen covers knows a token at that address. It goes further for well-known tickers: *"The post says PEPE, but this isn't PEPE's contract. The real PEPE is 0x6982…1933 on Ethereum."*

<p align="center"><img src="assets/screenshots/fake-token-flag.png" width="560" alt="Risk warning on a fake PEPE contract" /></p>
