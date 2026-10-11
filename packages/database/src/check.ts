import { createDatabase, databaseReadiness } from "./client";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("Set DATABASE_URL explicitly before running db:check.");
  process.exitCode = 1;
} else {
  let connection: ReturnType<typeof createDatabase> | undefined;
  try {
    connection = createDatabase(connectionString);
    const ready = await databaseReadiness(connection.sql);
    console.log(
      JSON.stringify({ connected: true, foundationTablesPresent: ready }),
    );
    if (!ready) process.exitCode = 1;
  } catch {
    // Connection errors can include hosts, users or connection strings.
    console.error(
      "Database check failed; inspect configuration and connectivity privately.",
    );
    process.exitCode = 1;
  } finally {
    await connection?.sql.end({ timeout: 5 });
  }
}
