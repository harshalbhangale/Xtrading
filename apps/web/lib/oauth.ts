import "server-only";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { oauthClients, oauthCodes, oauthTokens } from "@call-my-bluff/database";
import { IdentityError } from "@call-my-bluff/database/identity";
import { and, eq, gt, isNull } from "drizzle-orm";
import { getDatabase } from "./database";

/**
 * A small OAuth 2.1 authorization server for the MCP connector: dynamic client
 * registration, authorization code with PKCE (S256 only), and rotating refresh
 * tokens. The user signs in with Privy and approves on /oauth/authorize. Access
 * tokens are opaque, stored as hashes, and accepted only on the MCP endpoint.
 */
export const SCOPE = "mcp";
export const ACCESS_PREFIX = "xto_at_";
const REFRESH_PREFIX = "xto_rt_";
const ACCESS_TTL_S = 24 * 60 * 60;
const REFRESH_TTL_S = 90 * 24 * 60 * 60;
const CODE_TTL_S = 300;

export class OAuthError extends Error {
  constructor(
    readonly code: string,
    readonly description: string,
    readonly status = 400,
  ) {
    super(description);
  }
}

const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
const secret = (prefix: string) =>
  `${prefix}${randomBytes(32).toString("base64url")}`;

function db() {
  const database = getDatabase();
  if (!database)
    throw new OAuthError(
      "temporarily_unavailable",
      "Database unavailable",
      503,
    );
  return database.db;
}

export function origin(request: Request) {
  const configured = process.env.NEXT_PUBLIC_APP_URL;
  if (configured && /^https:\/\//.test(configured))
    return configured.replace(/\/$/, "");
  return new URL(request.url).origin;
}

export function serverMetadata(request: Request) {
  const base = origin(request);
  return {
    issuer: base,
    authorization_endpoint: `${base}/oauth/authorize`,
    token_endpoint: `${base}/api/oauth/token`,
    registration_endpoint: `${base}/api/oauth/register`,
    revocation_endpoint: `${base}/api/oauth/revoke`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none"],
    scopes_supported: [SCOPE],
  };
}

export function resourceMetadata(request: Request) {
  const base = origin(request);
  return {
    resource: `${base}/mcp`,
    authorization_servers: [base],
    scopes_supported: [SCOPE],
    bearer_methods_supported: ["header"],
    resource_name: "Xtrading",
  };
}

/** Redirects must be https, or http on loopback for local clients. No fragments. */
function validRedirect(uri: unknown): uri is string {
  if (typeof uri !== "string" || uri.length > 500) return false;
  try {
    const url = new URL(uri);
    if (url.hash) return false;
    if (url.protocol === "https:") return true;
    return (
      url.protocol === "http:" &&
      ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
    );
  } catch {
    return false;
  }
}

export async function registerClient(body: unknown) {
  const input = (body ?? {}) as {
    redirect_uris?: unknown;
    client_name?: unknown;
  };
  const uris = Array.isArray(input.redirect_uris) ? input.redirect_uris : [];
  if (uris.length === 0 || uris.length > 10 || !uris.every(validRedirect))
    throw new OAuthError(
      "invalid_redirect_uri",
      "Provide 1–10 https redirect URIs.",
    );
  const name =
    typeof input.client_name === "string" && input.client_name.trim()
      ? input.client_name.trim().slice(0, 80)
      : "MCP client";
  const clientId = `xtc_${randomBytes(16).toString("base64url")}`;
  await db()
    .insert(oauthClients)
    .values({ clientId, clientName: name, redirectUris: uris as string[] });
  return {
    client_id: clientId,
    client_name: name,
    redirect_uris: uris,
    grant_types: ["authorization_code", "refresh_token"],
    response_types: ["code"],
    token_endpoint_auth_method: "none",
    client_id_issued_at: Math.floor(Date.now() / 1000),
  };
}

export async function getClient(clientId: string) {
  if (!/^xtc_[A-Za-z0-9_-]{10,40}$/.test(clientId)) return null;
  const [client] = await db()
    .select()
    .from(oauthClients)
    .where(eq(oauthClients.clientId, clientId))
    .limit(1);
  return client ?? null;
}

/** Checks an authorization request before the consent screen is shown. */
export async function checkAuthorizeRequest(params: URLSearchParams) {
  const clientId = params.get("client_id") ?? "";
  const redirectUri = params.get("redirect_uri") ?? "";
  const client = await getClient(clientId);
  if (!client) throw new OAuthError("invalid_client", "Unknown client.");
  if (!client.redirectUris.includes(redirectUri))
    throw new OAuthError(
      "invalid_request",
      "redirect_uri is not registered for this client.",
    );
  if (params.get("response_type") !== "code")
    throw new OAuthError(
      "unsupported_response_type",
      "Use response_type=code.",
    );
  const challenge = params.get("code_challenge") ?? "";
  if (
    params.get("code_challenge_method") !== "S256" ||
    !/^[A-Za-z0-9_-]{43,128}$/.test(challenge)
  )
    throw new OAuthError("invalid_request", "PKCE with S256 is required.");
  return {
    clientId,
    clientName: client.clientName,
    redirectUri,
    redirectHost: new URL(redirectUri).host,
    codeChallenge: challenge,
    state: params.get("state"),
  };
}

/** The signed-in user approved: issue a one-time code and the redirect to send them to. */
export async function approve(privyUserId: string, params: URLSearchParams) {
  const request = await checkAuthorizeRequest(params);
  const code = secret("xto_code_");
  await db()
    .insert(oauthCodes)
    .values({
      codeHash: hash(code),
      clientId: request.clientId,
      privyUserId,
      redirectUri: request.redirectUri,
      codeChallenge: request.codeChallenge,
      scope: SCOPE,
      expiresAt: new Date(Date.now() + CODE_TTL_S * 1000),
    });
  const url = new URL(request.redirectUri);
  url.searchParams.set("code", code);
  if (request.state) url.searchParams.set("state", request.state);
  return url.href;
}

async function issue(clientId: string, privyUserId: string) {
  const access = secret(ACCESS_PREFIX);
  const refresh = secret(REFRESH_PREFIX);
  const now = Date.now();
  await db()
    .insert(oauthTokens)
    .values([
      {
        tokenHash: hash(access),
        kind: "access",
        clientId,
        privyUserId,
        scope: SCOPE,
        expiresAt: new Date(now + ACCESS_TTL_S * 1000),
      },
      {
        tokenHash: hash(refresh),
        kind: "refresh",
        clientId,
        privyUserId,
        scope: SCOPE,
        expiresAt: new Date(now + REFRESH_TTL_S * 1000),
      },
    ]);
  return {
    access_token: access,
    token_type: "Bearer",
    expires_in: ACCESS_TTL_S,
    refresh_token: refresh,
    scope: SCOPE,
  };
}

function pkceMatches(verifier: string, challenge: string) {
  if (!/^[A-Za-z0-9._~-]{43,128}$/.test(verifier)) return false;
  const computed = Buffer.from(
    createHash("sha256").update(verifier).digest("base64url"),
  );
  const expected = Buffer.from(challenge);
  return (
    computed.length === expected.length && timingSafeEqual(computed, expected)
  );
}

export async function exchange(form: URLSearchParams) {
  const grant = form.get("grant_type");
  const clientId = form.get("client_id") ?? "";
  const client = await getClient(clientId);
  if (!client) throw new OAuthError("invalid_client", "Unknown client.", 401);

  if (grant === "authorization_code") {
    const code = form.get("code") ?? "";
    const [row] = await db()
      .update(oauthCodes)
      .set({ usedAt: new Date() })
      .where(
        and(
          eq(oauthCodes.codeHash, hash(code)),
          isNull(oauthCodes.usedAt),
          gt(oauthCodes.expiresAt, new Date()),
        ),
      )
      .returning();
    if (
      !row ||
      row.clientId !== clientId ||
      row.redirectUri !== (form.get("redirect_uri") ?? "") ||
      !pkceMatches(form.get("code_verifier") ?? "", row.codeChallenge)
    )
      throw new OAuthError("invalid_grant", "Invalid or expired code.");
    return issue(clientId, row.privyUserId);
  }

  if (grant === "refresh_token") {
    const token = form.get("refresh_token") ?? "";
    // Rotation: the presented refresh token is revoked as it is used.
    const [row] = await db()
      .update(oauthTokens)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(oauthTokens.tokenHash, hash(token)),
          eq(oauthTokens.kind, "refresh"),
          isNull(oauthTokens.revokedAt),
          gt(oauthTokens.expiresAt, new Date()),
        ),
      )
      .returning();
    if (!row || row.clientId !== clientId)
      throw new OAuthError("invalid_grant", "Invalid refresh token.");
    return issue(clientId, row.privyUserId);
  }

  throw new OAuthError("unsupported_grant_type", "Unsupported grant_type.");
}

export async function revoke(token: string) {
  if (!token) return;
  await db()
    .update(oauthTokens)
    .set({ revokedAt: new Date() })
    .where(eq(oauthTokens.tokenHash, hash(token)));
}

/** Revokes every connector token the user has issued. */
export async function revokeAllFor(privyUserId: string) {
  await db()
    .update(oauthTokens)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(oauthTokens.privyUserId, privyUserId),
        isNull(oauthTokens.revokedAt),
      ),
    );
}

/** The Privy user behind a live access token, or null. */
export async function accessTokenUser(token: string) {
  if (!token.startsWith(ACCESS_PREFIX) || token.length > 200) return null;
  const database = getDatabase();
  if (!database) throw new IdentityError("database_unavailable", 503);
  const [row] = await database.db
    .select({ privyUserId: oauthTokens.privyUserId })
    .from(oauthTokens)
    .where(
      and(
        eq(oauthTokens.tokenHash, hash(token)),
        eq(oauthTokens.kind, "access"),
        isNull(oauthTokens.revokedAt),
        gt(oauthTokens.expiresAt, new Date()),
      ),
    )
    .limit(1);
  return row?.privyUserId ?? null;
}

export function oauthFailure(error: unknown) {
  if (error instanceof OAuthError)
    return Response.json(
      { error: error.code, error_description: error.description },
      { status: error.status, headers: cors({ "Cache-Control": "no-store" }) },
    );
  return Response.json(
    { error: "server_error" },
    { status: 500, headers: cors({ "Cache-Control": "no-store" }) },
  );
}

export function cors(headers: Record<string, string> = {}) {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    ...headers,
  };
}
