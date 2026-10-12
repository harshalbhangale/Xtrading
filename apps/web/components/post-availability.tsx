"use client";
import {
  type PostAvailability,
  postAvailabilitySchema,
} from "@call-my-bluff/domain";
import { useState } from "react";

const labels: Record<PostAvailability["status"], string> = {
  available: "Public post available",
  "not-publicly-available": "Not publicly available — deletion not confirmed",
  unavailable: "X check unavailable — no conclusion",
};
export function PostAvailabilityCheck({ callId }: { callId: string }) {
  const [result, setResult] = useState<PostAvailability | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function check() {
    setBusy(true);
    setResult(null);
    setError("");
    try {
      const response = await fetch(`/api/calls/${callId}/availability`, {
        cache: "no-store",
      });
      if (!response.ok) throw new Error("Check unavailable");
      setResult(postAvailabilitySchema.parse(await response.json()));
    } catch {
      setError("Could not check X. Try again later; no deletion conclusion.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div>
      <button
        type="button"
        className="text-link"
        disabled={busy}
        onClick={() => void check()}
      >
        {busy ? "Checking X…" : "Check post availability"}
      </button>
      <p className="small-note" aria-live="polite">
        {result
          ? `${labels[result.status]} · ${result.checkedAt} · X public embed`
          : error || "Not checked this visit."}
      </p>
    </div>
  );
}
