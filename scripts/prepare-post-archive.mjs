// Read-only: prepare ten public-X snapshots and estimate deployment + one batch.
// No signing and no mainnet transactions. Run with the web server env loaded.

import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { homedir } from "node:os";

const require = createRequire(
  new URL("../apps/web/package.json", import.meta.url),
);
const {
  createPublicClient,
  http,
  encodeDeployData,
  encodeFunctionData,
  keccak256,
  toHex,
  formatUnits,
} = require("viem");
const { privateKeyToAccount } = require("viem/accounts");
const { createRequire: cr } = await import("node:module");
const postgres = cr(
  new URL("../packages/database/package.json", import.meta.url),
)("postgres");
const url = new URL(process.env.DATABASE_URL);
url.searchParams.delete("sslmode");
const ca =
  process.env.DATABASE_CA_PEM?.replaceAll("\\n", "\n") ||
  (process.env.DATABASE_CA_FILE
    ? readFileSync(process.env.DATABASE_CA_FILE, "utf8")
    : undefined);
const sql = postgres(url.toString(), {
  ssl: { rejectUnauthorized: true, ...(ca ? { ca } : {}) },
  max: 1,
  connect_timeout: 5,
});
const posts = [];
try {
  const candidates =
    await sql`select post_id,handle from post_signals order by classified_at desc limit 40`;
  for (const row of candidates) {
    if (posts.length === 10) break;
    try {
      const r = await fetch(
        `https://publish.x.com/oembed?url=${encodeURIComponent(`https://x.com/i/status/${row.post_id}`)}&omit_script=true&dnt=true`,
        { signal: AbortSignal.timeout(5000) },
      );
      if (!r.ok) continue;
      const body = await r.json();
      const author =
        /^https:\/\/(?:x|twitter)\.com\/([A-Za-z0-9_]{1,15})$/.exec(
          body.author_url,
        )?.[1];
      const html = /<p[^>]*>([\s\S]*?)<\/p>/.exec(body.html)?.[1];
      if (!author || html === undefined) continue;
      const text = html
        .replace(/<br\s*\/?\s*>/gi, "\n")
        .replace(/<[^>]*>/g, "")
        .replace(/&#(x[0-9a-fA-F]+|[0-9]+);/g, (_, s) =>
          String.fromCodePoint(
            s.startsWith("x") ? parseInt(s.slice(1), 16) : parseInt(s, 10),
          ),
        )
        .replaceAll("&amp;", "&")
        .replaceAll("&lt;", "<")
        .replaceAll("&gt;", ">")
        .replaceAll("&quot;", '"')
        .replaceAll("&#39;", "'");
      if (text.length > 8000) continue;
      posts.push({
        postId: row.post_id,
        handle: author.toLowerCase(),
        url: `https://x.com/${author.toLowerCase()}/status/${row.post_id}`,
        text,
        textHash: keccak256(toHex(text)),
        source: "x-public-oembed",
        observedAt: new Date().toISOString(),
      });
    } catch {}
  }
} finally {
  await sql.end();
}
if (!posts.length)
  throw new Error("No public posts captured; no manifest is prepared");
const manifest = {
  version: "xtrading-public-post-archive-v1",
  coverage:
    "Public embed text only; image files are not archived. Publisher observation, not creator signature.",
  posts,
};
const encoded = toHex(JSON.stringify(manifest));
if ((encoded.length - 2) / 2 > 32768) throw new Error("Batch too large");
writeFileSync(
  "/tmp/xtrading-post-archive-manifest.json",
  `${JSON.stringify(manifest, null, 2)}\n`,
);
const artifact = JSON.parse(
  readFileSync(
    new URL(
      "../contracts/out/PostArchive.sol/PostArchive.json",
      import.meta.url,
    ),
    "utf8",
  ),
);
const key = readFileSync(`${homedir()}/.xtrading/mainnet-demo.env`, "utf8")
  .match(/^MAINNET_DEMO_KEY=(.*)$/m)?.[1]
  ?.trim()
  .replaceAll('"', "");
if (!key) throw new Error("Demo wallet unavailable");
const account = privateKeyToAccount(key.startsWith("0x") ? key : `0x${key}`);
const client = createPublicClient({ transport: http("https://rpc.monad.xyz") });
if ((await client.getChainId()) !== 143) throw new Error("Wrong chain");
const price = await client.getGasPrice();
const deployGas = await client.estimateGas({
  account: account.address,
  data: encodeDeployData({
    abi: artifact.abi,
    bytecode: artifact.bytecode.object,
  }),
});
// Estimate the archive call using runtime-code override: read-only eth_estimateGas.
const target = "0x0000000000000000000000000000000000000a11";
const data = encodeFunctionData({
  abi: artifact.abi,
  functionName: "archive",
  args: [posts.length, encoded],
});
// Immutable publisher is injected into the deployed runtime at compiler-reported offsets.
let runtime = artifact.deployedBytecode.object.slice(2);
for (const locations of Object.values(
  artifact.deployedBytecode.immutableReferences || {},
))
  for (const { start, length } of locations) {
    const value = account.address.slice(2).padStart(length * 2, "0");
    runtime =
      runtime.slice(0, start * 2) + value + runtime.slice((start + length) * 2);
  }
const batchGas = BigInt(
  await client.request({
    method: "eth_estimateGas",
    params: [
      { from: account.address, to: target, data },
      "latest",
      { [target]: { code: `0x${runtime}` } },
    ],
  }),
);
const paddedDeploy = (deployGas * 11n) / 10n,
  paddedBatch = (batchGas * 11n) / 10n;
const maximumPrice = price * 2n;
const estimate = {
  chainId: 143,
  publisher: account.address,
  postCount: posts.length,
  manifestBytes: (encoded.length - 2) / 2,
  batchHash: keccak256(encoded),
  deployGas: deployGas.toString(),
  batchGas: batchGas.toString(),
  currentGasPrice: price.toString(),
  estimatedMON: formatUnits((deployGas + batchGas) * price, 18),
  maximumBudgetMON: formatUnits(
    (paddedDeploy + paddedBatch) * maximumPrice,
    18,
  ),
  signed: false,
};
writeFileSync(
  "/tmp/xtrading-post-archive-estimate.json",
  `${JSON.stringify(estimate, null, 2)}\n`,
);
console.log(JSON.stringify(estimate, null, 2));
