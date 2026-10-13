import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { applySeed } from "@/server/catalog/repository";
import * as schema from "@/server/db/schema";
import { SEED_DISHES } from "@/seed/dishes";

async function main() {
  const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
  if (!url) {
    console.error("Set DATABASE_URL (or DATABASE_URL_UNPOOLED), e.g. via `vercel env pull .env.local`.");
    process.exit(1);
  }
  const pool = new Pool({ connectionString: url });
  try {
    const result = await applySeed(drizzle(pool, { schema }), SEED_DISHES);
    console.log(
      result.changed
        ? `Catalog updated to version ${result.version}: ${result.added} added, ${result.updated} updated, ${result.retired} retired.`
        : `Catalog already up to date (version ${result.version}).`,
    );
  } finally {
    await pool.end();
  }
}

void main();
