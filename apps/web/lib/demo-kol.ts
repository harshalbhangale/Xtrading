/**
 * Demo-only fixture: a fictional crypto KOL used to show what red flags look
 * like. Nothing here is real evidence — the handle, posts, token addresses
 * and Nansen verdicts are all made up, and every surface that renders it
 * labels it as demo data.
 */
export const DEMO_KOL_HANDLE = "demo_moonoracle";

export type DemoToken = {
  symbol: string;
  name: string;
  address: string;
  postedAt: string;
  claim: string;
  nansen: "blocked" | "warning";
  reasons: string[];
  sincePostPct: number;
};
export type DemoDeletedPost = {
  postedAt: string;
  deletedAt: string;
  text: string;
  asset: string;
  moveBeforeDeletePct: number;
};

export const demoKol = {
  handle: DEMO_KOL_HANDLE,
  displayName: "MoonOracle",
  followers: "184K",
  joined: "Mar 2024",
  verdict: "Fade",
  record: { right: 3, scored: 17, medianPct: -38.4 },
  summary:
    "Pushes freshly deployed tokens with copied names, then deletes the posts once the price collapses.",
  flags: [
    {
      severity: "serious" as const,
      title: "Shilled tokens Nansen blocks",
      detail:
        "4 contract addresses posted in the last 30 days. Nansen flags 3 as blocked (honeypot or rug-linked deployer) and 1 as a warning.",
    },
    {
      severity: "serious" as const,
      title: "Deleted calls after losses",
      detail:
        "5 posts deleted within 48 hours of posting, every one after the token fell more than 40%.",
    },
    {
      severity: "serious" as const,
      title: "Sold into their own call",
      detail:
        "A wallet funded by the creator's linked address sold $PEPEMON 6 minutes after the post went live.",
    },
    {
      severity: "warning" as const,
      title: "Most calls wrong",
      detail: "3 of 17 scored calls moved the creator's way (18%).",
    },
  ],
  tokens: [
    {
      symbol: "PEPEMON",
      name: "Pepe Monad",
      address: "0x3e89e9e63fbe6e44fd030f392196ae1b136e0665",
      postedAt: "2026-10-09T14:12:00Z",
      claim: "Next 100x on Monad. Dev is based, LP locked 🔒",
      nansen: "blocked",
      reasons: [
        "Honeypot: sells revert for non-whitelisted wallets",
        "LP not locked; deployer holds 61% of supply",
      ],
      sincePostPct: -94.2,
    },
    {
      symbol: "MONADAI",
      name: "Monad AI Agent",
      address: "0xe3a83767b0e04abedce14f02db68e5eb868adae6",
      postedAt: "2026-10-04T09:40:00Z",
      claim: "Official AI token of the Monad ecosystem.",
      nansen: "blocked",
      reasons: [
        "Impersonates an ecosystem project name",
        "Deployer funded by a wallet linked to 7 prior rugs",
      ],
      sincePostPct: -88.7,
    },
    {
      symbol: "USDCm",
      name: "USD Coin (Monad)",
      address: "0xca66a77f3aeb766460ceb5b5c025f624c580f83a",
      postedAt: "2026-09-28T18:05:00Z",
      claim: "Bridge your USDC here for 2x points.",
      nansen: "blocked",
      reasons: [
        "Fake stablecoin: not the canonical USDC contract",
        "Mint function open to the deployer",
      ],
      sincePostPct: -99.1,
    },
    {
      symbol: "CHOG2",
      name: "Chog 2.0",
      address: "0xd7ea6d3b04aa654812c5b03e14c87dd71df9db11",
      postedAt: "2026-09-21T11:30:00Z",
      claim: "Chog v2 relaunch. Early buyers only.",
      nansen: "warning",
      reasons: ["Top 10 holders own 83% of supply", "Contract not verified"],
      sincePostPct: -61.5,
    },
  ] satisfies DemoToken[],
  deleted: [
    {
      postedAt: "2026-10-09T14:12:00Z",
      deletedAt: "2026-10-10T21:47:00Z",
      text: "$PEPEMON is the play of the cycle. Aping my whole bag, not selling below $10M mcap.",
      asset: "PEPEMON",
      moveBeforeDeletePct: -91.0,
    },
    {
      postedAt: "2026-10-04T09:40:00Z",
      deletedAt: "2026-10-05T08:02:00Z",
      text: "$MONADAI is the official AI agent token. Team confirmed in DMs. Load up.",
      asset: "MONADAI",
      moveBeforeDeletePct: -72.4,
    },
    {
      postedAt: "2026-09-30T16:20:00Z",
      deletedAt: "2026-10-01T10:15:00Z",
      text: "Long $MON 20x here, easiest trade of the month 🚀",
      asset: "MON",
      moveBeforeDeletePct: -41.8,
    },
    {
      postedAt: "2026-09-28T18:05:00Z",
      deletedAt: "2026-09-29T07:30:00Z",
      text: "Swap your USDC to $USDCm for double points. Contract below 👇",
      asset: "USDCm",
      moveBeforeDeletePct: -97.6,
    },
    {
      postedAt: "2026-09-21T11:30:00Z",
      deletedAt: "2026-09-22T19:44:00Z",
      text: "$CHOG2 early. Don't fade me on this one.",
      asset: "CHOG2",
      moveBeforeDeletePct: -48.3,
    },
  ] satisfies DemoDeletedPost[],
};
