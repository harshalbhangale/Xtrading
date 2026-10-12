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
        "MON/USDC testnet market reads, eth_call quote simulation and wallet-reviewed approval/order steps. Testnet liquidity is thin; no confirmed fill yet.",
    },
    {
      name: "Privy",
      configured: Boolean(env.NEXT_PUBLIC_PRIVY_APP_ID),
      implementation: "foundation",
      detail:
        "X login, embedded wallet and server-verified X/wallet binding. Stake approve/deposit/withdraw signed and confirmed on testnet.",
    },
    {
      name: "Envio",
      configured: Boolean(env.ENVIO_GRAPHQL_URL),
      implementation: "foundation",
      detail:
        "Stake events indexed (local runtime) with reorg rollback; history and freshness shown on stake and creator pages. Fill indexing not started.",
    },
    {
      name: "Nansen",
      configured: Boolean(env.NANSEN_API_KEY),
      implementation: "foundation",
      detail:
        "Prices MON calls (WMON 1m OHLCV). Wallet DEX-trade consistency checks for bound creators on Monad mainnet; unavailable without a key.",
    },
    {
      name: "Perpl",
      configured: Boolean(
        env.PERPL_API_KEY && env.PERPL_API_KEY_SECRET && env.PERPL_ACCOUNT_ID,
      ),
      implementation: "foundation",
      detail:
        "Perp calls route to open Perpl testnet markets. Reviewed IOC orders with leverage/size caps are submitted with a signed API key; without credentials orders are validated in demo mode only.",
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
