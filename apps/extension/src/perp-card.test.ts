// @vitest-environment happy-dom
import { expect, it, vi } from "vitest";
import {
  deriveTradeRoute,
  heuristicSignal,
} from "../../../packages/integrations/src/signals";

vi.hoisted(() => {
  vi.stubGlobal("CMB_APP_ORIGIN", "https://xtradingnow.xyz");
});

import { perpCard } from "./perp-card";

it("renders a perp call as an X-style card and loads evidence only when opened", async () => {
  const sent: string[] = [];
  vi.stubGlobal("chrome", {
    runtime: {
      id: "t",
      sendMessage: vi.fn(async (m: { type: string }) => {
        sent.push(m.type);
        return m.type === "markets"
          ? {
              perpl: {
                markets: [
                  {
                    marketId: 32,
                    symbol: "ETH",
                    priceDecimals: 2,
                    quote: { mark: "250900", previous: "255060" },
                  },
                ],
              },
            }
          : null;
      }),
    },
  });
  const signal = heuristicSignal({
    handle: "ari",
    postId: "2",
    now: new Date(),
    text: "go short on ETH this week at 2400",
  });
  const route = deriveTradeRoute(signal, [
    { marketId: 32, symbol: "ETH", open: true },
  ]);
  if (route.status !== "available") throw new Error("route");
  const card = perpCard({ postId: "2", signal, route });
  document.body.append(card);
  for (let i = 0; i < 10; i++) await Promise.resolve();
  expect(card.classList.contains("inline-card")).toBe(true);
  expect(card.textContent).toContain("ETH-PERP $2,509.00");
  expect(card.textContent).toContain("Bearish ETH perp");
  expect(card.querySelector(".inline-buy")?.textContent).toBe("⇄ Short");
  // Scrolling past a card must not spend Nansen credits.
  expect(sent).not.toContain("creator-insights");
  const details = card.querySelector<HTMLDetailsElement>(".call-insights");
  if (!details) throw new Error("no insights");
  details.open = true;
  details.dispatchEvent(new Event("toggle"));
  await Promise.resolve();
  expect(sent).toContain("creator-insights");
});
