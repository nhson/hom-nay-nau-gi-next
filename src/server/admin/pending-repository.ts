import { desc, eq, sql } from "drizzle-orm";
import type { Category, DishDraft, MealType, PendingSourceKind, Region } from "@/domain";
import type { Db } from "@/server/catalog/repository";
import { pendingDishes } from "@/server/db/schema";
import { lines, publish, type Saved } from "./repository";

/** A stored Món chờ duyệt: the proposed dish plus where it came from. Warnings are not stored. */
export interface PendingRecord extends DishDraft {
  id: string;
  source: { kind: PendingSourceKind; url: string | null };
  model: string | null;
  createdAt: string;
  updatedAt: string;
}

type Row = typeof pendingDishes.$inferSelect;

const toRecord = (row: Row): PendingRecord => ({
  id: row.id,
  source: { kind: row.sourceKind as PendingRecord["source"]["kind"], url: row.sourceUrl },
  model: row.model,
  mealType: row.mealType as MealType,
  category: row.category as Category | null,
  chay: row.chay,
  region: row.region as Region | null,
  name: row.name,
  time: row.timeMinutes,
  ingredients: row.ingredients,
  steps: row.steps,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});

const draftColumns = (draft: DishDraft) => ({
  mealType: draft.mealType,
  category: draft.category,
  chay: draft.chay,
  region: draft.region,
  name: draft.name,
  timeMinutes: draft.time,
  ingredients: draft.ingredients,
  steps: draft.steps,
});

export async function insertPending(
  db: Db,
  input: { id: string; source: PendingRecord["source"]; model: string | null; draft: DishDraft; at: Date },
): Promise<PendingRecord> {
  const [row] = await db
    .insert(pendingDishes)
    .values({
      id: input.id,
      sourceKind: input.source.kind,
      sourceUrl: input.source.url,
      model: input.model,
      ...draftColumns(input.draft),
      createdAt: input.at,
      updatedAt: input.at,
    })
    .returning();
  return toRecord(row);
}

/** Several Món chờ duyệt in ONE statement (Nhập từ file): all of them or none. */
export async function insertPendingMany(
  db: Db,
  items: { id: string; draft: DishDraft }[],
  input: { source: PendingRecord["source"]; at: Date },
): Promise<void> {
  if (items.length === 0) return;
  await db.insert(pendingDishes).values(
    items.map((item) => ({
      id: item.id,
      sourceKind: input.source.kind,
      sourceUrl: input.source.url,
      model: null,
      ...draftColumns(item.draft),
      createdAt: input.at,
      updatedAt: input.at,
    })),
  );
}

/** Every Món chờ duyệt, newest first. */
export async function listPending(db: Db): Promise<PendingRecord[]> {
  const rows = await db.select().from(pendingDishes).orderBy(desc(pendingDishes.createdAt), desc(pendingDishes.id));
  return rows.map(toRecord);
}

export async function getPending(db: Db, id: string): Promise<PendingRecord | null> {
  const [row] = await db.select().from(pendingDishes).where(eq(pendingDishes.id, id));
  return row ? toRecord(row) : null;
}

export async function updatePending(db: Db, id: string, draft: DishDraft, at: Date): Promise<PendingRecord | null> {
  const [row] = await db
    .update(pendingDishes)
    .set({ ...draftColumns(draft), updatedAt: at })
    .where(eq(pendingDishes.id, id))
    .returning();
  return row ? toRecord(row) : null;
}

/**
 * Bỏ. False when it was not there. A Món chờ duyệt the Tác nhân thu thập found also marks its page
 * `discarded`, in the same statement, so the agent never proposes it again.
 */
export async function deletePending(db: Db, id: string): Promise<boolean> {
  const result = await db.execute(sql`WITH gone AS (
      DELETE FROM pending_dishes WHERE id = ${id}::text RETURNING id, source_url, source_kind
    ), seen AS (
      UPDATE agent_seen_sources SET outcome = 'discarded', last_processed_at = now()
      WHERE url IN (SELECT source_url FROM gone WHERE source_kind = 'agent')
    )
    SELECT id FROM gone`);
  const rows = Array.isArray(result) ? result : result.rows;
  return rows.length > 0;
}

/**
 * Duyệt, as ONE SQL statement (like every catalog change, see repository.ts): removes the Món chờ
 * duyệt, inserts the dish under `dishId` and bumps the catalog version, all or nothing. Null when the
 * Món chờ duyệt (or the catalog) is not there, so nothing changed. A page the Tác nhân thu thập found
 * is marked `approved` in the same statement.
 */
export function approvePending(db: Db, pendingId: string, dishId: string, draft: DishDraft): Promise<Saved | null> {
  return publish(
    db,
    sql`WITH gone AS (
      DELETE FROM pending_dishes WHERE id = ${pendingId}::text
        AND EXISTS (SELECT 1 FROM catalog_meta WHERE id = 1)
      RETURNING id, source_url, source_kind
    ), seen AS (
      UPDATE agent_seen_sources SET outcome = 'approved', last_processed_at = now()
      WHERE url IN (SELECT source_url FROM gone WHERE source_kind = 'agent')
    ), changed AS (
      INSERT INTO dishes (id, position, meal_type, category, chay, region, name, time_minutes, ingredients, steps, retired, updated_at)
      SELECT ${dishId}::text, COALESCE((SELECT max(position) FROM dishes), -1) + 1, ${draft.mealType}::text, ${draft.category}::text,
        ${draft.chay}::boolean, ${draft.region}::text, ${draft.name}::text, ${draft.time}::integer,
        ${lines(draft.ingredients)}, ${lines(draft.steps)}, false, now()
      WHERE EXISTS (SELECT 1 FROM gone)
      RETURNING retired, updated_at
    ), bumped AS (
      UPDATE catalog_meta SET version = version + 1, updated_at = now()
      WHERE id = 1 AND EXISTS (SELECT 1 FROM changed) RETURNING version
    )
    SELECT bumped.version AS version, changed.retired AS retired, changed.updated_at AS updated_at FROM bumped, changed`,
  );
}
