"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { isChromeless } from "./app-routes";
import { Brand } from "./brand";
import { SignedOutActions } from "./signed-out-actions";

type MenuItem = readonly [href: string, title: string, detail: string];

const menus: readonly { label: string; items: readonly MenuItem[] }[] = [
  {
    label: "Our solutions",
    items: [
      ["/how-it-works", "How it works", "From a post to a confirmed trade"],
      [
        "/for-creators",
        "For creators",
        "Register calls and build a verifiable record",
      ],
      ["/methodology", "Methodology", "How calls are evaluated and scored"],
    ],
  },
  {
    label: "Our products",
    items: [
      ["/creators", "Creators", "Browse creator records and call history"],
      ["/extension", "Extension", "Capture posts and follow activity on X"],
      ["/setup", "System status", "Network and service health"],
    ],
  },
];

const ConfiguredActions = dynamic(() => import("./configured-header-actions"), {
  ssr: false,
  loading: SignedOutActions,
});

function NavMenu({
  label,
  items,
  path,
}: {
  label: string;
  items: readonly MenuItem[];
  path: string | null;
}) {
  const ref = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      const node = ref.current;
      if (node?.open && !node.contains(event.target as Node)) node.open = false;
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && ref.current) ref.current.open = false;
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  const active = items.some(([href]) => href === path);
  return (
    <details ref={ref} className="nav-menu" data-active={active || undefined}>
      <summary>{label}</summary>
      <div className="nav-menu-panel">
        {items.map(([href, title, detail]) => (
          <Link
            key={href}
            href={href}
            aria-current={path === href ? "page" : undefined}
            onClick={() => {
              if (ref.current) ref.current.open = false;
            }}
          >
            <strong>{title}</strong>
            <span>{detail}</span>
          </Link>
        ))}
      </div>
    </details>
  );
}

export function SiteHeader({ testnet }: { testnet: boolean }) {
  const path = usePathname();
  if (isChromeless(path)) return null;
  return (
    <header className="topbar xp-header">
      <Link href="/" className="wordmark" aria-label="Xtrading home">
        <Brand />
      </Link>
      <nav aria-label="Main navigation">
        {menus.map((menu) => (
          <NavMenu key={menu.label} {...menu} path={path} />
        ))}
      </nav>
      <div className="header-actions">
        <span className="network">
          <i />
          Monad {testnet ? "testnet" : "mainnet"}
        </span>
        {process.env.NEXT_PUBLIC_PRIVY_APP_ID ? (
          <ConfiguredActions />
        ) : (
          <SignedOutActions />
        )}
      </div>
    </header>
  );
}
