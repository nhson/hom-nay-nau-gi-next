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

/**
 * Failed admin sign-ins per client, so repeated wrong passwords lock that client out for a while.
 * Holds only a network-address key and a counter; the row is deleted on a successful sign-in.
 */
export const adminLoginAttempts = pgTable("admin_login_attempts", {
  key: text("key").primaryKey(),
  failures: integer("failures").notNull().default(0),
  lockedUntil: timestamp("locked_until", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

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

/**
 * Món chờ duyệt (ADR-0006): dishes an AI model proposed, waiting for the Quản trị viên. Never read by
 * the public catalog or the export. The draft columns are deliberately looser than `dishes` (a proposal
 * may be incomplete); Duyệt runs the full dish rules. Warnings are derived when read, never stored.
 */
export const pendingDishes = pgTable(
  "pending_dishes",
  {
    id: text("id").primaryKey(),
    /** `menu`: Ảnh thực đơn (AI-written recipe). `agent`: Tác nhân thu thập (spec B). `photo`: the old recipe-photo upload, kept for rows made before it was replaced. */
    sourceKind: text("source_kind").notNull(),
    /** The page the dish came from (agent only). */
    sourceUrl: text("source_url"),
    /** The model that produced it, as OpenRouter reported it. */
    model: text("model"),
    mealType: text("meal_type").notNull(),
    category: text("category"),
    chay: boolean("chay").notNull().default(false),
    region: text("region"),
    name: text("name").notNull().default(""),
    timeMinutes: integer("time_minutes"),
    ingredients: text("ingredients").array().notNull(),
    steps: text("steps").array().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check("pending_dishes_source_kind_valid", sql`${t.sourceKind} in ('menu', 'agent', 'photo')`),
    check("pending_dishes_meal_type_valid", sql`${t.mealType} in ('buacom', 'buatomonuoc')`),
    check("pending_dishes_category_valid", sql`${t.category} is null or ${t.category} in ('xao', 'canh', 'man')`),
    check("pending_dishes_region_valid", sql`${t.region} is null or ${t.region} in ('bac', 'trung', 'nam')`),
  ],
);
