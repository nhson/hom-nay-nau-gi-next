import { defineConfig } from "drizzle-kit";

// `generate` only reads the schema; credentials are needed just for commands that touch a database.
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/server/db/schema.ts",
  out: "./drizzle",
  dbCredentials: { url: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL ?? "" },
});
