import { sql } from "drizzle-orm";
import type { Dish, DishDraft } from "@/domain";
import { readDish, type Db } from "@/server/catalog/repository";

export interface Published {
  version: number;
  dish: Dish;
}

/**
 * Every change to the catalog is ONE SQL statement: the dish write and the version bump are CTEs of
 * the same query, so Postgres commits both or neither. That holds on every driver, including the Neon
 * HTTP driver, which cannot run interactive transactions. A device can therefore never cache new
 * dishes under an old version, or a new version without its dish.
 */

const lines = (values: string[]) => sql`ARRAY(
  SELECT line FROM jsonb_array_elements_text(${JSON.stringify(values)}::jsonb) WITH ORDINALITY AS t(line, n) ORDER BY n
)`;

/** The version after the statement, or null when nothing was published. */
async function versionOf(db: Db, statement: ReturnType<typeof sql>): Promise<number | null> {
  const result = await db.execute(statement);
  const rows = (Array.isArray(result) ? result : result.rows) as { version: number | string }[];
  return rows[0] ? Number(rows[0].version) : null;
}

const bump = sql`UPDATE catalog_meta SET version = version + 1, updated_at = now()
  WHERE id = 1 AND EXISTS (SELECT 1 FROM changed) RETURNING version`;

export async function createDish(db: Db, id: string, draft: DishDraft): Promise<Published | null> {
  const version = await versionOf(
    db,
    sql`WITH changed AS (
      INSERT INTO dishes (id, position, meal_type, category, chay, region, name, time_minutes, ingredients, steps, retired, updated_at)
      SELECT ${id}::text, COALESCE((SELECT max(position) FROM dishes), -1) + 1, ${draft.mealType}::text, ${draft.category}::text,
        ${draft.chay}::boolean, ${draft.region}::text, ${draft.name}::text, ${draft.time}::integer,
        ${lines(draft.ingredients)}, ${lines(draft.steps)}, false, now()
      WHERE EXISTS (SELECT 1 FROM catalog_meta WHERE id = 1)
      RETURNING id
    ), bumped AS (${bump}) SELECT version FROM bumped`,
  );
  return version === null ? null : withDish(db, id, version);
}

export async function updateDish(db: Db, id: string, draft: DishDraft): Promise<Published | null> {
  const version = await versionOf(
    db,
    sql`WITH changed AS (
      UPDATE dishes SET meal_type = ${draft.mealType}::text, category = ${draft.category}::text, chay = ${draft.chay}::boolean,
        region = ${draft.region}::text, name = ${draft.name}::text, time_minutes = ${draft.time}::integer,
        ingredients = ${lines(draft.ingredients)}, steps = ${lines(draft.steps)}, updated_at = now()
      WHERE id = ${id}::text
      RETURNING id
    ), bumped AS (${bump}) SELECT version FROM bumped`,
  );
  return version === null ? null : withDish(db, id, version);
}

/** Hides (retired = true) or shows a dish. Returns null when the dish is already in that state. */
export async function setRetired(db: Db, id: string, retired: boolean): Promise<Published | null> {
  const version = await versionOf(
    db,
    sql`WITH changed AS (
      UPDATE dishes SET retired = ${retired}::boolean, updated_at = now()
      WHERE id = ${id}::text AND retired <> ${retired}::boolean
      RETURNING id
    ), bumped AS (${bump}) SELECT version FROM bumped`,
  );
  return version === null ? null : withDish(db, id, version);
}

async function withDish(db: Db, id: string, version: number): Promise<Published | null> {
  const dish = await readDish(db, id);
  return dish ? { version, dish } : null;
}
