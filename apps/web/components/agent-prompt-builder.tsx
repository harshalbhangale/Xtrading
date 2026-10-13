"use client";
import { normalizeHandle } from "@call-my-bluff/domain";
import { useState } from "react";

/** Builds the follow-and-take-profit prompt. The agent prepares; the user always signs. */
export function AgentPromptBuilder() {
  const [handle, setHandle] = useState("");
  const [size, setSize] = useState("1");
  const [target, setTarget] = useState("5");
  const [notice, setNotice] = useState("");
  const creator = normalizeHandle(handle.trim().replace(/^@/, ""));
  const validSize =
    /^(0|[1-9][0-9]{0,3})(\.[0-9]{1,6})?$/.test(size) && Number(size) > 0;
  const validTarget =
    /^[0-9]{1,3}(\.[0-9]{1,2})?$/.test(target) && Number(target) > 0;
  const prompt = `Watch @${creator ?? "HANDLE"} on Xtrading. Each run, call recent_calls for that handle with since set to the last time you checked. For a new bullish MON, ETH or BTC spot call, call quote_trade with chainId 143 for ${size} USDC, then prepare_trade with chainId 143, the postId and the handle, and give me the approvalUrl. After I confirm the buy, call get_position for that market on each run. When pnlPercent is ${target} or more, call prepare_trade to sell the open amount on chainId 143 and give me the approvalUrl. Never sign anything, never spend more than ${size} USDC per post, and act at most once per post.`;
  return (
    <>
      <div className="agent-builder">
        <label>
          Creator
          <input
            value={handle}
            onChange={(event) => setHandle(event.target.value)}
            placeholder="@handle"
            maxLength={16}
            autoComplete="off"
          />
        </label>
        <label>
          USDC per call
          <input
            value={size}
            onChange={(event) => setSize(event.target.value)}
            inputMode="decimal"
            maxLength={10}
          />
        </label>
        <label>
          Take profit at %
          <input
            value={target}
            onChange={(event) => setTarget(event.target.value)}
            inputMode="decimal"
            maxLength={6}
          />
        </label>
      </div>
      <pre className="agent-prompt">{prompt}</pre>
      <div className="table-actions">
        <button
          type="button"
          className="button"
          disabled={!creator || !validSize || !validTarget}
          onClick={() =>
            void navigator.clipboard
              .writeText(prompt)
              .then(() =>
                setNotice(
                  "Copied. In Claude Code, run it on a schedule with /loop 1m.",
                ),
              )
              .catch(() => setNotice("Clipboard unavailable in this browser."))
          }
        >
          Copy prompt
        </button>
      </div>
      <p className="small-note" role="status">
        {notice ||
          "Monad mainnet, real funds. The agent only prepares trades; you sign each buy and sell. It sees posts that Xtrading users have viewed, so keep X open on the creator's profile with the extension running."}
      </p>
    </>
  );
}
