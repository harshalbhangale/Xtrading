import { describe, expect, it } from "vitest";
import {
  checkPostAvailability,
  decimalToUnits,
  fetchPublicPost,
  firstNansenCandle,
  observePrice,
  parsePostUrl,
  postTimestampMs,
} from "./calls";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });

describe("decimalToUnits", () => {
  it("converts exactly and truncates toward zero", () => {
    expect(decimalToUnits("83026.15000000", 8)).toBe(8302615000000n);
    expect(decimalToUnits("0.0247902909310101", 8)).toBe(2479029n);
    expect(decimalToUnits("1.5e-5", 8)).toBe(1500n);
    expect(decimalToUnits("2e3", 2)).toBe(200000n);
    expect(decimalToUnits("0.000000001", 8)).toBe(0n);
    expect(() => decimalToUnits("-1", 8)).toThrow();
    expect(() => decimalToUnits("NaN", 8)).toThrow();
  });
});

describe("post URLs", () => {
  it("accepts only X status URLs", () => {
    expect(parsePostUrl("https://x.com/NoMoreBluffOnX/status/123/")).toEqual({
      handle: "nomorebluffonx",
      postId: "123",
    });
    expect(parsePostUrl("https://twitter.com/a/status/9")?.postId).toBe("9");
    expect(parsePostUrl("http://x.com/a/status/9")).toBeNull();
    expect(parsePostUrl("https://evil.com/a/status/9")).toBeNull();
    expect(parsePostUrl("https://x.com/a/status/9/photo/1")).toBeNull();
  });
  it("derives publication time from the snowflake", () => {
    expect(postTimestampMs("1585701318583492608")).toBe(
      (1585701318583492608n >> 22n) + 1288834974657n,
    );
    expect(postTimestampMs(String(1n << 22n))).toBe(1288834974658n);
  });
});

describe("fetchPublicPost", () => {
  it("takes the author from X's response", async () => {
    const post = await fetchPublicPost("20", async () =>
      json({
        author_url: "https://x.com/Jack",
        html: '<blockquote><p lang="en">BTC &amp; ETH up &gt; 5%<br>soon</p>&mdash; jack</blockquote>',
      }),
    );
    expect(post).toEqual({
      postId: "20",
      authorHandle: "jack",
      text: "BTC & ETH up > 5%\nsoon",
    });
  });
  it("returns null for missing posts and rejects odd payloads", async () => {
    expect(await fetchPublicPost("1", async () => json({}, 404))).toBeNull();
    await expect(
      fetchPublicPost("1", async () =>
        json({ author_url: "https://evil.com/x", html: "<p>x</p>" }),
      ),
    ).rejects.toThrow();
  });
});

describe("observePrice", () => {
  it("uses the first Binance candle at or after the timestamp", async () => {
    const result = await observePrice("BTC", 1_700_000_000, {
      fetcher: async () => json([[1_700_000_040_000, "37000.12000000"]]),
    });
    expect(result).toEqual({
      assetId: "BTC",
      sourceId: "binance-spot-1m-open:BTCUSDT",
      price: "3700012000000",
      priceDecimals: 8,
      timestamp: "1700000040",
    });
  });
  it("is unavailable outside the tolerance or without data", async () => {
    expect(
      await observePrice("ETH", 1_700_000_000, {
        fetcher: async () => json([[1_700_003_600_000, "1.0"]]),
      }),
    ).toBeNull();
    expect(
      await observePrice("ETH", 1_700_000_000, {
        fetcher: async () => json([]),
      }),
    ).toBeNull();
    expect(await observePrice("MON", 1_700_000_000)).toBeNull();
  });
  it("reads Nansen prices from source text", async () => {
    const raw =
      '{"data":[{"interval_start":"2023-11-14T22:13:00Z","open":1},{"interval_start":"2023-11-14T22:14:00Z","open":0.024790290931010199}]}';
    expect(firstNansenCandle(raw, 1_700_000_000)).toEqual({
      start: 1_700_000_040,
      open: "0.024790290931010199",
    });
  });
});

describe("public post availability", () => {
  it("reports a valid public post as available", async () => {
    const value = await checkPostAvailability("123", async () =>
      json({ author_url: "https://x.com/alice", html: "<p>buy ETH</p>" }),
    );
    expect(value.status).toBe("available");
    expect(value.source).toBe("x-oembed");
  });
  it("never calls a missing embed a confirmed deletion", async () => {
    expect(
      (await checkPostAvailability("123", async () => json({}, 404))).status,
    ).toBe("not-publicly-available");
  });
  it.each([401, 403, 429, 500])(
    "keeps HTTP %i failures inconclusive",
    async (status) => {
      expect(
        (await checkPostAvailability("123", async () => json({}, status)))
          .status,
      ).toBe("unavailable");
    },
  );
  it("keeps network and malformed response failures inconclusive", async () => {
    expect(
      (
        await checkPostAvailability("123", async () => {
          throw new Error("offline");
        })
      ).status,
    ).toBe("unavailable");
    expect(
      (await checkPostAvailability("123", async () => json({}))).status,
    ).toBe("unavailable");
  });
  it("rejects arbitrary URL input before fetching", async () => {
    let requested = false;
    await expect(
      checkPostAvailability("https://example.com", async () => {
        requested = true;
        return json({});
      }),
    ).rejects.toThrow("Invalid post ID");
    expect(requested).toBe(false);
  });
});
