// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from "vitest";
import insights from "./profile-insights.fixture.json";

vi.hoisted(() => {
  vi.stubGlobal("CMB_APP_ORIGIN", "https://xtradingnow.xyz");
});

import { scanProfile } from "./profile";

afterEach(() => {
  document.body.replaceChildren();
  vi.unstubAllGlobals();
});

it("shows captured calls with expiry prices even when the creator has no linked wallet", async () => {
  window.history.replaceState(null, "", "/MaxiCalls");
  document.body.innerHTML =
    '<div data-testid="primaryColumn"><div data-testid="UserName">MaxiCalls</div><div role="tablist"></div></div>';
  vi.stubGlobal("chrome", {
    runtime: {
      id: "test",
      sendMessage: vi.fn(async (message: { type: string }) =>
        message.type === "creator-insights" ? insights : null,
      ),
    },
  });
  await scanProfile();
  const text =
    document.querySelector(".cmb-profile-host")?.shadowRoot?.textContent;
  expect(text).toContain("Detected calls");
  expect(text).toContain("33");
  expect(text).toContain("9/19");
  expect(text).toContain("19 settled");
  expect(text).not.toContain("service unavailable");
  expect(text).toContain("not linked");
});
