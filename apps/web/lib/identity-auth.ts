import "server-only";
import { IdentityError } from "@call-my-bluff/database/identity";
import { normalizeHandle } from "@call-my-bluff/domain";
import { PrivyClient } from "@privy-io/node";

let client: PrivyClient | undefined;
function privy() {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
  const appSecret = process.env.PRIVY_APP_SECRET;
  if (!appId || !appSecret)
    throw new IdentityError("authentication_unavailable", 503);
  client ??= new PrivyClient({
    appId,
    appSecret,
    timeout: 10_000,
    maxRetries: 0,
  });
  return client;
}
/** The Privy user ID behind a Bearer token, verified locally; no profile fetch. */
export async function verifiedUserId(request: Request) {
  const bearer = request.headers.get("authorization");
  if (!bearer || !/^Bearer [^\s]+$/.test(bearer) || bearer.length > 8192)
    return null;
  try {
    return (await privy().utils().auth().verifyAccessToken(bearer.slice(7)))
      .user_id;
  } catch {
    return null;
  }
}

export async function authenticatedUser(request: Request) {
  const bearer = request.headers.get("authorization");
  if (!bearer || !/^Bearer [^\s]+$/.test(bearer) || bearer.length > 8192)
    throw new IdentityError("authentication_required", 401);
  let userId: string;
  try {
    userId = (await privy().utils().auth().verifyAccessToken(bearer.slice(7)))
      .user_id;
  } catch (error) {
    if (error instanceof IdentityError) throw error;
    throw new IdentityError("invalid_session", 401);
  }
  return privyUser(userId);
}

/** Current Privy user by ID: linked X account and wallets, read fresh from Privy. */
export async function privyUser(userId: string) {
  const client = privy();
  try {
    const user = await client.users()._get(userId);
    if (user.id !== userId) throw new Error("User mismatch");
    const twitter = user.linked_accounts.filter(
      (a) => a.type === "twitter_oauth",
    );
    const account = twitter.length === 1 ? twitter[0] : undefined;
    const handle =
      account?.type === "twitter_oauth" && account.username
        ? normalizeHandle(account.username)
        : null;
    const xAccount =
      account?.type === "twitter_oauth" &&
      /^\d+$/.test(account.subject) &&
      handle
        ? { xUserId: account.subject, handle }
        : null;
    const wallets = user.linked_accounts.flatMap((a) =>
      a.type === "wallet" && a.chain_type === "ethereum" ? [a.address] : [],
    );
    return { privyUserId: userId, xAccount, wallets };
  } catch {
    throw new IdentityError("identity_provider_unavailable", 503);
  }
}
