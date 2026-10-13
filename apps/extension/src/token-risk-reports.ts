import { tokenReferences } from "@call-my-bluff/integrations/token-references";

/** Published security evidence. These are dated reports, not live provider scans. */
export type TokenRiskReport = {
  id: string;
  chainId: number;
  network: string;
  address: string;
  token: string;
  finding: string;
  publisher: string;
  publishedAt: string;
  sourceUrl: string;
  evidenceUrl: string;
  reportingPost?: { handle: string; postId: string };
};

const damusSource = "https://x.com/PeckShieldAlert/status/1622436301055336450";
const pepeSource =
  "https://www.bnbchain.org/en/blog/dappbay-red-alarm-dapp-risk-list-april-17th-21st";

export const tokenRiskReports: readonly TokenRiskReport[] = [
  {
    id: "damus-bnb-honeypot",
    chainId: 56,
    network: "BNB Smart Chain",
    address: "0xcdb9b53158be4f67f010ec62413d3c7b88888888",
    token: "DAMUS",
    finding: "PeckShield reported this contract as a honeypot.",
    publisher: "PeckShield",
    publishedAt: "2023-02-06",
    sourceUrl: damusSource,
    evidenceUrl: `${damusSource}/photo/1`,
    reportingPost: { handle: "peckshieldalert", postId: "1622436301055336450" },
  },
  {
    id: "damus-bnb-sell-tax",
    chainId: 56,
    network: "BNB Smart Chain",
    address: "0x819eadb4c15c1e4697155be22c3b7cf12dac5660",
    token: "DAMUS",
    finding: "PeckShield reported a 100% sell tax for this contract.",
    publisher: "PeckShield",
    publishedAt: "2023-02-06",
    sourceUrl: damusSource,
    evidenceUrl: `${damusSource}/photo/1`,
    reportingPost: { handle: "peckshieldalert", postId: "1622436301055336450" },
  },
  ...[
    "0x9cf8b570fac7d129c2afa7058210d9137f55c081",
    "0x0839992d75940c557364e889d945c5a6b1a38ec0",
    "0x0905b28186e1a53893b974332e122c0b63e0f5f0",
  ].map((address) => ({
    id: `pepe-bnb-${address}`,
    chainId: 56,
    network: "BNB Smart Chain",
    address,
    token: "PEPE",
    finding:
      "BNB Chain's Red Alarm list identified this contract as a fake token.",
    publisher: "BNB Chain / DappBay",
    publishedAt: "2023-04-21",
    sourceUrl: pepeSource,
    evidenceUrl: pepeSource,
  })),
];

export type TokenRiskMatch = {
  report: TokenRiskReport;
  basis: "address" | "published-report";
  networkConfirmedByText: boolean;
};

/** A text cue is not an onchain verification; ambiguous posts stay unscoped. */
function networkCue(text: string): number | null {
  const cues = [
    /\b(?:BNB(?:\s*Smart)?\s*Chain|BNBChain|BSC|BEP[- ]?20)\b/i.test(text)
      ? 56
      : null,
    /\b(?:Ethereum|ERC[- ]?20)\b/i.test(text) ? 1 : null,
    /\bMonad\b/i.test(text) ? 143 : null,
    /\bBase\b/i.test(text) ? 8453 : null,
    /\bSolana\b/i.test(text) ? 101 : null,
  ].filter((n): n is number => n !== null);
  return cues.length === 1 ? (cues[0] ?? null) : null;
}

/** Exact contracts only. A ticker, author, or price drop never establishes token risk. */
export function matchTokenRiskReports(input: {
  text: string;
  handle: string;
  postId: string;
}): TokenRiskMatch[] {
  const addresses = new Set(
    tokenReferences(input.text)
      .filter((r) => r.kind === "evm")
      .map((r) => r.address.toLowerCase()),
  );
  const chain = networkCue(input.text);
  return tokenRiskReports.flatMap((report): TokenRiskMatch[] => {
    const sourcePost = report.reportingPost;
    // The reporting author's post is evidence context, never an accusation against that author.
    if (
      sourcePost?.postId === input.postId &&
      sourcePost.handle === input.handle.toLowerCase() &&
      /\bDamus\b/i.test(input.text) &&
      /\b(?:honeypot|selling tax)\b/i.test(input.text)
    )
      return [
        { report, basis: "published-report", networkConfirmedByText: false },
      ];
    if (
      !addresses.has(report.address) ||
      (chain !== null && chain !== report.chainId)
    )
      return [];
    return [
      {
        report,
        basis: "address",
        networkConfirmedByText: chain === report.chainId,
      },
    ];
  });
}
