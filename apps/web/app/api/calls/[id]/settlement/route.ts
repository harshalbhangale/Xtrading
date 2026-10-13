import { IdentityError } from "@call-my-bluff/database/identity";
import { z } from "zod";
import {
  callSettlementContext,
  prepareCallRecord,
} from "../../../../../lib/call-settlement";
import {
  identityFailure,
  reply,
  requireOrigin,
} from "../../../../../lib/identity-http";

export const dynamic = "force-dynamic";
type Params = { params: Promise<{ id: string }> };

async function callId({ params }: Params) {
  const id = z.uuid().safeParse((await params).id);
  if (!id.success) throw new IdentityError("invalid_call");
  return id.data;
}

export async function GET(request: Request, context: Params) {
  try {
    return reply(
      (await callSettlementContext(request, await callId(context))).state,
    );
  } catch (error) {
    return identityFailure(error);
  }
}

/** Prepares the creator's zero-bond registerCall; nothing is signed here. */
export async function POST(request: Request, context: Params) {
  try {
    requireOrigin(request);
    return reply(await prepareCallRecord(request, await callId(context)));
  } catch (error) {
    return identityFailure(error);
  }
}
