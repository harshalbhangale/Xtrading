"use client";

import { useState } from "react";
import { RecordTable } from "./ui";

export function CallFilters() {
  const [status, setStatus] = useState("all");
  return (
    <>
      <div className="filter-bar">
        <label htmlFor="call-status">Evaluation status</label>
        <select
          id="call-status"
          value={status}
          onChange={(event) => setStatus(event.target.value)}
        >
          <option value="all">All calls</option>
          <option value="unreviewed">Unreviewed</option>
          <option value="eligible">Eligible</option>
          <option value="resolved">Resolved</option>
          <option value="excluded">Excluded</option>
        </select>
        <span className="muted">Source not connected</span>
      </div>
      <div aria-live="polite">
        <RecordTable
          columns={[
            "Source post",
            "Asset / direction",
            "Time horizon",
            "Status",
            "Evidence",
          ]}
          emptyTitle={
            status === "all"
              ? "No calls indexed yet."
              : `No ${status} calls to display.`
          }
          emptyDescription="Connect a verified creator account and the call ingestion service to build this ledger."
        />
      </div>
    </>
  );
}
