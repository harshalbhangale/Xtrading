// Prints the Perpl exchange accounts for the API key in apps/web/.env.local.
// Usage: node scripts/perpl-accounts.mjs   (reads only; never places orders)
import { createHash, createPrivateKey, randomBytes, sign } from "node:crypto";
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(new URL("../apps/web/.env.local", import.meta.url), "utf8")
    .split("\n")
    .filter((line) => /^[A-Z_]+=/.test(line))
    .map((line) => [
      line.slice(0, line.indexOf("=")),
      line.slice(line.indexOf("=") + 1).trim(),
    ]),
);
const apiUrl = env.PERPL_API_URL || "https://testnet.perpl.xyz/api";
const apiKey = env.PERPL_API_KEY;
const secret = Buffer.from(
  (env.PERPL_API_KEY_SECRET ?? "").replace(/^0x/, ""),
  "hex",
);
if (!apiKey || secret.length !== 32) {
  console.error(
    "Set PERPL_API_KEY and a 64-hex-character PERPL_API_KEY_SECRET in apps/web/.env.local first.",
  );
  process.exit(1);
}
const target = "/v1/trading/wallet";
const timestamp = String(Date.now());
const nonce = randomBytes(16).toString("base64url");
const canonical = [
  10143,
  "GET",
  target,
  timestamp,
  nonce,
  createHash("sha256").update("").digest("hex"),
].join("\n");
const key = createPrivateKey({
  key: Buffer.concat([
    Buffer.from("302e020100300506032b657004220420", "hex"),
    secret,
  ]),
  format: "der",
  type: "pkcs8",
});
const response = await fetch(`${apiUrl}${target}`, {
  headers: {
    "X-API-Key": apiKey,
    "X-API-Timestamp": timestamp,
    "X-API-Nonce": nonce,
    "X-API-Signature": sign(null, Buffer.from(canonical), key).toString(
      "base64url",
    ),
  },
});
const body = await response.json().catch(() => null);
if (!response.ok) {
  console.error(`Perpl returned HTTP ${response.status}:`, body);
  process.exit(1);
}
console.log(`Wallet ${body.addr}`);
if (!body.as?.length)
  console.log(
    "No exchange accounts yet. Create one and deposit collateral on testnet.perpl.xyz.",
  );
for (const account of body.as ?? [])
  console.log(
    `PERPL_ACCOUNT_ID=${account.id}   forwarding=${account.fw ? "on" : "OFF (enable it)"}   frozen=${account.fr}   balance=${account.b}`,
  );
