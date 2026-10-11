import { identityStatusSchema } from "@call-my-bluff/domain";
import {
  identityContext,
  identityFailure,
  reply,
} from "../../../lib/identity-http";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    const { user, service } = await identityContext(request);
    const binding = await service.current(user.privyUserId);
    const bindingCurrent = Boolean(
      binding &&
        user.xAccount?.xUserId === binding.xUserId &&
        user.xAccount.handle === binding.handle &&
        user.wallets.some((w) => w.toLowerCase() === binding.wallet),
    );
    return reply(
      identityStatusSchema.parse({
        xAccount: user.xAccount,
        binding,
        bindingCurrent,
      }),
    );
  } catch (error) {
    return identityFailure(error);
  }
}
