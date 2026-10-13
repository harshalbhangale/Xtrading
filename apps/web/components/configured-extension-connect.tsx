"use client";
import { usePrivy } from "@privy-io/react-auth";
import { useState } from "react";

/**
 * Mints a perp-scoped extension session and hands it to the extension's bridge on
 * this page. The Privy access token stays here; only the scoped session crosses.
 */
export default function ConfiguredExtensionConnect() {
  const { ready, authenticated, login, getAccessToken } = usePrivy();
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">(
    "idle",
  );
  const [message, setMessage] = useState("");
  async function connect() {
    setState("busy");
    setMessage("");
    try {
      const token = await getAccessToken();
      if (!token) throw new Error("Sign in again.");
      const response = await fetch("/api/extension/session", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const value = (await response.json()) as {
        token?: string;
        handle?: string | null;
        expiresAt?: string;
        error?: string;
      };
      if (!response.ok || !value.token)
        throw new Error(
          value.error === "current_binding_required"
            ? "Bind your X account to your wallet first (Setup)."
            : value.error === "extension_sessions_unconfigured"
              ? "Extension sessions are not configured on this server."
              : (value.error ?? "Connection failed.").replaceAll("_", " "),
        );
      const nonce = crypto.randomUUID();
      const acknowledged = new Promise<boolean>((resolve) => {
        const timer = setTimeout(() => resolve(false), 3000);
        window.addEventListener("message", function onAck(event) {
          if (
            event.source === window &&
            event.origin === window.location.origin &&
            event.data?.type === "xtrading-extension-session-saved" &&
            event.data?.nonce === nonce
          ) {
            clearTimeout(timer);
            window.removeEventListener("message", onAck);
            resolve(event.data.saved === true);
          }
        });
      });
      window.postMessage(
        {
          type: "xtrading-extension-session",
          nonce,
          token: value.token,
          handle: value.handle,
          expiresAt: value.expiresAt,
        },
        window.location.origin,
      );
      if (!(await acknowledged))
        throw new Error(
          "The extension did not answer. Install or reload it, then try again.",
        );
      setState("done");
      setMessage(
        `Connected${value.handle ? ` as @${value.handle}` : ""}. You can close this window and trade from X.`,
      );
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "Connection failed.");
    }
  }
  if (!ready) return <p>Loading…</p>;
  if (!authenticated)
    return (
      <button className="button" type="button" onClick={() => login()}>
        Sign in with X
      </button>
    );
  return (
    <div className="connect-actions">
      {state !== "done" && (
        <button
          className="button"
          type="button"
          disabled={state === "busy"}
          onClick={() => void connect()}
        >
          {state === "busy" ? "Connecting…" : "Connect extension"}
        </button>
      )}
      {message && (
        <p role="status" className={state === "error" ? "pt-error" : ""}>
          {message}
        </p>
      )}
      {state === "done" && (
        <button
          className="button secondary-button"
          type="button"
          onClick={() => window.close()}
        >
          Close window
        </button>
      )}
    </div>
  );
}
