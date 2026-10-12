"use client";

import { useLogin, usePrivy } from "@privy-io/react-auth";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { accountLabel } from "./dashboard/account";
import { type Role, RoleCards, roles } from "./role-cards";

export default function ConfiguredRoleChooser() {
  const router = useRouter();
  const { ready, authenticated, user, logout } = usePrivy();
  // Only navigate after a login this page started, never on passive session restore.
  const intent = useRef<Role | null>(null);
  const [error, setError] = useState("");
  const { login } = useLogin({
    onComplete: () => {
      const role = intent.current;
      intent.current = null;
      if (role) router.push(roles[role].href);
    },
    onError: (code) => {
      intent.current = null;
      if (code !== "exited_auth_flow")
        setError("Sign-in did not complete. Try again.");
    },
  });
  const choose = (role: Role) => {
    setError("");
    if (authenticated) {
      router.push(roles[role].href);
      return;
    }
    intent.current = role;
    login({
      loginMethods:
        role === "creator" ? ["twitter"] : ["twitter", "email", "wallet"],
    });
  };
  return (
    <>
      {authenticated && user && (
        <p className="start-signed-in">
          Signed in as <strong>{accountLabel(user).name}</strong>
          <button
            type="button"
            className="inline-button"
            onClick={() => void logout()}
          >
            Use a different account
          </button>
        </p>
      )}
      <RoleCards
        action={(role) => (
          <button
            type="button"
            className="button"
            disabled={!ready}
            onClick={() => choose(role)}
          >
            {authenticated ? roles[role].open : roles[role].cta}{" "}
            <span aria-hidden="true">→</span>
          </button>
        )}
      />
      {error && (
        <p className="start-error" role="alert">
          {error}
        </p>
      )}
    </>
  );
}
