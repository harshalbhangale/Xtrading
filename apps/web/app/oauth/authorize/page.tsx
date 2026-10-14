import type { Metadata } from "next";
import { ConsentControl } from "../../../components/oauth-consent-control";
import { checkAuthorizeRequest, OAuthError } from "../../../lib/oauth";
export const metadata: Metadata = { title: "Connect to Xtrading" };
export const dynamic = "force-dynamic";

export default async function AuthorizePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(raw))
    if (typeof value === "string") params.set(key, value);
  let request: Awaited<ReturnType<typeof checkAuthorizeRequest>> | null = null;
  let problem = "";
  try {
    request = await checkAuthorizeRequest(params);
  } catch (error) {
    problem =
      error instanceof OAuthError
        ? error.description
        : "This sign-in link could not be checked. Try connecting again.";
  }
  return (
    <section className="oauth-page">
      <div className="oauth-card">
        <p className="oauth-brand">Xtrading</p>
        {request ? (
          <>
            <h1>Connect {request.clientName}</h1>
            <p>
              <strong>{request.clientName}</strong> (
              <code>{request.redirectHost}</code>) wants to use your Xtrading
              account through the Xtrading MCP connector.
            </p>
            <ul className="oauth-scopes">
              <li>Read markets, creator calls and your portfolio</li>
              <li>Read your Perpl and Kuru positions</li>
              <li>
                Prepare unsigned trades for you to approve in your own wallet
              </li>
            </ul>
            <p className="small-note">
              It can never sign, send or move funds. You can disconnect it any
              time from Agent access.
            </p>
            <ConsentControl query={params.toString()} />
          </>
        ) : (
          <>
            <h1>Can’t connect</h1>
            <p className="form-message">{problem}</p>
          </>
        )}
      </div>
    </section>
  );
}
