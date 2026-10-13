import { keccak256, stringToHex } from "viem";

/** Deterministic onchain ID for a registered call; never reused across calls. */
export const onchainCallId = (id: string) =>
  keccak256(stringToHex(`xtrading:call:${id}`));
