import { IdentityError } from "@call-my-bluff/database/identity";
import { callBondActionSchema } from "@call-my-bluff/domain";
import { z } from "zod";
import { callBondContext, prepareCallBond } from "../../../../../lib/call-bond";
import {
  identityFailure,
  jsonBody,
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
    return reply((await callBondContext(request, await callId(context))).state);
  } catch (error) {
    return identityFailure(error);
  }
}

export async function POST(request: Request, context: Params) {
  try {
    requireOrigin(request);
    const id = await callId(context);
    const body = callBondActionSchema.safeParse(await jsonBody(request));
    if (!body.success) throw new IdentityError("invalid_body");
    return reply(
      await prepareCallBond(request, id, body.data.action, body.data.amount),
    );
  } catch (error) {
    return identityFailure(error);
  }
}
