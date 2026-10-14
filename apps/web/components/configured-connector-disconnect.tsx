"use client";
import { usePrivy } from "@privy-io/react-auth";
import { useState } from "react";

/** Revokes every connector token this user approved (claude.ai and others). */
export default function ConfiguredConnectorDisconnect() {
  const { authenticated, getAccessToken } = usePrivy();
  const [notice, setNotice] = useState("");
  if (!authenticated) return null;
  async function disconnect() {
    const token = await getAccessToken();
    if (!token) return setNotice("Session expired. Sign in again.");
    const response = await fetch("/api/oauth/connections", {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => null);
    setNotice(
      response?.ok
        ? "Disconnected. Connected apps must sign in again to use Xtrading."
        : "Could not disconnect. Try again.",
    );
  }
  return (
    <p className="small-note">
      <button
        type="button"
        className="inline-button"
        onClick={() => void disconnect()}
      >
        Disconnect all connected apps
      </button>{" "}
      {notice}
    </p>
  );
}
