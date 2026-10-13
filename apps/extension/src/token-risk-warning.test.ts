// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from "vitest";
import { addTokenRiskWarning } from "./token-risk-warning";

afterEach(() => {
  document.body.replaceChildren();
  vi.unstubAllGlobals();
});

it("renders dated source-linked risk evidence without a provider request or signing control", () => {
  const fetcher = vi.fn();
  vi.stubGlobal("fetch", fetcher);
  const article = document.createElement("article");
  const text = document.createElement("div");
  text.dataset.testid = "tweetText";
  article.append(text);
  document.body.append(article);
  const input = {
    handle: "peckshieldalert",
    postId: "1622436301055336450",
    text: "Damus honeypot selling tax report",
  };
  addTokenRiskWarning(article, input);
  addTokenRiskWarning(article, input);
  expect(article.querySelectorAll(".cmb-token-risk-host")).toHaveLength(1);
  const root = article.querySelector(".cmb-token-risk-host")?.shadowRoot;
  expect(root?.textContent).toContain("Token security report");
  expect(root?.textContent).toContain("100% sell tax");
  expect(root?.textContent).toContain("2023-02-06");
  expect(root?.textContent).toContain(
    "current sell behaviour has not been simulated",
  );
  expect(root?.querySelector("a")?.href).toBe(
    "https://x.com/PeckShieldAlert/status/1622436301055336450/photo/1",
  );
  expect(root?.querySelector("button")).toBeNull();
  expect(fetcher).not.toHaveBeenCalled();
});

it("labels an address match without a network cue as unverified", () => {
  const article = document.createElement("article");
  const text = document.createElement("div");
  text.dataset.testid = "tweetText";
  article.append(text);
  document.body.append(article);
  addTokenRiskWarning(article, {
    handle: "alice",
    postId: "123",
    text: "CA: 0x9cf8b570fac7d129c2afa7058210d9137f55c081",
  });
  expect(
    article.querySelector(".cmb-token-risk-host")?.shadowRoot?.textContent,
  ).toContain("this post's network is not verified");
});
