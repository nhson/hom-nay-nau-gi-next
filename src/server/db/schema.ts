import { sql } from "drizzle-orm";
import { boolean, check, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

/**
 * Server catalog. Ids are the stable legacy ids (x1, c1, m1, t1 ...). Dishes are never hard-deleted:
 * removing one from the seed sets `retired`, so history and favorites keep resolving.
 */
export const dishes = pgTable(
  "dishes",
  {
    id: text("id").primaryKey(),
    /** Index in the seed file; keeps catalog order deterministic. Not exposed by the API. */
    position: integer("position").notNull(),
    mealType: text("meal_type").notNull(),
    category: text("category"),
    chay: boolean("chay").notNull().default(false),
    region: text("region"),
    name: text("name").notNull(),
    timeMinutes: integer("time_minutes"),
    ingredients: text("ingredients").array().notNull(),
    steps: text("steps").array().notNull(),
    retired: boolean("retired").notNull().default(false),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check("dishes_meal_type_valid", sql`${t.mealType} in ('buacom', 'buatomonuoc')`),
    check(
      "dishes_category_rule",
      // `is not null` is explicit: a CHECK passes when it evaluates to NULL, and `NULL in (...)` is NULL.
      sql`(${t.mealType} = 'buacom' and ${t.category} is not null and ${t.category} in ('xao', 'canh', 'man')) or (${t.mealType} = 'buatomonuoc' and ${t.category} is null)`,
    ),
    check("dishes_region_valid", sql`${t.region} is null or ${t.region} in ('bac', 'trung', 'nam')`),
    check("dishes_ingredients_nonempty", sql`cardinality(${t.ingredients}) > 0`),
    check("dishes_time_positive", sql`${t.timeMinutes} is null or ${t.timeMinutes} > 0`),
  ],
);

/** One row. `version` increases only when seed content changes (drives the API's ETag). */
export const catalogMeta = pgTable(
  "catalog_meta",
  {
    id: integer("id").primaryKey().default(1),
    version: integer("version").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [check("catalog_meta_singleton", sql`${t.id} = 1`)],
);
