"use client";
import Image from "next/image";
import { useState } from "react";
import TerminalTradeModal from "./terminal-trade-modal";

/** Opens spot and perp trading in a pop-up over the Terminal. */
export function TradeOnMonadButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className="term-trade-cta"
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        <Image src="/brand/monad.png" alt="" width={32} height={32} />
        <span>
          <strong>Trade on Monad</strong>
          <small>Kuru spot · Perpl perps</small>
        </span>
        <i aria-hidden="true">↗</i>
      </button>
      {open && (
        <TerminalTradeModal
          href="/dashboard/trade?market=MON&instrument=spot"
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
