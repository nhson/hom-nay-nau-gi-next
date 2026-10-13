import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

export class DatabaseNotConfiguredError extends Error {
  constructor() {
    super("DATABASE_URL is not set");
    this.name = "DatabaseNotConfiguredError";
  }
}

function create(url: string) {
  return drizzle(neon(url), { schema });
}

let cached: ReturnType<typeof create> | null = null;

/**
 * Lazy so `next build` never needs the environment variable. Plain function on purpose, not a
 * Proxy wrapper (those break libraries that introspect the client). The HTTP driver does not
 * support transactions, so seeding and migrating use a TCP client (see scripts/).
 */
export function getDb() {
  if (cached) return cached;
  const url = process.env.DATABASE_URL;
  if (!url) throw new DatabaseNotConfiguredError();
  cached = create(url);
  return cached;
}
