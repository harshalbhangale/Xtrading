import {
  type Address,
  encodeFunctionData,
  erc20Abi,
  parseAbi,
  zeroAddress,
} from "viem";

/**
 * Kuru Spot V2 on Monad testnet. Addresses from the 29 Sep 2026 deployment
 * handoff (kuru-testnet-docs, "Testnet Deployments"); ABIs from
 * @toxicflow-labs/ts-sdk@0.2.0 (contracts cdac5ae1). Trading runs against the
 * owner's AccountCore balance: approve → deposit → swap, each wallet-reviewed.
 */
export const accountCoreAbi = parseAbi([
  "function deposit(address rootOwner, address token, uint256 amount) payable",
  "function rootAccountIdOf(address owner) view returns (uint40)",
  "function getBalance(uint40 accountId, address token) view returns (uint256)",
  "function withdraw(uint40 rootAccountId, address token, uint256 amount, address recipient)",
]);
export const orderBookAbi = parseAbi([
  "function getMarketParams() view returns (uint32 pricePrecision, uint96 sizePrecision, uint32 tickSize, uint96 minQuote, uint96 maxQuote, uint256 takerFeePps, uint256 makerFeePps)",
  "function bestBidAsk() view returns (uint32 bid, uint32 ask)",
  "function getL2Book(uint256 levels) view returns (uint32[] bidPrices, uint96[] bidSizes, uint32[] askPrices, uint96[] askSizes)",
  "struct BuilderConfig { address builder; uint32 feePps; }",
  "struct SwapResult { uint128 amountInUsed; uint128 amountOut; }",
  "function swap(uint40 userId, bool isBuy, uint128 amountIn, uint128 minAmountOut, uint64 deadline, BuilderConfig builderConfig) returns (SwapResult result)",
  "event SpotSwap(uint40 indexed userId, address indexed executor, bool indexed isBuy, uint128 amountInUsed, uint128 amountOut, uint128 minAmountOut)",
]);

type Token = { symbol: string; address: Address; decimals: number };
export const kuruUsdc: Token = {
  symbol: "USDC",
  address: "0xA402B424f392EAA05DBc8779e4502A1F6A96fEF1",
  decimals: 6,
};
export const kuruV2 = {
  chainId: 10143,
  accountCore: "0xdbaaDe7B42c95399bb1E9614D51B5B9e2cf78038" as Address,
  quote: kuruUsdc,
  markets: {
    WETH: {
      market: "0x9d187971B64505Ac81f12c5FD2ac9c5247Ec62F3" as Address,
      base: {
        symbol: "WETH",
        address: "0x63c84e18184021c6CcE5ea57d0c3Ec0E65f3b303" as Address,
        decimals: 18,
      },
      pricePrecision: 100n,
      sizePrecision: 10_000_000_000n,
    },
    WBTC: {
      market: "0x8661cB7c5f4f8ae3ee116B63Aa5a23c69110e357" as Address,
      base: {
        symbol: "WBTC",
        address: "0x7cDC77B348a2E101C766aD290367f3c5F287af18" as Address,
        decimals: 8,
      },
      pricePrecision: 100n,
      sizePrecision: 100_000_000n,
    },
    // Only market with a two-sided book on 12 Oct 2026. Base is native MON.
    MON: {
      market: "0x26cd68436B6A4AEB3ec52abC20A4d121f8B4BAc9" as Address,
      base: {
        symbol: "MON",
        address: zeroAddress,
        decimals: 18,
      },
      pricePrecision: 1_000_000n,
      sizePrecision: 1_000_000n,
    },
  },
} as const;
export type KuruMarketKey = keyof typeof kuruV2.markets;
export const kuruMarketKeys = Object.keys(kuruV2.markets) as [
  KuruMarketKey,
  ...KuruMarketKey[],
];
export const EMPTY_BID = 4294967295;
export const FEE_DENOMINATOR = 10_000_000n;

export function tradeTokens(key: KuruMarketKey, side: "buy" | "sell") {
  const market = kuruV2.markets[key];
  return side === "buy"
    ? { input: kuruUsdc, output: market.base }
    : { input: market.base, output: kuruUsdc };
}

export function minimumQuotedOutput(expected: bigint, slippageBps: number) {
  if (
    !Number.isInteger(slippageBps) ||
    slippageBps < 1 ||
    slippageBps > 500 ||
    expected <= 0n
  )
    throw new Error("Invalid quote or slippage");
  const minimum = (expected * BigInt(10000 - slippageBps)) / 10000n;
  if (minimum === 0n) throw new Error("Quote output too small");
  return minimum;
}

/**
 * Indicative exact-input output from resting book levels, after the taker fee.
 * Display only: the enforced minimum always comes from simulating the swap.
 */
export function bookEstimate(input: {
  key: KuruMarketKey;
  side: "buy" | "sell";
  amountIn: bigint;
  book: readonly [
    readonly number[],
    readonly bigint[],
    readonly number[],
    readonly bigint[],
  ];
  takerFeePps: bigint;
}) {
  const market = kuruV2.markets[input.key];
  const baseScale = 10n ** BigInt(market.base.decimals);
  const quoteScale = 10n ** BigInt(kuruUsdc.decimals);
  const denominator = market.sizePrecision * market.pricePrecision;
  const keep = FEE_DENOMINATOR - input.takerFeePps;
  let remaining = input.amountIn;
  let out = 0n;
  if (input.side === "buy") {
    // Fee is charged in quote; only the remainder buys base.
    remaining = (remaining * keep) / FEE_DENOMINATOR;
    const [, , prices, sizes] = input.book;
    for (let i = 0; i < prices.length && remaining > 0n; i++) {
      const price = BigInt(prices[i] ?? 0);
      const size = sizes[i] ?? 0n;
      if (price === 0n || size === 0n) continue;
      const levelCost = (price * size * quoteScale) / denominator;
      if (remaining >= levelCost) {
        out += (size * baseScale) / market.sizePrecision;
        remaining -= levelCost;
      } else {
        out +=
          (remaining * denominator * baseScale) /
          (price * quoteScale * market.sizePrecision);
        remaining = 0n;
      }
    }
  } else {
    const [prices, sizes] = input.book;
    for (let i = 0; i < prices.length && remaining > 0n; i++) {
      const price = BigInt(prices[i] ?? 0);
      const size = sizes[i] ?? 0n;
      if (price === 0n || price === BigInt(EMPTY_BID) || size === 0n) continue;
      const levelBase = (size * baseScale) / market.sizePrecision;
      const used = remaining < levelBase ? remaining : levelBase;
      out +=
        (price * used * market.sizePrecision * quoteScale) /
        (denominator * baseScale);
      remaining -= used;
    }
    out = (out * keep) / FEE_DENOMINATOR;
  }
  return { output: out, filled: remaining === 0n };
}

type Step = {
  action: "approve" | "deposit" | "swap" | "withdraw";
  to: Address;
  data: `0x${string}`;
  value: bigint;
};

/**
 * Chooses the single next transaction. Funds are deposited only up to the
 * shortfall, approvals are exact, and swaps carry an onchain deadline.
 */
export function nextTradeStep(input: {
  key: KuruMarketKey;
  side: "buy" | "sell";
  amount: bigint;
  wallet: Address;
  rootAccountId: bigint;
  accountBalance: bigint;
  walletBalance: bigint;
  allowance: bigint;
  minimumOutput: bigint;
  deadline: bigint;
}): Step {
  if (input.amount <= 0n || input.amount >= 2n ** 128n)
    throw new Error("Amount out of bounds");
  const { input: token } = tradeTokens(input.key, input.side);
  const shortfall =
    input.accountBalance >= input.amount
      ? 0n
      : input.amount - input.accountBalance;
  if (shortfall > 0n) {
    if (input.walletBalance < shortfall) throw new Error("Insufficient funds");
    // Native MON: AccountCore.deposit is payable and the value is the amount.
    if (token.address === zeroAddress)
      return {
        action: "deposit",
        to: kuruV2.accountCore,
        data: encodeFunctionData({
          abi: accountCoreAbi,
          functionName: "deposit",
          args: [input.wallet, zeroAddress, shortfall],
        }),
        value: shortfall,
      };
    if (input.allowance < shortfall)
      return {
        action: "approve",
        to: token.address,
        data: encodeFunctionData({
          abi: erc20Abi,
          functionName: "approve",
          args: [kuruV2.accountCore, shortfall],
        }),
        value: 0n,
      };
    return {
      action: "deposit",
      to: kuruV2.accountCore,
      data: encodeFunctionData({
        abi: accountCoreAbi,
        functionName: "deposit",
        args: [input.wallet, token.address, shortfall],
      }),
      value: 0n,
    };
  }
  if (input.rootAccountId <= 0n || input.rootAccountId >= 2n ** 40n)
    throw new Error("Kuru account required");
  if (input.minimumOutput <= 0n || input.minimumOutput >= 2n ** 128n)
    throw new Error("Positive bounded minimum output required");
  return {
    action: "swap",
    to: kuruV2.markets[input.key].market,
    data: encodeFunctionData({
      abi: orderBookAbi,
      functionName: "swap",
      args: [
        Number(input.rootAccountId),
        input.side === "buy",
        input.amount,
        input.minimumOutput,
        input.deadline,
        { builder: zeroAddress, feePps: 0 },
      ],
    }),
    value: 0n,
  };
}

export function withdrawStep(input: {
  rootAccountId: bigint;
  token: Address;
  amount: bigint;
  wallet: Address;
}): Step {
  if (input.rootAccountId <= 0n || input.amount <= 0n)
    throw new Error("Nothing to withdraw");
  return {
    action: "withdraw",
    to: kuruV2.accountCore,
    data: encodeFunctionData({
      abi: accountCoreAbi,
      functionName: "withdraw",
      args: [
        Number(input.rootAccountId),
        input.token,
        input.amount,
        input.wallet,
      ],
    }),
    value: 0n,
  };
}

/**
 * Kuru spot on Monad mainnet (chain 143): the V1 order books listed by
 * api.kuru.io, verified onchain with getMarketParams on 12 Oct 2026. ABI from
 * @kuru-labs/kuru-sdk@0.0.95. Market orders pull the input straight from the
 * wallet (no custody account): exact approve to the order book, then one IOC
 * market order. There is no onchain deadline; the minimum output protects it.
 * Limit-order minimum sizes do not apply to these market orders (fork-tested).
 */
export const kuruV1OrderBookAbi = parseAbi([
  "function getMarketParams() view returns (uint32 pricePrecision, uint96 sizePrecision, address baseAsset, uint256 baseDecimals, address quoteAsset, uint256 quoteDecimals, uint32 tickSize, uint96 minSize, uint96 maxSize, uint256 takerFeeBps, uint256 makerFeeBps)",
  "function bestBidAsk() view returns (uint256 bid, uint256 ask)",
  "function placeAndExecuteMarketBuy(uint96 quoteSize, uint256 minAmountOut, bool isMargin, bool isFillOrKill) payable returns (uint256)",
  "function placeAndExecuteMarketSell(uint96 size, uint256 minAmountOut, bool isMargin, bool isFillOrKill) payable returns (uint256)",
]);
export const kuruMainnetUsdc: Token = {
  symbol: "USDC",
  address: "0x754704Bc059F8C67012fEd69BC8A327a5aafb603",
  decimals: 6,
};
export const kuruMainnet = {
  chainId: 143,
  quote: kuruMainnetUsdc,
  markets: {
    MON: {
      market: "0x065C9d28E428A0db40191a54d33d5b7c71a9C394" as Address,
      base: { symbol: "MON", address: zeroAddress, decimals: 18 },
      pricePrecision: 100_000_000n,
      sizePrecision: 10_000_000_000n,
    },
    WETH: {
      market: "0xa6aFd386135B7d41a6c40C525ABc4a1019b0D132" as Address,
      base: {
        symbol: "WETH",
        address: "0xEE8c0E9f1BFFb4Eb878d8f15f368A02a35481242" as Address,
        decimals: 18,
      },
      pricePrecision: 10_000n,
      sizePrecision: 10_000_000_000n,
    },
    // Coinbase-wrapped BTC; shares the "WBTC" key with the testnet market.
    WBTC: {
      market: "0x40C49f171202f91ff5D2Fae34c22Dd2bfdd22aF0" as Address,
      base: {
        symbol: "cbBTC",
        address: "0xd18B7EC58Cdf4876f6AFebd3Ed1730e4Ce10414b" as Address,
        decimals: 8,
      },
      pricePrecision: 10_000n,
      sizePrecision: 100_000_000n,
    },
  },
} as const;
export const MAINNET_PRICE_SCALE = 10n ** 18n;

/** Explicit per-chain spot configuration; never falls back between chains. */
export function kuruNetwork(chainId: 10143 | 143) {
  return chainId === 143 ? kuruMainnet : kuruV2;
}
export function networkTradeTokens(
  chainId: 10143 | 143,
  key: KuruMarketKey,
  side: "buy" | "sell",
) {
  const network = kuruNetwork(chainId);
  const base = network.markets[key].base as Token;
  return side === "buy"
    ? { input: network.quote, output: base }
    : { input: base, output: network.quote };
}

/**
 * Converts an input-token amount to the order book's integer size. Buys are
 * quoted in price precision, sells in size precision; the amount actually
 * spent is rounded down to what the book can represent.
 */
export function mainnetOrderSize(input: {
  key: KuruMarketKey;
  side: "buy" | "sell";
  amount: bigint;
}) {
  const market = kuruMainnet.markets[input.key];
  const [precision, decimals] =
    input.side === "buy"
      ? [market.pricePrecision, kuruMainnetUsdc.decimals]
      : [market.sizePrecision, market.base.decimals];
  const scale = 10n ** BigInt(decimals);
  const size = (input.amount * precision) / scale;
  if (size <= 0n || size >= 2n ** 96n) throw new Error("Amount out of bounds");
  return { size, spend: (size * scale) / precision };
}

/** Display-only estimate from the top of book (18-decimal quote-per-base prices). */
export function mainnetTopOfBookEstimate(input: {
  key: KuruMarketKey;
  side: "buy" | "sell";
  spend: bigint;
  bid: bigint;
  ask: bigint;
  takerFeeBps: bigint;
}) {
  const market = kuruMainnet.markets[input.key];
  const baseScale = 10n ** BigInt(market.base.decimals);
  const quoteScale = 10n ** BigInt(kuruMainnetUsdc.decimals);
  const keep = 10_000n - input.takerFeeBps;
  if (input.side === "buy")
    return input.ask === 0n
      ? 0n
      : (input.spend * MAINNET_PRICE_SCALE * baseScale * keep) /
          (input.ask * quoteScale * 10_000n);
  return (
    (input.spend * input.bid * quoteScale * keep) /
    (MAINNET_PRICE_SCALE * baseScale * 10_000n)
  );
}

/** Next mainnet transaction: an exact approval to the order book, or the market order. */
export function mainnetTradeStep(input: {
  key: KuruMarketKey;
  side: "buy" | "sell";
  amount: bigint;
  walletBalance: bigint;
  allowance: bigint;
  minimumOutput: bigint;
}): Step {
  const market = kuruMainnet.markets[input.key];
  const { input: token } = networkTradeTokens(143, input.key, input.side);
  const { size, spend } = mainnetOrderSize(input);
  if (input.walletBalance < spend) throw new Error("Insufficient funds");
  const native = token.address === zeroAddress;
  if (!native && input.allowance < spend)
    return {
      action: "approve",
      to: token.address,
      data: encodeFunctionData({
        abi: erc20Abi,
        functionName: "approve",
        args: [market.market, spend],
      }),
      value: 0n,
    };
  if (input.minimumOutput <= 0n) throw new Error("Positive minimum required");
  return {
    action: "swap",
    to: market.market,
    data: encodeFunctionData({
      abi: kuruV1OrderBookAbi,
      functionName:
        input.side === "buy"
          ? "placeAndExecuteMarketBuy"
          : "placeAndExecuteMarketSell",
      // Wallet funds (not margin), immediate-or-cancel (not fill-or-kill).
      args: [size, input.minimumOutput, false, false],
    }),
    value: native ? spend : 0n,
  };
}
