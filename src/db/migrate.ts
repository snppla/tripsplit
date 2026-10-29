import path from "node:path";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Client } from "pg";

// Arbitrary constant identifying TripSplit's migration lock.
const MIGRATION_LOCK_ID = 727274;

export async function runMigrations() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    // During a rolling deploy two copies of the app can start at once; make
    // the second wait for the first to finish migrating.
    await client.query("select pg_advisory_lock($1)", [MIGRATION_LOCK_ID]);
    await migrate(drizzle(client), { migrationsFolder: path.join(process.cwd(), "drizzle") });
  } finally {
    // Closing the session also releases the lock.
    await client.end();
  }
}
