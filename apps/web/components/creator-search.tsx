"use client";

import { normalizeHandle } from "@call-my-bluff/domain";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Icon } from "./dashboard/icons";

export function CreatorSearch() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  return (
    <form
      className="search"
      onSubmit={(event) => {
        event.preventDefault();
        const handle = normalizeHandle(value.trim());
        if (!handle) {
          setError("Enter a valid X handle.");
          return;
        }
        setError("");
        router.push(`/creators/${handle}`);
      }}
    >
      <label className="sr-only" htmlFor="creator-search">
        Find a creator
      </label>
      <div className="search-row">
        <span>
          <Icon name="search" size={18} />
        </span>
        <input
          id="creator-search"
          placeholder="Enter an X handle"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          autoComplete="off"
          aria-describedby={error ? "search-error" : undefined}
        />
        <button type="submit">View record</button>
      </div>
      {error && (
        <p id="search-error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
