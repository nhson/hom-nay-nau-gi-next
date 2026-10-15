import { daysBetween } from "./dates";
import { buildBuaComMenu, CATEGORY_ORDER, filterDishes, pickRandom } from "./selection";
import type { Category, Dish, HistoryEntry, Menu, Rng } from "./types";

/** Dishes cooked within this many calendar days (today included) are avoided when picking. */
export const RECENT_DAYS = 4;

export function recentDishIds(
  history: readonly HistoryEntry[],
  today: string,
  days: number = RECENT_DAYS,
): string[] {
  const ids = new Set<string>();
  for (const entry of history) {
    // NaN (malformed date) fails the comparison and is ignored.
    if (daysBetween(entry.date, today) < days) {
      for (const id of entry.dishIds) ids.add(id);
    }
  }
  return [...ids];
}

/** Orders a Bữa cơm 3 món's ids Xào -> Canh -> Món mặn. Unresolvable ids are dropped. */
export function sortIdsByCategoryOrder(
  ids: readonly string[],
  resolve: (id: string) => Dish | undefined,
): string[] {
  const dishes = ids.map(resolve).filter((dish): dish is Dish => dish !== undefined);
  const ordered: string[] = [];
  for (const category of CATEGORY_ORDER) {
    const dish = dishes.find((candidate) => candidate.category === category);
    if (dish) ordered.push(dish.id);
  }
  return ordered;
}

/** True when there is no menu or it was generated on an earlier day. */
export function isMenuStale(menu: Menu | null, today: string): boolean {
  return menu === null || menu.date !== today;
}

/** True when the menu names a dish that cannot be resolved at all (retired dishes still resolve). */
export function hasMissingDish(menu: Menu | null, resolvable: readonly Dish[]): boolean {
  if (!menu) return false;
  const known = new Set(resolvable.map((dish) => dish.id));
  return menu.dishIds.some((id) => !known.has(id));
}

export interface MenuOptions {
  chay?: boolean;
  rng?: Rng;
}

export interface GeneratedMenu {
  menu: Menu;
  /** Nhóm món with no matching dish (for example no Chay Canh). */
  missing: Category[];
}

/** `dishes` must already be the pickable set (hidden and retired dishes removed). */
export function generateBuaComMenu(
  dishes: readonly Dish[],
  history: readonly HistoryEntry[],
  today: string,
  options: MenuOptions = {},
): GeneratedMenu {
  const recent = recentDishIds(history, today);
  const picks = buildBuaComMenu(dishes, {
    chay: options.chay,
    rng: options.rng,
    avoidIdsByCategory: { xao: recent, canh: recent, man: recent },
  });
  const dishIds: string[] = [];
  const missing: Category[] = [];
  for (const category of CATEGORY_ORDER) {
    const pick = picks[category];
    if (pick) dishIds.push(pick.id);
    else missing.push(category);
  }
  return { menu: { dishIds, date: today, mealType: "buacom" }, missing };
}

/** A Bữa 1 món menu, or null when no Bữa 1 món dish matches the filters. */
export function generateMonNuocMenu(
  dishes: readonly Dish[],
  history: readonly HistoryEntry[],
  today: string,
  options: MenuOptions = {},
): Menu | null {
  const pool = filterDishes(dishes, { mealType: "buatomonuoc", chay: options.chay });
  const pick = pickRandom(pool, recentDishIds(history, today), options.rng);
  return pick ? { dishIds: [pick.id], date: today, mealType: "buatomonuoc" } : null;
}

export type RerollResult =
  | { ok: true; menu: Menu }
  | { ok: false; reason: "no-alternative" | "not-applicable" };

/**
 * Replaces one Nhóm món's dish. The new dish always differs from the current one when the group
 * has an alternative, and the menu keeps the fixed Xào -> Canh -> Món mặn order.
 */
export function rerollSlot(
  menu: Menu,
  category: Category,
  dishes: readonly Dish[],
  history: readonly HistoryEntry[],
  options: MenuOptions = {},
): RerollResult {
  if (menu.mealType !== "buacom") return { ok: false, reason: "not-applicable" };
  const byId = new Map(dishes.map((dish) => [dish.id, dish]));
  const current = menu.dishIds
    .map((id) => byId.get(id))
    .filter((dish): dish is Dish => dish !== undefined);
  const currentInGroup = current.find((dish) => dish.category === category);
  const pool = filterDishes(dishes, { mealType: "buacom", category, chay: options.chay }).filter(
    (dish) => dish.id !== currentInGroup?.id,
  );
  const next = pickRandom(pool, recentDishIds(history, menu.date), options.rng);
  if (!next) return { ok: false, reason: "no-alternative" };
  const kept = current.filter((dish) => dish.category !== category);
  const ids = sortIdsByCategoryOrder([...kept.map((dish) => dish.id), next.id], (id) =>
    id === next.id ? next : byId.get(id),
  );
  return { ok: true, menu: { ...menu, dishIds: ids } };
}

export function rerollMonNuoc(
  menu: Menu,
  dishes: readonly Dish[],
  history: readonly HistoryEntry[],
  options: MenuOptions = {},
): RerollResult {
  if (menu.mealType !== "buatomonuoc") return { ok: false, reason: "not-applicable" };
  const pool = filterDishes(dishes, { mealType: "buatomonuoc", chay: options.chay }).filter(
    (dish) => !menu.dishIds.includes(dish.id),
  );
  const next = pickRandom(pool, recentDishIds(history, menu.date), options.rng);
  if (!next) return { ok: false, reason: "no-alternative" };
  return { ok: true, menu: { ...menu, dishIds: [next.id] } };
}
