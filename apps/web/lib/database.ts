import "server-only";
import { createDatabase } from "@call-my-bluff/database/client";

let connection: ReturnType<typeof createDatabase> | undefined;

export function getDatabase() {
  const url = process.env.DATABASE_URL;
  if (!url) return undefined;
  connection ??= createDatabase(url);
  return connection;
}
