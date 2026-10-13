import { normalizeHandle } from "@call-my-bluff/domain";
import { appOrigin } from "./config";
import { send } from "./dom";

// Extension connect: the app page hands over a perp-scoped extension session (never
// the Privy token). Only this origin and path are accepted.
window.addEventListener("message", (event: MessageEvent) => {
  const message = event.data;
  if (
    event.source !== window ||
    event.origin !== appOrigin ||
    location.origin !== appOrigin ||
    location.pathname !== "/extension/connect" ||
    !message ||
    typeof message !== "object" ||
    message.type !== "xtrading-extension-session" ||
    typeof message.nonce !== "string" ||
    !/^[a-zA-Z0-9-]{16,100}$/.test(message.nonce)
  )
    return;
  void send<{ saved?: boolean }>({
    type: "store-session",
    token: message.token,
    handle: message.handle,
    expiresAt: message.expiresAt,
  }).then((value) =>
    window.postMessage(
      {
        type: "xtrading-extension-session-saved",
        nonce: message.nonce,
        saved: value?.saved === true,
      },
      appOrigin,
    ),
  );
});

// App-only watchlist bridge. No Privy tokens, X cookies or provider keys cross it.
window.addEventListener("message", (event: MessageEvent) => {
  if (
    event.source !== window ||
    event.origin !== appOrigin ||
    location.origin !== appOrigin ||
    location.pathname !== "/dashboard/watchlist"
  )
    return;
  const message = event.data;
  if (
    !message ||
    typeof message !== "object" ||
    message.type !== "tradepost-follow-request" ||
    typeof message.nonce !== "string" ||
    !/^[a-zA-Z0-9-]{16,100}$/.test(message.nonce)
  )
    return;
  const viewer =
    typeof message.viewer === "string" ? normalizeHandle(message.viewer) : null;
  if (!viewer || !["read", "configure"].includes(message.action)) return;
  if (message.action === "configure" && typeof message.enabled !== "boolean")
    return;
  void send<unknown>({
    type: "app-following",
    viewer,
    action: message.action,
    enabled: message.enabled,
  })
    .then((value: unknown) => {
      window.postMessage(
        { type: "tradepost-follow-response", nonce: message.nonce, value },
        appOrigin,
      );
    })
    .catch(() => {
      window.postMessage(
        {
          type: "tradepost-follow-response",
          nonce: message.nonce,
          value: null,
        },
        appOrigin,
      );
    });
});
