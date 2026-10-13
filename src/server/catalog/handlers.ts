import { errorResponse, methodNotAllowed } from "@/server/api/responses";
import { catalogResponseSchema } from "@/shared/schemas";
import { readCatalog, type Db } from "./repository";

export const CATALOG_CACHE_CONTROL =
  "public, max-age=0, s-maxage=300, stale-while-revalidate=86400";

export function catalogEtag(version: number): string {
  return `"catalog-v${version}"`;
}

/** True when an If-None-Match header (a list of tags, possibly weak, or *) covers `etag`. */
export function etagMatches(header: string | null, etag: string): boolean {
  if (!header) return false;
  if (header.trim() === "*") return true;
  return header
    .split(",")
    .map((tag) => tag.trim().replace(/^W\//, ""))
    .includes(etag);
}

/**
 * Route Handlers take a Request and return a Response, so tests (and the thin files under
 * src/app/api) call exactly this code. The database is injected.
 */
export function createCatalogHandlers(getDb: () => Db) {
  async function GET(request: Request): Promise<Response> {
    try {
      const catalog = await readCatalog(getDb());
      if (!catalog) {
        return errorResponse(503, "catalog_unavailable", "The catalog has not been published yet.");
      }
      const etag = catalogEtag(catalog.version);
      const headers = { ETag: etag, "Cache-Control": CATALOG_CACHE_CONTROL };
      if (etagMatches(request.headers.get("if-none-match"), etag)) {
        return new Response(null, { status: 304, headers });
      }
      const body = catalogResponseSchema.parse(catalog);
      return Response.json(body, { headers });
    } catch (error) {
      console.error("catalog GET failed", error);
      return errorResponse(500, "internal_error", "Something went wrong. Please try again.");
    }
  }

  const unsupported = () => methodNotAllowed(["GET", "HEAD"]);

  return { GET, POST: unsupported, PUT: unsupported, PATCH: unsupported, DELETE: unsupported };
}
