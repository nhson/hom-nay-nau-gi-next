import { sql } from "drizzle-orm";
import { methodNotAllowed } from "@/server/api/responses";
import type { Db } from "@/server/catalog/repository";
import type { HealthResponse } from "@/shared/schemas";

export function createHealthHandlers(getDb: () => Db) {
  async function GET(): Promise<Response> {
    const headers = { "Cache-Control": "no-store" };
    try {
      await getDb().execute(sql`select 1`);
      const body: HealthResponse = { status: "ok", database: "up" };
      return Response.json(body, { headers });
    } catch {
      const body: HealthResponse = { status: "degraded", database: "down" };
      return Response.json(body, { status: 503, headers });
    }
  }

  const unsupported = () => methodNotAllowed(["GET", "HEAD"]);

  return { GET, POST: unsupported, PUT: unsupported, PATCH: unsupported, DELETE: unsupported };
}
