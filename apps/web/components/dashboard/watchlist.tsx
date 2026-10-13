"use client";

import {
  normalizeHandle,
  type Watchlist as SavedWatchlist,
  watchlistLimit,
  watchlistSchema,
} from "@call-my-bluff/domain";
import Link from "next/link";
import { useEffect, useState } from "react";
import { EmptyState } from "./ui";

const storageKey = "cmb.watchlist.v1";
const bridgeTimeoutMs = 2500;

type Command =
  | { action: "read" }
  | { action: "add" | "remove"; handle: string };

/** Reads or changes the handles the Xtrading extension keeps for this browser. Rejects when it is not connected. */
function extensionWatchlist(command: Command): Promise<SavedWatchlist> {
  const nonce = crypto.randomUUID();
  return new Promise((resolve, reject) => {
    const onMessage = (event: MessageEvent) => {
      if (
        event.origin !== location.origin ||
        event.source !== window ||
        event.data?.type !== "tradepost-watchlist-response" ||
        event.data.nonce !== nonce
      )
        return;
      clearTimeout(timeout);
      window.removeEventListener("message", onMessage);
      const parsed = watchlistSchema.safeParse(event.data.value);
      if (parsed.success) resolve(parsed.data);
      else reject(new Error("Watchlist unavailable"));
    };
    const timeout = setTimeout(() => {
      window.removeEventListener("message", onMessage);
      reject(new Error("Extension not connected"));
    }, bridgeTimeoutMs);
    window.addEventListener("message", onMessage);
    window.postMessage(
      { type: "tradepost-watchlist-request", nonce, ...command },
      location.origin,
    );
  });
}

/** Browser-only fallback used when the extension is not connected. */
function readLocalHandles(): string[] {
  const stored: unknown = JSON.parse(localStorage.getItem(storageKey) ?? "[]");
  if (
    !Array.isArray(stored) ||
    stored.length > watchlistLimit ||
    !stored.every(
      (item) => typeof item === "string" && normalizeHandle(item) === item,
    )
  )
    throw new Error("Invalid watchlist");
  return [...new Set(stored as string[])];
}

type Source = "extension" | "browser";

export function Watchlist() {
  const [handles, setHandles] = useState<string[]>([]);
  const [source, setSource] = useState<Source | null>(null);
  const [input, setInput] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    extensionWatchlist({ action: "read" })
      .then((value) => {
        if (cancelled) return;
        setHandles(value.entries.map((entry) => entry.handle));
        setSource("extension");
      })
      .catch(() => {
        if (cancelled) return;
        try {
          setHandles(readLocalHandles());
        } catch {
          setMessage(
            "Saved handles could not be read. You can start a fresh local watchlist.",
          );
        }
        setSource("browser");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function save(handle: string) {
    if (source === "extension") {
      try {
        const value = await extensionWatchlist({ action: "add", handle });
        setHandles(value.entries.map((entry) => entry.handle));
        setMessage(`@${handle} saved to your watchlist.`);
        return true;
      } catch {
        setMessage(
          "Could not save to the Xtrading extension. It may be full (50 handles) or needs a reload.",
        );
        return false;
      }
    }
    return writeLocal(
      [...handles, handle],
      `@${handle} saved in this browser.`,
    );
  }

  async function remove(handle: string) {
    if (source === "extension") {
      try {
        const value = await extensionWatchlist({ action: "remove", handle });
        setHandles(value.entries.map((entry) => entry.handle));
        setMessage(`@${handle} removed from your watchlist.`);
      } catch {
        setMessage(
          "Could not update the Xtrading extension. Reload the extension and this dashboard.",
        );
      }
      return;
    }
    writeLocal(
      handles.filter((item) => item !== handle),
      `@${handle} removed from this browser.`,
    );
  }

  function writeLocal(next: string[], notice: string) {
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
      setHandles(next);
      setMessage(notice);
      return true;
    } catch {
      setMessage(
        "Browser storage is unavailable. Your changes were not saved.",
      );
      return false;
    }
  }

  const defaultNotice =
    source === "extension"
      ? "Synced with the Xtrading extension in this browser. No account sync or creator verification yet."
      : "Extension not connected, so handles are saved only in this browser. Install or reload the Xtrading extension to sync with X profiles.";

  return (
    <>
      <form
        className="watchlist-form"
        onSubmit={async (event) => {
          event.preventDefault();
          const handle = normalizeHandle(input.trim());
          if (!handle) {
            setMessage("Enter a valid X handle.");
            return;
          }
          if (handles.includes(handle)) {
            setMessage("That handle is already on your watchlist.");
            return;
          }
          if (handles.length >= watchlistLimit) {
            setMessage(`You can save up to ${watchlistLimit} handles.`);
            return;
          }
          if (await save(handle)) setInput("");
        }}
      >
        <label htmlFor="watchlist-handle">Add an X handle</label>
        <div className="input-action">
          <input
            id="watchlist-handle"
            placeholder="@handle"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            maxLength={16}
            autoComplete="off"
          />
          <button className="button" type="submit" disabled={!source}>
            Save handle +
          </button>
        </div>
      </form>
      <p className="form-message" role="status">
        {message || defaultNotice}
      </p>
      {!source ? (
        <p className="muted">Reading watchlist…</p>
      ) : handles.length === 0 ? (
        <EmptyState
          title="No saved handles."
          description="Saving a handle does not verify the account or copy its trades."
        />
      ) : (
        <div className="table-scroll">
          <table className="record-table">
            <caption className="sr-only">Saved creator handles</caption>
            <thead>
              <tr>
                <th scope="col">Creator handle</th>
                <th scope="col">Evidence</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {handles.map((handle) => (
                <tr key={handle}>
                  <td>
                    <Link
                      className="creator-handle"
                      href={`/creators/${handle}`}
                    >
                      @{handle}
                    </Link>
                    <small>Saved handle · identity not verified</small>
                  </td>
                  <td>
                    <span className="status-badge">Not fetched</span>
                  </td>
                  <td>
                    <div className="table-actions">
                      <Link className="text-link" href={`/creators/${handle}`}>
                        View record ↗
                      </Link>
                      <button
                        className="inline-button"
                        type="button"
                        aria-label={`Remove @${handle} from watchlist`}
                        onClick={() => remove(handle)}
                      >
                        Remove
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
