"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function Navigation() {
  const path = usePathname();
  return (
    <nav aria-label="Main navigation">
      {[
        ["/", "Terminal"],
        ["/creators", "Creators"],
        ["/portfolio", "Portfolio"],
      ].map(([href, label]) => (
        <Link
          key={href}
          href={href ?? "/"}
          aria-current={
            path === href || (href !== "/" && path.startsWith(href ?? "/"))
              ? "page"
              : undefined
          }
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}
