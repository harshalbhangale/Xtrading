// @vitest-environment happy-dom
import { expect, it, vi } from "vitest";
import {
  deriveTradeRoute,
  heuristicSignal,
} from "../../../packages/integrations/src/signals";

vi.hoisted(() => {
  vi.stubGlobal("CMB_APP_ORIGIN", "https://xtradingnow.xyz");
});

import { perpTicket } from "./perp-ticket";

const market = (marketId: number, mark: string) => ({
  marketId,
  symbol: "ETH",
  priceDecimals: 2,
  sizeDecimals: 3,
  open: true,
  quote: { mark, previous: mark },
  takerFeePpm: 345,
  maxSlippageBps: 100,
  marketMaxLeverage: 12,
  maintenanceMarginHundredths: 2000,
});
const settle = async () => {
  for (let i = 0; i < 10; i++) await Promise.resolve();
};

function setup(mainnet: unknown) {
  const sent: { type: string; perplChainId?: number }[] = [];
  vi.stubGlobal("chrome", {
    runtime: {
      id: "t",
      sendMessage: vi.fn(async (m: { type: string; perplChainId?: number }) => {
        sent.push(m);
        if (m.type !== "markets") return null;
        return m.perplChainId === 143
          ? mainnet
          : {
              perpl: {
                markets: [market(32, "250000")],
                limits: { maxLeverage: 5, maxSize: "1", maxCollateral: null },
              },
            };
      }),
    },
  });
  const signal = heuristicSignal({
    handle: "ari",
    postId: "2",
    now: new Date(),
    text: "long ETH perp here",
  });
  const route = deriveTradeRoute(signal, [
    { marketId: 32, symbol: "ETH", open: true },
  ]);
  if (route.status !== "available") throw new Error("route");
  const ticket = perpTicket("2", signal, route);
  document.body.replaceChildren(ticket);
  const network = ticket.querySelector<HTMLSelectElement>(".swap-network");
  if (!network) throw new Error("no network select");
  return { sent, ticket, network };
}

it("starts on testnet and finds the mainnet market by symbol, not by testnet ID", async () => {
  const { sent, ticket, network } = setup({
    perpl: {
      markets: [market(20, "251000")],
      limits: { maxLeverage: 3, maxSize: null, maxCollateral: "50" },
    },
  });
  await settle();
  expect(network.value).toBe("10143");
  expect(ticket.textContent).toContain("ETH-PERP");
  expect(ticket.textContent).toContain("· testnet ·");

  network.value = "143";
  network.dispatchEvent(new Event("change"));
  await settle();
  expect(sent.at(-1)).toEqual({ type: "markets", perplChainId: 143 });
  expect(ticket.textContent).toContain("$2,510.00");
  expect(ticket.textContent).toContain("50 AUSD margin, 3x");
  expect(ticket.textContent).toContain("mainnet · real AUSD");
  // Mainnet caps leverage at 3x, so higher chips are not offered.
  const chips = [...ticket.querySelectorAll(".lev")].map((b) => b.textContent);
  expect(chips).toEqual(["1x", "2x", "3x"]);
});

it("says so when Perpl mainnet is switched off, without falling back", async () => {
  const { ticket, network } = setup({
    perpl: { venue: "Perpl", chainId: 143, status: "disabled" },
  });
  await settle();
  network.value = "143";
  network.dispatchEvent(new Event("change"));
  await settle();
  expect(ticket.textContent).toContain(
    "Perpl mainnet is switched off on this server.",
  );
  expect(ticket.textContent).not.toContain("ETH-PERP");
});
