// One approved 1-USDC Kuru MON round trip. --rehearse requires an unlocked local fork.
// Secrets stay in memory; signed hashes are persisted before receipt polling.
import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { homedir } from "node:os";

const require = createRequire(
  new URL("../apps/web/package.json", import.meta.url),
);
const {
  createPublicClient,
  createWalletClient,
  http,
  parseAbi,
  encodeFunctionData,
  formatUnits,
} = require("viem");
const { privateKeyToAccount } = require("viem/accounts");
const { monad } = require("viem/chains");
const live = process.argv.includes("--live");
if (!live && !process.argv.includes("--rehearse"))
  throw new Error("Choose --rehearse or --live");
const keyFile = `${homedir()}/.xtrading/mainnet-demo.env`;
if ((statSync(keyFile).mode & 0o777) !== 0o600)
  throw new Error("Key file permissions must be 600");
const key = readFileSync(keyFile, "utf8")
  .match(/^MAINNET_DEMO_KEY=(.*)$/m)?.[1]
  ?.trim()
  .replaceAll('"', "");
if (!key || !/^(0x)?[a-fA-F0-9]{64}$/.test(key))
  throw new Error("Existing demo key unavailable");
const account = privateKeyToAccount(key.startsWith("0x") ? key : `0x${key}`);
const rpc = live ? "https://rpc.monad.xyz" : "http://127.0.0.1:8551";
const client = createPublicClient({
  chain: monad,
  transport: http(rpc, { timeout: 15000, retryCount: 0 }),
});
const signer = createWalletClient({
  chain: monad,
  account: live ? account : account.address,
  transport: http(rpc),
});
const token = "0x754704Bc059F8C67012fEd69BC8A327a5aafb603";
const book = "0x065C9d28E428A0db40191a54d33d5b7c71a9C394";
const abi = parseAbi([
  "function approve(address,uint256) returns (bool)",
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address,address) view returns (uint256)",
  "function placeAndExecuteMarketBuy(uint96,uint256,bool,bool) returns(uint256)",
  "function placeAndExecuteMarketSell(uint96,uint256,bool,bool) payable returns(uint256)",
  "function getMarketParams() view returns(uint32,uint96,address,uint256,address,uint256,uint32,uint96,uint96,uint256,uint256)",
]);
const record = new URL(
  live
    ? "../contracts/deployments/mainnet-roundtrip-2026-10-13.json"
    : "../contracts/deployments/roundtrip-rehearsal.json",
  import.meta.url,
);
if (live && existsSync(record))
  throw new Error(
    "Live run already recorded; inspect receipts before any retry",
  );
const read = (fn, args) =>
  client.readContract({ address: token, abi, functionName: fn, args });
const snapshot = async () => ({
  mon: await client.getBalance({ address: account.address }),
  usdc: await read("balanceOf", [account.address]),
});
if ((await client.getChainId()) !== 143) throw new Error("Wrong chain");
const params = await client.readContract({
  address: book,
  abi,
  functionName: "getMarketParams",
});
if (
  params[0] !== 100000000 ||
  params[1] !== 10000000000n ||
  params[2].toLowerCase() !== "0x0000000000000000000000000000000000000000" ||
  params[3] !== 18n ||
  params[4].toLowerCase() !== token.toLowerCase() ||
  params[5] !== 6n
)
  throw new Error("Market changed");
const start = await snapshot();
if (start.usdc < 1000000n) throw new Error("Need 1 USDC");
const gasPrice = (await client.getGasPrice()) * 2n;
const CAP = 200000000000000000n;
let used = 0n;
let exitReserve = 0n;
const report = {
  mode: live ? "mainnet" : "fork",
  wallet: account.address,
  before: { MON: formatUnits(start.mon, 18), USDC: formatUnits(start.usdc, 6) },
  gasPrice: gasPrice.toString(),
  gasCapWei: CAP.toString(),
  steps: [],
};
const save = () =>
  writeFileSync(record, `${JSON.stringify(report, null, 2)}\n`);
let nonce = await client.getTransactionCount({
  address: account.address,
  blockTag: "pending",
});
async function send(name, to, data, value = 0n) {
  if (
    (await client.getTransactionCount({
      address: account.address,
      blockTag: "pending",
    })) !== nonce
  )
    throw new Error("Wallet nonce changed; stop concurrent activity");
  const raw = await client.estimateGas({
    account: account.address,
    to,
    data,
    value,
  });
  const gas = (raw * 12n) / 10n + 1000n;
  if (used + gas * gasPrice > CAP)
    throw new Error("0.2 MON gas cap would be exceeded");
  // Reserve the simulated exit gas before initiating the buy.
  if (name === "buy" && used + (gas + exitReserve) * gasPrice > CAP)
    throw new Error("Insufficient gas budget for buy and exit");
  const hash = await signer.sendTransaction({
    to,
    data,
    value,
    gas,
    gasPrice,
    nonce,
  });
  nonce++;
  const step = { name, hash, status: "submitted", gasLimit: gas.toString() };
  report.steps.push(step);
  save();
  const receipt = await client.waitForTransactionReceipt({
    hash,
    timeout: 120000,
  });
  const cost = receipt.gasUsed * receipt.effectiveGasPrice;
  used += cost;
  Object.assign(step, {
    status: receipt.status,
    gasCostWei: cost.toString(),
    block: receipt.blockNumber.toString(),
  });
  save();
  console.log(name, receipt.status, hash, "gas MON", formatUnits(cost, 18));
  if (receipt.status !== "success")
    throw new Error("Transaction reverted; no blind retry");
  return cost;
}
console.log(
  "wallet",
  account.address,
  "before",
  report.before,
  "mode",
  report.mode,
);
if ((await read("allowance", [account.address, book])) < 1000000n)
  await send(
    "approve",
    token,
    encodeFunctionData({
      abi,
      functionName: "approve",
      args: [book, 1000000n],
    }),
  );
const size = 100000000n;
const quote = await client.simulateContract({
  address: book,
  abi,
  functionName: "placeAndExecuteMarketBuy",
  args: [size, 1n, false, false],
  account: account.address,
});
const exitSize = quote.result / 100000000n;
const exitGas = await client.estimateGas({
  account: account.address,
  to: book,
  value: exitSize * 100000000n,
  data: encodeFunctionData({
    abi,
    functionName: "placeAndExecuteMarketSell",
    args: [exitSize, 1n, false, false],
  }),
});
exitReserve = (exitGas * 12n) / 10n + 1000n;
console.log("exit reserved MON", formatUnits(exitReserve * gasPrice, 18));
const beforeBuy = await snapshot();
const cost = await send(
  "buy",
  book,
  encodeFunctionData({
    abi,
    functionName: "placeAndExecuteMarketBuy",
    args: [size, (quote.result * 99n) / 100n, false, false],
  }),
);
const afterBuy = await snapshot();
const bought = afterBuy.mon - beforeBuy.mon + cost;
if (bought <= 0n || beforeBuy.usdc - afterBuy.usdc !== 1000000n)
  throw new Error("Unexpected buy accounting");
report.boughtMonWei = bought.toString();
save();
const sellSize = bought / 100000000n;
const spend = sellSize * 100000000n;
const sellQuote = await client.simulateContract({
  address: book,
  abi,
  functionName: "placeAndExecuteMarketSell",
  args: [sellSize, 1n, false, false],
  value: spend,
  account: account.address,
});
await send(
  "sell",
  book,
  encodeFunctionData({
    abi,
    functionName: "placeAndExecuteMarketSell",
    args: [sellSize, (sellQuote.result * 99n) / 100n, false, false],
  }),
  spend,
);
const end = await snapshot();
report.after = {
  MON: formatUnits(end.mon, 18),
  USDC: formatUnits(end.usdc, 6),
};
report.totalGasMON = formatUnits(used, 18);
report.usdcChange = formatUnits(end.usdc - start.usdc, 6);
report.monDustWei = (bought - spend).toString();
report.usdcRecovered = formatUnits(end.usdc - afterBuy.usdc, 6);
save();
console.log(JSON.stringify(report, null, 2));
