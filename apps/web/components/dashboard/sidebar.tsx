"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navigation = {
  user: [
    { href: "/dashboard", label: "Overview", icon: "◫" },
    { href: "/dashboard/watchlist", label: "Watchlist", icon: "☆" },
    { href: "/dashboard/portfolio", label: "Portfolio", icon: "↗" },
    { href: "/dashboard/trade", label: "Trade review", icon: "⇄" },
    { href: "/dashboard/activity", label: "Activity", icon: "≡" },
    { href: "/creators", label: "Find creators", icon: "⌕" },
  ],
  creator: [
    { href: "/creator", label: "Overview", icon: "◫" },
    { href: "/creator/profile", label: "Identity & profile", icon: "◎" },
    { href: "/creator/stake", label: "Your stake", icon: "◇" },
    { href: "/creator/calls", label: "Your calls", icon: "≡" },
    { href: "/creator/reputation", label: "Reputation", icon: "↗" },
  ],
} as const;

export function Sidebar({ audience }: { audience: "user" | "creator" }) {
  const pathname = usePathname();
  return (
    <aside className="dashboard-sidebar">
      <div className="workspace-label">
        <span className="workspace-symbol" aria-hidden="true">
          {audience === "creator" ? "◇" : "◫"}
        </span>
        <div>
          <strong>
            {audience === "creator" ? "Creator studio" : "Your workspace"}
          </strong>
          <span>
            {audience === "creator"
              ? "Build your public record"
              : "Follow the evidence"}
          </span>
        </div>
      </div>
      <p className="eyebrow">Workspace</p>
      <nav
        aria-label={`${audience === "creator" ? "Creator" : "User"} workspace navigation`}
      >
        {navigation[audience].map((item) => (
          <Link
            key={item.href}
            href={item.href}
            aria-current={pathname === item.href ? "page" : undefined}
          >
            <span aria-hidden="true">{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </nav>
      <div className="sidebar-divider" />
      <p className="eyebrow">Connected surfaces</p>
      <nav aria-label="Connected surfaces">
        <Link href="/extension">
          <span aria-hidden="true">↗</span>X extension
        </Link>
        <Link href="/integrations">
          <span aria-hidden="true">⌘</span>Agent connections
        </Link>
      </nav>
      <div className="sidebar-bottom">
        <p>
          One account.
          <br />
          Two perspectives.
        </p>
        <Link
          className="text-link"
          href={audience === "creator" ? "/dashboard" : "/creator"}
        >
          Switch to{" "}
          {audience === "creator" ? "user workspace" : "creator studio"} ↗
        </Link>
      </div>
    </aside>
  );
}
