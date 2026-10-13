import { PGlite } from "@electric-sql/pglite";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import * as schema from "@/server/db/schema";

/**
 * A hermetic in-memory Postgres (PGlite) with the REAL migrations applied, so tests exercise the
 * actual constraints. No network, no shared state.
 */
export async function createTestDb() {
  const client = new PGlite();
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: "./drizzle" });
  return {
    db,
    reset: async () => {
      await db.execute(sql`truncate table dishes, catalog_meta`);
    },
    close: () => client.close(),
  };
}

/** Collects an error's message plus its `cause` chain (Drizzle wraps driver errors). */
export function errorText(error: unknown): string {
  const parts: string[] = [];
  let current: unknown = error;
  while (current instanceof Error) {
    parts.push(current.message);
    current = current.cause;
  }
  return parts.join(" | ");
}
