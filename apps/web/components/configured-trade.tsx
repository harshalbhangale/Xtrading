"use client";
import { kuruV2 } from "@call-my-bluff/integrations/kuru";
import {
  kuruAccountSchema,
  spotReviewSchema,
  withdrawReviewSchema,
} from "@call-my-bluff/integrations/market-schemas";
import { stakeUnits } from "@call-my-bluff/integrations/stake";
import { usePrivy, useSendTransaction, useWallets } from "@privy-io/react-auth";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPublicClient, formatUnits, http } from "viem";
import { monadTestnet } from "viem/chains";

type Review = ReturnType<typeof spotReviewSchema.parse>;
type Withdrawal = ReturnType<typeof withdrawReviewSchema.parse>;
type Account = ReturnType<typeof kuruAccountSchema.parse>;
type Market = "WETH" | "WBTC";
const errors: Record<string, string> = {
  insufficient_market_token:
    "Not enough of the input token in your wallet or Kuru account.",
  invalid_market_amount:
    "Amount is outside the market's limits (minimum order is 10 USDC).",
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
  approve: "Step 1 of 3 · Approve exact amount",
  deposit: "Step 2 of 3 · Deposit into your Kuru account",
  swap: "Step 3 of 3 · Swap",
} as const;
const units = (value: string | null, decimals: number, symbol: string) =>
  value === null ? "—" : `${formatUnits(BigInt(value), decimals)} ${symbol}`;

export default function ConfiguredTrade() {
  const { ready, authenticated, user, login, getAccessToken } = usePrivy();
  const { wallets } = useWallets();
  const { sendTransaction } = useSendTransaction();
  const [market, setMarket] = useState<Market>("WETH");
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
    const requested = params.get("side"),
      source = params.get("postId"),
      requestedMarket = params.get("market");
    if (requested === "buy" || requested === "sell") setSide(requested);
    if (requestedMarket === "WETH" || requestedMarket === "WBTC")
      setMarket(requestedMarket);
    if (source && /^[0-9]{1,30}$/.test(source)) setPostId(source);
  }, []);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
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
    try {
      setAccount(kuruAccountSchema.parse(await api("/api/trades/account")));
    } catch {
      setAccount(null);
    }
  }, [api]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: Reset private state on account change.
  useEffect(() => {
    setReview(null);
    setHash(null);
    setNotice("");
    if (ready && authenticated) void loadAccount();
  }, [ready, authenticated, user?.id]);

  const tokens =
    side === "buy"
      ? { input: kuruV2.quote, output: kuruV2.markets[market].base }
      : { input: kuruV2.markets[market].base, output: kuruV2.quote };
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
      chainId: 10143,
      market,
      side,
      amount: units.toString(),
      slippageBps: Number(slippage),
      sourcePostId: postId || null,
    };
  }
  async function fresh(current: Review | Withdrawal | null) {
    if (current?.action === "withdraw")
      return withdrawReviewSchema.parse(
        await api("/api/trades/withdraw", {
          chainId: 10143,
          token: current.token.symbol,
          amount: current.amount,
        }),
      );
    const result = spotReviewSchema.parse(
      await api("/api/trades/prepare", intent()),
    );
    const allowed = [
      kuruV2.accountCore,
      kuruV2.markets[result.market].market,
      result.input.address,
    ].map((a) => a.toLowerCase());
    if (!allowed.includes(result.to.toLowerCase()))
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
      setBusy(false);
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
        current.value !== previous.value
      ) {
        setReview(current);
        setNotice("The quote or step changed. Review the updated values.");
        return;
      }
      const wallet = wallets.find(
        (w) => w.address.toLowerCase() === current.wallet.toLowerCase(),
      );
      if (!wallet) throw new Error("Bound wallet is not connected.");
      await wallet.switchChain(10143);
      if (owner.current !== who) return;
      setReview(null);
      const sent = await sendTransaction(
        {
          chainId: 10143,
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
        chain: monadTestnet,
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
      if (current.action === "swap" && current.sourcePostId)
        await api("/api/trades/record", {
          transactionHash: sent.hash,
          sourcePostId: current.sourcePostId,
        }).catch(() => undefined);
      setNotice(
        current.action === "swap"
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
        {(["WETH", "WBTC"] as const).map((choice) => (
          <button
            key={choice}
            type="button"
            aria-pressed={market === choice}
            onClick={() => {
              setMarket(choice);
              setReview(null);
            }}
          >
            {choice} / USDC
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
            {choice === "buy" ? "Buy" : "Sell"} {market}
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
        placeholder={side === "buy" ? "10" : "0.004"}
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
                      (not enough liquidity for the full amount)
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
                      : "—"}
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
                      ? "to Kuru AccountCore, exact amount"
                      : "from your wallet into your Kuru account"}
                  </dd>
                </div>
              </>
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
              ? "The contract enforces the minimum and the deadline."
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
          href={`https://testnet.monadvision.com/tx/${hash}`}
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
              <th scope="col">Kuru account</th>
              <th scope="col" />
            </tr>
          </thead>
          <tbody>
            {account.balances.map((row) => (
              <tr key={row.token.address}>
                <td>{row.token.symbol}</td>
                <td>{formatUnits(BigInt(row.wallet), row.token.decimals)}</td>
                <td>{formatUnits(BigInt(row.account), row.token.decimals)}</td>
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
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="small-note">Balances unavailable.</p>
      )}
      <p className="small-note">
        Kuru test tokens on Monad testnet; no monetary value. Kuru test USDC is{" "}
        <code>{kuruV2.quote.address}</code>, not the staking token. Gas:{" "}
        {account
          ? `${formatUnits(BigInt(account.nativeBalance), 18)} MON`
          : "—"}
        .
      </p>
    </div>
  );
}
