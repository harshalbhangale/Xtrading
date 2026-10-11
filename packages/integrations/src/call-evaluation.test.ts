import { expect, it } from "vitest";
import { evaluateExpiredCall } from "./call-evaluation";

const terms = {
  methodology: "directional-return-v1",
  assetId: "10143:asset",
  sourceId: "historical-provider",
  direction: "up",
  entryPrice: "100000000000000000000",
  priceDecimals: 18,
  expiry: "3600",
  toleranceSeconds: "60",
  targetBps: "100",
};
const price = {
  assetId: terms.assetId,
  sourceId: terms.sourceId,
  price: "101000000000000000000",
  priceDecimals: 18,
  timestamp: "3600",
};

it("evaluates exact integer thresholds for up and down calls", () => {
  expect(evaluateExpiredCall(terms, price, "7200").outcome).toBe("success");
  expect(
    evaluateExpiredCall(
      terms,
      { ...price, price: "100999999999999999999" },
      "7200",
    ).outcome,
  ).toBe("failure");
  expect(
    evaluateExpiredCall(
      { ...terms, direction: "down" },
      { ...price, price: "99000000000000000000" },
      "7200",
    ).outcome,
  ).toBe("success");
  expect(
    evaluateExpiredCall(terms, { ...price, price: terms.entryPrice }, "7200")
      .outcome,
  ).toBe("tie");
});
it("leaves missing, mismatched and out-of-window observations unresolved", () => {
  expect(evaluateExpiredCall(terms, price, "3599").outcome).toBe("unresolved");
  expect(evaluateExpiredCall(terms, null, "7200").outcome).toBe("unresolved");
  for (const patch of [
    { timestamp: "3599" },
    { timestamp: "3661" },
    { timestamp: "3601" },
    { sourceId: "other" },
    { assetId: "other" },
    { priceDecimals: 6 },
  ]) {
    expect(
      evaluateExpiredCall(terms, { ...price, ...patch }, "3600").outcome,
    ).toBe("unresolved");
  }
});
