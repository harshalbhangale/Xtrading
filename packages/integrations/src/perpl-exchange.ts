import {
  type Address,
  decodeEventLog,
  encodeFunctionData,
  erc20Abi,
  getAddress,
  type Hex,
  parseAbi,
} from "viem";

/**
 * Perpl's Exchange per network. Orders are sent by the user's own wallet to its
 * own exchange account (`execOrder` acts on msg.sender's account), so nothing
 * here can trade for anyone else. Addresses from Perpl's network reference.
 */
export const PERPL_TESTNET = {
  network: "testnet",
  chainId: 10143,
  exchange: "0x1964C32f0bE608E7D29302AFF5E61268E72080cc",
  collateral: "0xa9012a055bd4e0eDfF8Ce09f960291C09D5322dC",
  collateralDecimals: 6,
  context: "https://testnet.perpl.xyz/api/v1/pub/context",
  app: "https://testnet.perpl.xyz",
  explorer: "https://testnet.monadvision.com",
} as const;

/** Monad mainnet: real AUSD. Same Exchange contract version as testnet (1.7.5). */
export const PERPL_MAINNET = {
  network: "mainnet",
  chainId: 143,
  exchange: "0x34B6552d57a35a1D042CcAe1951BD1C370112a6F",
  collateral: "0x00000000eFE302BEAA2b3e6e1b18d08D69a9012a",
  collateralDecimals: 6,
  context: "https://app.perpl.xyz/api/v1/pub/context",
  app: "https://app.perpl.xyz",
  explorer: "https://monadvision.com",
} as const;

export type PerplNetwork = typeof PERPL_TESTNET | typeof PERPL_MAINNET;
export type PerplChainId = PerplNetwork["chainId"];

/** The explicit network for a chain ID; never falls back to another chain. */
export function perplNetwork(chainId: number): PerplNetwork {
  if (chainId === PERPL_TESTNET.chainId) return PERPL_TESTNET;
  if (chainId === PERPL_MAINNET.chainId) return PERPL_MAINNET;
  throw new Error("Unsupported Perpl chain");
}

const orderDesc =
  "(uint256 orderDescId,uint256 perpId,uint8 orderType,uint256 orderId,uint256 pricePNS,uint256 lotLNS,uint256 expiryBlock,bool postOnly,bool fillOrKill,bool immediateOrCancel,uint256 maxMatches,uint256 leverageHdths,uint256 lastExecutionBlock,uint256 amountCNS,uint256 maxNegPnlCollatBPS)";

// Subset of Perpl's Exchange ABI (dex-sdk rc_v1.1.7) used by the wallet flow.
export const perplExchangeAbi = parseAbi([
  "function createAccount(uint256 amountCNS) returns (uint256)",
  "function depositCollateral(uint256 amountCNS)",
  `function execOrder(${orderDesc} orderDesc) returns ((uint256 perpId,uint256 orderId))`,
  "function getAccountByAddr(address accountAddress) view returns ((uint256 accountId,uint256 balanceCNS,uint256 lockedBalanceCNS,uint8 frozen,address accountAddr,(uint256 bank1,uint256 bank2,uint256 bank3,uint256 bank4) positions))",
  "function getMinAccountOpenCNS() view returns (uint256)",
  "function getPosition(uint256 perpId, uint256 accountId) view returns ((uint256 accountId,uint256 nextNodeId,uint256 prevNodeId,uint8 positionType,uint256 depositCNS,uint256 pricePNS,uint256 lotLNS,uint256 entryBlock,int256 pnlCNS,int256 deltaPnlCNS,int256 premiumPnlCNS), uint256, bool)",
  "function withdrawCollateral(uint256 amountCNS)",
  "error AccountDoesNotExist(address accountAddress)",
  "event OrderRequest(uint256 perpId,uint256 accountId,uint256 orderDescId,uint256 orderId,uint8 orderType,uint256 pricePNS,uint256 lotLNS,uint256 expiryBlock,bool postOnly,bool fillOrKill,bool immediateOrCancel,uint256 maxMatches,uint256 leverageHdths,uint256 lastExecutionBlock,uint256 amountCNS,uint256 maxNegPnlCollatBPS,uint256 gasLeft)",
  "event OrderRequestV2(uint256 perpId,uint256 accountId,uint256 orderDescId,uint256 orderId,uint8 orderType,uint256 pricePNS,uint256 lotLNS,uint256 expiryBlock,bool postOnly,bool fillOrKill,bool immediateOrCancel,uint256 maxMatches,uint256 leverageHdths,uint256 lastExecutionBlock,uint256 amountCNS,uint256 maxNegPnlCollatBPS,uint256 gasLeft,bytes extension)",
  "event TakerOrderFilled(uint256 entryPricePNS,uint256 collatPricePNS,uint256 pnlPricePNS,uint256 lotLNS,uint256 feeCNS,int256 amountCNS,uint256 balanceCNS)",
  "event TakerOrderFilledV2(uint256 entryPricePNS,uint256 collatPricePNS,uint256 pnlPricePNS,uint256 lotLNS,uint256 feeCNS,int256 amountCNS,uint256 balanceCNS,uint256 builderId,uint256 builderFeeCNS)",
  "event OrderPostFailed(uint256 reason)",
]);

// Perpl order types (dex-sdk RequestType): 0 OpenLong, 1 OpenShort, 2 CloseLong, 3 CloseShort.
const OPEN_LONG = 0;
const OPEN_SHORT = 1;
const CLOSE_LONG = 2;
const CLOSE_SHORT = 3;
export const perplOrderAction = [
  "open-long",
  "open-short",
  "close-long",
  "close-short",
] as const;
const BPS = 10_000n;

export type PerplOrderDesc = {
  orderDescId: bigint;
  perpId: bigint;
  orderType: number;
  orderId: bigint;
  pricePNS: bigint;
  lotLNS: bigint;
  expiryBlock: bigint;
  postOnly: boolean;
  fillOrKill: boolean;
  immediateOrCancel: boolean;
  maxMatches: bigint;
  leverageHdths: bigint;
  lastExecutionBlock: bigint;
  amountCNS: bigint;
  maxNegPnlCollatBPS: bigint;
};

/**
 * One immediate-or-cancel order that opens or adds to a position. The limit
 * price is the mark moved by the slippage cap against the trader, so the order
 * can never fill worse than the reviewed bound. Caps are enforced here.
 */
export function perplWalletOrder(input: {
  requestId: bigint;
  perpId: number;
  side: "long" | "short";
  lots: bigint;
  maxLots: bigint;
  markPNS: bigint;
  slippageBps: number;
  leverage: number;
  maxLeverage: number;
}): PerplOrderDesc {
  if (input.requestId <= 0n) throw new Error("Invalid request ID");
  if (input.lots <= 0n) throw new Error("Size must be positive");
  if (input.lots > input.maxLots)
    throw new Error("Size exceeds the configured cap");
  if (
    !Number.isInteger(input.leverage) ||
    input.leverage < 1 ||
    input.leverage > input.maxLeverage
  )
    throw new Error("Leverage outside the configured range");
  if (
    !Number.isInteger(input.slippageBps) ||
    input.slippageBps < 1 ||
    input.slippageBps > 500
  )
    throw new Error("Slippage must be 1–500 basis points");
  if (input.markPNS <= 0n) throw new Error("No mark price");
  const slip = BigInt(input.slippageBps);
  // Round against the trader's favour so the bound is never looser than shown.
  const pricePNS =
    input.side === "long"
      ? (input.markPNS * (BPS + slip) + BPS - 1n) / BPS
      : (input.markPNS * (BPS - slip)) / BPS;
  return {
    orderDescId: input.requestId,
    perpId: BigInt(input.perpId),
    orderType: input.side === "long" ? OPEN_LONG : OPEN_SHORT,
    orderId: 0n,
    pricePNS,
    lotLNS: input.lots,
    expiryBlock: 0n,
    postOnly: false,
    fillOrKill: false,
    immediateOrCancel: true,
    // Zero lets the contract apply its own gas-safe maximum.
    maxMatches: 0n,
    leverageHdths: BigInt(input.leverage * 100),
    lastExecutionBlock: 0n,
    amountCNS: 0n,
    // dex-sdk default: at most 10% of notional drawn to cover negative PnL.
    maxNegPnlCollatBPS: 1000n,
  };
}

/**
 * A reduce-only IOC order that closes all of one position. CloseLong/CloseShort
 * can only shrink the matching side, so it can never open or invert a position.
 * Closing a long sells, so its bound is below the mark; closing a short buys.
 */
export function perplCloseOrder(input: {
  requestId: bigint;
  perpId: number;
  position: "long" | "short";
  lots: bigint;
  markPNS: bigint;
  slippageBps: number;
}): PerplOrderDesc {
  if (input.requestId <= 0n) throw new Error("Invalid request ID");
  if (input.lots <= 0n) throw new Error("No open position");
  if (input.markPNS <= 0n) throw new Error("No mark price");
  if (
    !Number.isInteger(input.slippageBps) ||
    input.slippageBps < 1 ||
    input.slippageBps > 500
  )
    throw new Error("Slippage must be 1–500 basis points");
  const slip = BigInt(input.slippageBps);
  const pricePNS =
    input.position === "long"
      ? (input.markPNS * (BPS - slip)) / BPS
      : (input.markPNS * (BPS + slip) + BPS - 1n) / BPS;
  return {
    orderDescId: input.requestId,
    perpId: BigInt(input.perpId),
    orderType: input.position === "long" ? CLOSE_LONG : CLOSE_SHORT,
    orderId: 0n,
    pricePNS,
    lotLNS: input.lots,
    expiryBlock: 0n,
    postOnly: false,
    fillOrKill: false,
    immediateOrCancel: true,
    maxMatches: 0n,
    leverageHdths: 0n,
    lastExecutionBlock: 0n,
    amountCNS: 0n,
    maxNegPnlCollatBPS: 1000n,
  };
}

/** Moves free exchange-account AUSD back to the wallet that owns the account. */
export function perplWithdrawStep(
  amountCNS: bigint,
  available: bigint,
  network: PerplNetwork = PERPL_TESTNET,
) {
  if (amountCNS <= 0n) throw new Error("Amount must be positive");
  if (amountCNS > available) throw new Error("amount_above_available");
  return {
    kind: "withdraw" as const,
    label: `Withdraw ${units(amountCNS)} AUSD to your wallet`,
    to: network.exchange as Address,
    data: encodeFunctionData({
      abi: perplExchangeAbi,
      functionName: "withdrawCollateral",
      args: [amountCNS],
    }),
  };
}

/** Encodes one order descriptor as the wallet's execOrder call. */
export function perplOrderStep(
  order: PerplOrderDesc,
  label: string,
  network: PerplNetwork = PERPL_TESTNET,
): PerplStep {
  return {
    kind: "order",
    label,
    to: network.exchange,
    data: encodeFunctionData({
      abi: perplExchangeAbi,
      functionName: "execOrder",
      args: [order],
    }),
  };
}

/**
 * Collateral the order may lock, in collateral units (6 decimals): margin at the
 * bounded price, with a 50% buffer for Perpl's initial-margin rules, plus fees.
 */
export function perplCollateralNeeded(input: {
  pricePNS: bigint;
  lots: bigint;
  priceDecimals: number;
  sizeDecimals: number;
  leverage: number;
  takerFeePer100k: number;
}) {
  const scale = 10n ** BigInt(input.priceDecimals + input.sizeDecimals);
  const notional =
    (input.pricePNS * input.lots * 10n ** 6n + scale - 1n) / scale;
  const margin = (notional * 3n) / (2n * BigInt(input.leverage));
  const fee = (notional * BigInt(input.takerFeePer100k) * 2n) / 100_000n;
  return margin + fee + 1n;
}

export type PerplStep = {
  kind: "approve" | "create-account" | "deposit" | "order" | "withdraw";
  label: string;
  to: Address;
  data: Hex;
};

/**
 * Unsigned transactions for the user's wallet, in order. Approvals are exact,
 * never unlimited. Fails rather than proposing a deposit the wallet cannot pay.
 */
export function perplWalletSteps(input: {
  account: { id: bigint; balanceCNS: bigint } | null;
  walletCollateral: bigint;
  allowance: bigint;
  minAccountOpen: bigint;
  needed: bigint;
  order: PerplOrderDesc;
  network?: PerplNetwork;
}): PerplStep[] {
  const network = input.network ?? PERPL_TESTNET;
  const steps: PerplStep[] = [];
  const fund = input.account
    ? input.needed > input.account.balanceCNS
      ? input.needed - input.account.balanceCNS
      : 0n
    : input.needed > input.minAccountOpen
      ? input.needed
      : input.minAccountOpen;
  if (fund > input.walletCollateral) throw new Error("collateral_insufficient");
  if (fund > 0n) {
    if (input.allowance < fund)
      steps.push({
        kind: "approve",
        label: `Approve ${units(fund)} AUSD for Perpl`,
        to: network.collateral,
        data: encodeFunctionData({
          abi: erc20Abi,
          functionName: "approve",
          args: [network.exchange, fund],
        }),
      });
    steps.push(
      input.account
        ? {
            kind: "deposit",
            label: `Deposit ${units(fund)} AUSD into your Perpl account`,
            to: network.exchange,
            data: encodeFunctionData({
              abi: perplExchangeAbi,
              functionName: "depositCollateral",
              args: [fund],
            }),
          }
        : {
            kind: "create-account",
            label: `Open your Perpl account with ${units(fund)} AUSD`,
            to: network.exchange,
            data: encodeFunctionData({
              abi: perplExchangeAbi,
              functionName: "createAccount",
              args: [fund],
            }),
          },
    );
  }
  steps.push(
    perplOrderStep(input.order, "Place the order from your wallet", network),
  );
  return steps;
}

function units(value: bigint) {
  const text = value.toString().padStart(7, "0");
  return `${text.slice(0, -6)}.${text.slice(-6)}`.replace(/\.?0+$/, "");
}

type Log = { address: string; data: Hex; topics: readonly Hex[] };

/**
 * What one execOrder transaction did, from its receipt logs: the order must be
 * this account's request with this ID. Taker fills after the request are its fills.
 */
export function perplOrderOutcome(input: {
  logs: readonly Log[];
  accountId: bigint;
  orderDescId: bigint;
  network?: PerplNetwork;
}) {
  let matched = false;
  let seen = false;
  let lots = 0n;
  let fee = 0n;
  let weighted = 0n;
  let failedReason: bigint | null = null;
  const exchange = getAddress((input.network ?? PERPL_TESTNET).exchange);
  for (const log of input.logs) {
    if (getAddress(log.address) !== exchange) continue;
    let event: ReturnType<typeof decodeEventLog<typeof perplExchangeAbi>>;
    try {
      event = decodeEventLog({
        abi: perplExchangeAbi,
        data: log.data,
        topics: log.topics as [Hex, ...Hex[]],
      });
    } catch {
      continue;
    }
    if (
      event.eventName === "OrderRequest" ||
      event.eventName === "OrderRequestV2"
    ) {
      matched =
        event.args.accountId === input.accountId &&
        event.args.orderDescId === input.orderDescId;
      seen ||= matched;
      continue;
    }
    if (!matched) continue;
    if (
      event.eventName === "TakerOrderFilled" ||
      event.eventName === "TakerOrderFilledV2"
    ) {
      lots += event.args.lotLNS;
      fee += event.args.feeCNS;
      weighted += event.args.entryPricePNS * event.args.lotLNS;
    } else if (event.eventName === "OrderPostFailed")
      failedReason = event.args.reason;
  }
  return {
    found: seen,
    filledLots: lots,
    averagePricePNS: lots > 0n ? weighted / lots : null,
    feeCNS: fee,
    failedReason,
  };
}
