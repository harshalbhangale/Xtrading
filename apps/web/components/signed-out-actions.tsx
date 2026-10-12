import Link from "next/link";

export function SignedOutActions() {
  return (
    <>
      <Link className="header-signin" href="/start">
        Sign in
      </Link>
      <Link className="xp-button xp-button-small" href="/start">
        Get started <span aria-hidden="true">↗</span>
      </Link>
    </>
  );
}
