import {
  postSignalRequestSchema,
  tradeReviewPath,
} from "@call-my-bluff/domain";
import { expect, it } from "vitest";
import { deriveTradeRoute, heuristicSignal } from "./signals";
import { tokenReferences } from "./token-references";

const mint = "39fzweMMY4DRAgBQN61jbMGRoa2RBFTjAY3Vg95Epump";
it("preserves Solana address case and rejects invalid lengths/characters", () => {
  expect(tokenReferences(`CA: ${mint}`)).toEqual([
    { address: mint, kind: "solana" },
  ]);
  expect(tokenReferences("CA: abcdefghijklmnopqrstuvwxyz1234567890")).toEqual(
    [],
  );
  expect(tokenReferences(`CA: ${mint}A`)).toEqual([]);
});
it("deduplicates EVM references without assuming their chain or token", () => {
  const address = `0x${"aB".repeat(20)}`;
  expect(tokenReferences(`${address} ${address.toLowerCase()}`)).toEqual([
    { address: address.toLowerCase(), kind: "evm" },
  ]);
});
it("does not substitute a ticker market when an address is present", () => {
  const signal = heuristicSignal({
    postId: "123",
    handle: "alice",
    text: `buy $ETH CA: ${mint}`,
  });
  expect(deriveTradeRoute(signal, [])).toMatchObject({ status: "unavailable" });
  for (const text of [`CA:\n${mint}`, `CA ${mint}`, `Contract address ${mint}`])
    expect(
      heuristicSignal({ postId: "123", handle: "alice", text }),
    ).toMatchObject({ isCall: false, tokenMention: true });
});
it("allows only X media metadata and remains compatible with older callers", () => {
  const base = { postId: "123", handle: "alice", text: "buy $ETH" };
  expect(postSignalRequestSchema.parse(base).images).toEqual([]);
  for (const url of [
    "http://pbs.twimg.com/media/image.jpg",
    "https://pbs.twimg.com.evil.test/media/image.jpg",
    "https://user:pass@pbs.twimg.com/media/image.jpg",
    "https://pbs.twimg.com/profile_images/avatar.png",
    "https://127.0.0.1/media/image.jpg",
  ]) {
    expect(
      postSignalRequestSchema.safeParse({ ...base, images: [{ url, alt: "" }] })
        .success,
    ).toBe(false);
  }
});
it("review links preserve the source and distinguish spot selling from a perp short", () => {
  const spot = heuristicSignal({
    postId: "123",
    handle: "alice",
    text: "buy $ETH",
  });
  const spotUrl = new URL(
    tradeReviewPath(spot, deriveTradeRoute(spot, []), "sell") ?? "",
    "https://tradepostapp.vercel.app",
  );
  expect(Object.fromEntries(spotUrl.searchParams)).toMatchObject({
    postId: "123",
    handle: "alice",
    chainId: "10143",
    market: "WETH",
    side: "sell",
    instrument: "spot",
  });
  const perp = heuristicSignal({
    postId: "123",
    handle: "alice",
    text: "long $BTC 5x",
  });
  const perpUrl = new URL(
    tradeReviewPath(
      perp,
      deriveTradeRoute(perp, [{ marketId: 1, symbol: "BTC", open: true }]),
      "sell",
    ) ?? "",
    "https://tradepostapp.vercel.app",
  );
  expect(perpUrl.searchParams.get("side")).toBe("short");
  expect(
    tradeReviewPath(
      spot,
      { status: "unavailable", reason: "No market" },
      "buy",
    ),
  ).toBeNull();
});
