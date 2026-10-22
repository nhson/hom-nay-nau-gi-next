import { sql } from "drizzle-orm";
import type { DishDraft } from "@/domain";
import type { Db } from "@/server/catalog/repository";

/** What a committed change reports: the new catalog version and the facts only the database knows. */
export interface Saved {
  version: number;
  retired: boolean;
  updatedAt: string;
}

/**
 * Every change to the catalog is ONE SQL statement: the dish write and the version bump are CTEs of
 * the same query, so Postgres commits both or neither. That holds on every driver, including the Neon
 * HTTP driver, which cannot run interactive transactions. A device can therefore never cache new
 * dishes under an old version, or a new version without its dish. The statement also returns what the
 * response needs, so nothing is read after the commit that could fail and misreport a saved change.
 */

const lines = (values: string[]) => sql`ARRAY(
  SELECT line FROM jsonb_array_elements_text(${JSON.stringify(values)}::jsonb) WITH ORDINALITY AS t(line, n) ORDER BY n
)`;

const bump = sql`UPDATE catalog_meta SET version = version + 1, updated_at = now()
  WHERE id = 1 AND EXISTS (SELECT 1 FROM changed) RETURNING version`;

/** Runs the statement; null when nothing was published (the dish or the catalog was not there). */
async function publish(db: Db, statement: ReturnType<typeof sql>): Promise<Saved | null> {
  const result = await db.execute(statement);
  const rows = (Array.isArray(result) ? result : result.rows) as {
    version: number | string;
    retired: boolean;
    updated_at: string | Date;
  }[];
  const row = rows[0];
  return row
    ? { version: Number(row.version), retired: row.retired, updatedAt: new Date(row.updated_at).toISOString() }
    : null;
}

const report = sql`SELECT bumped.version AS version, changed.retired AS retired, changed.updated_at AS updated_at FROM bumped, changed`;

export function createDish(db: Db, id: string, draft: DishDraft): Promise<Saved | null> {
  return publish(
    db,
    sql`WITH changed AS (
      INSERT INTO dishes (id, position, meal_type, category, chay, region, name, time_minutes, ingredients, steps, retired, updated_at)
      SELECT ${id}::text, COALESCE((SELECT max(position) FROM dishes), -1) + 1, ${draft.mealType}::text, ${draft.category}::text,
        ${draft.chay}::boolean, ${draft.region}::text, ${draft.name}::text, ${draft.time}::integer,
        ${lines(draft.ingredients)}, ${lines(draft.steps)}, false, now()
      WHERE EXISTS (SELECT 1 FROM catalog_meta WHERE id = 1)
      RETURNING retired, updated_at
    ), bumped AS (${bump}) ${report}`,
  );
}

export function updateDish(db: Db, id: string, draft: DishDraft): Promise<Saved | null> {
  return publish(
    db,
    sql`WITH changed AS (
      UPDATE dishes SET meal_type = ${draft.mealType}::text, category = ${draft.category}::text, chay = ${draft.chay}::boolean,
        region = ${draft.region}::text, name = ${draft.name}::text, time_minutes = ${draft.time}::integer,
        ingredients = ${lines(draft.ingredients)}, steps = ${lines(draft.steps)}, updated_at = now()
      WHERE id = ${id}::text
      RETURNING retired, updated_at
    ), bumped AS (${bump}) ${report}`,
  );
}

/** Hides (retired = true) or shows a dish. Null when the dish is missing or already in that state. */
export function setRetired(db: Db, id: string, retired: boolean): Promise<Saved | null> {
  return publish(
    db,
    sql`WITH changed AS (
      UPDATE dishes SET retired = ${retired}::boolean, updated_at = now()
      WHERE id = ${id}::text AND retired <> ${retired}::boolean
      RETURNING retired, updated_at
    ), bumped AS (${bump}) ${report}`,
  );
}

/** Postgres refused a duplicate key (two people picked the same new id at the same moment). */
export function isUniqueViolation(error: unknown): boolean {
  for (let current: unknown = error; current instanceof Error; current = current.cause) {
    if ((current as { code?: string }).code === "23505") return true;
  }
  return false;
}
