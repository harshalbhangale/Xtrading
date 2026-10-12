import type { ReactNode } from "react";

// 20px line icons drawn on a 24px grid; colour follows currentColor.
const paths = {
  overview: (
    <>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="3.5" width="7" height="4.5" rx="1.5" />
      <rect x="13.5" y="11" width="7" height="9.5" rx="1.5" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
    </>
  ),
  trade: (
    <>
      <path d="M4 8h14l-3.5-3.5" />
      <path d="M20 16H6l3.5 3.5" />
    </>
  ),
  portfolio: (
    <>
      <path d="M12 3.5a8.5 8.5 0 1 0 8.5 8.5H12z" />
      <path d="M15 3.9A8.5 8.5 0 0 1 20.1 9H15z" />
    </>
  ),
  activity: <path d="M3 12h4l2.5-6 5 12 2.5-6h4" />,
  watchlist: (
    <>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
      <circle cx="12" cy="12" r="2.75" />
    </>
  ),
  creators: (
    <>
      <circle cx="9" cy="8.5" r="3.5" />
      <path d="M2.5 19.5c.8-3.3 3.3-5 6.5-5s5.7 1.7 6.5 5" />
      <path d="M15.5 5.2a3.5 3.5 0 0 1 0 6.6M18 14.8c1.7.7 2.9 2.3 3.5 4.7" />
    </>
  ),
  faucet: (
    <path d="M12 3.5s-6 6.4-6 10.7a6 6 0 0 0 12 0c0-4.3-6-10.7-6-10.7z" />
  ),
  identity: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <circle cx="9" cy="11" r="2.25" />
      <path d="M5.75 16c.6-1.6 1.7-2.4 3.25-2.4s2.65.8 3.25 2.4M15 10h3.5M15 13.5h2.5" />
    </>
  ),
  stake: (
    <>
      <rect x="4.5" y="10.5" width="15" height="10" rx="2" />
      <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
    </>
  ),
  calls: (
    <>
      <path d="M4 14.5V9.5l11-5v15z" />
      <path d="M15 8.5a3.5 3.5 0 0 1 0 7M7 15l1.5 5h3l-1.2-4" />
    </>
  ),
  reputation: <path d="M4 20V13M10 20V8M16 20v-9M22 20H2M20 4l-4 4-3-2-4 3" />,
  extension: (
    <path d="M9 4.5a2 2 0 0 1 4 0V6h4.5a1 1 0 0 1 1 1v4h-1.5a2 2 0 0 0 0 4h1.5v4a1 1 0 0 1-1 1H6.5a1 1 0 0 1-1-1v-4H7a2 2 0 0 0 0-4H5.5V7a1 1 0 0 1 1-1H9z" />
  ),
  agent: (
    <>
      <rect x="3" y="4.5" width="18" height="15" rx="2" />
      <path d="M7 10l3 2.5L7 15M12.5 15H17" />
    </>
  ),
  status: (
    <>
      <circle cx="12" cy="12" r="2" />
      <path d="M7.8 7.8a6 6 0 0 0 0 8.4M16.2 7.8a6 6 0 0 1 0 8.4M5 5a10 10 0 0 0 0 14M19 5a10 10 0 0 1 0 14" />
    </>
  ),
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  arrow: <path d="M7 17L17 7M9 7h8v8" />,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M20 20l-4.4-4.4" />
    </>
  ),
  copy: (
    <>
      <rect x="8.5" y="8.5" width="11.5" height="11.5" rx="2" />
      <path d="M15.5 8.5V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7.5a2 2 0 0 0 2 2h2.5" />
    </>
  ),
} satisfies Record<string, ReactNode>;

export type IconName = keyof typeof paths;

export function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  return (
    <svg
      className="icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {paths[name]}
    </svg>
  );
}
