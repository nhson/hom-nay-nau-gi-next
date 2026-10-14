import { formatDayMonth } from "./dates";
import type { ResolvedCatalog } from "./catalog";
import { isMenuCooked, latestHistory, resolveDishNames } from "./history";
import { sortIdsByCategoryOrder } from "./menu";
import type { PersonalState } from "./personal";
import { buildShoppingList, type ShoppingItem } from "./shopping";
import type { Dish, MealType, Menu } from "./types";

/** Today's dishes, resolved, in display order (fixed Xào -> Canh -> Món mặn for Bữa cơm 3 món). */
export function menuDishes(menu: Menu | null, resolvable: readonly Dish[]): Dish[] {
  if (!menu) return [];
  const byId = new Map(resolvable.map((dish) => [dish.id, dish]));
  const ids =
    menu.mealType === "buacom"
      ? sortIdsByCategoryOrder(menu.dishIds, (id) => byId.get(id))
      : menu.dishIds.filter((id) => byId.has(id));
  return ids.flatMap((id) => byId.get(id) ?? []);
}

export interface HistoryRow {
  date: string;
  /** dd/mm */
  label: string;
  names: string[];
  mealType: MealType;
}

export interface TodayView {
  menu: Menu | null;
  dishes: Dish[];
  shopping: ShoppingItem[];
  /** Today's recorded entry is exactly the menu on screen. */
  cooked: boolean;
  recent: HistoryRow[];
}

export function selectToday(state: PersonalState, catalog: ResolvedCatalog, today: string): TodayView {
  const dishes = menuDishes(state.todayMenu, catalog.resolvable);
  return {
    menu: state.todayMenu,
    dishes,
    shopping: buildShoppingList(dishes, state.ticks),
    cooked: isMenuCooked(state.history, state.todayMenu, today),
    recent: latestHistory(state.history).map((entry) => ({
      date: entry.date,
      label: formatDayMonth(entry.date),
      names: resolveDishNames(entry.dishIds, catalog.resolvable),
      mealType: entry.mealType,
    })),
  };
}
