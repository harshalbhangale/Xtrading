import {
  chainIdSchema,
  type IntegrationStatus,
  type MonadChainId,
} from "@call-my-bluff/domain";
import { monad, monadTestnet } from "viem/chains";

export function getMonadChain(input: unknown) {
  const chainId = chainIdSchema.parse(Number(input ?? 10143));
  return chainId === 143 ? monad : monadTestnet;
}

// Deployment references only; these are not evidence of current liquidity or a quote.
// Source: https://docs.kuru.io/contracts/Contract-addresses
export const kuruMarkets: Record<
  MonadChainId,
  { name: string; address: `0x${string}` }[]
> = {
  10143: [
    {
      name: "MON / USDC",
      address: "0xa241896A7Dbe8a550D2E5fF7A914bB1989ceD2D9",
    },
  ],
  143: [
    {
      name: "MON / USDC",
      address: "0x065C9d28E428A0db40191a54d33d5b7c71a9C394",
    },
    {
      name: "MON / AUSD",
      address: "0x131a2e70a5b31a517a74b8c567149bc294470da9",
    },
  ],
};

export function integrationStatus(
  env: Record<string, string | undefined>,
): IntegrationStatus[] {
  return [
    {
      name: "Kuru",
      configured: Boolean(env.MONAD_RPC_URL && env.KURU_MARKET_ADDRESS),
      implementation: "foundation",
      detail:
        "Supported-market configuration. Quote and execution adapter is next.",
    },
    {
      name: "Privy",
      configured: Boolean(env.NEXT_PUBLIC_PRIVY_APP_ID),
      implementation: "foundation",
      detail:
        "Server-verified X/wallet binding implemented. Stake transaction review is available; live deposit and trading verification remain pending.",
    },
    {
      name: "Envio",
      configured: Boolean(env.ENVIO_GRAPHQL_URL),
      implementation: "foundation",
      detail:
        "Stake event schema and handlers. Deployment and fill indexing are next.",
    },
    {
      name: "Nansen",
      configured: Boolean(env.NANSEN_API_KEY),
      implementation: "foundation",
      detail:
        "Server-only API client boundary. Authorized endpoint coverage must be verified.",
    },
    {
      name: "Perpl",
      configured: false,
      implementation: "foundation",
      detail:
        "Explicit perp routing policy. Market, risk checks, unsigned order preparation and confirmed execution are pending.",
    },
    {
      name: "Chainlink CRE",
      configured: false,
      implementation: "foundation",
      detail:
        "Hourly call settlement planned. Workflow, network support and authenticated receiver are not yet implemented.",
    },
  ];
}
