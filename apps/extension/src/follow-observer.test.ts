// @vitest-environment happy-dom
import { afterEach, expect, it } from "vitest";
import { followObservations } from "./follow-observer";

function page(path: string, body: string) {
  window.history.replaceState(null, "", path);
  document.body.innerHTML =
    '<a data-testid="AppTabBar_Profile_Link" href="https://x.com/alice">Me</a>' +
    body;
}
afterEach(() => document.body.replaceChildren());
it("captures Following only in the profile header, not ordinary posts", () => {
  page(
    "/bob",
    '<div data-testid="primaryColumn"><div data-testid="UserName">Bob</div><button data-testid="22-unfollow">Following</button><article data-testid="tweet"><button data-testid="55-follow">Follow</button></article></div>',
  );
  expect(followObservations()).toEqual({
    viewer: "alice",
    observations: [{ handle: "bob", following: true }],
  });
});
it("captures explicitly visible unfollowed profile state", () => {
  page(
    "/bob",
    '<div data-testid="primaryColumn"><div data-testid="UserName">Bob</div><button data-testid="22-follow">Follow</button></div>',
  );
  expect(followObservations()?.observations).toEqual([
    { handle: "bob", following: false },
  ]);
});
it("ignores suggestions and feed follow buttons", () => {
  page(
    "/bob",
    '<div data-testid="primaryColumn"><div data-testid="UserName">Bob</div><div data-testid="UserCell"><button data-testid="99-unfollow">Following</button></div></div>',
  );
  expect(followObservations()?.observations).toEqual([]);
  page(
    "/home",
    '<article data-testid="tweet"><button data-testid="99-unfollow">Following</button></article>',
  );
  expect(followObservations()?.observations).toEqual([]);
});
it("reads visible rows only from the current viewer's following list", () => {
  const rows =
    '<div data-testid="UserCell"><a href="https://x.com/bob">Bob</a><button data-testid="22-unfollow">Following</button></div>';
  const scopedRows = `<div data-testid="primaryColumn">${rows}</div><aside><div data-testid="UserCell"><a href="https://x.com/eve">Eve</a><button data-testid="99-unfollow">Following</button></div></aside>`;
  page("/alice/following", scopedRows);
  expect(followObservations()?.observations).toEqual([
    { handle: "bob", following: true },
  ]);
  page("/charlie/following", scopedRows);
  expect(followObservations()?.observations).toEqual([]);
});
it("does not infer a viewer or a following state from missing UI", () => {
  page(
    "/bob",
    '<div data-testid="primaryColumn"><div data-testid="UserName">Bob</div></div>',
  );
  expect(followObservations()?.observations).toEqual([]);
  document.body.replaceChildren();
  expect(followObservations()).toBeNull();
});
