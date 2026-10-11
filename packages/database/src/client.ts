import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export function databaseOptions(connectionString: string) {
  const url = new URL(connectionString);
  if (!["postgres:", "postgresql:"].includes(url.protocol)) {
    throw new Error("DATABASE_URL must be a PostgreSQL connection URL");
  }
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (!local && url.searchParams.get("sslmode") !== "verify-full") {
    throw new Error("Remote databases require sslmode=verify-full");
  }
  // TLS is configured explicitly, never downgraded by connection-string options.
  url.searchParams.delete("sslmode");
  return {
    url: url.toString(),
    options: {
      ssl: local ? false : { rejectUnauthorized: true },
      max: 5,
      connect_timeout: 5,
      idle_timeout: 20,
      connection: { statement_timeout: 5000 },
      prepare: false,
    },
  };
}

export function createDatabase(connectionString: string) {
  const { url, options } = databaseOptions(connectionString);
  const caFile = process.env.DATABASE_CA_FILE;
  if (options.ssl && caFile) {
    Object.assign(options.ssl, { ca: readFileSync(caFile, "utf8") });
  }
  const sql = postgres(url, options);
  return { sql, db: drizzle(sql, { schema }) };
}

export async function databaseReadiness(sql: ReturnType<typeof postgres>) {
  const rows = await sql<{ ready: boolean }[]>`
    select to_regclass('public.creators') is not null
      and to_regclass('public.calls') is not null
      and to_regclass('public.trade_intents') is not null
      and to_regclass('public.fills') is not null
      and to_regclass('public.stake_snapshots') is not null as ready
  `;
  return rows[0]?.ready === true;
}

import { readFileSync } from "node:fs";
