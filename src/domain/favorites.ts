import { formatDayMonth } from "./dates";
import { sortIdsByCategoryOrder } from "./menu";
import type { Dish, Favorite, MealType, Menu } from "./types";

export function defaultFavoriteName(date: string): string {
  return `Thực đơn ${formatDayMonth(date)}`;
}

export function createFavorite(menu: Menu, name: string, id: string, savedAt: number): Favorite {
  return {
    id,
    name: name.trim() || defaultFavoriteName(menu.date),
    dishIds: [...menu.dishIds],
    mealType: menu.mealType,
    savedAt,
  };
}

export function deleteFavorite(favorites: readonly Favorite[], id: string): Favorite[] {
  return favorites.filter((favorite) => favorite.id !== id);
}

/**
 * Turns a favorite into today's menu. Dishes that no longer resolve are dropped. Returns null when
 * none resolve. The legacy app did not store a meal type on favorites, so it is inferred.
 */
export function applyFavorite(
  favorite: Favorite,
  today: string,
  dishes: readonly Dish[],
): Menu | null {
  const byId = new Map(dishes.map((dish) => [dish.id, dish]));
  const resolved = favorite.dishIds
    .map((id) => byId.get(id))
    .filter((dish): dish is Dish => dish !== undefined);
  if (resolved.length === 0) return null;
  const mealType: MealType =
    favorite.mealType ??
    (resolved.every((dish) => dish.mealType === "buatomonuoc") ? "buatomonuoc" : "buacom");
  const dishIds =
    mealType === "buacom"
      ? sortIdsByCategoryOrder(
          resolved.map((dish) => dish.id),
          (id) => byId.get(id),
        )
      : resolved.map((dish) => dish.id).slice(0, 1);
  return dishIds.length === 0 ? null : { dishIds, date: today, mealType };
}
