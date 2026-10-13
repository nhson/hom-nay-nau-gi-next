import type { Dish, HistoryEntry, Menu } from "./types";

export const HISTORY_CAP = 60;
export const HISTORY_VISIBLE = 7;
/** Shown for a history or favorite entry whose dish no longer resolves. */
export const MISSING_DISH_NAME = "(đã xoá)";

/**
 * Records `menu` as cooked on its date. Recording again on the same date replaces that day's entry
 * in place; a new date is added at the front. History is capped at HISTORY_CAP entries.
 */
export function recordCooked(history: readonly HistoryEntry[], menu: Menu): HistoryEntry[] {
  const entry: HistoryEntry = {
    date: menu.date,
    dishIds: [...menu.dishIds],
    mealType: menu.mealType,
  };
  const index = history.findIndex((existing) => existing.date === menu.date);
  const next =
    index === -1
      ? [entry, ...history]
      : history.map((existing, i) => (i === index ? entry : existing));
  return next.slice(0, HISTORY_CAP);
}

export function latestHistory(
  history: readonly HistoryEntry[],
  count: number = HISTORY_VISIBLE,
): HistoryEntry[] {
  return history.slice(0, count);
}

function sameIds(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  const sortedA = [...a].sort();
  const sortedB = [...b].sort();
  return sortedA.every((id, i) => id === sortedB[i]);
}

/** True when today's recorded entry is exactly the menu on screen. */
export function isMenuCooked(
  history: readonly HistoryEntry[],
  menu: Menu | null,
  today: string,
): boolean {
  if (!menu) return false;
  const entry = history.find((existing) => existing.date === today);
  return !!entry && entry.mealType === menu.mealType && sameIds(entry.dishIds, menu.dishIds);
}

export function resolveDishNames(ids: readonly string[], dishes: readonly Dish[]): string[] {
  const byId = new Map(dishes.map((dish) => [dish.id, dish.name]));
  return ids.map((id) => byId.get(id) ?? MISSING_DISH_NAME);
}
