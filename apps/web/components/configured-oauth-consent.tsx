"use client";
import { usePrivy } from "@privy-io/react-auth";
import { useState } from "react";

/** Sign in with Privy, then Allow sends the user back to the client with a code. */
export default function ConfiguredOAuthConsent({ query }: { query: string }) {
  const { ready, authenticated, login, getAccessToken, user } = usePrivy();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (!ready) return <p className="small-note">Loading…</p>;
  if (!authenticated)
    return (
      <button type="button" className="button oauth-allow" onClick={login}>
        Sign in to continue
      </button>
    );
  const name = user?.twitter?.username
    ? `@${user.twitter.username}`
    : (user?.email?.address ?? "your account");
  async function allow() {
    setBusy(true);
    setError("");
    try {
      const token = await getAccessToken();
      if (!token) throw new Error("Session expired. Sign in again.");
      const response = await fetch("/api/oauth/approve", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ query }),
      });
      const value = (await response.json().catch(() => null)) as {
        redirect?: string;
        description?: string;
        error?: string;
      } | null;
      if (!response.ok || !value?.redirect)
        throw new Error(
          value?.description ?? value?.error ?? "Could not approve.",
        );
      window.location.assign(value.redirect);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not approve.");
      setBusy(false);
    }
  }
  function deny() {
    const params = new URLSearchParams(query);
    const redirect = params.get("redirect_uri");
    if (!redirect) return;
    const url = new URL(redirect);
    url.searchParams.set("error", "access_denied");
    const state = params.get("state");
    if (state) url.searchParams.set("state", state);
    window.location.assign(url.href);
  }
  return (
    <>
      <p className="small-note">Signed in as {name}.</p>
      <div className="oauth-actions">
        <button
          type="button"
          className="button oauth-allow"
          disabled={busy}
          onClick={() => void allow()}
        >
          {busy ? "Connecting…" : "Allow"}
        </button>
        <button
          type="button"
          className="inline-button"
          disabled={busy}
          onClick={deny}
        >
          Cancel
        </button>
      </div>
      {error && <p className="form-message">{error}</p>}
    </>
  );
}
