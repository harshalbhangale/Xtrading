import "server-only";
import {
  IdentityError,
  identityService,
} from "@call-my-bluff/database/identity";
import { getMonadChain } from "@call-my-bluff/integrations";
import { getDatabase } from "./database";
import { authenticatedUser } from "./identity-auth";

export function identityOrigin() {
  const value = process.env.NEXT_PUBLIC_APP_URL;
  if (!value) throw new IdentityError("app_origin_unconfigured", 503);
  const url = new URL(value);
  if (
    url.protocol !== "https:" &&
    !(
      url.protocol === "http:" &&
      ["localhost", "127.0.0.1"].includes(url.hostname)
    )
  )
    throw new IdentityError("app_origin_invalid", 503);
  return url.origin;
}
// localhost and 127.0.0.1 are the same local dev server; `pnpm dev` prints the latter.
const LOOPBACK = /^http:\/\/(?:localhost|127\.0\.0\.1)(:\d+)?$/;
export function requireOrigin(request: Request) {
  const origin = identityOrigin();
  const sent = request.headers.get("origin");
  const loopbackAlias =
    sent !== null &&
    LOOPBACK.test(origin) &&
    LOOPBACK.exec(sent)?.[1] === LOOPBACK.exec(origin)?.[1];
  if (sent !== origin && !loopbackAlias)
    throw new IdentityError("origin_not_allowed", 403);
  return origin;
}
export async function identityContext(request: Request) {
  const user = await authenticatedUser(request);
  const database = getDatabase();
  if (!database) throw new IdentityError("database_unavailable", 503);
  return {
    user,
    service: identityService(database.db),
    chainId: getMonadChain(process.env.NEXT_PUBLIC_MONAD_CHAIN_ID).id,
  };
}
export function requireX(user: Awaited<ReturnType<typeof authenticatedUser>>) {
  if (!user.xAccount) throw new IdentityError("x_account_required", 409);
  return {
    privyUserId: user.privyUserId,
    ...user.xAccount,
    wallets: user.wallets,
  };
}
export async function jsonBody(request: Request, maxBytes = 4096) {
  if (request.headers.get("content-type")?.split(";")[0] !== "application/json")
    throw new IdentityError("json_required", 415);
  const reader = request.body?.getReader();
  if (!reader) throw new IdentityError("invalid_body");
  const decoder = new TextDecoder();
  let body = "",
    bytes = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > maxBytes) {
      await reader.cancel();
      throw new IdentityError("body_too_large", 413);
    }
    body += decoder.decode(value, { stream: true });
  }
  try {
    return JSON.parse(body + decoder.decode()) as unknown;
  } catch {
    throw new IdentityError("invalid_body");
  }
}
export function reply(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store", Vary: "Authorization" },
  });
}
export function identityFailure(error: unknown) {
  return error instanceof IdentityError
    ? reply({ error: error.code }, error.status)
    : reply({ error: "identity_unavailable" }, 503);
}
