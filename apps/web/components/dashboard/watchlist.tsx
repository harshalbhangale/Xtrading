"use client";

import { normalizeHandle } from "@call-my-bluff/domain";
import Link from "next/link";
import { useEffect, useState } from "react";
import { EmptyState } from "./ui";

const storageKey = "cmb.watchlist.v1";

export function Watchlist() {
  const [handles, setHandles] = useState<string[]>([]);
  const [input, setInput] = useState("");
  const [message, setMessage] = useState("");
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    try {
      const stored: unknown = JSON.parse(
        localStorage.getItem(storageKey) ?? "[]",
      );
      if (
        !Array.isArray(stored) ||
        stored.length > 50 ||
        !stored.every(
          (item) => typeof item === "string" && normalizeHandle(item) === item,
        )
      )
        throw new Error("Invalid watchlist");
      setHandles([...new Set(stored as string[])]);
    } catch {
      setMessage(
        "Saved handles could not be read. You can start a fresh local watchlist.",
      );
    }
    setLoaded(true);
  }, []);
  function save(next: string[], notice: string) {
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
  return (
    <>
      <form
        className="watchlist-form"
        onSubmit={(event) => {
          event.preventDefault();
          const handle = normalizeHandle(input.trim());
          if (!handle) {
            setMessage("Enter a valid X handle.");
            return;
          }
          if (handles.includes(handle)) {
            setMessage("That handle is already on your local watchlist.");
            return;
          }
          if (handles.length >= 50) {
            setMessage("You can save up to 50 handles in this browser.");
            return;
          }
          if (save([...handles, handle], `@${handle} saved in this browser.`))
            setInput("");
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
          <button className="button" type="submit" disabled={!loaded}>
            Save handle +
          </button>
        </div>
      </form>
      <p className="form-message" role="status">
        {message ||
          "Saved on this browser only. No account sync or creator verification yet."}
      </p>
      {!loaded ? (
        <p className="muted">Reading local watchlist…</p>
      ) : handles.length === 0 ? (
        <EmptyState
          title="No saved handles."
          description="Saving a handle does not verify the account or copy its trades."
        />
      ) : (
        <div className="table-scroll">
          <table className="record-table">
            <caption className="sr-only">Handles saved in this browser</caption>
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
                        onClick={() =>
                          save(
                            handles.filter((item) => item !== handle),
                            `@${handle} removed from this browser.`,
                          )
                        }
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
