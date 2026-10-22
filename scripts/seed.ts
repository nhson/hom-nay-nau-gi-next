import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { seedEmptyCatalog } from "@/server/catalog/repository";
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
    const result = await seedEmptyCatalog(drizzle(pool, { schema }), SEED_DISHES);
    if (result.status === "refused") {
      console.error(
        `Refusing to seed: the catalog already has ${result.dishes} dishes. The database is the source of truth ` +
          "(manage dishes in /admin); the seed only bootstraps an empty catalog (ADR-0004).",
      );
      process.exitCode = 1;
      return;
    }
    console.log(`Catalog seeded: version ${result.version}, ${result.added} dishes.`);
  } finally {
    await pool.end();
  }
}

void main();
