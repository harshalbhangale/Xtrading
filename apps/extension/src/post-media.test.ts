// @vitest-environment happy-dom
import { expect, it } from "vitest";
import { postImages } from "./post-media";

it("captures the original post's photos, excluding quoted posts and avatars", () => {
  const article = document.createElement("article");
  article.innerHTML =
    '<img src="https://pbs.twimg.com/profile_images/avatar.png"><a href="https://x.com/alice/status/123/photo/1"><img src="https://pbs.twimg.com/media/outer.jpg" alt="chart"></a><a href="https://x.com/bob/status/456/photo/1"><img src="https://pbs.twimg.com/media/quote.jpg"></a>';
  expect(postImages(article, "123")).toEqual([
    { url: "https://pbs.twimg.com/media/outer.jpg", alt: "chart" },
  ]);
});
it("rejects photo sources outside X media", () => {
  const article = document.createElement("article");
  article.innerHTML =
    '<a href="https://x.com/alice/status/123/photo/1"><img src="https://evil.test/pixel.png"></a>';
  expect(postImages(article, "123")).toEqual([]);
});
