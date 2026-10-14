import type { Dish } from "@/domain";
import { SEED_DISHES } from "@/seed/dishes";
import { catalogResponseSchema } from "@/shared/schemas";
import { idbGet, idbSet } from "./idb";

const KEY = "catalog";
export const CATALOG_URL = "/api/v1/catalog";

export interface CachedCatalog {
  version: number;
  etag: string | null;
  dishes: Dish[];
}

/** What the app boots with before (or without) any network: the bundled seed. */
export const BUNDLED_CATALOG: CachedCatalog = {
  version: 0,
  etag: null,
  dishes: [...SEED_DISHES],
};

function parseCached(value: unknown): CachedCatalog | null {
  const parsed = catalogResponseSchema.safeParse(value);
  if (!parsed.success || parsed.data.dishes.length === 0) return null;
  const etag =
    typeof value === "object" && value !== null && "etag" in value && typeof value.etag === "string"
      ? value.etag
      : null;
  return { version: parsed.data.version, etag, dishes: parsed.data.dishes };
}

/** The last catalog fetched from the server, else the bundled seed. Never throws. */
export async function loadCatalog(): Promise<CachedCatalog> {
  try {
    return parseCached(await idbGet(KEY)) ?? BUNDLED_CATALOG;
  } catch {
    return BUNDLED_CATALOG;
  }
}

export type RefreshResult =
  | { status: "updated"; catalog: CachedCatalog }
  | { status: "unchanged" }
  | { status: "failed" };

/**
 * Asks the server for a newer catalog (conditional on the cached ETag). Anything unexpected,
 * including a payload that fails validation, is a silent "failed": the cached catalog stays.
 */
export async function refreshCatalog(
  current: CachedCatalog,
  fetchImpl: typeof fetch = fetch,
): Promise<RefreshResult> {
  try {
    const response = await fetchImpl(CATALOG_URL, {
      headers: current.etag ? { "If-None-Match": current.etag } : {},
    });
    if (response.status === 304) return { status: "unchanged" };
    if (!response.ok) return { status: "failed" };
    const parsed = catalogResponseSchema.safeParse(await response.json());
    if (!parsed.success || parsed.data.dishes.length === 0) return { status: "failed" };
    if (parsed.data.version < current.version) return { status: "failed" };
    const catalog: CachedCatalog = {
      version: parsed.data.version,
      etag: response.headers.get("etag"),
      dishes: parsed.data.dishes,
    };
    return { status: "updated", catalog };
  } catch {
    return { status: "failed" };
  }
}

export function saveCatalog(catalog: CachedCatalog): Promise<boolean> {
  return idbSet(KEY, catalog);
}
