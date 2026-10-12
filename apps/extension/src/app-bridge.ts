import { normalizeHandle } from "@call-my-bluff/domain";
import { appOrigin } from "./config";
import { send } from "./dom";

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
