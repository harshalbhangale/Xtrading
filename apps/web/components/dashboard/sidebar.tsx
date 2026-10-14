"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Brand } from "../brand";
import { Icon, type IconName } from "./icons";

type Item = { href: string; label: string; icon: IconName };

const navigation: Record<"user" | "creator", Item[]> = {
  user: [
    { href: "/dashboard", label: "Terminal", icon: "activity" },
    { href: "/dashboard/profile", label: "Profile", icon: "overview" },
    { href: "/dashboard/portfolio", label: "Portfolio", icon: "portfolio" },
    { href: "/dashboard/trades", label: "My trades", icon: "trade" },
    { href: "/dashboard/watchlist", label: "Watchlist", icon: "watchlist" },
    { href: "/creators", label: "Creators", icon: "creators" },
  ],
  creator: [
    { href: "/creator", label: "Overview", icon: "overview" },
    { href: "/creator/profile", label: "Identity", icon: "identity" },
    { href: "/creator/earnings", label: "Earnings & posts", icon: "portfolio" },
    { href: "/creator/calls", label: "Calls", icon: "calls" },
    { href: "/creator/reputation", label: "Reputation", icon: "reputation" },
  ],
};

const tools: Item[] = [
  { href: "/extension", label: "X extension", icon: "extension" },
  { href: "/integrations", label: "Agent access", icon: "agent" },
];

const SidebarAccount = dynamic(() => import("./sidebar-account"), {
  ssr: false,
  loading: () => <div className="account-card account-card-loading" />,
});

function current(pathname: string, href: string) {
  // Overview pages only match exactly; sections match their sub-pages too.
  if (href === "/dashboard" || href === "/creator") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Sidebar({ audience }: { audience: "user" | "creator" }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  // biome-ignore lint/correctness/useExhaustiveDependencies: Close the mobile drawer after navigation.
  useEffect(() => setOpen(false), [pathname]);
  return (
    <>
      <div className="workspace-mobilebar">
        <Link href="/" aria-label="Xtrading home" className="workspace-brand">
          <Brand />
        </Link>
        <button
          type="button"
          className="icon-button"
          aria-expanded={open}
          aria-controls="workspace-sidebar"
          onClick={() => setOpen((value) => !value)}
        >
          <Icon name={open ? "close" : "menu"} />
          <span className="sr-only">{open ? "Close menu" : "Open menu"}</span>
        </button>
      </div>
      <aside
        id="workspace-sidebar"
        className="dashboard-sidebar"
        data-open={open}
      >
        <Link href="/" aria-label="Xtrading home" className="workspace-brand">
          <Brand />
        </Link>
        <nav className="workspace-switch" aria-label="Workspace">
          <Link
            href="/dashboard"
            aria-current={audience === "user" ? "true" : undefined}
          >
            User
          </Link>
          <Link
            href="/creator"
            aria-current={audience === "creator" ? "true" : undefined}
          >
            Creator
          </Link>
        </nav>
        <nav
          className="sidebar-nav"
          aria-label={audience === "creator" ? "Creator studio" : "Dashboard"}
        >
          {navigation[audience].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={current(pathname, item.href) ? "page" : undefined}
            >
              <Icon name={item.icon} />
              {item.label}
            </Link>
          ))}
        </nav>
        <p className="sidebar-label">Tools</p>
        <nav className="sidebar-nav" aria-label="Tools">
          {tools.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={current(pathname, item.href) ? "page" : undefined}
            >
              <Icon name={item.icon} />
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <p className="account-meta">
            Spot · Monad mainnet
            <br />
            Perps · Monad testnet
          </p>
          {process.env.NEXT_PUBLIC_PRIVY_APP_ID ? (
            <SidebarAccount />
          ) : (
            <div className="account-card">
              <p className="account-meta">Sign-in is not configured.</p>
            </div>
          )}
        </div>
      </aside>
      {open && (
        <button
          type="button"
          className="sidebar-scrim"
          aria-label="Close menu"
          onClick={() => setOpen(false)}
        />
      )}
    </>
  );
}
