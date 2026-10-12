import { createHash, createPrivateKey, randomBytes, sign } from "node:crypto";

// PKCS#8 DER prefix for a raw 32-byte Ed25519 private key (RFC 8410).
const ed25519Pkcs8Prefix = Buffer.from(
  "302e020100300506032b657004220420",
  "hex",
);

/** Server-only. Canonical string and headers per Perpl's REST signing documentation. */
export function signPerplRequest(input: {
  chainId: number;
  method: "GET" | "POST";
  target: string;
  body: string;
  apiKey: string;
  secretHex: string;
  timestampMs?: number;
  nonce?: string;
}) {
  const secret = Buffer.from(input.secretHex.replace(/^0x/, ""), "hex");
  if (secret.length !== 32) throw new Error("Invalid Perpl API key secret");
  if (!input.target.startsWith("/v1/")) throw new Error("Invalid Perpl target");
  const timestamp = String(input.timestampMs ?? Date.now());
  const nonce = input.nonce ?? randomBytes(16).toString("base64url");
  const bodyHash = createHash("sha256").update(input.body).digest("hex");
  const canonical = [
    input.chainId,
    input.method,
    input.target,
    timestamp,
    nonce,
    bodyHash,
  ].join("\n");
  const key = createPrivateKey({
    key: Buffer.concat([ed25519Pkcs8Prefix, secret]),
    format: "der",
    type: "pkcs8",
  });
  return {
    canonical,
    headers: {
      "X-API-Key": input.apiKey,
      "X-API-Timestamp": timestamp,
      "X-API-Nonce": nonce,
      "X-API-Signature": sign(null, Buffer.from(canonical), key).toString(
        "base64url",
      ),
    },
  };
}

const uint = /^(0|[1-9][0-9]*)$/;
function safeInteger(value: string, label: string) {
  if (!uint.test(value)) throw new Error(`Invalid ${label}`);
  const parsed = BigInt(value);
  if (parsed > BigInt(Number.MAX_SAFE_INTEGER))
    throw new Error(`${label} too large`);
  return Number(parsed);
}

/**
 * One immediate-or-cancel market order that opens a position. Size is in the market's
 * scaled integer units; leverage in hundredths (500 = 5x). Caps are enforced here.
 */
export function buildPerplOpenOrder(input: {
  marketId: number;
  accountId: string;
  side: "long" | "short";
  size: string;
  leverageHundredths: number;
  maxLeverageHundredths: number;
  maxSize: string;
  slippageBps: number;
  requestId: number;
}) {
  const size = safeInteger(input.size, "size");
  if (size <= 0) throw new Error("Size must be positive");
  if (BigInt(input.size) > BigInt(input.maxSize))
    throw new Error("Size exceeds the configured cap");
  if (
    !Number.isInteger(input.leverageHundredths) ||
    input.leverageHundredths < 100 ||
    input.leverageHundredths > input.maxLeverageHundredths
  )
    throw new Error("Leverage outside the configured range");
  if (
    !Number.isInteger(input.slippageBps) ||
    input.slippageBps < 1 ||
    input.slippageBps > 500
  )
    throw new Error("Slippage must be 1–500 basis points");
  if (!Number.isSafeInteger(input.requestId) || input.requestId <= 0)
    throw new Error("Invalid request ID");
  return {
    rq: input.requestId,
    mkt: input.marketId,
    acc: safeInteger(input.accountId, "account"),
    t: input.side === "long" ? 1 : 2,
    p: 0,
    s: size,
    ms: input.slippageBps,
    fl: 4,
    lv: input.leverageHundredths,
    lb: 0,
  };
}
