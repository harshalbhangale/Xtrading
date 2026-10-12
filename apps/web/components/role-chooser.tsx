"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { RoleCards, roles } from "./role-cards";

function DirectChooser({ note }: { note?: string }) {
  return (
    <>
      <RoleCards
        action={(role) => (
          <Link className="button" href={roles[role].href}>
            {roles[role].cta} <span aria-hidden="true">→</span>
          </Link>
        )}
      />
      {note && <p className="start-error">{note}</p>}
    </>
  );
}

const ConfiguredChooser = dynamic(() => import("./configured-role-chooser"), {
  ssr: false,
  loading: () => <DirectChooser />,
});

export function RoleChooser() {
  return process.env.NEXT_PUBLIC_PRIVY_APP_ID ? (
    <ConfiguredChooser />
  ) : (
    <DirectChooser note="Sign-in is not configured on this deployment. Public pages still work; signing and personal data are unavailable." />
  );
}
