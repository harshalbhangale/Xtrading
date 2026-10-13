import { amountSchema } from "@call-my-bluff/domain";
import {
  type Address,
  encodeFunctionData,
  erc20Abi,
  getAddress,
  type Hex,
  isAddress,
  zeroAddress,
} from "viem";
import { z } from "zod";
import { kuruNetwork } from "./kuru";

/**
 * Plain wallet transfers: MON and the configured Kuru tokens, per chain.
 * The user's own wallet signs; the server only prepares a reviewed step.
 */
export type WalletChainId = 10143 | 143;
export type WalletToken = {
  symbol: string;
  address: Address;
  decimals: number;
};

/** Tokens a wallet can hold and send on one chain. Native MON is first. */
export function walletTokens(chainId: WalletChainId): WalletToken[] {
  const network = kuruNetwork(chainId);
  return [
    network.markets.MON.base,
    network.quote,
    network.markets.WETH.base,
    network.markets.WBTC.base,
  ];
}

export function walletToken(chainId: WalletChainId, symbol: string) {
  return walletTokens(chainId).find((token) => token.symbol === symbol);
}

const address = z
  .string()
  .refine((value) => isAddress(value, { strict: false }))
  .transform((value) => getAddress(value));
const positive = amountSchema.pipe(
  z
    .string()
    .max(78)
    .refine((value) => BigInt(value) > 0n),
);
const chainIdSchema = z.union([z.literal(10143), z.literal(143)]);

export const prepareTransferSchema = z
  .object({
    chainId: chainIdSchema,
    from: address,
    to: address,
    token: z.string().min(1).max(16),
    // Integer token units; never a float.
    amount: positive,
  })
  .strict();

const hexAddress = z.string().regex(/^0x[0-9a-fA-F]{40}$/);
const token = z.object({
  symbol: z.string(),
  address: hexAddress,
  decimals: z.number().int().nonnegative().max(36),
});
export const walletBalancesSchema = z.object({
  chainId: chainIdSchema,
  wallet: hexAddress,
  balances: z.array(z.object({ token, balance: amountSchema })),
  observedAt: z.iso.datetime(),
  blockNumber: amountSchema,
});
export const transferReviewSchema = z.object({
  status: z.literal("prepared"),
  action: z.literal("transfer"),
  chainId: chainIdSchema,
  wallet: hexAddress,
  recipient: hexAddress,
  token,
  amount: amountSchema,
  to: hexAddress,
  data: z.string().regex(/^0x[0-9a-fA-F]*$/),
  value: amountSchema,
  gas: amountSchema,
  gasPrice: amountSchema,
  nativeBalance: amountSchema,
  expiresAt: z.iso.datetime(),
  observedAt: z.iso.datetime(),
  blockNumber: amountSchema,
});

export class TransferError extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}

/** One transfer step: native value send, or ERC-20 transfer(recipient, amount). */
export function transferStep(input: {
  token: WalletToken;
  from: Address;
  recipient: Address;
  amount: bigint;
}): { to: Address; data: Hex; value: bigint } {
  if (input.amount <= 0n) throw new TransferError("invalid_amount");
  const recipient = getAddress(input.recipient);
  if (recipient === zeroAddress) throw new TransferError("invalid_recipient");
  if (recipient === getAddress(input.from))
    throw new TransferError("recipient_is_sender");
  // Tokens sent to their own contract are usually lost.
  if (input.token.address !== zeroAddress && recipient === input.token.address)
    throw new TransferError("recipient_is_token_contract");
  if (input.token.address === zeroAddress)
    return { to: recipient, data: "0x", value: input.amount };
  return {
    to: input.token.address,
    data: encodeFunctionData({
      abi: erc20Abi,
      functionName: "transfer",
      args: [recipient, input.amount],
    }),
    value: 0n,
  };
}
