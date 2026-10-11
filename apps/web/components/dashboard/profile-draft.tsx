"use client";

import { normalizeHandle } from "@call-my-bluff/domain";
import { useEffect, useState } from "react";

const storageKey = "cmb.creator-profile-draft.v1";
type Draft = { displayName: string; handle: string; bio: string };
const emptyDraft: Draft = { displayName: "", handle: "", bio: "" };

export function ProfileDraft() {
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [message, setMessage] = useState("");
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    try {
      const stored: unknown = JSON.parse(
        localStorage.getItem(storageKey) ?? "null",
      );
      if (
        stored &&
        typeof stored === "object" &&
        "displayName" in stored &&
        "handle" in stored &&
        "bio" in stored &&
        typeof stored.displayName === "string" &&
        stored.displayName.length <= 60 &&
        typeof stored.handle === "string" &&
        (stored.handle === "" ||
          normalizeHandle(stored.handle) === stored.handle) &&
        typeof stored.bio === "string" &&
        stored.bio.length <= 160
      )
        setDraft({
          displayName: stored.displayName,
          handle: stored.handle,
          bio: stored.bio,
        });
    } catch {
      setMessage(
        "Your saved draft could not be read. You can create a new one.",
      );
    }
    setLoaded(true);
  }, []);
  return (
    <form
      className="profile-form"
      onSubmit={(event) => {
        event.preventDefault();
        const handle = normalizeHandle(draft.handle.trim());
        if (!handle) {
          setMessage("Enter a valid X handle before saving your draft.");
          return;
        }
        const next = {
          ...draft,
          displayName: draft.displayName.trim(),
          handle,
        };
        if (!next.displayName) {
          setMessage("Enter a display name.");
          return;
        }
        try {
          localStorage.setItem(storageKey, JSON.stringify(next));
          setDraft(next);
          setMessage(
            "Draft saved in this browser. Your identity is not verified and nothing is published.",
          );
        } catch {
          setMessage(
            "Browser storage is unavailable. Your draft was not saved.",
          );
        }
      }}
    >
      <div className="form-field">
        <label htmlFor="profile-name">Display name</label>
        <input
          id="profile-name"
          required
          maxLength={60}
          value={draft.displayName}
          onChange={(event) =>
            setDraft({ ...draft, displayName: event.target.value })
          }
          placeholder="How your audience knows you"
        />
      </div>
      <div className="form-field">
        <label htmlFor="profile-handle">
          X handle <span className="muted">/ draft only</span>
        </label>
        <input
          id="profile-handle"
          required
          maxLength={16}
          value={draft.handle}
          onChange={(event) =>
            setDraft({ ...draft, handle: event.target.value })
          }
          placeholder="@yourhandle"
          autoComplete="off"
        />
        <p>
          This field does not prove account ownership. Verification will use
          your stable X user ID.
        </p>
      </div>
      <div className="form-field">
        <label htmlFor="profile-bio">About your calls</label>
        <textarea
          id="profile-bio"
          rows={4}
          maxLength={160}
          value={draft.bio}
          onChange={(event) => setDraft({ ...draft, bio: event.target.value })}
          placeholder="Markets you follow and how you think about them"
        />
        <span className="character-count">{draft.bio.length} / 160</span>
      </div>
      <div className="form-footer">
        <button className="button" type="submit" disabled={!loaded}>
          Save local draft ↗
        </button>
        <button
          className="inline-button"
          type="button"
          disabled={!loaded}
          onClick={() => {
            try {
              localStorage.removeItem(storageKey);
              setDraft(emptyDraft);
              setMessage("Local draft cleared.");
            } catch {
              setMessage("The local draft could not be cleared.");
            }
          }}
        >
          Clear draft
        </button>
      </div>
      <p className="form-message" role="status">
        {message ||
          "Drafts stay on this browser until account publishing is connected."}
      </p>
    </form>
  );
}
