import { databaseReadiness } from "@call-my-bluff/database/client";
import { getDatabase } from "../../../lib/database";

export const dynamic = "force-dynamic";
export async function GET() {
  let database:
    | "unconfigured"
    | "unavailable"
    | "migration_required"
    | "ready" = "unconfigured";
  try {
    const connection = getDatabase();
    if (connection) {
      database = (await databaseReadiness(connection.sql))
        ? "ready"
        : "migration_required";
    }
  } catch {
    database = "unavailable";
  }
  return Response.json(
    { application: "call-my-bluff", database },
    {
      status: database === "ready" ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
