import type { Dish } from "./types";

export interface ResolvedCatalog {
  /** Everything that can be looked up by id: used for history, favorites and today's menu. */
  resolvable: Dish[];
  /** What random may pick and what the dish bank lists: resolvable minus retired dishes. */
  pickable: Dish[];
}

/**
 * The Danh mục món as a device sees it: read-only, exactly what the server published. Retired dishes
 * still resolve, so old records stay readable, but are never picked or listed.
 */
export function resolveCatalog(catalog: readonly Dish[]): ResolvedCatalog {
  const resolvable = [...catalog];
  return { resolvable, pickable: resolvable.filter((dish) => !dish.retired) };
}
