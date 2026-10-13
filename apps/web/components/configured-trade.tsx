"use client";
import {
  confirmedCreatorPayment,
  flowEntrypoint,
} from "@call-my-bluff/integrations/creator-fees";
import {
  kuruNetwork,
  networkTradeTokens,
} from "@call-my-bluff/integrations/kuru";
import {
  kuruAccountSchema,
  spotReviewSchema,
  withdrawReviewSchema,
} from "@call-my-bluff/integrations/market-schemas";
import { stakeUnits } from "@call-my-bluff/integrations/stake";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPublicClient, formatUnits, http } from "viem";
import { monad, monadTestnet } from "viem/chains";
import { z } from "zod";
import { useWalletSend } from "./use-wallet-send";

type Review = ReturnType<typeof spotReviewSchema.parse>;
type Withdrawal = ReturnType<typeof withdrawReviewSchema.parse>;
type Account = ReturnType<typeof kuruAccountSchema.parse>;
type Market = "MON" | "WETH" | "WBTC";
const errors: Record<string, string> = {
  insufficient_market_token:
    "Not enough of the input token in your wallet or Kuru account.",
  invalid_market_amount: "Amount is outside the market's limits.",
  mainnet_trading_disabled: "Mainnet trading is switched off on this server.",
  quote_unavailable_or_insufficient_liquidity:
    "No executable quote at this size. Try a smaller amount.",
  trade_simulation_failed:
    "The transaction would fail onchain. Nothing was sent.",
  insufficient_gas_balance: "Not enough MON for gas.",
  current_binding_required: "Bind your X account to this wallet first.",
  market_verification_failed: "Market checks failed. Trading is paused.",
  insufficient_balance: "Not enough balance in your Kuru account.",
};
const stepTitle = {
  approve: "Approve the exact shortfall",
  deposit: "Deposit the shortfall into your Kuru account",
  swap: "Swap",
} as const;
const units = (value: string | null, decimals: number, symbol: string) =>
  value === null ? "—" : `${formatUnits(BigInt(value), decimals)} ${symbol}`;

export default function ConfiguredTrade({ chainId }: { chainId: 10143 | 143 }) {
  const mainnet = chainId === 143;
  const network = kuruNetwork(chainId);
  const explorer = mainnet
    ? "https://monadvision.com"
    : "https://testnet.monadvision.com";
  const { ready, authenticated, user, login, getAccessToken } = usePrivy();
  const { wallets } = useWallets();
  const { sendTransaction } = useWalletSend();
  const [creator, setCreator] = useState<{
    xUserId: string;
    handle: string;
    wallet: string;
  } | null>(null);
  const [payCreator, setPayCreator] = useState(false);
  const [creatorStatus, setCreatorStatus] = useState(
    "No creator fee selected.",
  );
  const [market, setMarket] = useState<Market>("MON");
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [amount, setAmount] = useState("");
  const [postId, setPostId] = useState("");
  const [slippage, setSlippage] = useState("100");
  const [review, setReview] = useState<Review | Withdrawal | null>(null);
  const [account, setAccount] = useState<Account | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [hash, setHash] = useState<`0x${string}` | null>(null);
  const [now, setNow] = useState(Date.now());
  const owner = useRef(user?.id);
  owner.current = user?.id;

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const handle = params.get("handle");
    let cancelled = false;
    if (handle && /^[a-zA-Z0-9_]{1,15}$/.test(handle)) {
      setCreatorStatus("Checking creator payout registration…");
      void fetch(`/api/creators/${handle.toLowerCase()}/payout`, {
        cache: "no-store",
      })
        .then(async (r) => {
          if (!r.ok) throw new Error("unavailable");
          const data = z
            .object({
              creator: z
                .object({
                  xUserId: z.string().regex(/^[0-9]+$/),
                  handle: z.string(),
                  wallet: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
                })
                .nullable(),
              mainnetFeesEnabled: z.boolean(),
            })
            .parse(await r.json());
          if (cancelled) return;
          setCreator(data.mainnetFeesEnabled ? data.creator : null);
          if (
            data.mainnetFeesEnabled &&
            data.creator &&
            params.get("payCreator") === "1"
          )
            setPayCreator(true);
          setCreatorStatus(
            data.mainnetFeesEnabled && data.creator
              ? "Optional creator fee: 0.5% of bought-token output."
              : "Creator fees are unavailable for this post. No creator fee will be charged.",
          );
        })
        .catch(() => {
          if (!cancelled)
            setCreatorStatus(
              "Creator payout lookup unavailable. No creator fee will be charged.",
            );
        });
    }
    const requested = params.get("side"),
      source = params.get("postId"),
      requestedMarket = params.get("market");
    if (requested === "buy" || requested === "sell") setSide(requested);
    if (
      requestedMarket === "MON" ||
      requestedMarket === "WETH" ||
      requestedMarket === "WBTC"
    )
      setMarket(requestedMarket);
    if (source && /^[0-9]{1,30}$/.test(source)) setPostId(source);
    const initialAmount = params.get("amount"),
      initialSlippage = params.get("slippage");
    if (
      initialAmount &&
      /^(0|[1-9][0-9]{0,38})(\.[0-9]{1,36})?$/.test(initialAmount)
    )
      setAmount(initialAmount);
    if (
      initialSlippage &&
      /^[0-9]{1,3}$/.test(initialSlippage) &&
      Number(initialSlippage) >= 1 &&
      Number(initialSlippage) <= 500
    )
      setSlippage(initialSlippage);
    return () => {
      cancelled = true;
    };
  }, []);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      clearInterval(timer);
      owner.current = undefined;
    };
  }, []);

  const api = useCallback(
    async (path: string, body?: unknown) => {
      const token = await getAccessToken();
      if (!token) throw new Error("Session expired. Sign in again.");
      const response = await fetch(path, {
        method: body ? "POST" : "GET",
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${token}`,
          ...(body ? { "Content-Type": "application/json" } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      const value: unknown = await response.json();
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
            (code.replaceAll("_", " ") || "Trade service unavailable."),
        );
      }
      return value;
    },
    [getAccessToken],
  );
  const loadAccount = useCallback(async () => {
    const who = owner.current;
    try {
      const data = kuruAccountSchema.parse(
        await api(`/api/trades/account?chainId=${chainId}`),
      );
      if (owner.current === who) setAccount(data);
    } catch {
      if (owner.current === who) setAccount(null);
    }
  }, [api, chainId]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: Reset private state on account change.
  useEffect(() => {
    setReview(null);
    setHash(null);
    setNotice("");
    setAccount(null);
    setBusy(false);
    if (ready && authenticated) void loadAccount();
  }, [ready, authenticated, user?.id, chainId]);

  const tokens = networkTradeTokens(chainId, market, side);
  const expired = review ? Date.parse(review.expiresAt) <= now : false;

  function intent() {
    if (postId && !/^[0-9]{1,30}$/.test(postId))
      throw new Error("Source post ID must be digits.");
    if (
      !/^[0-9]{1,3}$/.test(slippage) ||
      Number(slippage) < 1 ||
      Number(slippage) > 500
    )
      throw new Error("Slippage must be 1–500 basis points.");
    let units: bigint;
    try {
      units = stakeUnits(amount, tokens.input.decimals);
    } catch {
      throw new Error(
        `Enter a positive ${tokens.input.symbol} amount with at most ${tokens.input.decimals} decimals.`,
      );
    }
    return {
      instrument: "spot",
      chainId,
      market,
      side,
      amount: units.toString(),
      slippageBps: Number(slippage),
      sourcePostId: postId || null,
      creatorXUserId:
        mainnet && side === "buy" && payCreator
          ? (creator?.xUserId ?? null)
          : null,
    };
  }
  async function fresh(current: Review | Withdrawal | null) {
    const who = owner.current;
    if (current?.action === "withdraw") {
      const result = withdrawReviewSchema.parse(
        await api("/api/trades/withdraw", {
          chainId: 10143,
          token: current.token.symbol,
          amount: current.amount,
        }),
      );
      if (owner.current !== who)
        throw new Error("Account changed. Prepare a new review.");
      return result;
    }
    const result = spotReviewSchema.parse(
      await api("/api/trades/prepare", intent()),
    );
    if (owner.current !== who)
      throw new Error("Account changed. Prepare a new review.");
    const allowed = [
      ...("accountCore" in network ? [network.accountCore] : []),
      network.markets[result.market].market,
      result.input.address,
      ...(result.execution === "creator-flow" ? [flowEntrypoint] : []),
    ].map((a) => a.toLowerCase());
    if (
      result.chainId !== chainId ||
      !allowed.includes(result.to.toLowerCase())
    )
      throw new Error("Unexpected transaction target.");
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
  const prepare = () =>
    run(async () => {
      setHash(null);
      setReview(await fresh(null));
    });
  const prepareWithdraw = (symbol: string, value: string) =>
    run(async () => {
      setHash(null);
      setReview(
        withdrawReviewSchema.parse(
          await api("/api/trades/withdraw", {
            chainId: 10143,
            token: symbol,
            amount: value,
          }),
        ),
      );
    });
  const submit = () =>
    run(async () => {
      const previous = review;
      if (!previous || Date.parse(previous.expiresAt) <= Date.now()) {
        setReview(null);
        throw new Error("Review expired. Prepare again.");
      }
      const who = owner.current;
      const current = await fresh(previous);
      if (
        current.wallet !== previous.wallet ||
        current.action !== previous.action ||
        current.to !== previous.to ||
        current.data !== previous.data ||
        current.value !== previous.value ||
        (current.action !== "withdraw" &&
          previous.action !== "withdraw" &&
          JSON.stringify(current.creatorFee) !==
            JSON.stringify(previous.creatorFee))
      ) {
        setReview(current);
        setNotice("The quote or step changed. Review the updated values.");
        return;
      }
      const wallet = wallets.find(
        (w) => w.address.toLowerCase() === current.wallet.toLowerCase(),
      );
      if (!wallet) throw new Error("Bound wallet is not connected.");
      await wallet.switchChain(chainId);
      if (owner.current !== who) return;
      setReview(null);
      const sent = await sendTransaction(
        {
          chainId,
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
        chain: mainnet ? monad : monadTestnet,
        transport: http(),
      }).waitForTransactionReceipt({
        hash: sent.hash,
        confirmations: 2,
        timeout: 120000,
      });
      if (owner.current !== who) return;
      if (receipt.status !== "success")
        throw new Error("Transaction reverted. Nothing was traded.");
      await loadAccount();
      if (current.action === "approve" || current.action === "deposit") {
        setNotice(
          `${current.action === "approve" ? "Approval" : "Deposit"} confirmed in block ${receipt.blockNumber}. Preparing the next step…`,
        );
        setReview(await fresh(null));
        return;
      }
      // Fill records are Envio-backed and testnet-only.
      if (!mainnet && current.action === "swap" && current.sourcePostId)
        await api("/api/trades/record", {
          transactionHash: sent.hash,
          sourcePostId: current.sourcePostId,
        }).catch(() => undefined);
      if (current.action === "swap" && current.creatorFee) {
        const paid = confirmedCreatorPayment(receipt.logs, {
          buyer: current.wallet,
          recipient: current.creatorFee.wallet,
          token: current.output.address,
        });
        setNotice(
          paid === null
            ? `Transaction confirmed in block ${receipt.blockNumber}, but the creator payment could not be verified. Check the receipt; no earnings amount is assumed.`
            : `Swap confirmed in block ${receipt.blockNumber}. Creator received ${units(paid.toString(), current.output.decimals, current.output.symbol)} at ${current.creatorFee.wallet}. Your output is net of that payment. Indexed earnings appear after Envio catches up.`,
        );
        return;
      }
      setNotice(
        current.action === "swap" && mainnet
          ? `Market order confirmed in block ${receipt.blockNumber} on Monad mainnet. The output is in your wallet; check the receipt for the exact fill.`
          : current.action === "swap"
            ? `Swap confirmed in block ${receipt.blockNumber}. Proceeds are in your Kuru account; withdraw them below. The fill appears in your portfolio once Envio indexes it.`
            : `Withdrawal confirmed in block ${receipt.blockNumber}.`,
      );
    });

  if (!ready) return <p className="small-note">Loading wallet…</p>;
  if (!authenticated)
    return (
      <button type="button" className="button" onClick={() => login()}>
        Sign in to trade
      </button>
    );
  return (
    <div className="stake-form">
      <fieldset
        className="preview-selector"
        aria-label="Market"
        disabled={busy}
      >
        {(["MON", "WETH", "WBTC"] as const).map((choice) => (
          <button
            key={choice}
            type="button"
            aria-pressed={market === choice}
            onClick={() => {
              setMarket(choice);
              setReview(null);
            }}
          >
            {network.markets[choice].base.symbol} / USDC
          </button>
        ))}
      </fieldset>
      <fieldset className="preview-selector" aria-label="Side" disabled={busy}>
        {(["buy", "sell"] as const).map((choice) => (
          <button
            key={choice}
            type="button"
            aria-pressed={side === choice}
            onClick={() => {
              setSide(choice);
              setReview(null);
            }}
          >
            {choice === "buy" ? "Buy" : "Sell"}{" "}
            {network.markets[market].base.symbol}
          </button>
        ))}
      </fieldset>
      <label htmlFor="trade-amount">
        Amount to spend ({tokens.input.symbol})
      </label>
      <input
        id="trade-amount"
        inputMode="decimal"
        maxLength={40}
        disabled={busy}
        value={amount}
        placeholder={
          mainnet
            ? side === "buy"
              ? "1"
              : market === "MON"
                ? "10"
                : "0.0004"
            : side === "buy"
              ? "10"
              : market === "MON"
                ? "400"
                : "0.004"
        }
        onChange={(e) => {
          setAmount(e.target.value);
          setReview(null);
        }}
      />
      <label htmlFor="trade-slippage">
        Max slippage (basis points, 100 = 1%)
      </label>
      <input
        id="trade-slippage"
        inputMode="numeric"
        disabled={busy}
        value={slippage}
        onChange={(e) => {
          setSlippage(e.target.value);
          setReview(null);
        }}
      />
      <label htmlFor="trade-source">Source X post ID (optional)</label>
      <input
        id="trade-source"
        inputMode="numeric"
        maxLength={30}
        disabled={busy}
        value={postId}
        onChange={(e) => {
          setPostId(e.target.value);
          setReview(null);
        }}
      />
      {mainnet && side === "buy" && creator && (
        <label>
          <input
            type="checkbox"
            disabled={busy}
            checked={payCreator}
            onChange={(e) => {
              setPayCreator(e.target.checked);
              setReview(null);
            }}
          />
          Pay 0.5% of output to @{creator.handle} · {creator.wallet}
        </label>
      )}
      <p className="small-note">{creatorStatus}</p>
      <button
        type="button"
        className="button"
        disabled={busy || !amount}
        onClick={() => void prepare()}
      >
        Review trade
      </button>

      {review && review.action !== "withdraw" && (
        <section aria-label="Trade review">
          <h3>{stepTitle[review.action]}</h3>
          <dl className="quote-review">
            <div>
              <dt>Spend</dt>
              <dd>
                {units(
                  review.amount,
                  review.input.decimals,
                  review.input.symbol,
                )}
              </dd>
            </div>
            {review.action === "swap" ? (
              <>
                <div>
                  <dt>Expected (simulated)</dt>
                  <dd>
                    {units(
                      review.expectedOutput,
                      review.output.decimals,
                      review.output.symbol,
                    )}
                  </dd>
                </div>
                <div>
                  <dt>Minimum received</dt>
                  <dd>
                    {units(
                      review.minimumOutput,
                      review.output.decimals,
                      review.output.symbol,
                    )}
                  </dd>
                </div>
                {review.amountInUsed !== review.amount && (
                  <div>
                    <dt>Would execute</dt>
                    <dd>
                      {units(
                        review.amountInUsed,
                        review.input.decimals,
                        review.input.symbol,
                      )}{" "}
                      {mainnet
                        ? "(rounded down to the market's size precision)"
                        : "(not enough liquidity for the full amount)"}
                    </dd>
                  </div>
                )}
                <div>
                  <dt>Onchain deadline</dt>
                  <dd>
                    {review.deadline
                      ? new Date(
                          Number(review.deadline) * 1000,
                        ).toLocaleTimeString()
                      : "None on Kuru mainnet; the minimum is enforced onchain"}
                  </dd>
                </div>
              </>
            ) : (
              <>
                <div>
                  <dt>Indicative output</dt>
                  <dd>
                    {units(
                      review.indicativeOutput,
                      review.output.decimals,
                      review.output.symbol,
                    )}
                    {!review.indicativeFilled &&
                      " (book too thin for the full amount)"}
                  </dd>
                </div>
                <div>
                  <dt>
                    {review.action === "approve" ? "Approval" : "Deposit"}
                  </dt>
                  <dd>
                    {units(
                      (
                        BigInt(review.amount) - BigInt(review.accountBalance)
                      ).toString(),
                      review.input.decimals,
                      review.input.symbol,
                    )}{" "}
                    {review.action === "approve"
                      ? mainnet
                        ? review.execution === "creator-flow"
                          ? "to the Kuru Flow entrypoint, exact amount"
                          : "to the Kuru order book, exact amount"
                        : "to Kuru AccountCore, exact amount"
                      : review.input.symbol === "MON"
                        ? "native MON, sent as the transaction value. Leave enough MON for gas."
                        : "from your wallet into your Kuru account"}
                  </dd>
                </div>
              </>
            )}
            {review.creatorFee && (
              <div>
                <dt>Creator fee</dt>
                <dd>
                  0.5% of gross {review.creatorFee.denomination.symbol} output
                  to {review.creatorFee.wallet}. Expected and minimum received
                  above are after this fee.
                </dd>
              </div>
            )}
            <div>
              <dt>Kuru taker fee</dt>
              <dd>{Number(review.takerFeePps) / 1000} bps, included</dd>
            </div>
            <div>
              <dt>Network fee (est.)</dt>
              <dd>
                {formatUnits(
                  ((BigInt(review.gas) * 120n) / 100n) *
                    BigInt(review.gasPrice),
                  18,
                )}{" "}
                MON
              </dd>
            </div>
            <div>
              <dt>Source post</dt>
              <dd>
                {review.sourcePostId ?? "None"}{" "}
                {review.sourcePostId && "· unverified"}
              </dd>
            </div>
          </dl>
          <p className="small-note">
            Block {review.blockNumber}, unfinalized.{" "}
            {review.action === "swap"
              ? mainnet
                ? "The order book enforces the minimum output. Real funds."
                : "The contract enforces the minimum and the deadline."
              : "This step moves no funds into a trade; the swap is reviewed separately."}{" "}
            Review{" "}
            {expired
              ? "expired"
              : `expires in ${Math.max(0, Math.ceil((Date.parse(review.expiresAt) - now) / 1000))}s`}
            .
          </p>
          <details>
            <summary>Unsigned transaction</summary>
            <p>To: {review.to}</p>
            <pre className="ownership-message">{review.data}</pre>
          </details>
          <div className="button-row">
            <button
              type="button"
              className="button"
              disabled={busy || expired}
              onClick={() => void submit()}
            >
              Open wallet to approve
            </button>
            <button
              type="button"
              className="text-link"
              disabled={busy}
              onClick={() => setReview(null)}
            >
              Discard
            </button>
          </div>
        </section>
      )}

      {review && review.action === "withdraw" && (
        <section aria-label="Withdrawal review">
          <h3>Withdraw to your wallet</h3>
          <p>
            {units(review.amount, review.token.decimals, review.token.symbol)}{" "}
            from your Kuru account to {review.wallet}.
          </p>
          <div className="button-row">
            <button
              type="button"
              className="button"
              disabled={busy || expired}
              onClick={() => void submit()}
            >
              Open wallet to approve
            </button>
            <button
              type="button"
              className="text-link"
              disabled={busy}
              onClick={() => setReview(null)}
            >
              Discard
            </button>
          </div>
        </section>
      )}

      <p role="status">
        {notice}
        {busy ? " Working…" : ""}
      </p>
      {hash && (
        <a
          className="text-link"
          href={`${explorer}/tx/${hash}`}
          target="_blank"
          rel="noreferrer"
        >
          View transaction ↗
        </a>
      )}

      <h3>Balances</h3>
      {account ? (
        <table className="record-table">
          <thead>
            <tr>
              <th scope="col">Token</th>
              <th scope="col">Wallet</th>
              {!mainnet && <th scope="col">Kuru account</th>}
              {!mainnet && <th scope="col" />}
            </tr>
          </thead>
          <tbody>
            {account.balances.map((row) => (
              <tr key={row.token.address}>
                <td>{row.token.symbol}</td>
                <td>{formatUnits(BigInt(row.wallet), row.token.decimals)}</td>
                {!mainnet && (
                  <td>
                    {formatUnits(BigInt(row.account), row.token.decimals)}
                  </td>
                )}
                {!mainnet && (
                  <td>
                    {row.account !== "0" && (
                      <button
                        type="button"
                        className="text-link"
                        disabled={busy}
                        onClick={() =>
                          void prepareWithdraw(row.token.symbol, row.account)
                        }
                      >
                        Withdraw
                      </button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="small-note">Balances unavailable.</p>
      )}
      {mainnet ? (
        <p className="small-note">
          Monad mainnet · real funds. Market orders spend directly from your
          wallet (no Kuru account, no deposit) and have no minimum size. USDC is{" "}
          <code>{network.quote.address}</code>. Keep MON for gas
          {account
            ? ` (${formatUnits(BigInt(account.nativeBalance), 18)} MON)`
            : ""}
          .
        </p>
      ) : (
        <p className="small-note">
          Kuru test tokens on Monad testnet; no monetary value. Minimum order is
          10 USDC. Kuru test USDC is <code>{network.quote.address}</code>, not
          the staking token. Wallet MON pays gas
          {account
            ? ` (${formatUnits(BigInt(account.nativeBalance), 18)} MON)`
            : ""}
          . A MON deposit uses that same balance.
        </p>
      )}
    </div>
  );
}
