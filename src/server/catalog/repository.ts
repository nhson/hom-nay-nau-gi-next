import { asc, eq, inArray, sql } from "drizzle-orm";
import type { PgDatabase } from "drizzle-orm/pg-core";
import type { Category, Dish, MealType, Region } from "@/domain";
import { catalogMeta, dishes } from "@/server/db/schema";
import type * as schema from "@/server/db/schema";

// Works with every Drizzle Postgres driver (Neon HTTP at runtime, node-postgres for scripts,
// PGlite in tests).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Db = PgDatabase<any, typeof schema>;

export interface CatalogSnapshot {
  version: number;
  dishes: Dish[];
}

type DishRow = typeof dishes.$inferSelect;

function rowToDish(row: DishRow): Dish {
  return {
    id: row.id,
    mealType: row.mealType as MealType,
    category: row.category as Category | null,
    chay: row.chay,
    region: row.region as Region | null,
    name: row.name,
    time: row.timeMinutes,
    ingredients: row.ingredients,
    steps: row.steps,
    retired: row.retired,
  };
}

/** A dish plus when it was last changed: for the admin only, never published to devices. */
export type AdminDish = Dish & { updatedAt: string };

const toAdminDish = (row: DishRow): AdminDish => ({ ...rowToDish(row), updatedAt: row.updatedAt.toISOString() });

export async function readAdminCatalog(db: Db): Promise<{ version: number; dishes: AdminDish[] } | null> {
  const [meta] = await db.select().from(catalogMeta).where(eq(catalogMeta.id, 1));
  if (!meta) return null;
  const rows = await db.select().from(dishes).orderBy(asc(dishes.position));
  return { version: meta.version, dishes: rows.map(toAdminDish) };
}

/** The whole catalog, or null when it has never been seeded. */
export async function readCatalog(db: Db): Promise<CatalogSnapshot | null> {
  // Read the version BEFORE the dishes. If a seed commits in between, the client receives newer
  // dishes labelled with the older version and simply refetches next time. The reverse order could
  // cache stale dishes under a new version forever.
  const [meta] = await db.select().from(catalogMeta).where(eq(catalogMeta.id, 1));
  if (!meta) return null;
  const rows = await db.select().from(dishes).orderBy(asc(dishes.position));
  return { version: meta.version, dishes: rows.map(rowToDish) };
}

export interface SeedResult {
  changed: boolean;
  version: number;
  added: number;
  updated: number;
  retired: number;
}

type NewRow = typeof dishes.$inferInsert;

function toRow(dish: Dish, position: number): NewRow {
  return {
    id: dish.id,
    position,
    mealType: dish.mealType,
    category: dish.category,
    chay: dish.chay,
    region: dish.region,
    name: dish.name,
    timeMinutes: dish.time,
    ingredients: dish.ingredients,
    steps: dish.steps,
    retired: false,
  };
}

function sameContent(existing: DishRow, next: NewRow): boolean {
  return (
    existing.position === next.position &&
    existing.mealType === next.mealType &&
    existing.category === next.category &&
    existing.chay === next.chay &&
    existing.region === next.region &&
    existing.name === next.name &&
    existing.timeMinutes === next.timeMinutes &&
    existing.retired === next.retired &&
    JSON.stringify(existing.ingredients) === JSON.stringify(next.ingredients) &&
    JSON.stringify(existing.steps) === JSON.stringify(next.steps)
  );
}

/**
 * Makes the database match `seed`, idempotently: upserts by id, retires ids missing from the seed,
 * and bumps the catalog version only when something actually changed. Needs a driver with
 * transactions (node-postgres or PGlite, not the Neon HTTP driver).
 */
export async function applySeed(db: Db, seed: readonly Dish[]): Promise<SeedResult> {
  const ids = new Set<string>();
  for (const dish of seed) {
    if (ids.has(dish.id)) throw new Error(`Duplicate dish id in seed: ${dish.id}`);
    ids.add(dish.id);
  }

  return db.transaction(async (tx) => {
    const current = await tx.select().from(dishes);
    const currentById = new Map(current.map((row) => [row.id, row]));

    let added = 0;
    let updated = 0;
    const upserts: NewRow[] = [];
    seed.forEach((dish, position) => {
      const next = toRow(dish, position);
      const existing = currentById.get(dish.id);
      if (!existing) {
        added += 1;
        upserts.push(next);
      } else if (!sameContent(existing, next)) {
        updated += 1;
        upserts.push(next);
      }
    });
    const toRetire = current.filter((row) => !ids.has(row.id) && !row.retired).map((row) => row.id);

    const [meta] = await tx.select().from(catalogMeta).where(eq(catalogMeta.id, 1));
    const changed = upserts.length > 0 || toRetire.length > 0 || !meta;
    if (!changed) {
      return { changed: false, version: meta.version, added: 0, updated: 0, retired: 0 };
    }

    for (const row of upserts) {
      const { id: _id, ...rest } = row;
      void _id;
      await tx
        .insert(dishes)
        .values(row)
        .onConflictDoUpdate({ target: dishes.id, set: { ...rest, updatedAt: sql`now()` } });
    }
    if (toRetire.length > 0) {
      await tx
        .update(dishes)
        .set({ retired: true, updatedAt: sql`now()` })
        .where(inArray(dishes.id, toRetire));
    }
    const version = meta ? meta.version + 1 : 1;
    await tx
      .insert(catalogMeta)
      .values({ id: 1, version })
      .onConflictDoUpdate({ target: catalogMeta.id, set: { version, updatedAt: sql`now()` } });

    return { changed: true, version, added, updated, retired: toRetire.length };
  });
}

export type SeedEmptyResult =
  | ({ status: "seeded" } & SeedResult)
  | { status: "refused"; dishes: number };

/**
 * What `db:seed` runs. The database is the source of truth once the admin page exists (ADR-0004), so
 * the seed only bootstraps an EMPTY catalog and refuses to touch one that already has dishes: a stray
 * command must never overwrite the Quản trị viên's edits or hide the dishes they added.
 */
export async function seedEmptyCatalog(db: Db, seed: readonly Dish[]): Promise<SeedEmptyResult> {
  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(dishes);
  if (count > 0) return { status: "refused", dishes: count };
  return { status: "seeded", ...(await applySeed(db, seed)) };
}
