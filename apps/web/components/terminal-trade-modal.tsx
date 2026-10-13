"use client";
import dynamic from "next/dynamic";
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { TradeControl } from "./trade-control";

const PerpTrade = dynamic(() => import("./configured-perp-trade"), {
  ssr: false,
});
export default function TerminalTradeModal({
  href,
  onClose,
}: {
  href: string;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const params = new URL(href, "https://xtradingnow.xyz").searchParams;
  const perp = params.get("instrument") === "perp";
  params.set("chainId", perp ? "10143" : "143");
  params.delete("popup");
  useEffect(() => {
    const before = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.current?.focus();
    return () => {
      document.body.style.overflow = overflow;
      if (before instanceof HTMLElement) before.focus();
    };
  }, []);
  return createPortal(
    <div className="trade-modal-backdrop">
      <dialog
        open
        aria-modal="true"
        aria-label={perp ? "Perpl testnet trade" : "Kuru mainnet trade"}
        className="terminal-trade-dialog"
        ref={dialog}
        tabIndex={-1}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.stopPropagation();
            onClose();
          }
          if (e.key === "Tab") {
            const controls = dialog.current?.querySelectorAll<HTMLElement>(
              'button:not(:disabled),input:not(:disabled),select:not(:disabled),a[href],[tabindex="0"]',
            );
            if (!controls?.length) return;
            const first = controls[0],
              last = controls[controls.length - 1];
            if (e.shiftKey && document.activeElement === first) {
              e.preventDefault();
              last?.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
              e.preventDefault();
              first?.focus();
            }
          }
        }}
      >
        <header className="trade-modal-heading">
          <div>
            <h2>{perp ? "Perpl perpetuals" : "Kuru spot"}</h2>
            <p>
              {perp
                ? "Monad testnet · test AUSD"
                : "Monad mainnet · real funds"}
            </p>
          </div>
          <button
            type="button"
            className="icon-button"
            aria-label="Close trade"
            onClick={onClose}
          >
            ×
          </button>
        </header>
        {params.get("handle") && (
          <p>
            From @{params.get("handle")}
            {params.get("postId") && (
              <a
                className="text-link"
                href={`https://x.com/${params.get("handle")}/status/${params.get("postId")}`}
                target="_blank"
                rel="noreferrer"
              >
                {" "}
                · View post ↗
              </a>
            )}
          </p>
        )}
        {perp ? (
          <PerpTrade initialParams={params.toString()} />
        ) : (
          <TradeControl chainId={143} initialParams={params.toString()} />
        )}
      </dialog>
    </div>,
    document.body,
  );
}
