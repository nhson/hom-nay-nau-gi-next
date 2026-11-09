import { errorResponse } from "@/server/api/responses";
import { secretsMatch } from "@/server/admin/session";
import type { Collector } from "./collector";

export interface CronDeps {
  /** CRON_SECRET. Null when it is not set: then the cron route refuses everyone. */
  getSecret: () => string | null;
  getCollector: () => Collector;
}

const noStore = { "Cache-Control": "no-store" };

/**
 * The daily run (Vercel cron, 22:00 UTC). Outside the admin session: Vercel sends
 * `Authorization: Bearer <CRON_SECRET>`, and nothing else may start a run this way.
 */
export function createCronHandlers(deps: CronDeps) {
  async function collect(request: Request): Promise<Response> {
    const secret = deps.getSecret();
    const header = request.headers.get("authorization") ?? "";
    if (!secret || !secretsMatch(header, `Bearer ${secret}`)) {
      return errorResponse(401, "unauthorized", "This route is for the scheduled run only.");
    }
    try {
      const outcome = await deps.getCollector().run("cron");
      if (!outcome.ok) return errorResponse(409, "agent_running", "A run is already going.");
      return Response.json({ run: outcome.run }, { headers: noStore });
    } catch (error) {
      console.error("cron run failed", error);
      return errorResponse(500, "internal_error", "Something went wrong.");
    }
  }
  return { collect };
}

export function readCronSecret(env: Record<string, string | undefined> = process.env): string | null {
  return env.CRON_SECRET?.trim() || null;
}
