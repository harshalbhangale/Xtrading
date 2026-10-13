"use client";
import {
  bindingChallengeSchema,
  identityBindingSchema,
  identityStatusSchema,
} from "@call-my-bluff/domain";
import { usePrivy, useSignMessage, useWallets } from "@privy-io/react-auth";
import { useCallback, useEffect, useRef, useState } from "react";
import { toHex } from "viem";

type IdentityStatus = ReturnType<typeof identityStatusSchema.parse>;
type Challenge = ReturnType<typeof bindingChallengeSchema.parse>;
const errors: Record<string, string> = {
  x_account_required: "Link your X account before preparing a wallet proof.",
  invalid_session: "Your session could not be verified. Sign in again.",
  authentication_required: "Sign in before verifying ownership.",
  wallet_not_linked: "Select a wallet linked to your current Privy account.",
  challenge_rate_limited:
    "Wait before requesting another proof. Proof requests are limited.",
  binding_conflict:
    "This account or wallet already has a different binding. Recovery needs a separate review.",
  challenge_expired_or_used:
    "This proof expired or was used. Prepare a new proof.",
  identity_changed:
    "Your linked account or wallet changed. Prepare a new proof.",
  invalid_wallet_proof: "The signature did not match the selected wallet.",
  origin_not_allowed:
    "Open the app at its configured URL before verifying ownership.",
};
export default function ConfiguredIdentity() {
  const { ready, authenticated, user, login, linkTwitter, getAccessToken } =
    usePrivy();
  const activeUser = useRef(user?.id);
  activeUser.current = user?.id;
  const { wallets } = useWallets();
  const { signMessage } = useSignMessage();
  const [status, setStatus] = useState<IdentityStatus | null>(null);
  const [selected, setSelected] = useState("");
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const request = useCallback(
    async (path: string, body?: unknown) => {
      const token = await getAccessToken();
      if (!token) throw new Error("Sign in before verifying ownership.");
      const response = await fetch(path, {
        method: body ? "POST" : "GET",
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${token}`,
          ...(body ? { "Content-Type": "application/json" } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      const result: unknown = await response.json();
      if (!response.ok) {
        const code =
          typeof result === "object" &&
          result &&
          "error" in result &&
          typeof result.error === "string"
            ? result.error
            : "";
        throw new Error(
          errors[code] ??
            "Identity verification is temporarily unavailable. Try again later.",
        );
      }
      return result;
    },
    [getAccessToken],
  );
  // biome-ignore lint/correctness/useExhaustiveDependencies: Server identity must refresh when linked accounts change or the user requests refresh.
  useEffect(() => {
    let cancelled = false;
    setStatus(null);
    setChallenge(null);
    setError("");
    if (ready && authenticated) {
      void request("/api/identity")
        .then((result) => {
          if (!cancelled) setStatus(identityStatusSchema.parse(result));
        })
        .catch(() => {
          if (!cancelled)
            setError("Could not load verified identity. Retry the check.");
        });
    }
    return () => {
      cancelled = true;
    };
  }, [
    ready,
    authenticated,
    user?.id,
    user?.twitter?.subject,
    refresh,
    request,
  ]);
  async function prepare() {
    const owner = activeUser.current;
    setBusy(true);
    setError("");
    setChallenge(null);
    try {
      const proof = bindingChallengeSchema.parse(
        await request("/api/identity/challenge", { wallet: selected }),
      );
      if (activeUser.current === owner) setChallenge(proof);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not prepare proof.");
    } finally {
      setBusy(false);
    }
  }
  async function bind() {
    const owner = activeUser.current;
    if (!challenge) return;
    const wallet = wallets.find(
      (w) => w.address.toLowerCase() === challenge.wallet.toLowerCase(),
    );
    if (!wallet) {
      setError(
        "Selected wallet is unavailable. Reconnect and prepare a new proof.",
      );
      return;
    }
    setBusy(true);
    setError("");
    try {
      if (Date.parse(challenge.expiresAt) <= Date.now())
        throw new Error("Proof expired. Prepare a new proof.");
      const signature =
        wallet.walletClientType === "privy"
          ? (
              await signMessage(
                { message: challenge.message },
                { address: wallet.address },
              )
            ).signature
          : await (await wallet.getEthereumProvider()).request({
              method: "personal_sign",
              params: [toHex(challenge.message), wallet.address],
            });
      const binding = identityBindingSchema.parse(
        await request("/api/identity/bind", {
          challengeId: challenge.challengeId,
          signature,
        }),
      );
      if (activeUser.current !== owner) return;
      setStatus({
        xAccount: { xUserId: binding.xUserId, handle: binding.handle },
        binding,
        bindingCurrent: true,
      });
      setChallenge(null);
    } catch {
      setError(
        "The proof was not completed. If you rejected signing, prepare a new proof when ready; otherwise refresh identity and retry.",
      );
    } finally {
      setBusy(false);
    }
  }
  if (!ready) return <p className="small-note">Loading account connection…</p>;
  if (!authenticated)
    return (
      <>
        <p>Sign in to link your X account and prove wallet ownership.</p>
        <button type="button" className="button" onClick={login}>
          Sign in with Privy ↗
        </button>
      </>
    );
  return (
    <div className="identity-binding">
      <p className="small-note">
        X account:{" "}
        {status?.xAccount
          ? `@${status.xAccount.handle}`
          : "Not verified by server"}
      </p>
      <p className="small-note">
        Wallet binding:{" "}
        {status?.bindingCurrent
          ? "Ownership verified"
          : "Not currently verified"}
      </p>
      {status?.bindingCurrent && status.binding && (
        <p className="small-note">
          {status.binding.wallet}
          <br />
          Linked {new Date(status.binding.linkedAt).toLocaleString()}
        </p>
      )}
      <p className="small-note">
        Identity proof does not establish reputation or profitable advice.
      </p>
      {!user?.twitter && (
        <button
          className="button secondary-button"
          type="button"
          onClick={linkTwitter}
          disabled={busy}
        >
          Link X account ↗
        </button>
      )}
      <label htmlFor="identity-wallet">Wallet to bind</label>
      <select
        id="identity-wallet"
        value={selected}
        disabled={busy}
        onChange={(e) => {
          setSelected(e.target.value);
          setChallenge(null);
        }}
      >
        <option value="">Choose a connected EVM wallet</option>
        {wallets.map((w) => (
          <option key={w.address} value={w.address}>
            {w.address}
          </option>
        ))}
      </select>
      <button
        className="button secondary-button"
        type="button"
        disabled={busy || !selected || !status?.xAccount}
        onClick={() => void prepare()}
      >
        Prepare ownership proof
      </button>
      {challenge && (
        <div>
          <p className="small-note">
            Review this message. Signing proves ownership and does not move
            funds. Expires {new Date(challenge.expiresAt).toLocaleTimeString()}.
          </p>
          <pre className="ownership-message">{challenge.message}</pre>
          <button
            className="button"
            type="button"
            disabled={busy}
            onClick={() => void bind()}
          >
            {busy ? "Waiting for approval…" : "Sign and bind wallet"}
          </button>
        </div>
      )}
      <button
        className="text-link"
        type="button"
        disabled={busy}
        onClick={() => setRefresh((v) => v + 1)}
      >
        Refresh verified identity
      </button>
      {error && (
        <p role="alert" className="small-note">
          {error}
        </p>
      )}
    </div>
  );
}
