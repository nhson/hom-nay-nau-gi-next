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

/** The numbers on Tổng quan: shown and hidden dishes, and the shown ones per Nhóm món and for Bữa 1 món. */
export interface CatalogCounts {
  shown: number;
  hidden: number;
  xao: number;
  canh: number;
  man: number;
  buatomonuoc: number;
}

export function catalogCounts(dishes: readonly Pick<Dish, "mealType" | "category" | "retired">[]): CatalogCounts {
  const counts: CatalogCounts = { shown: 0, hidden: 0, xao: 0, canh: 0, man: 0, buatomonuoc: 0 };
  for (const item of dishes) {
    if (item.retired) {
      counts.hidden++;
      continue;
    }
    counts.shown++;
    if (item.mealType === "buatomonuoc") counts.buatomonuoc++;
    else if (item.category) counts[item.category]++;
  }
  return counts;
}
