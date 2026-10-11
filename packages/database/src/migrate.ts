import { fileURLToPath } from "node:url";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { createDatabase } from "./client";

let connection: ReturnType<typeof createDatabase> | undefined;
try {
  connection = createDatabase(
    process.env.DATABASE_URL ??
      "postgresql://cmb:cmb_local@localhost:5433/call_my_bluff",
  );
  await migrate(connection.db, {
    migrationsFolder: fileURLToPath(new URL("../migrations", import.meta.url)),
  });
  console.log("Database migrations applied successfully.");
} catch {
  console.error(
    "Database migration failed. Check connectivity and schema privately.",
  );
  process.exitCode = 1;
} finally {
  await connection?.sql.end({ timeout: 5 });
}
