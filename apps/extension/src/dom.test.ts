// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from "vitest";
import { assetUrl, poweredBy } from "./dom";

afterEach(() => vi.unstubAllGlobals());

it("keeps packaged images usable after Chrome invalidates a reloaded extension", () => {
  const getURL = vi.fn((path: string) => `chrome-extension://test/${path}`);
  vi.stubGlobal("chrome", { runtime: { getURL } });
  const path = "brand/xtrading-wordmark.png";
  expect(assetUrl(path)).toBe(`chrome-extension://test/${path}`);
  getURL.mockImplementation(() => {
    throw new Error("Extension context invalidated.");
  });
  expect(() => poweredBy()).not.toThrow();
  expect(assetUrl(path)).toBe(`chrome-extension://test/${path}`);
});
