"use client";
import { usePrivy } from "@privy-io/react-auth";
import { useState } from "react";

export default function ConfiguredMcpToken() {
  const { ready, authenticated, login, getAccessToken } = usePrivy();
  const [notice, setNotice] = useState("");
  if (!ready) return <p className="small-note">Loading…</p>;
  if (!authenticated)
    return (
      <button type="button" className="button" onClick={login}>
        Sign in to get a token
      </button>
    );
  return (
    <>
      <button
        type="button"
        className="button"
        onClick={async () => {
          const token = await getAccessToken();
          if (!token) {
            setNotice("Session expired. Sign in again.");
            return;
          }
          try {
            await navigator.clipboard.writeText(token);
            setNotice("Copied. Paste it only into your own agent's config.");
          } catch {
            setNotice("Clipboard unavailable in this browser.");
          }
        }}
      >
        Copy session token
      </button>
      {notice && (
        <p className="small-note" role="status">
          {notice}
        </p>
      )}
    </>
  );
}
