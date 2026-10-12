import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import {
  IdentityError,
  identityService,
} from "@call-my-bluff/database/identity";
import { getMonadChain } from "@call-my-bluff/integrations";
import { getDatabase } from "./database";
import { authenticatedUser, privyUser } from "./identity-auth";

/**
 * Extension sessions let the X extension place perp orders without holding a Privy
 * token. A session is an HMAC-signed claim (Privy user ID, perp scope, expiry) minted
 * only after a verified Privy session with a current X/wallet binding. Every use reads
 * the Privy user again, so an unlinked X account or wallet stops it immediately.
 */
const TTL_MS = 7 * 24 * 60 * 60 * 1000;
const prefix = "v1";

function secret() {
  const value = process.env.EXTENSION_SESSION_SECRET ?? "";
  if (value.length < 32)
    throw new IdentityError("extension_sessions_unconfigured", 503);
  return value;
}
const sign = (payload: string) =>
  createHmac("sha256", secret())
    .update(`${prefix}.${payload}`)
    .digest("base64url");

export async function mintExtensionSession(request: Request) {
  const user = await authenticatedUser(request);
  await currentBinding(user);
  const expiresAt = Date.now() + TTL_MS;
  const payload = Buffer.from(
    JSON.stringify({ sub: user.privyUserId, scope: "perp", exp: expiresAt }),
  ).toString("base64url");
  return {
    token: `${prefix}.${payload}.${sign(payload)}`,
    handle: user.xAccount?.handle ?? null,
    expiresAt: new Date(expiresAt).toISOString(),
  };
}

/** Resolve `Authorization: Extension <token>` to the same context as a Privy session. */
export async function extensionContext(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  const match = header.match(
    /^Extension (v1\.[A-Za-z0-9_-]{1,512}\.[A-Za-z0-9_-]{43})$/,
  );
  if (!match?.[1]) throw new IdentityError("authentication_required", 401);
  const [, payload = "", signature = ""] = match[1].split(".");
  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given))
    throw new IdentityError("invalid_session", 401);
  let claims: { sub?: unknown; scope?: unknown; exp?: unknown };
  try {
    claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    throw new IdentityError("invalid_session", 401);
  }
  if (
    typeof claims.sub !== "string" ||
    claims.scope !== "perp" ||
    typeof claims.exp !== "number" ||
    claims.exp <= Date.now()
  )
    throw new IdentityError("invalid_session", 401);
  const user = await privyUser(claims.sub);
  const database = getDatabase();
  if (!database) throw new IdentityError("database_unavailable", 503);
  return {
    user,
    service: identityService(database.db),
    chainId: getMonadChain(process.env.NEXT_PUBLIC_MONAD_CHAIN_ID).id,
  };
}

async function currentBinding(user: Awaited<ReturnType<typeof privyUser>>) {
  const database = getDatabase();
  if (!database) throw new IdentityError("database_unavailable", 503);
  const binding = await identityService(database.db).current(user.privyUserId);
  if (
    !binding ||
    binding.xUserId !== user.xAccount?.xUserId ||
    !user.wallets.some((w) => w.toLowerCase() === binding.wallet)
  )
    throw new IdentityError("current_binding_required", 403);
  return binding;
}
