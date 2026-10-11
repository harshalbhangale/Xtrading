"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navigation = {
  user: [
    { href: "/dashboard", label: "Overview" },
    { href: "/dashboard/trade", label: "Trade" },
    { href: "/dashboard/portfolio", label: "Portfolio" },
    { href: "/dashboard/activity", label: "Activity" },
    { href: "/dashboard/watchlist", label: "Watchlist" },
    { href: "/creators", label: "Creators" },
  ],
  creator: [
    { href: "/creator", label: "Overview" },
    { href: "/creator/profile", label: "Identity" },
    { href: "/creator/stake", label: "Stake" },
    { href: "/creator/calls", label: "Calls" },
    { href: "/creator/reputation", label: "Reputation" },
  ],
} as const;

export function Sidebar({ audience }: { audience: "user" | "creator" }) {
  const pathname = usePathname();
  return (
    <aside className="dashboard-sidebar">
      <p className="eyebrow">
        {audience === "creator" ? "Creator studio" : "Your workspace"}
      </p>
      <nav
        aria-label={`${audience === "creator" ? "Creator" : "User"} workspace navigation`}
      >
        {navigation[audience].map((item) => (
          <Link
            key={item.href}
            href={item.href}
            aria-current={pathname === item.href ? "page" : undefined}
          >
            {item.label}
          </Link>
        ))}
      </nav>
      <div className="sidebar-divider" />
      <nav aria-label="Other surfaces">
        <Link href="/extension">X extension</Link>
        <Link href="/integrations">Agent access (MCP)</Link>
      </nav>
      <div className="sidebar-bottom">
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
