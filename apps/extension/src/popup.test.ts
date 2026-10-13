import { expect, it, vi } from "vitest";

vi.hoisted(() => {
  vi.stubGlobal("CMB_APP_ORIGIN", "https://xtradingnow.xyz");
});

import { buildLabel, connectionRows, unreachableCopy } from "./popup";

it("names the chain from health and does not call Kuru a live fill", () => {
  expect(buildLabel(10143)).toBe("Monad testnet");
  expect(buildLabel(143)).toBe("Monad mainnet");
  const rows = connectionRows({
    chainId: 10143,
    modes: { llm: "demo", nansen: "demo", perpl: "wallet" },
  });
  expect(rows.find((row) => row.label === "Kuru spot")).toEqual({
    label: "Kuru spot",
    value: "Testnet",
    tone: "ok",
  });
  expect(rows.find((row) => row.label === "Perpl orders")).toEqual({
    label: "Perpl orders",
    value: "Your wallet · testnet",
    tone: "ok",
  });
  expect(unreachableCopy()).toBe("Not reachable");
});

it("keeps an unknown chain and an unreported Perpl mode honest", () => {
  const rows = connectionRows({ chainId: 1, modes: {} });
  expect(rows.find((row) => row.label === "Kuru spot")?.value).toBe(
    "Unknown network",
  );
  expect(rows.find((row) => row.label === "Perpl orders")?.value).toBe(
    "Unavailable",
  );
});
