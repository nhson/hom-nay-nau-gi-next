import { formatDayMonth } from "./dates";
import type { ResolvedCatalog } from "./catalog";
import { isMenuCooked, latestHistory, resolveDishNames } from "./history";
import { sortIdsByCategoryOrder } from "./menu";
import type { PersonalState } from "./personal";
import { CATEGORY_ORDER } from "./selection";
import { buildShoppingList, type ShoppingItem } from "./shopping";
import type { Category, Dish, MealType, Menu } from "./types";

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

export type BankFilter = "all" | Category | "buatomonuoc";

const BANK_GROUP_ORDER: readonly string[] = [...CATEGORY_ORDER, "buatomonuoc"];

function bankGroup(dish: Dish): number {
  return BANK_GROUP_ORDER.indexOf(dish.category ?? "buatomonuoc");
}

/** Lower-case, accent-free text so "canh chua" finds "Canh Chua" and "ca loc" finds "cá lóc". */
export function foldText(text: string): string {
  return text.normalize("NFD").replace(/\p{M}/gu, "").replace(/đ/g, "d").replace(/Đ/g, "d").toLowerCase().trim();
}

/** The dish bank: pickable dishes, filtered, sorted by group then name (Vietnamese collation). */
export function selectDishBank(
  catalog: ResolvedCatalog,
  filter: BankFilter,
  chayOnly: boolean,
  query = "",
): Dish[] {
  const needle = foldText(query);
  return catalog.pickable
    .filter((dish) => {
      if (chayOnly && !dish.chay) return false;
      if (needle !== "" && !foldText(dish.name).includes(needle)) return false;
      if (filter === "all") return true;
      if (filter === "buatomonuoc") return dish.mealType === "buatomonuoc";
      return dish.category === filter;
    })
    .sort((a, b) => bankGroup(a) - bankGroup(b) || a.name.localeCompare(b.name, "vi"));
}

export interface FavoriteRow {
  id: string;
  name: string;
  dishNames: string[];
  mealType: MealType | undefined;
  /** At least one of its dishes still exists, so it can be applied. */
  usable: boolean;
}

export function selectFavorites(state: PersonalState, catalog: ResolvedCatalog): FavoriteRow[] {
  const ids = new Set(catalog.resolvable.map((dish) => dish.id));
  return state.favorites.map((favorite) => ({
    id: favorite.id,
    name: favorite.name,
    dishNames: resolveDishNames(favorite.dishIds, catalog.resolvable),
    mealType: favorite.mealType,
    usable: favorite.dishIds.some((id) => ids.has(id)),
  }));
}
