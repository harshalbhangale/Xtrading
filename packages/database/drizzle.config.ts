import { defineConfig } from "drizzle-kit";
import { databaseOptions } from "./src/client";

const connection = databaseOptions(
  process.env.DATABASE_URL ??
    "postgresql://cmb:cmb_local@localhost:5433/call_my_bluff",
);
if (connection.options.ssl && process.env.DATABASE_CA_FILE) {
  Object.assign(connection.options.ssl, {
    ca: readFileSync(process.env.DATABASE_CA_FILE, "utf8"),
  });
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema.ts",
  out: "./migrations",
  dbCredentials: {
    url: connection.url,
    ssl: connection.options.ssl,
  },
});

import { readFileSync } from "node:fs";
