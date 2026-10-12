"use client";

import { usePrivy } from "@privy-io/react-auth";
import Link from "next/link";
import { accountLabel } from "./account";

export default function SidebarAccount() {
  const { ready, authenticated, user, logout } = usePrivy();
  if (!ready) return <div className="account-card account-card-loading" />;
  if (!authenticated || !user)
    return (
      <div className="account-card">
        <p className="account-meta">Browsing signed out</p>
        <Link className="button button-block" href="/start">
          Sign in
        </Link>
      </div>
    );
  const account = accountLabel(user);
  return (
    <div className="account-card">
      <div className="account-row">
        <span className="account-avatar" aria-hidden="true">
          {account.initial}
        </span>
        <div>
          <strong>{account.name}</strong>
          <span className="account-meta">{account.detail}</span>
        </div>
      </div>
      <button
        type="button"
        className="secondary-button button button-block"
        onClick={() => void logout()}
      >
        Sign out
      </button>
    </div>
  );
}
