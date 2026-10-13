import { z } from "zod";

const integer = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const amount = z.string().regex(/^[0-9]+$/);
const signedAmount = z.string().regex(/^-?[0-9]+$/);
export const perplWalletSchema = z.object({
  addr: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  as: z
    .array(
      z.object({
        id: integer,
        fw: z.boolean(),
        fr: z.boolean(),
        b: amount,
        lfr: integer.optional(),
      }),
    )
    .max(100),
});
const position = z.object({
  acc: integer,
  mkt: integer,
  pid: integer,
  st: integer,
  sd: z.union([z.literal(1), z.literal(2)]),
  c: signedAmount,
  ep: integer,
  s: integer,
  lv: integer,
});
const fill = z.object({
  acc: integer,
  mkt: integer,
  rq: integer,
  st: integer,
  fs: integer,
  fp: integer,
  f: signedAmount,
  at: z
    .object({ txid: z.string().optional(), b: integer.optional() })
    .optional(),
});
export function projectPerplAccount(
  accountId: string,
  wallet: unknown,
  positions: unknown,
  history: unknown,
) {
  if (
    !/^[0-9]+$/.test(accountId) ||
    BigInt(accountId) > BigInt(Number.MAX_SAFE_INTEGER)
  )
    throw new Error("invalid_account");
  const state = perplWalletSchema.parse(wallet);
  const account = state.as.find((a) => a.id === Number(accountId));
  if (!account) throw new Error("account_not_owned");
  const open = z
    .object({ d: z.array(position).max(1000) })
    .parse(positions)
    .d.filter((p) => p.acc === account.id && p.st === 1 && p.s > 0);
  const fills = z
    .object({ d: z.array(fill).max(1000) })
    .parse(history)
    .d.filter((f) => f.acc === account.id && f.fs > 0)
    .slice(0, 20);
  return {
    accountId: account.id,
    wallet: state.addr,
    availableCollateral: account.b,
    forwarding: account.fw,
    frozen: account.fr,
    lastRequestId: account.lfr ?? 0,
    positions: open.map((p) => ({
      marketId: p.mkt,
      positionId: String(p.pid),
      side: p.sd === 1 ? ("long" as const) : ("short" as const),
      size: String(p.s),
      entryPrice: String(p.ep),
      collateral: p.c,
      leverageHundredths: p.lv,
    })),
    fills: fills.map((f) => ({
      marketId: f.mkt,
      requestId: f.rq,
      statusCode: f.st,
      filledSize: String(f.fs),
      fillPrice: String(f.fp),
      fee: f.f,
      block: f.at?.b ?? null,
      transactionHash:
        f.at?.txid && /^(0x)?[0-9a-fA-F]{64}$/.test(f.at.txid)
          ? `0x${f.at.txid.replace(/^0x/, "")}`
          : null,
    })),
  };
}
