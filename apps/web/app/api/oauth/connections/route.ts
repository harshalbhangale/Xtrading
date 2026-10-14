import { authenticatedUser } from "../../../../lib/identity-auth";
import { identityFailure, reply } from "../../../../lib/identity-http";
import { revokeAllFor } from "../../../../lib/oauth";
export const dynamic = "force-dynamic";

// Disconnects every connector (claude.ai etc.) the signed-in user has approved.
export async function DELETE(request: Request) {
  try {
    const user = await authenticatedUser(request);
    await revokeAllFor(user.privyUserId);
    return reply({ revoked: true });
  } catch (error) {
    return identityFailure(error);
  }
}
