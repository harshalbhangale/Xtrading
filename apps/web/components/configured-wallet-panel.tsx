"use client";

import { fromUnits, toUnits } from "@call-my-bluff/domain";
import {
  transferReviewSchema,
  walletBalancesSchema,
} from "@call-my-bluff/integrations/wallet";
import { useCreateWallet, usePrivy, useWallets } from "@privy-io/react-auth";
import QRCode from "qrcode";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  createPublicClient,
  formatUnits,
  getAddress,
  http,
  isAddress,
  zeroAddress,
} from "viem";
import { monad, monadTestnet } from "viem/chains";
import { useWalletSend } from "./use-wallet-send";

type Balances = ReturnType<typeof walletBalancesSchema.parse>;
type Review = ReturnType<typeof transferReviewSchema.parse>;
type ChainId = 10143 | 143;

const networks = {
  10143: {
    name: "Monad testnet",
    explorer: "https://testnet.monadvision.com",
    chain: monadTestnet,
  },
  143: {
    name: "Monad mainnet",
    explorer: "https://monadvision.com",
    chain: monad,
  },
} as const;
const errors: Record<string, string> = {
  insufficient_balance: "Not enough of this token in the wallet.",
  insufficient_gas_balance: "Not enough MON left to pay gas.",
  transfer_simulation_failed:
    "The transfer would fail onchain. Nothing was sent.",
  recipient_is_sender: "That is this wallet's own address.",
  recipient_is_token_contract:
    "That is the token's contract address. Tokens sent there are usually lost.",
  invalid_recipient: "Enter a valid recipient address.",
  wallet_not_owned: "That wallet is not linked to your account.",
  wallet_required: "Create or link a wallet first.",
  mainnet_trading_disabled: "Mainnet is switched off on this server.",
  rpc_unconfigured: "The chain connection is not configured on this server.",
};
// The wallet works on Monad mainnet only.
const chainId: ChainId = 143;
const short = (value: string) => `${value.slice(0, 6)}…${value.slice(-4)}`;
const tokenInfo: Record<string, { name: string; color: string }> = {
  MON: { name: "Monad", color: "#836ef9" },
  USDC: { name: "USD Coin", color: "#2775ca" },
  WETH: { name: "Wrapped Ether", color: "#627eea" },
  WBTC: { name: "Wrapped Bitcoin", color: "#f7931a" },
  cbBTC: { name: "Coinbase Wrapped BTC", color: "#0052ff" },
};
/** Token units for display: at most six decimals, cut (never rounded up). */
function amountText(value: string, decimals: number) {
  const units = BigInt(value);
  const [whole = "0", fraction = ""] = formatUnits(units, decimals).split(".");
  const cut = fraction.slice(0, 6).replace(/0+$/, "");
  if (units > 0n && whole === "0" && !cut) return "<0.000001";
  return cut ? `${whole}.${cut}` : whole;
}

/**
 * The signed-in user's own wallet: receive by QR code, send to any address.
 * Balances are read from chain; every send is prepared, reviewed, then signed
 * by the user's wallet. Testnet is the default and mainnet is opt-in.
 */
export default function ConfiguredWalletPanel() {
  const { ready, authenticated, login, getAccessToken, user } = usePrivy();
  const { wallets, ready: walletsReady } = useWallets();
  const { createWallet } = useCreateWallet();
  const { sendTransaction } = useWalletSend();
  const [selected, setSelected] = useState<string>("");
  const [balances, setBalances] = useState<Balances | null>(null);
  const [loadError, setLoadError] = useState("");
  const [qr, setQr] = useState("");
  const [copied, setCopied] = useState(false);
  const [tab, setTab] = useState<"receive" | "send">("receive");
  const [token, setToken] = useState("MON");
  const [amount, setAmount] = useState("");
  const [recipient, setRecipient] = useState("");
  const [review, setReview] = useState<Review | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [hash, setHash] = useState<`0x${string}` | null>(null);
  const [now, setNow] = useState(Date.now());
  const owner = useRef(user?.id);
  owner.current = user?.id;

  const embedded = wallets.find((w) => w.walletClientType === "privy");
  const address =
    wallets.find((w) => w.address.toLowerCase() === selected.toLowerCase())
      ?.address ??
    embedded?.address ??
    wallets[0]?.address;
  const network = networks[chainId];

  const api = useCallback(
    async (path: string, body?: unknown) => {
      const accessToken = await getAccessToken();
      if (!accessToken) throw new Error("Session expired. Sign in again.");
      const response = await fetch(path, {
        method: body ? "POST" : "GET",
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          ...(body ? { "Content-Type": "application/json" } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      const value: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const code =
          typeof value === "object" &&
          value &&
          "error" in value &&
          typeof value.error === "string"
            ? value.error
            : "";
        throw new Error(
          errors[code] ??
            (code.replaceAll("_", " ") || "Wallet service unavailable."),
        );
      }
      return value;
    },
    [getAccessToken],
  );

  const loadBalances = useCallback(async () => {
    if (!address) return;
    setLoadError("");
    try {
      const result = walletBalancesSchema.parse(
        await api(`/api/wallet/balances?chainId=${chainId}&address=${address}`),
      );
      if (result.wallet.toLowerCase() !== address.toLowerCase()) return;
      setBalances(result);
    } catch (error) {
      setBalances(null);
      setLoadError(
        error instanceof Error ? error.message : "Balances unavailable.",
      );
    }
  }, [api, address]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: Reload when the account, wallet or network changes.
  useEffect(() => {
    if (!ready || !authenticated || !address) return;
    setBalances(null);
    setReview(null);
    void loadBalances();
  }, [ready, authenticated, address, user?.id]);

  useEffect(() => {
    if (!address) return setQr("");
    let cancelled = false;
    // Plain checksummed address: every wallet and exchange app can scan it.
    void QRCode.toDataURL(getAddress(address), {
      margin: 1,
      width: 176,
      errorCorrectionLevel: "M",
    }).then((url) => {
      if (!cancelled) setQr(url);
    });
    return () => {
      cancelled = true;
    };
  }, [address]);

  useEffect(() => {
    if (!review) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [review]);

  const selectedToken = balances?.balances.find(
    (b) => b.token.symbol === token,
  );
  const units = selectedToken
    ? amount.trim()
      ? toUnits(amount, selectedToken.token.decimals)
      : null
    : null;
  const recipientValid = isAddress(recipient.trim(), { strict: false });

  function intent() {
    if (!address || !selectedToken)
      throw new Error("Balances are still loading.");
    if (!recipientValid) throw new Error("Enter a valid recipient address.");
    if (units === null || units <= 0n) throw new Error("Enter a valid amount.");
    return {
      chainId,
      from: address,
      to: getAddress(recipient.trim()),
      token,
      amount: units.toString(),
    };
  }
  async function prepare(body: ReturnType<typeof intent>) {
    const result = transferReviewSchema.parse(
      await api("/api/wallet/transfer", body),
    );
    const expected =
      result.token.address === zeroAddress
        ? result.recipient
        : result.token.address;
    if (
      result.chainId !== body.chainId ||
      result.wallet.toLowerCase() !== body.from.toLowerCase() ||
      result.recipient.toLowerCase() !== body.to.toLowerCase() ||
      result.to.toLowerCase() !== expected.toLowerCase() ||
      result.amount !== body.amount
    )
      throw new Error("Unexpected transfer details. Nothing was sent.");
    return result;
  }
  async function run(task: () => Promise<void>) {
    const who = owner.current;
    setBusy(true);
    setNotice("");
    try {
      await task();
    } catch (error) {
      if (owner.current === who) {
        setReview(null);
        setNotice(error instanceof Error ? error.message : "Request failed.");
      }
    } finally {
      if (owner.current === who) setBusy(false);
    }
  }
  const startReview = () =>
    run(async () => {
      setHash(null);
      setReview(await prepare(intent()));
    });
  const confirm = () =>
    run(async () => {
      const previous = review;
      if (!previous || Date.parse(previous.expiresAt) <= Date.now()) {
        setReview(null);
        throw new Error("Review expired. Review the transfer again.");
      }
      const who = owner.current;
      const current = await prepare({
        chainId: previous.chainId,
        from: previous.wallet,
        to: getAddress(previous.recipient),
        token: previous.token.symbol,
        amount: previous.amount,
      });
      if (
        current.to !== previous.to ||
        current.data !== previous.data ||
        current.value !== previous.value
      ) {
        setReview(current);
        setNotice("The transfer changed. Check the updated values.");
        return;
      }
      if (owner.current !== who) return;
      setReview(null);
      const sent = await sendTransaction(
        {
          chainId: current.chainId,
          to: current.to,
          data: current.data as `0x${string}`,
          value: BigInt(current.value),
          gasLimit: (BigInt(current.gas) * 120n) / 100n,
        },
        { address: current.wallet, uiOptions: { showWalletUIs: true } },
      );
      setHash(sent.hash);
      setNotice("Submitted. Waiting for confirmation…");
      const receipt = await createPublicClient({
        chain: networks[current.chainId].chain,
        transport: http(),
      }).waitForTransactionReceipt({
        hash: sent.hash,
        confirmations: 2,
        timeout: 120000,
      });
      if (owner.current !== who) return;
      if (receipt.status !== "success")
        throw new Error("Transaction reverted. Nothing was sent.");
      setAmount("");
      setNotice(
        `Sent ${formatUnits(BigInt(current.amount), current.token.decimals)} ${current.token.symbol} to ${short(current.recipient)} in block ${receipt.blockNumber}.`,
      );
      await loadBalances();
    });

  async function copy() {
    if (!address) return;
    try {
      await navigator.clipboard.writeText(getAddress(address));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  if (!ready || !walletsReady)
    return <p className="small-note">Loading wallet…</p>;
  if (!authenticated)
    return (
      <div className="wlt-empty">
        <p>Sign in to see your balances, deposit by QR code and send funds.</p>
        <button type="button" className="button" onClick={() => login()}>
          Sign in
        </button>
      </div>
    );
  if (!address)
    return (
      <div className="wlt-empty">
        <p>No wallet is linked to this account yet.</p>
        <button
          type="button"
          className="button"
          disabled={busy}
          onClick={() =>
            run(async () => {
              await createWallet();
            })
          }
        >
          Create a wallet
        </button>
        {notice && <p className="wlt-notice">{notice}</p>}
      </div>
    );

  const checksummed = getAddress(address);
  const current = wallets.find(
    (w) => w.address.toLowerCase() === address.toLowerCase(),
  );
  const secondsLeft = review
    ? Math.max(0, Math.ceil((Date.parse(review.expiresAt) - now) / 1000))
    : 0;
  const tokenBadge = (symbol: string) => (
    <span
      className="wlt-token-icon"
      aria-hidden="true"
      style={{ background: tokenInfo[symbol]?.color ?? "var(--raised)" }}
    >
      {symbol.replace(/^cb/, "").slice(0, 1)}
    </span>
  );
  return (
    <div className="wlt">
      <header className="wlt-head">
        <div className="wlt-id">
          <span className="wlt-avatar" aria-hidden="true" />
          <div>
            <strong>{short(checksummed)}</strong>
            <small>
              {current?.walletClientType === "privy"
                ? "Privy wallet"
                : (current?.walletClientType ?? "Wallet")}
            </small>
          </div>
          <button
            type="button"
            className="wlt-icon-button"
            onClick={() => void copy()}
            aria-label="Copy wallet address"
            title="Copy address"
          >
            {copied ? "✓" : "⧉"}
          </button>
          <a
            className="wlt-icon-button"
            href={`${network.explorer}/address/${checksummed}`}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Open in block explorer"
            title="Open in explorer"
          >
            ↗
          </a>
        </div>
        <span className="wlt-chip">
          <i aria-hidden="true" /> {network.name}
        </span>
      </header>

      {wallets.length > 1 && (
        <label className="wlt-field wlt-switch">
          <span>Wallet</span>
          <select
            value={address}
            disabled={busy}
            onChange={(event) => setSelected(event.target.value)}
          >
            {wallets.map((w) => (
              <option key={w.address} value={w.address}>
                {short(w.address)} ·{" "}
                {w.walletClientType === "privy"
                  ? "Privy wallet"
                  : w.walletClientType}
              </option>
            ))}
          </select>
        </label>
      )}

      <section className="wlt-assets" aria-label="Balances">
        <div className="wlt-assets-head">
          <span>Assets</span>
          <button
            type="button"
            className="wlt-refresh"
            disabled={busy}
            onClick={() => void loadBalances()}
          >
            ↻ {balances ? `Block ${balances.blockNumber}` : "Refresh"}
          </button>
        </div>
        {balances ? (
          <ul>
            {balances.balances.map((row) => {
              const zero = BigInt(row.balance) === 0n;
              return (
                <li key={row.token.address} data-zero={zero || undefined}>
                  {tokenBadge(row.token.symbol)}
                  <span className="wlt-token-name">
                    <strong>{row.token.symbol}</strong>
                    <small>
                      {tokenInfo[row.token.symbol]?.name ?? "Token"}
                    </small>
                  </span>
                  <span className="wlt-token-amount">
                    {amountText(row.balance, row.token.decimals)}
                  </span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="wlt-assets-empty">{loadError || "Reading balances…"}</p>
        )}
      </section>

      <div className="wlt-segment wlt-tabs" role="tablist">
        {(["receive", "send"] as const).map((key) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
          >
            {key === "receive" ? "↓ Deposit" : "↑ Send"}
          </button>
        ))}
      </div>

      {tab === "receive" ? (
        <div className="wlt-receive">
          <div className="wlt-qr">
            {qr ? (
              // biome-ignore lint/performance/noImgElement: Local data URL; nothing to optimise.
              <img
                src={qr}
                width={176}
                height={176}
                alt={`QR code for wallet address ${checksummed}`}
              />
            ) : (
              <span>Drawing QR…</span>
            )}
          </div>
          <div className="wlt-receive-body">
            <p>Send MON, USDC, WETH or cbBTC on {network.name}.</p>
            <button
              type="button"
              className="wlt-address"
              onClick={() => void copy()}
              aria-label="Copy wallet address"
            >
              <code>{checksummed}</code>
              <span>{copied ? "Copied ✓" : "Copy"}</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="wlt-send">
          <div className="wlt-row">
            <label className="wlt-field">
              <span>Token</span>
              <select
                value={token}
                disabled={busy}
                onChange={(event) => {
                  setToken(event.target.value);
                  setReview(null);
                }}
              >
                {(balances?.balances ?? []).map((row) => (
                  <option key={row.token.address} value={row.token.symbol}>
                    {row.token.symbol}
                  </option>
                ))}
              </select>
            </label>
            <label className="wlt-field wlt-grow">
              <span>
                Amount
                {selectedToken && (
                  <small>
                    Available{" "}
                    {amountText(
                      selectedToken.balance,
                      selectedToken.token.decimals,
                    )}{" "}
                    {selectedToken.token.symbol}
                  </small>
                )}
              </span>
              <div className="wlt-input">
                <input
                  inputMode="decimal"
                  placeholder="0.0"
                  value={amount}
                  disabled={busy}
                  onChange={(event) => {
                    setAmount(event.target.value);
                    setReview(null);
                  }}
                />
                {selectedToken &&
                  selectedToken.token.address !== zeroAddress && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        setAmount(
                          fromUnits(
                            BigInt(selectedToken.balance),
                            selectedToken.token.decimals,
                          ),
                        );
                        setReview(null);
                      }}
                    >
                      Max
                    </button>
                  )}
              </div>
            </label>
          </div>
          <label className="wlt-field">
            <span>Recipient address</span>
            <input
              placeholder="0x…"
              spellCheck={false}
              autoComplete="off"
              value={recipient}
              disabled={busy}
              aria-invalid={Boolean(recipient.trim()) && !recipientValid}
              onChange={(event) => {
                setRecipient(event.target.value);
                setReview(null);
              }}
            />
          </label>
          {recipient.trim() && !recipientValid && (
            <p className="wlt-error">That is not a valid address.</p>
          )}

          {review ? (
            <div className="wlt-review">
              <p className="wlt-review-amount">
                {tokenBadge(review.token.symbol)}
                <strong>
                  {formatUnits(BigInt(review.amount), review.token.decimals)}{" "}
                  {review.token.symbol}
                </strong>
              </p>
              <dl>
                <div>
                  <dt>To</dt>
                  <dd>{review.recipient}</dd>
                </div>
                <div>
                  <dt>From</dt>
                  <dd>{review.wallet}</dd>
                </div>
                <div>
                  <dt>Max network fee</dt>
                  <dd>
                    {formatUnits(
                      ((BigInt(review.gas) * 120n) / 100n) *
                        BigInt(review.gasPrice),
                      18,
                    )}{" "}
                    MON
                  </dd>
                </div>
              </dl>
              <div className="wlt-actions">
                <button
                  type="button"
                  className="wlt-secondary"
                  disabled={busy}
                  onClick={() => setReview(null)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="wlt-primary"
                  disabled={busy || secondsLeft === 0}
                  onClick={() => void confirm()}
                >
                  {secondsLeft > 0
                    ? `Confirm send · ${secondsLeft}s`
                    : "Review expired"}
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              className="wlt-primary"
              disabled={
                busy ||
                !balances ||
                !recipientValid ||
                units === null ||
                units <= 0n
              }
              onClick={() => void startReview()}
            >
              Review transfer
            </button>
          )}
        </div>
      )}

      {(notice || hash) && (
        <p className="wlt-notice">
          {notice}{" "}
          {hash && (
            <a
              href={`${network.explorer}/tx/${hash}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              View transaction ↗
            </a>
          )}
        </p>
      )}
    </div>
  );
}
