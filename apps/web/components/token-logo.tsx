import Image from "next/image";

/** Token marks drawn inline; MON uses the Monad brand asset. */
export function TokenLogo({
  symbol,
  size = 36,
}: {
  symbol: string;
  size?: number;
}) {
  if (symbol === "MON")
    return (
      <Image
        className="token-logo"
        src="/brand/monad.png"
        alt=""
        width={size}
        height={size}
      />
    );
  const svg = (children: React.ReactNode) => (
    <svg
      className="token-logo"
      width={size}
      height={size}
      viewBox="0 0 32 32"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
  if (symbol === "USDC")
    return svg(
      <>
        <circle cx="16" cy="16" r="16" fill="#2775ca" />
        <path
          fill="#fff"
          d="M20.1 18.2c0-2.2-1.3-2.9-3.9-3.2-1.9-.3-2.2-.8-2.2-1.6s.6-1.4 1.8-1.4c1.1 0 1.7.4 2 1.3.1.2.2.3.4.3h1c.2 0 .4-.2.4-.4v-.1c-.3-1.3-1.3-2.3-2.7-2.5V9c0-.2-.2-.4-.5-.4h-.9c-.2 0-.4.2-.4.5v1.5c-1.8.2-3 1.4-3 2.9 0 2.1 1.3 2.9 3.9 3.2 1.7.3 2.3.7 2.3 1.7s-.9 1.6-2 1.6c-1.6 0-2.1-.7-2.3-1.5-.1-.2-.2-.3-.4-.3h-1c-.2 0-.4.2-.4.4v.1c.3 1.5 1.2 2.5 3.2 2.8V23c0 .2.2.4.5.4h.9c.2 0 .4-.2.4-.5v-1.5c1.8-.3 3-1.5 3-3.2Z"
        />
        <path
          fill="#fff"
          d="M13 24.4c-4.7-1.7-7.1-6.9-5.4-11.6.9-2.5 2.9-4.5 5.4-5.4.2-.1.4-.3.4-.6v-.8c0-.2-.1-.4-.4-.4h-.1C7.3 7.4 4.3 13.4 6 18.9c1 3.2 3.5 5.7 6.8 6.8.2.1.5 0 .5-.2.1-.1.1-.1.1-.2v-.8c0-.2-.2-.4-.4-.5Zm6.1-18.6c-.2-.1-.5 0-.5.2-.1.1-.1.1-.1.2v.8c0 .2.2.5.4.6 4.7 1.7 7.1 6.9 5.4 11.6-.9 2.5-2.9 4.5-5.4 5.4-.2.1-.4.3-.4.6v.8c0 .2.1.4.4.4h.1c5.5-1.7 8.5-7.6 6.8-13.1-1-3.3-3.6-5.8-6.7-6.9Z"
        />
      </>,
    );
  if (symbol === "WETH" || symbol === "ETH")
    return svg(
      <>
        <circle cx="16" cy="16" r="16" fill="#627eea" />
        <path fill="#fff" fillOpacity=".6" d="M16.5 4v8.9l7.5 3.3z" />
        <path fill="#fff" d="M16.5 4 9 16.2l7.5-3.3z" />
        <path fill="#fff" fillOpacity=".6" d="M16.5 22v6l7.5-10.4z" />
        <path fill="#fff" d="M16.5 28v-6L9 17.6z" />
        <path fill="#fff" fillOpacity=".2" d="m16.5 20.6 7.5-4.4-7.5-3.3z" />
        <path fill="#fff" fillOpacity=".6" d="m9 16.2 7.5 4.4v-7.7z" />
      </>,
    );
  if (symbol === "cbBTC" || symbol === "WBTC" || symbol === "BTC")
    return svg(
      <>
        <circle
          cx="16"
          cy="16"
          r="16"
          fill={symbol === "cbBTC" ? "#0052ff" : "#f7931a"}
        />
        <path
          fill="#fff"
          d="M22.6 14c.3-2.1-1.3-3.2-3.4-4l.7-2.8-1.7-.4-.7 2.7-1.4-.3.7-2.7-1.7-.4-.7 2.8-1.1-.3-2.4-.6-.4 1.8s1.3.3 1.2.3c.7.2.8.6.8 1l-.8 3.2.2.1-.2-.1-1.1 4.5c-.1.2-.3.5-.8.4 0 0-1.2-.3-1.2-.3l-.8 1.9 2.2.6 1.2.3-.7 2.8 1.7.4.7-2.8 1.4.4-.7 2.8 1.7.4.7-2.8c2.9.5 5.1.3 6-2.3.7-2.1 0-3.3-1.5-4.1 1.1-.3 1.9-1 2.2-2.5Zm-3.9 5.4c-.5 2.1-4.1 1-5.3.7l.9-3.7c1.2.3 4.9.9 4.4 3Zm.5-5.5c-.5 1.9-3.5.9-4.4.7l.9-3.4c1 .2 4.1.7 3.5 2.7Z"
        />
      </>,
    );
  return svg(
    <>
      <circle cx="16" cy="16" r="16" fill="#2c3830" />
      <text
        x="16"
        y="21"
        textAnchor="middle"
        fontSize="14"
        fontWeight="700"
        fill="#fff"
      >
        {symbol.slice(0, 1)}
      </text>
    </>,
  );
}
