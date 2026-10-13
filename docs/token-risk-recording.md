# Source-linked token warnings

Extension 0.11.2 includes five exact-address historical risk records. No records are attributed to Nansen; they come from published security reports, and the UI displays their source and date. No tweet content, price outcome, deletion history or creator identity was fabricated.

## Recording tweet

Open [PeckShield's 6 February 2023 DAMUS warning](https://x.com/PeckShieldAlert/status/1622436301055336450). Its text and author were verified through X oEmbed and the logged-in browser on 13 October 2026. Its first image explicitly lists the BNB contracts below. The extension shows a **Token security report** immediately beneath the post, including the exact addresses and links to that image. This is a reporting tweet, not a promotion by a malicious creator. The original promotional posts were not located or verified.

| Network | Contract | Published finding |
|---|---|---|
| BNB Smart Chain (56) | `0xcdb9b53158be4f67f010ec62413d3c7b88888888` | PeckShield's image labels it a honeypot |
| BNB Smart Chain (56) | `0x819eadb4c15c1e4697155be22c3b7cf12dac5660` | PeckShield's image reports 100% sell tax |

The report is historical. Current sell behaviour is not claimed or simulated, and these contracts are not available in Xtrading's configured Monad markets. Source: [PeckShield evidence image](https://x.com/PeckShieldAlert/status/1622436301055336450/photo/1).

## Counterfeit PEPE contracts

BNB Chain's [21 April 2023 Red Alarm list](https://www.bnbchain.org/en/blog/dappbay-red-alarm-dapp-risk-list-april-17th-21st) identifies these BNB Smart Chain contracts as fake tokens:

- `0x9cf8b570fac7d129c2afa7058210d9137f55c081`
- `0x0839992d75940c557364e889d945c5a6b1a38ec0`
- `0x0905b28186e1a53893b974332e122c0b63e0f5f0`

Any X post containing one of those exact addresses receives the dated **Reported token risk** card. A PEPE ticker alone or legitimate Ethereum PEPE does not match. Explicit mentions of another network suppress the BNB finding. If the post's network is missing or ambiguous, the card says that the address matches a BNB report and the post's network is unverified. The source report does not establish a sell-tax or honeypot finding for these PEPE contracts.

## Packaging and verification

- `pnpm exec vitest run apps/extension/src/token-risk-reports.test.ts apps/extension/src/token-risk-warning.test.ts apps/extension/src/content.test.ts` covers exact-address/network matching, report context, no provider/signing calls, and X's recycled post nodes.
- `pnpm --filter @call-my-bluff/extension package` creates the production ZIPs.
- Reload the existing unpacked extension, then refresh the X tab to replace its old content script. A version number alone does not establish which bundle is loaded.
- The warning is source-based evidence, not an automatic assertion that an author is a scammer or that Nansen blocked a token. Existing trading routes remain limited to the configured Monad markets.

Verified 13 October 2026: `pnpm check` passed lint, workspace types, 213 application tests, 30 Foundry tests, and builds. Six application tests and four optional Foundry fork tests were skipped. Production ZIPs were rebuilt and inspected for version 0.11.2 and the warning code. The unpacked `dist` build retains the existing localhost app origin. Chrome's internal extension-management page rendered blank during the reload attempt, so activation of the updated bundle in the user's browser remains unverified; reload the unpacked extension and refresh the tweet.
