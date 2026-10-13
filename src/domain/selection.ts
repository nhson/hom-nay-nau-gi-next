import type { Category, Dish, MealType, Rng } from "./types";

/** Fixed display order of a Bữa cơm 3 món: Xào/Luộc/Salad -> Canh -> Món mặn. */
export const CATEGORY_ORDER: readonly Category[] = ["xao", "canh", "man"];

export interface DishFilters {
  mealType?: MealType;
  category?: Category;
  chay?: boolean;
}

export function filterDishes(dishes: readonly Dish[], filters: DishFilters = {}): Dish[] {
  const { mealType, category, chay } = filters;
  return dishes.filter((dish) => {
    if (mealType && dish.mealType !== mealType) return false;
    if (category && dish.category !== category) return false;
    if (chay && !dish.chay) return false;
    return true;
  });
}

/**
 * Picks a dish, preferring ones not in `avoidIds`. If everything is avoided, falls back to the
 * whole pool. Returns null only for an empty pool.
 */
export function pickRandom(
  pool: readonly Dish[],
  avoidIds: readonly string[] = [],
  rng: Rng = Math.random,
): Dish | null {
  if (pool.length === 0) return null;
  const avoid = new Set(avoidIds);
  const fresh = pool.filter((dish) => !avoid.has(dish.id));
  const candidates = fresh.length > 0 ? fresh : pool;
  const index = Math.min(candidates.length - 1, Math.floor(rng() * candidates.length));
  return candidates[index];
}

export type BuaComPicks = Record<Category, Dish | null>;

export interface BuaComOptions {
  chay?: boolean;
  avoidIdsByCategory?: Partial<Record<Category, readonly string[]>>;
  rng?: Rng;
}

/** One dish per Nhóm món; a group is null when no dish matches the filters. */
export function buildBuaComMenu(dishes: readonly Dish[], options: BuaComOptions = {}): BuaComPicks {
  const { chay, avoidIdsByCategory = {}, rng } = options;
  const picks: BuaComPicks = { xao: null, canh: null, man: null };
  for (const category of CATEGORY_ORDER) {
    const pool = filterDishes(dishes, { mealType: "buacom", category, chay });
    picks[category] = pickRandom(pool, avoidIdsByCategory[category] ?? [], rng);
  }
  return picks;
}

export interface MonNuocOptions {
  chay?: boolean;
  avoidId?: string;
  rng?: Rng;
}

export function pickMonNuoc(dishes: readonly Dish[], options: MonNuocOptions = {}): Dish | null {
  const { chay, avoidId, rng } = options;
  const pool = filterDishes(dishes, { mealType: "buatomonuoc", chay });
  return pickRandom(pool, avoidId ? [avoidId] : [], rng);
}
