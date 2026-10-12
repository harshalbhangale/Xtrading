import Image from "next/image";

export function Brand() {
  return (
    <span className="brand">
      <Image
        className="brand-logo"
        src="/brand/xtrading-logo.png"
        alt="Xtrading"
        width={2172}
        height={724}
        priority
      />
    </span>
  );
}
