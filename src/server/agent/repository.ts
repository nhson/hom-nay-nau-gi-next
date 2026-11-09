import { desc, eq, sql } from "drizzle-orm";
import { AGENT_SETTINGS_DEFAULTS, type AgentSettings, type RunEntry, type SeenOutcome, type SeenSource } from "@/domain";
import type { Db } from "@/server/catalog/repository";
import { agentRuns, agentSeenSources, agentSettings } from "@/server/db/schema";
import type { AgentRun } from "@/shared/schemas";

/** How many runs Lần chạy gần nhất keeps; older ones are pruned when a run is recorded. */
export const RUNS_KEPT = 30;

const rowsOf = <T>(result: unknown): T[] => (Array.isArray(result) ? result : (result as { rows: T[] }).rows);

export async function readSettings(db: Db): Promise<AgentSettings> {
  const [row] = await db.select().from(agentSettings).where(eq(agentSettings.id, 1));
  return row ? { dishesPerDay: row.dishesPerDay, pauseAt: row.pauseAt, pagesPerRun: row.pagesPerRun } : AGENT_SETTINGS_DEFAULTS;
}

export async function saveSettings(db: Db, settings: AgentSettings, at: Date): Promise<AgentSettings> {
  await db
    .insert(agentSettings)
    .values({ id: 1, ...settings, updatedAt: at })
    .onConflictDoUpdate({ target: agentSettings.id, set: { ...settings, updatedAt: at } });
  return settings;
}

/**
 * Takes the run lock in ONE statement and returns the settings to run with, or null when another run
 * holds a lock that has not expired yet. The lock expires on its own at `until`.
 */
export async function takeRunLock(db: Db, at: Date, until: Date): Promise<AgentSettings | null> {
  const result = await db.execute(sql`
    INSERT INTO agent_settings (id, running_until) VALUES (1, ${until.toISOString()}::timestamptz)
    ON CONFLICT (id) DO UPDATE SET running_until = EXCLUDED.running_until
      WHERE agent_settings.running_until IS NULL OR agent_settings.running_until <= ${at.toISOString()}::timestamptz
    RETURNING dishes_per_day, pause_at, pages_per_run`);
  const [row] = rowsOf<{ dishes_per_day: number; pause_at: number; pages_per_run: number }>(result);
  return row ? { dishesPerDay: row.dishes_per_day, pauseAt: row.pause_at, pagesPerRun: row.pages_per_run } : null;
}

export async function releaseRunLock(db: Db): Promise<void> {
  await db.update(agentSettings).set({ runningUntil: null }).where(eq(agentSettings.id, 1));
}

export async function isRunning(db: Db, at: Date): Promise<boolean> {
  const [row] = await db.select({ until: agentSettings.runningUntil }).from(agentSettings).where(eq(agentSettings.id, 1));
  return Boolean(row?.until && row.until > at);
}

export async function listSeen(db: Db): Promise<SeenSource[]> {
  const rows = await db.select().from(agentSeenSources);
  return rows.map((row) => ({ url: row.url, outcome: row.outcome as SeenOutcome, failures: row.failures }));
}

/** Records what happened to each page; a `failed` page counts one more failure. */
export async function recordSeen(db: Db, pages: { url: string; sourceId: string; outcome: SeenOutcome }[], at: Date): Promise<void> {
  if (pages.length === 0) return;
  await db
    .insert(agentSeenSources)
    .values(
      pages.map((page) => ({
        ...page,
        failures: page.outcome === "failed" ? 1 : 0,
        firstProcessedAt: at,
        lastProcessedAt: at,
      })),
    )
    .onConflictDoUpdate({
      target: agentSeenSources.url,
      set: {
        outcome: sql`excluded.outcome`,
        failures: sql`CASE WHEN excluded.outcome = 'failed' THEN ${agentSeenSources.failures} + 1 ELSE ${agentSeenSources.failures} END`,
        lastProcessedAt: at,
      },
    });
}

type RunRow = typeof agentRuns.$inferSelect;

const toRun = (row: RunRow): AgentRun => ({
  id: row.id,
  trigger: row.trigger as AgentRun["trigger"],
  status: row.status as AgentRun["status"],
  skipped: row.skipped as AgentRun["skipped"],
  stoppedBy: row.stoppedBy as AgentRun["stoppedBy"],
  pagesRead: row.pagesRead,
  added: row.added,
  entries: row.entries as RunEntry[],
  startedAt: row.startedAt.toISOString(),
  finishedAt: row.finishedAt.toISOString(),
});

/** Stores the run, then drops all but the newest RUNS_KEPT. */
export async function recordRun(db: Db, run: AgentRun): Promise<void> {
  await db.insert(agentRuns).values({
    ...run,
    startedAt: new Date(run.startedAt),
    finishedAt: new Date(run.finishedAt),
  });
  await db.execute(sql`DELETE FROM agent_runs WHERE id NOT IN (
    SELECT id FROM agent_runs ORDER BY started_at DESC, id DESC LIMIT ${RUNS_KEPT}
  )`);
}

/** Newest first. */
export async function listRuns(db: Db): Promise<AgentRun[]> {
  const rows = await db.select().from(agentRuns).orderBy(desc(agentRuns.startedAt), desc(agentRuns.id)).limit(RUNS_KEPT);
  return rows.map(toRun);
}
