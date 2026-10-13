/**
 * Integer-only maths for a perp order ticket. Prices and sizes are scaled integers
 * (Perpl's price_decimals and size_decimals); nothing here uses floating point.
 */
const ten = (decimals: number) => 10n ** BigInt(decimals);

/** Human decimal string to scaled units; null when invalid or too precise. */
export function toUnits(value: string, decimals: number): bigint | null {
  const text = value.trim();
  if (!/^(0|[1-9][0-9]*)(\.[0-9]+)?$/.test(text)) return null;
  const [whole = "0", fraction = ""] = text.split(".");
  if (fraction.length > decimals) return null;
  return (
    BigInt(whole) * ten(decimals) +
    BigInt(fraction.padEnd(decimals, "0") || "0")
  );
}

/** Scaled units to a plain decimal string without trailing zeros. */
export function fromUnits(value: bigint, decimals: number): string {
  const negative = value < 0n;
  const abs = negative ? -value : value;
  const whole = abs / ten(decimals);
  const fraction = (abs % ten(decimals))
    .toString()
    .padStart(decimals, "0")
    .replace(/0+$/, "");
  return `${negative ? "-" : ""}${whole}${fraction ? `.${fraction}` : ""}`;
}

/** Display a scaled USD amount with grouping: 2 decimals, or 4 below $1. */
export function formatUsd(value: bigint, decimals: number): string {
  const places = value < ten(decimals) && value > -ten(decimals) ? 4 : 2;
  const keep = Math.min(places, decimals);
  const step = ten(decimals - keep);
  const rounded = (value + (value >= 0n ? step / 2n : -step / 2n)) / step;
  const text = fromUnits(rounded, keep);
  const [whole = "0", fraction = ""] = text.replace("-", "").split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${text.startsWith("-") ? "-" : ""}$${grouped}${keep ? `.${fraction.padEnd(keep, "0")}` : ""}`;
}

export type TicketInput = {
  sizeUnits: bigint;
  sizeDecimals: number;
  /** Mark price, scaled by priceDecimals. */
  price: bigint;
  priceDecimals: number;
  leverage: number;
  /** Taker fee in parts per million of notional. */
  takerFeePpm: number;
};

/** Order value, initial margin and taker fee, all scaled by priceDecimals. */
export function ticketQuote(input: TicketInput) {
  const notional = (input.sizeUnits * input.price) / ten(input.sizeDecimals);
  const leverage = BigInt(Math.max(1, Math.trunc(input.leverage)));
  return {
    notional,
    margin: notional / leverage,
    fee:
      (notional * BigInt(Math.max(0, Math.trunc(input.takerFeePpm)))) /
      1_000_000n,
    // Same fee with 4 extra decimals (scale priceDecimals + 4) so small fees still show.
    feeFine:
      (notional *
        BigInt(Math.max(0, Math.trunc(input.takerFeePpm))) *
        10_000n) /
      1_000_000n,
  };
}

/** Size units bought by a USD amount at `price`, rounded down to the size step. */
export function sizeFromUsd(
  usdUnits: bigint,
  price: bigint,
  sizeDecimals: number,
) {
  return price > 0n ? (usdUnits * ten(sizeDecimals)) / price : 0n;
}

/** Change from `previous` to `current` in basis points; null without a previous price. */
export function changeBps(current: bigint, previous: bigint | null) {
  if (!previous || previous <= 0n) return null;
  return Number(((current - previous) * 10_000n) / previous);
}

/**
 * Estimated liquidation price for a new isolated position, from Perpl's formula
 * P_liq = P_entry + s·(MMR − deposit)/L with deposit = notional/leverage and
 * MMR = notional/MMF. Ignores fees and funding, so it is an estimate.
 * `leverage` and `maintenanceHundredths` use Perpl's hundredths (2000 = 20x = 5%).
 */
export function liquidationPrice(input: {
  entry: bigint;
  side: "long" | "short";
  leverageHundredths: number;
  maintenanceHundredths: number;
}) {
  const lev = BigInt(Math.trunc(input.leverageHundredths));
  const mmf = BigInt(Math.trunc(input.maintenanceHundredths));
  if (lev <= 0n || mmf <= 0n || input.entry <= 0n) return null;
  // distance as a fraction of entry: 100/lev − 100/mmf (hundredths cancel out).
  const numerator = 100n * mmf - 100n * lev;
  if (numerator <= 0n) return null; // leverage at or past the maintenance level
  const move = (input.entry * numerator) / (lev * mmf);
  const price = input.side === "long" ? input.entry - move : input.entry + move;
  return price > 0n ? price : null;
}

/**
 * Indicative Kuru spot fill at the best book price. Kuru prices are quote per base
 * scaled by `pricePrecision`. Buys spend quote and receive base; sells the reverse.
 * Taker fee is in Kuru's parts-per-ten-million (7000 = 7 bps).
 */
export function spotEstimate(input: {
  side: "buy" | "sell";
  amount: bigint;
  price: bigint;
  pricePrecision: bigint;
  baseDecimals: number;
  quoteDecimals: number;
  takerFeePps: bigint;
}) {
  if (input.amount <= 0n || input.price <= 0n || input.pricePrecision <= 0n)
    return null;
  const gross =
    input.side === "buy"
      ? (input.amount * ten(input.baseDecimals) * input.pricePrecision) /
        (input.price * ten(input.quoteDecimals))
      : (input.amount * input.price * ten(input.quoteDecimals)) /
        (input.pricePrecision * ten(input.baseDecimals));
  const fee = (gross * input.takerFeePps) / 10_000_000n;
  return { output: gross - fee, fee };
}
