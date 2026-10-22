import { eq, sql } from "drizzle-orm";
import type { Db } from "@/server/catalog/repository";
import { adminLoginAttempts } from "@/server/db/schema";

import { LOCK_MINUTES, MAX_FAILURES } from "@/shared/admin-policy";

/** When the client may try again, or null if it is not locked. */
export async function lockedUntil(db: Db, key: string, now: Date): Promise<Date | null> {
  const [row] = await db.select().from(adminLoginAttempts).where(eq(adminLoginAttempts.key, key));
  return row?.lockedUntil && row.lockedUntil > now ? row.lockedUntil : null;
}

/**
 * Counts one wrong password. A single statement, so many parallel guesses cannot slip past the limit
 * between a read and a write. Returns the lock time when this failure was the one that locked.
 */
export async function recordFailure(db: Db, key: string, now: Date): Promise<Date | null> {
  const at = now.toISOString();
  const until = new Date(now.getTime() + LOCK_MINUTES * 60_000).toISOString();
  const result = await db.execute(sql`
    INSERT INTO admin_login_attempts (key, failures, locked_until, updated_at)
    VALUES (${key}, 1, NULL, ${at}::timestamptz)
    ON CONFLICT (key) DO UPDATE SET
      failures = CASE
        WHEN admin_login_attempts.locked_until IS NOT NULL AND admin_login_attempts.locked_until <= ${at}::timestamptz THEN 1
        ELSE admin_login_attempts.failures + 1 END,
      locked_until = CASE
        WHEN (CASE WHEN admin_login_attempts.locked_until IS NOT NULL AND admin_login_attempts.locked_until <= ${at}::timestamptz THEN 1
                   ELSE admin_login_attempts.failures + 1 END) >= ${MAX_FAILURES}
          THEN ${until}::timestamptz
        WHEN admin_login_attempts.locked_until IS NOT NULL AND admin_login_attempts.locked_until <= ${at}::timestamptz THEN NULL
        ELSE admin_login_attempts.locked_until END,
      updated_at = ${at}::timestamptz
    RETURNING locked_until
  `);
  const rows = (Array.isArray(result) ? result : result.rows) as { locked_until: string | Date | null }[];
  const locked = rows[0]?.locked_until;
  return locked ? new Date(locked) : null;
}

export async function clearFailures(db: Db, key: string): Promise<void> {
  await db.delete(adminLoginAttempts).where(eq(adminLoginAttempts.key, key));
}
