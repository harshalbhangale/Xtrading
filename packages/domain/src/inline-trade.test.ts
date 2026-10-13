import { expect, it } from "vitest";
import {
  decimalAtoms,
  displayAtoms,
  inlineQuoteRequestSchema,
} from "./inline-trade";

it("parses precise amounts without rounding or floating point", () => {
  expect(decimalAtoms("9007199254740993.123456", 6)).toBe(
    "9007199254740993123456",
  );
  expect(decimalAtoms("0.000001", 6)).toBe("1");
  for (const value of ["-1", "1e6", "1.0000001", "NaN", "0", "01", "1."])
    expect(decimalAtoms(value, 6)).toBeNull();
  expect(displayAtoms("9007199254740993123456", 6)).toBe(
    "9007199254740993.123456",
  );
});
it("public quotes accept only configured networks and integer amounts", () => {
  const request = {
    chainId: 10143,
    market: "MON",
    side: "buy",
    amount: "1000000",
    slippageBps: 50,
  };
  expect(inlineQuoteRequestSchema.safeParse(request).success).toBe(true);
  for (const change of [
    { chainId: 1 },
    { amount: "1.0" },
    { market: "PEPE" },
    { url: "https://evil.test" },
    { amount: "9".repeat(80) },
  ])
    expect(
      inlineQuoteRequestSchema.safeParse({ ...request, ...change }).success,
    ).toBe(false);
});
