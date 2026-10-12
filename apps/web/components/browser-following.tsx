"use client";
import {
  type BrowserFollowing,
  browserFollowingSchema,
  identityStatusSchema,
} from "@call-my-bluff/domain";
import { usePrivy } from "@privy-io/react-auth";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

async function bridge(
  viewer: string,
  enabled?: boolean,
): Promise<BrowserFollowing> {
  const nonce = crypto.randomUUID();
  return new Promise((resolve, reject) => {
    const onMessage = (event: MessageEvent) => {
      if (
        event.origin !== location.origin ||
        event.source !== window ||
        event.data?.type !== "tradepost-follow-response" ||
        event.data.nonce !== nonce
      )
        return;
      clearTimeout(timeout);
      window.removeEventListener("message", onMessage);
      const parsed = browserFollowingSchema.safeParse(event.data.value);
      if (parsed.success && parsed.data.viewerHandle === viewer)
        resolve(parsed.data);
      else reject(new Error("Following data unavailable"));
    };
    const timeout = setTimeout(() => {
      window.removeEventListener("message", onMessage);
      reject(
        new Error(
          "Reload the Xtrading extension and this dashboard to connect browser sync.",
        ),
      );
    }, 2500);
    window.addEventListener("message", onMessage);
    window.postMessage(
      {
        type: "tradepost-follow-request",
        nonce,
        viewer,
        action: enabled === undefined ? "read" : "configure",
        enabled,
      },
      location.origin,
    );
  });
}

export default function BrowserFollowingView() {
  const { ready, authenticated, user, login, getAccessToken } = usePrivy();
  const [viewer, setViewer] = useState<string | null>(null);
  const [data, setData] = useState<BrowserFollowing | null>(null);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const generation = useRef(0);
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | undefined;
    const controller = new AbortController();
    setViewer(null);
    setData(null);
    setNotice("");
    setBusy(false);
    if (ready && authenticated && user?.id) {
      void (async () => {
        const token = await getAccessToken();
        const response = await fetch("/api/identity", {
          cache: "no-store",
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });
        if (!response.ok)
          throw new Error("Could not verify your X login. Sign in again.");
        const identity = identityStatusSchema.parse(await response.json());
        const owner = identity.xAccount?.handle;
        if (!owner)
          throw new Error(
            "Link an X account to enable browser following sync.",
          );
        if (cancelled) return;
        setViewer(owner);
        const refresh = async () => {
          try {
            const value = await bridge(owner);
            if (!cancelled) {
              setData(value);
              setNotice("");
            }
          } catch (error) {
            if (!cancelled) {
              setData(null);
              setNotice(
                error instanceof Error
                  ? error.message
                  : "Browser sync unavailable.",
              );
            }
          }
        };
        await refresh();
        if (!cancelled)
          timer = setInterval(() => {
            if (document.visibilityState === "visible") void refresh();
          }, 15000);
      })().catch((error) => {
        if (!cancelled)
          setNotice(
            error instanceof Error
              ? error.message
              : "Browser sync unavailable.",
          );
      });
    }
    return () => {
      generation.current++;
      cancelled = true;
      controller.abort();
      clearInterval(timer);
    };
  }, [ready, authenticated, user?.id, getAccessToken]);

  async function configure(enabled: boolean) {
    if (!viewer) return;
    const started = generation.current;
    setBusy(true);
    try {
      const value = await bridge(viewer, enabled);
      if (started !== generation.current) return;
      setData(value);
      setNotice(
        enabled
          ? "Enabled. View profiles or your following list on X; observed accounts will appear here."
          : "Disabled and cleared for this browser account.",
      );
    } catch {
      if (started !== generation.current) return;
      setNotice(
        "Could not update browser sync. Reload the extension and dashboard.",
      );
    } finally {
      if (started === generation.current) setBusy(false);
    }
  }
  if (!ready) return <p>Loading sign-in…</p>;
  if (!authenticated)
    return (
      <button type="button" className="button" onClick={login}>
        Sign in to connect browser follows
      </button>
    );
  return (
    <div>
      <p className="small-note">
        No paid X API. With your permission, the extension saves Following
        states on profiles and your own following list that you view. This is a
        partial record in this browser, keyed by handle; it is not a complete or
        verified following graph. It does not copy trades.
      </p>
      <p className="form-message" role="status">
        {notice || (viewer ? `X login: @${viewer}` : "Checking your X login…")}
      </p>
      {data && (
        <>
          <button
            type="button"
            className="button"
            disabled={busy}
            onClick={() => void configure(!data.enabled)}
          >
            {busy
              ? "Updating…"
              : data.enabled
                ? "Disable sync & clear observations"
                : "Enable viewed-follow sync"}
          </button>
          {data.enabled && (
            <>
              <p className="small-note">
                Updates every 15 seconds while this dashboard is visible. Only
                observations for @{data.viewerHandle} are shown. Existing
                follows appear as you view them; unobserved unfollows and
                changes on other devices are not synced.
              </p>
              <a
                className="text-link"
                href={`https://x.com/${data.viewerHandle}/following`}
                target="_blank"
                rel="noopener noreferrer"
              >
                View my X following list ↗
              </a>
              {data.follows.length === 0 ? (
                <p>No following states observed yet.</p>
              ) : (
                <div className="table-scroll">
                  <table className="record-table">
                    <thead>
                      <tr>
                        <th scope="col">Account</th>
                        <th scope="col">Last observed following</th>
                        <th scope="col">Evidence</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.follows.map((entry) => (
                        <tr key={entry.handle}>
                          <td>
                            <Link
                              className="text-link"
                              href={`/creators/${entry.handle}`}
                            >
                              @{entry.handle}
                            </Link>
                          </td>
                          <td>{entry.observedAt.replace("T", " ")}</td>
                          <td>Not fetched · open creator record</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
